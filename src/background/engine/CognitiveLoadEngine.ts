import type { BRIResult, LoadLevel, PageComplexitySnapshot } from './types'
import type { UrlCategory } from '../../models/types'
import { calculateCognitiveLoad } from './CognitiveLoadCalculator'
import { calculatePhysicalFatigue, type RestState } from './PhysicalFatigueCalculator'
import { personalCalibration } from './PersonalCalibration'
import { dataQualityGate } from './DataQualityGate'
import { briHistoryBuffer } from './BRIHistoryBuffer'
import { triggerEngine } from './TriggerEngine'
import { sessionTracker } from './SessionTracker'
import { calculateEyeHandDelay } from '../helper/MouseTrackAnalyzer'
import type { Event } from '../../models/events/Event'
import type { FullscreenChange } from '../../models/events/FullscreenChange'
import { urlCategoryDB } from '../../services/UrlCategoryDataBaseManager'

/* ------------------------------------------------------------------ */
/* 常量                                                               */
/* ------------------------------------------------------------------ */

/** 宏观 tick 周期：30s */
const TICK_MINUTE = 0.5

/** 平滑系数 α（一阶低通滤波） */
const SMOOTHING_ALPHA = 0.25

const ALARM_NAME = 'brainrest-engine-tick'

/** 归入"用户主动交互"的事件类型 */
const INTERACTION_TYPES = new Set<string>([
    'click',
    'mousemove',
    'scroll',
    'keydown',
    'keyup',
    'touchstart',
    'touchmove',
    'touchend',
])

/* ------------------------------------------------------------------ */
/* 工具函数                                                           */
/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

function levelOf(briDisplay: number): LoadLevel {
    if (briDisplay >= 70) return 'high'
    if (briDisplay >= 40) return 'moderate'
    return 'low'
}

/* ------------------------------------------------------------------ */
/* 主引擎                                                             */
/* ------------------------------------------------------------------ */

/**
 * BrainRest Cognitive Load Engine
 *
 * 纯计算引擎：每 30s tick 一次，持续输出 BRIResult。
 * 触发路径评估结果附带在 BRIResult.triggerPath 中（null = 未触发），
 * 数值如何利用（弹窗、通知、建议等）由前端决定。
 */
class CognitiveLoadEngine {
    private static instance: CognitiveLoadEngine | null = null

    /** 上一周期的 BRI_display */
    private prevBriDisplay = 0

    /** 最近一次计算结果 */
    private lastResult: BRIResult | null = null

    /** 最新的页面复杂度快照 */
    private latestComplexity: PageComplexitySnapshot | null = null

    /** 当前活跃标签页的 URL（用于查询页面类型） */
    private currentUrl: string = ''

    /** 当前页面类型缓存 */
    private currentPageType: UrlCategory | null = null

    /** 最新有效样本时间戳 */
    private latestSampleAt = Date.now()

    /* --- 活跃度 / 休息状态 --- */
    private lastActivityAt = Date.now()
    private isFocused = true
    private lastBlurAt: number | null = null
    private videoFullscreen = false
    private deviceLocked = false

    private constructor() {}

    static getInstance(): CognitiveLoadEngine {
        if (!CognitiveLoadEngine.instance) {
            CognitiveLoadEngine.instance = new CognitiveLoadEngine()
        }
        return CognitiveLoadEngine.instance
    }

    /* ---------------------------------------------------------------- */
    /* 生命周期                                                         */
    /* ---------------------------------------------------------------- */

    async start(): Promise<void> {
        const alarm = await chrome.alarms.get(ALARM_NAME)
        if (!alarm) {
            await chrome.alarms.create(ALARM_NAME, {
                periodInMinutes: TICK_MINUTE,
            })
            chrome.alarms.onAlarm.addListener((alarm) => {
                if (alarm.name === ALARM_NAME) {
                    this.tick()
                }
            })
        }
    }

    async stop(): Promise<void> {
        await chrome.alarms.clear(ALARM_NAME)
    }

    /* ---------------------------------------------------------------- */
    /* 外部状态注入（由 service-worker / listener 调用）                  */
    /* ---------------------------------------------------------------- */

    setVideoFullscreen(active: boolean): void {
        this.videoFullscreen = active
    }

    setDeviceLocked(locked: boolean): void {
        this.deviceLocked = locked
        sessionTracker.setLocked(locked)
    }

    setWindowFocused(focused: boolean): void {
        this.isFocused = focused
        if (!focused) {
            this.lastBlurAt = Date.now()
        } else {
            this.lastBlurAt = null
        }
        sessionTracker.setFocused(focused)
    }

    /** 接收页面复杂度快照（由 service-worker 从 port 消息转发） */
    receivePageComplexity(snapshot: PageComplexitySnapshot): void {
        this.latestComplexity = snapshot
        this.latestSampleAt = snapshot.timestamp
        dataQualityGate.recordSample(snapshot.timestamp)
    }

