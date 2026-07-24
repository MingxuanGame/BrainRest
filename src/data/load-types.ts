import type { LoadTypeProfileMap } from './types'

/**
 * 负荷类型档案表：行为类型 → 认知负荷类型 → 恢复机制
 *
 * 科学依据：
 * - 认知负荷恢复：减少信息输入，让工作记忆释放
 * - 注意力恢复理论（ART）：自然环境、低刺激活动帮助恢复主动注意力
 * - 眼疲劳恢复：减少近距离视觉刺激
 * - 身体恢复：缓解久坐和肌肉紧张
 * - 情绪调节：降低压力和刺激水平
 */
export const loadTypeProfiles: LoadTypeProfileMap = {
    reading_learning: {
        label: '长时间阅读 / 学习',
        mainLoads: ['持续视觉输入', '工作记忆占用', '信息理解压力', '眼睛近距离聚焦'],
        durationMin: 3,
        message: '你的大脑正在努力处理大量信息，眼睛也一直近距离聚焦——先做几分钟视觉恢复吧。',
        activities: [
            {
                name: '20-20-20 视觉恢复法',
                detail: '看 6 米外物体 20 秒',
                purpose: '降低睫状肌持续紧张',
                star: true,
            },
            {
                name: '远眺窗外 1-3 分钟',
                purpose: '改变视觉焦距，减少近距离视觉疲劳',
            },
            {
                name: '闭眼休息 + 深呼吸 1-3 分钟',
                purpose: '降低持续信息处理状态',
            },
            {
                name: '眼球运动',
                detail: '上下左右移动、缓慢画圆',
                purpose: '缓解视觉固定',
            },
            {
                name: '轻微颈部拉伸',
                detail: '左右转头、低头抬头',
                purpose: '缓解阅读姿势造成的颈部压力',
            },
            {
                name: '喝水',
                purpose: '补充水分，提高身体舒适度',
            },
            {
                name: '听低刺激音乐',
                detail: '白噪音、自然声音',
                purpose: '减少继续输入文字信息',
            },
            {
                name: '看自然元素',
                detail: '植物、天空、远处景物',
                purpose: '促进注意力恢复',
            },
            {
                name: '简单走动 2-5 分钟',
                purpose: '促进血液循环',
            },
            {
                name: '写一句总结',
                detail: '「刚才学习了什么？」',
                purpose: '完成认知关闭，减少大脑残留负荷',
            },
        ],
    },
    deep_work: {
        label: '编程 / 深度工作',
        mainLoads: ['高度专注', '问题解决', '逻辑推理', '长时间保持目标'],
        durationMin: 10,
        message: '你已高强度专注了很久，大脑一直在保持目标和推理——离开屏幕换个状态，回来会更高效。',
        activities: [
            {
                name: '离开屏幕短暂走动',
                purpose: '切换大脑状态',
                star: true,
            },
            {
                name: '简单身体拉伸',
                detail: '肩颈、手腕、背部',
                purpose: '缓解久坐肌肉紧张',
            },
            {
                name: '闭眼深呼吸几轮',
                detail: '4 秒吸气、6 秒呼气',
                purpose: '降低紧张状态',
            },
            {
                name: '看远处绿色植物',
                purpose: '恢复定向注意力',
            },
            {
                name: '整理桌面',
                purpose: '完成心理上的任务切换',
            },
            {
                name: '喝水或补充健康零食',
                purpose: '恢复身体状态',
            },
            {
                name: '听无歌词音乐',
                purpose: '避免新的语言处理负荷',
            },
            {
                name: '做简单机械活动',
                detail: '洗杯子、浇花、整理物品',
                purpose: '降低认知需求',
            },
            {
                name: '一分钟冥想',
                detail: '关注呼吸与身体感觉',
                purpose: '平复思绪',
            },
            {
                name: '记录下一步任务',
                purpose: '减少「未完成任务占用」',
            },
        ],
    },
    high_stimulation: {
        label: '短视频 / 社交媒体高刺激',
        mainLoads: ['高频奖励刺激', '注意力快速切换', '信息碎片化'],
        durationMin: 5,
        message: '这不是疲劳，而是大脑刺激过量。先暂停所有信息输入，给大脑一点空白时间。',
        activities: [
            {
                name: '暂停所有信息输入 2-5 分钟',
                detail: '不要马上切换到其他内容',
                purpose: '让大脑降低刺激水平',
                star: true,
            },
            {
                name: '看窗外远处',
                purpose: '降低视觉刺激',
            },
            {
                name: '慢呼吸',
                purpose: '降低刺激水平',
            },
            {
                name: '闭眼静坐',
                purpose: '给大脑空白时间',
            },
            {
                name: '听自然声音',
                detail: '雨声、风声、森林声',
                purpose: '低刺激放松',
            },
            {
                name: '喝水',
                purpose: '提供身体反馈',
            },
            {
                name: '简单伸展',
                detail: '伸懒腰、肩膀放松',
                purpose: '缓解久坐',
            },
            {
                name: '走到另一个空间',
                detail: '离开电脑桌',
                purpose: '物理隔离刺激源',
            },
            {
                name: '写下当前想法',
                purpose: '整理碎片信息',
            },
            {
                name: '低刺激兴趣活动',
                detail: '画画、拼图、植物护理',
                purpose: '温和转移注意力',
            },
        ],
    },
    social_communication: {
        label: '视频会议 / 社交沟通',
        mainLoads: ['持续面部识别', '社交压力', '语言处理'],
        durationMin: 3,
        message: '持续的面部识别和语言处理会累积社交压力，找个安静的地方独处片刻。',
        activities: [
            {
                name: '关闭摄像头休息 30 秒',
                purpose: '减少持续面部识别负荷',
            },
            {
                name: '深呼吸',
                purpose: '降低紧张状态',
            },
            {
                name: '肩颈放松',
                purpose: '缓解姿势紧张',
            },
            {
                name: '喝水',
                purpose: '恢复身体状态',
            },
            {
                name: '看远处',
                purpose: '放松视觉',
            },
            {
                name: '短暂独处',
                purpose: '降低社交刺激',
            },
            {
                name: '听舒缓音乐',
                purpose: '情绪调节',
            },
            {
                name: '简单走动',
                purpose: '促进血液循环',
            },
            {
                name: '记录会议重点',
                purpose: '完成信息整理',
            },
            {
                name: '做一个轻松动作',
                detail: '握拳放松、伸展',
                purpose: '释放身体紧张',
            },
        ],
    },
    info_processing: {
        label: '高密度信息处理',
        mainLoads: ['信息筛选', '判断决策', '多来源比较'],
        durationMin: 10,
        message: '高密度的信息筛选和判断正在占用工作记忆，暂停输入，让大脑清空一下。',
        activities: [
            {
                name: '闭眼休息',
                purpose: '暂停视觉信息输入',
            },
            {
                name: '散步',
                purpose: '切换大脑状态',
            },
            {
                name: '看自然环境',
                purpose: '促进注意力恢复',
            },
            {
                name: '喝水',
                purpose: '恢复身体状态',
            },
            {
                name: '拉伸',
                purpose: '缓解久坐紧张',
            },
            {
                name: '听音乐',
                purpose: '情绪调节',
            },
            {
                name: '做简单家务',
                purpose: '降低认知需求',
            },
            {
                name: '呼吸训练',
                purpose: '平复决策压力',
            },
            {
                name: '写总结',
                purpose: '完成认知关闭',
            },
            {
                name: '暂停输入 10 分钟',
                purpose: '让工作记忆释放',
            },
        ],
    },
    creative_work: {
        label: '创意设计 / 创作类工作',
        mainLoads: ['发散思考', '视觉想象', '不确定性压力'],
        durationMin: 5,
        message: '持续审视作品容易固化思路，离开一会儿——灵感往往在放空时出现。',
        activities: [
            {
                name: '离开作品 5 分钟',
                detail: '避免持续审视',
                purpose: '打破思路固化',
            },
            {
                name: '看自然景物',
                purpose: '恢复注意力',
            },
            {
                name: '随手涂鸦',
                purpose: '低压力发散',
            },
            {
                name: '散步',
                purpose: '促进灵感孵化',
            },
            {
                name: '听音乐',
                purpose: '情绪调节',
            },
            {
                name: '做身体运动',
                purpose: '激活身体状态',
            },
            {
                name: '闭眼想象',
                purpose: '温和发散思考',
            },
            {
                name: '整理素材',
                purpose: '轻量任务切换',
            },
            {
                name: '喝水',
                purpose: '恢复身体状态',
            },
            {
                name: '改变环境位置',
                detail: '例如换房间',
                purpose: '刷新环境刺激',
            },
        ],
    },
}
