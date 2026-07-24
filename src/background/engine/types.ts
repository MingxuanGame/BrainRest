import type { UrlCategory } from "../../models/types";

/* ------------------------------------------------------------------ */
/* 页面复杂度快照（Content Script 每 30s 上报）                        */
/* ------------------------------------------------------------------ */

export interface PageComplexitySnapshot {
    /** 可视区域文字字符数 / 视口面积 (chars·px⁻²) */
    textDensity: number;
    /** 页面表格元素数量 */
    tableCount: number;
    /** 页面代码块元素数量 */
    codeCount: number;
    /** 页面列表元素数量 */
    listCount: number;
    /** 页面标题元素数量 */
    headingCount: number;
    /** 采集时间戳 (ms) */
    timestamp: number;
}

/* ------------------------------------------------------------------ */
/* 认知负荷信号（标准化后，均 0-100）                                  */
/* ------------------------------------------------------------------ */

export interface CognitiveSignals {
    /** D 时长得分 */
    D: number;
    /** B 页面类型基线 */
    B: number;
    /** ρ 文字密度得分 */
    rho: number;
    /** S 结构复杂度得分 */
    S: number;
    /** P 页面综合复杂度 */
    P: number;
    /** T 切换负荷 */
    T: number;
}

/* ------------------------------------------------------------------ */
/* 身体疲劳信号（标准化后，均 0-100）                                  */
/* ------------------------------------------------------------------ */

export interface PhysicalSignals {
    /** E 轨迹熵得分 */
    E: number;
    /** L 眼-手延迟得分 */
    L: number;
    /** I 交互强度得分 */
    I: number;
    /** R 修正负荷得分 */
    R: number;
    /** R_rest 休息衰减因子 */
    R_rest: number;
}

/* ------------------------------------------------------------------ */
/* 负荷等级                                                           */
/* ------------------------------------------------------------------ */

export type LoadLevel = "low" | "moderate" | "high" | "insufficient_data";

/* ------------------------------------------------------------------ */
/* 触发路径                                                           */
/* ------------------------------------------------------------------ */

export type TriggerPath = "A" | "B" | "C";

/* ------------------------------------------------------------------ */
/* 引擎完整输出结果                                                    */
/* ------------------------------------------------------------------ */

export interface BRIResult {
    /** 认知负荷子指数 (0-100) */
    clCog: number;
    /** 身体疲劳子指数 (0-100) */
    clPhy: number;
    /** 原始脑休息指数 (0-100) */
    briRaw: number;
    /** 校准后指数 (0-150) */
    bri: number;
    /** 平滑输出指数 (0-100) */
    briDisplay: number;
    /** 个人校准系数 */
    kPersonal: number;
    /** 数据覆盖率 (0-1) */
    cData: number;
    /** 负荷等级 */
    level: LoadLevel;
    /** 命中的触发路径（null = 未触发） */
    triggerPath: TriggerPath | null;
    /** 页面类型 */
    pageType: UrlCategory | null;
    /** 认知信号明细 */
    cognitiveSignals: CognitiveSignals;
    /** 身体信号明细 */
    physicalSignals: PhysicalSignals;
    /** 计算时间戳 */
    timestamp: number;
}

/* ------------------------------------------------------------------ */
/* 用户行为类型（PersonalCalibration 内部使用）                        */
/* ------------------------------------------------------------------ */

export type UserAction = "proactive_rest" | "dismiss_notification" | "acknowledge_notification";

/* ------------------------------------------------------------------ */
/* B 分值映射表                                                       */
/* ------------------------------------------------------------------ */

export const TYPE_BASELINE: Record<UrlCategory, number> = {
    deep_work_productivity: 90,
    longform_deep_reading: 85,
    hybrid_learning_cognition: 75,
    im_social_adjunct: 55,
    shopping_reward_social: 50,
    low_load_utility: 50,
    social_feed: 45,
    competitive_progression_games: 45,
    short_video_entertainment: 40,
    passive_long_video: 40,
    audio_low_visual: 35,
};
