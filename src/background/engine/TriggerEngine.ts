import type {PhysicalSignals, TriggerPath} from "./types";
import {briHistoryBuffer} from "./BRIHistoryBuffer";
import {sessionTracker} from "./SessionTracker";

/* ------------------------------------------------------------------ */
/* 常量                                                               */
/* ------------------------------------------------------------------ */

/** 硬门槛：有效前台时长 >= 30 min */
const MIN_FRONT_MINUTES = 30;

/** 硬门槛：数据新鲜度，最新样本距现在 < 120s */
const MAX_SAMPLE_AGE_MS = 120_000;

/** 硬门槛：冷却期，距上次命中 >= 30 min */
const COOLDOWN_MS = 30 * 60 * 1000;

/** 路径 A：BRI_display 高负荷阈值 */
const PATH_A_THRESHOLD = 70;
/** 路径 A：评估窗口 (min) */
const PATH_A_WINDOW_MIN = 30;
/** 路径 A：累计高负荷时长阈值 (min) */
const PATH_A_DURATION_MIN = 20;

/** 路径 B：AUC 积分阈值 (score·min) */
const PATH_B_AUC_THRESHOLD = 4000;
/** 路径 B：评估窗口 (min) */
const PATH_B_WINDOW_MIN = 60;

/** 路径 C：CL_phy 阈值 */
const PATH_C_CL_PHY_THRESHOLD = 70;
/** 路径 C：轨迹熵 E 阈值 */
const PATH_C_E_THRESHOLD = 60;
/** 路径 C：眼-手延迟阈值 (ms) */
const PATH_C_EYE_HAND_DELAY_MS = 300;
/** 路径 C：连续操作时长阈值 (min) */
const PATH_C_DURATION_MIN = 15;

/* ------------------------------------------------------------------ */
/* 触发引擎                                                            */
/* ------------------------------------------------------------------ */

export interface TriggerCheckInput {
    /** 认知负荷子指数 */
    clCog: number;
    /** 身体疲劳子指数 */
    clPhy: number;
    /** 身体信号明细 */
    physicalSignals: PhysicalSignals;
    /** 数据覆盖率 */
    cData: number;
    /** 最新样本时间戳（用于数据新鲜度检查） */
    latestSampleAt: number;
    /** 眼-手延迟原始值 (ms)，null 表示无有效数据 */
    eyeHandDelayMs: number | null;
}

/**
 * 休息触发引擎。
 *
 * 硬门槛（必须同时满足）+ 三条触发路径（满足任一即命中）。
 * 仅做数值评估，命中结果附带在 BRIResult.triggerPath 中输出，
 * 如何响应（提醒、弹窗等）由前端决定。
 */
export class TriggerEngine {
    /** 上次命中时间戳 */
    private lastTriggeredAt = 0;

    /**
     * 评估触发条件。
     *
     * @returns 命中的触发路径，null 表示未命中
     */
    check(input: TriggerCheckInput): TriggerPath | null {
        const {latestSampleAt, eyeHandDelayMs, cData} = input;
        const now = Date.now();

        // ---- 硬门槛检查 ----

        // 1. 有效前台时长 >= 30 min
        if (sessionTracker.getFrontMinutes() < MIN_FRONT_MINUTES) {
            return null;
        }

        // 2. 数据新鲜度：最新样本距现在 < 120s
        if (now - latestSampleAt > MAX_SAMPLE_AGE_MS) {
            return null;
        }

        // 3. 数据覆盖率 >= 0.70
        if (cData < 0.7) {
            return null;
        }

        // 4. 冷却期：距上次命中 >= 30 min
        if (now - this.lastTriggeredAt < COOLDOWN_MS) {
            return null;
        }

        // ---- 触发路径检查 ----

        // 路径 A：持续高负荷
        if (this.checkPathA()) {
            this.lastTriggeredAt = now;
            return "A";
        }

        // 路径 B：累积等效负荷（AUC 积分）
        if (this.checkPathB()) {
            this.lastTriggeredAt = now;
            return "B";
        }

        // 路径 C：神经肌肉疲劳信号
        if (this.checkPathC(input, eyeHandDelayMs)) {
            this.lastTriggeredAt = now;
            return "C";
        }

        return null;
    }

    /** 重置冷却（如前端确认用户已休息） */
    resetCooldown(): void {
        this.lastTriggeredAt = 0;
    }

    /* ---------------------------------------------------------------- */
    /* 路径 A：持续高负荷                                                */
    /* ---------------------------------------------------------------- */

    private checkPathA(): boolean {
        const highLoadDuration = briHistoryBuffer.getHighLoadDuration(
            PATH_A_THRESHOLD,
            PATH_A_WINDOW_MIN,
        );
        return highLoadDuration >= PATH_A_DURATION_MIN;
    }

    /* ---------------------------------------------------------------- */
    /* 路径 B：累积等效负荷（AUC 积分）                                  */
    /* ---------------------------------------------------------------- */

    private checkPathB(): boolean {
        const auc = briHistoryBuffer.getAUC(PATH_B_WINDOW_MIN);
        return auc >= PATH_B_AUC_THRESHOLD;
    }

    /* ---------------------------------------------------------------- */
    /* 路径 C：神经肌肉疲劳信号                                          */
    /* ---------------------------------------------------------------- */

    private checkPathC(
        input: TriggerCheckInput,
        eyeHandDelayMs: number | null,
    ): boolean {
        const {clPhy, physicalSignals} = input;

        return (
            clPhy >= PATH_C_CL_PHY_THRESHOLD &&
            physicalSignals.E >= PATH_C_E_THRESHOLD &&
            eyeHandDelayMs !== null &&
            eyeHandDelayMs >= PATH_C_EYE_HAND_DELAY_MS &&
            sessionTracker.getFrontMinutes() >= PATH_C_DURATION_MIN
        );
    }
}

/** 全局唯一实例 */
export const triggerEngine = new TriggerEngine();
