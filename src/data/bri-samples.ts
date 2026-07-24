import type { BRIResult } from '../background/engine/types'

/** 一条样例：场景说明 + 完整 BRIResult 输入 */
export interface BriResultSample {
    /** 场景说明 */
    scenario: string
    /** 样例 BRIResult（作为 buildRestSuggestion 的输入） */
    result: BRIResult
}

/** 构造一个 BRIResult，仅覆盖关心的字段，其余取默认 */
function makeBri(overrides: Partial<BRIResult>): BRIResult {
    return {
        clCog: 0,
        clPhy: 0,
        briRaw: 0,
        bri: 0,
        briDisplay: 0,
        kPersonal: 1,
        cData: 1,
        level: 'high',
        triggerPath: null,
        pageType: null,
        cognitiveSignals: { D: 0, B: 0, rho: 0, S: 0, P: 0, T: 0 },
        physicalSignals: { E: 0, L: 0, I: 0, R: 0, R_rest: 0 },
        timestamp: Date.now(),
        ...overrides,
    }
}

/**
 * 样例 BRIResult 输入集合。
 *
 * 供 Debug 页载入后走 buildRestSuggestion 真实生成路径，观察 RestSuggestion 输出。
 */
export const sampleBriResults: BriResultSample[] = [
    {
        scenario: '路径A · 深度工作（命中页面类型）',
        result: makeBri({
            triggerPath: 'A',
            pageType: 'deep_work_productivity',
            clCog: 85,
            briDisplay: 82,
        }),
    },
    {
        scenario: '路径A · 长文阅读（眼疲劳）',
        result: makeBri({
            triggerPath: 'A',
            pageType: 'longform_deep_reading',
            clCog: 80,
            briDisplay: 78,
        }),
    },
    {
        scenario: '路径B · 信息流（被动累积）',
        result: makeBri({
            triggerPath: 'B',
            pageType: 'social_feed',
            level: 'moderate',
            briDisplay: 55,
        }),
    },
    {
        scenario: '路径C · 竞技游戏（神经肌肉疲劳）',
        result: makeBri({
            triggerPath: 'C',
            pageType: 'competitive_progression_games',
            clPhy: 78,
            physicalSignals: { E: 65, L: 60, I: 40, R: 30, R_rest: 0 },
        }),
    },
    {
        scenario: '路径C · 无页面类型（回退路径基调，时长为区间）',
        result: makeBri({
            triggerPath: 'C',
            pageType: null,
            clPhy: 75,
        }),
    },
    {
        scenario: '未触发（triggerPath 为 null，不提醒）',
        result: makeBri({
            triggerPath: null,
            pageType: 'deep_work_productivity',
            level: 'low',
            briDisplay: 20,
        }),
    },
]
