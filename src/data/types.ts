import type { UrlCategory } from '../models/types'
import type { TriggerPath } from '../background/engine/types'

/** 疲劳类型（决定文案标题主语） */
export type Fatigue = 'cognitive' | 'cognitive_accumulated' | 'physical'

/** 触发路径基调：按 A/B/C 给出休息主基调 */
export interface TriggerBaseline {
    /** 路径中文标签 */
    label: string
    /** 疲劳类型 */
    fatigue: Fatigue
    /** 建议时长区间 [min, max]（分钟） */
    durationMin: [number, number]
    /** 核心推荐活动 */
    coreActivities: string[]
    /** 应避免的行为 */
    avoid: string[]
    /** 脑科学依据 */
    rationale: string
}

/** 页面类型细化建议：按 UrlCategory 给出具体时长与活动 */
export interface PageSuggestion {
    /** 该类型的认知负荷基线（对应 TYPE_BASELINE） */
    baseline: number
    /** 建议时长（分钟） */
    durationMin: number
    /** 推荐活动 */
    activities: string[]
    /** 应避免的行为 */
    avoid: string[]
    /** 带脑科学依据的完整文案 */
    message: string
    /** 脑科学依据 */
    rationale: string
}

/** 触发基调表类型 */
export type TriggerBaselineMap = Record<TriggerPath, TriggerBaseline>

/** 页面建议表类型 */
export type PageSuggestionMap = Record<UrlCategory, PageSuggestion>

/** 疲劳标题表类型 */
export type FatigueTitleMap = Record<Fatigue, string>