    /** 接收事件流（由 service-worker 从 port 消息转发） */
    receiveEvent(event: Event): void {
        // 更新活跃度状态
        if (INTERACTION_TYPES.has(event.type)) {
            if (event.timestamp > this.lastActivityAt) {
                this.lastActivityAt = event.timestamp
            }
        }

        // 更新焦点状态
        if (event.type === 'focus') {
            this.setWindowFocused(true)
        } else if (event.type === 'blur') {
            this.setWindowFocused(false)
        }

        // 更新全屏状态
        if (event.type === 'fullscreen_change') {
            const fsEvent = event as FullscreenChange
            this.setVideoFullscreen(fsEvent.active)
        }

        // 更新当前 URL
        if (event.url) {
            this.currentUrl = event.url
        }

        // 记录有效采样
        this.latestSampleAt = event.timestamp
        dataQualityGate.recordSample(event.timestamp)
    }

    /* ---------------------------------------------------------------- */
    /* 数据查询（前端消费入口）                                          */
    /* ---------------------------------------------------------------- */

    /** 获取最近一次计算结果（每 30s 更新一次） */
    getLastResult(): BRIResult | null {
        return this.lastResult
    }

    /* ---------------------------------------------------------------- */
    /* 核心 tick                                                        */
    /* ---------------------------------------------------------------- */

    private async tick(): Promise<void> {
        // 0. 更新页面类型缓存
        await this.refreshPageType()

        // 1. 数据质量门控
        const cData = dataQualityGate.getCoverage()
        if (cData < 0.7) {
            // 数据不足：输出状态但不更新 BRI_display
            this.lastResult = {
                clCog: 0,
                clPhy: 0,
                briRaw: 0,
                bri: 0,
                briDisplay: this.prevBriDisplay,
                kPersonal: personalCalibration.getK(),
                cData,
                level: 'insufficient_data',
                triggerPath: null,
                cognitiveSignals: { D: 0, B: 0, rho: 0, S: 0, P: 0, T: 0 },
                physicalSignals: { E: 0, L: 0, I: 0, R: 0, R_rest: 0 },
                timestamp: Date.now(),
                pageType: this.currentPageType,
            }
            return
        }

        // 2. 计算 CL_cog
        const { clCog, signals: cognitiveSignals } = calculateCognitiveLoad(
            this.currentPageType,
            this.latestComplexity,
        )

        // 3. 计算 CL_phy
        const restState: RestState = {
            videoFullscreen: this.videoFullscreen,
            deviceLocked: this.deviceLocked,
            isFocused: this.isFocused,
            lastBlurAt: this.lastBlurAt,
            lastActivityAt: this.lastActivityAt,
        }
        const { clPhy, signals: physicalSignals } = calculatePhysicalFatigue(restState)

        // 4. 融合：BRI_raw = min(max(CL_cog, CL_phy) + 0.30 × min(CL_cog, CL_phy), 100)
        const briRaw = clamp(Math.max(clCog, clPhy) + 0.3 * Math.min(clCog, clPhy), 0, 100)

        // 5. 校准：BRI = BRI_raw × k_personal
        const kPersonal = personalCalibration.getK()
        const bri = briRaw * kPersonal

        // 6. 平滑：BRI_display(t) = 0.25 × min(BRI(t), 100) + 0.75 × BRI_display(t-1)
        const briDisplay = clamp(
            SMOOTHING_ALPHA * Math.min(bri, 100) + (1 - SMOOTHING_ALPHA) * this.prevBriDisplay,
            0,
            100,
        )
        this.prevBriDisplay = briDisplay

        // 7. 存入 BRIHistoryBuffer（供路径 A/B 判定）
        briHistoryBuffer.push(briDisplay)

        // 8. 触发路径评估（仅作为数据输出，如何利用由前端决定）
        const eyeHandDelayMs = calculateEyeHandDelay()
        const triggerPath = triggerEngine.check({
            clCog,
            clPhy,
            physicalSignals,
            cData,
            latestSampleAt: this.latestSampleAt,
            eyeHandDelayMs,
        })

        // 9. 构建结果
        this.lastResult = {
            clCog,
            clPhy,
            briRaw,
            bri,
            briDisplay,
            kPersonal,
            cData,
            level: levelOf(briDisplay),
            triggerPath,
            cognitiveSignals,
            physicalSignals,
            timestamp: Date.now(),
            pageType: this.currentPageType,
        }

        // 10. 定期自动校准检查（内部有 7 天间隔保护）
        void personalCalibration.checkAutoCalibration([])
    }

    /* ---------------------------------------------------------------- */
    /* 页面类型刷新                                                      */
    /* ---------------------------------------------------------------- */

    private async refreshPageType(): Promise<void> {
        if (!this.currentUrl) return

        try {
            const domain = new URL(this.currentUrl).hostname.toLowerCase().replace(/^www\./, '')
            const category = await urlCategoryDB.lookupCategory(domain)
            this.currentPageType = category ?? null
        } catch {
            // URL 解析失败保持上次值
        }
    }
}

/** 全局唯一实例 */
export const engine = CognitiveLoadEngine.getInstance()

export default engine
