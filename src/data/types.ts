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

/**
 * 认知负荷类型：行为类型 → 认知负荷类型 → 恢复机制
 *
 * - reading_learning       长时间阅读 / 学习（视觉输入 + 工作记忆）
 * - deep_work              编程 / 深度工作（高度专注 + 逻辑推理）
 * - high_stimulation       短视频 / 社交媒体高刺激（奖励刺激过量）
 * - social_communication   视频会议 / 社交沟通（面部识别 + 社交压力）
 * - info_processing        高密度信息处理（信息筛选 + 判断决策）
 * - creative_work          创意设计 / 创作类工作（发散思考 + 不确定性压力）
 */
export type LoadType =
    | 'reading_learning'
    | 'deep_work'
    | 'high_stimulation'
    | 'social_communication'
    | 'info_processing'
    | 'creative_work'

/** 单个恢复活动 */
export interface RecoveryActivity {
    /** 活动名称（展示给用户） */
    name: string
    /** 具体做法示例（可选） */
    detail?: string
    /** 作用 / 恢复机制 */
    purpose: string
    /** ⭐ 优先推荐活动，抽取时必选 */
    star?: boolean
}

/** 负荷类型档案：主要负荷来源 + 恢复活动池 */
export interface LoadTypeProfile {
    /** 中文标签 */
    label: string
    /** 主要负荷来源 */
    mainLoads: string[]
    /** 建议休息时长（分钟） */
    durationMin: number
    /** 桌宠提醒主体文案 */
    message: string
    /** 可抽取的恢复活动池 */
    activities: RecoveryActivity[]
}

/** 触发基调表类型 */
export type TriggerBaselineMap = Record<TriggerPath, TriggerBaseline>

/** 负荷类型档案表类型 */
export type LoadTypeProfileMap = Record<LoadType, LoadTypeProfile>

/** 页面类型 → 负荷类型映射表类型 */
export type CategoryLoadTypeMap = Record<UrlCategory, LoadType>

/** 疲劳标题表类型 */
export type FatigueTitleMap = Record<Fatigue, string>
