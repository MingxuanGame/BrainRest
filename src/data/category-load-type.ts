import type { CategoryLoadTypeMap } from './types'

/**
 * 页面类型 → 认知负荷类型映射
 *
 * 行为类型（UrlCategory，11 类）归入认知负荷类型（LoadType，6 类），
 * 由负荷类型决定恢复机制与活动池。
 */
export const categoryLoadType: CategoryLoadTypeMap = {
    // 阅读 / 学习：视觉输入 + 工作记忆
    longform_deep_reading: 'reading_learning',
    hybrid_learning_cognition: 'reading_learning',

    // 深度工作：高度专注 + 逻辑推理
    deep_work_productivity: 'deep_work',

    // 高刺激：高频奖励 + 注意力快速切换
    short_video_entertainment: 'high_stimulation',
    social_feed: 'high_stimulation',
    shopping_reward_social: 'high_stimulation',
    competitive_progression_games: 'high_stimulation',
    passive_long_video: 'high_stimulation',

    // 社交沟通：语言处理 + 社交压力
    im_social_adjunct: 'social_communication',

    // 高密度信息处理：检索、筛选、决策
    low_load_utility: 'info_processing',
    audio_low_visual: 'info_processing',
}
