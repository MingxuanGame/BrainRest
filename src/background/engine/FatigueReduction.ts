import type { BRIResult } from './types'
import { levelOf } from './CognitiveLoadEngine'

/**
 * 休息对疲劳指数的影响参数。
 *
 * 语义：给定一次休息前的引擎结果、推荐的目标休息时长、以及实际休息时长，
 * 计算休息后的疲劳指数。targetTime 与 actualTime 必须使用相同单位（分钟）。
 */
export interface ReductionParams {
    /** 休息前的引擎结果 */
    result: BRIResult
    /** 目标休息时长：单个总时长，或 [min, max] 推荐区间（取中点为完全恢复基准） */
    targetTime: number | [number, number]
    /** 实际休息时长（与 targetTime 同单位） */
    actualTime: number
}

/* ------------------------------------------------------------------ */
/* 调参常量                                                            */
/* ------------------------------------------------------------------ */

/**
 * 达到目标时长时残留的疲劳比例（0 = 完全恢复）。
 * 单次休息通常不会清空累积负荷，这里保留一个小地板更贴近现实，且便于调参。
 */
const RECOVERED_FLOOR_RATIO = 0.1

/**
 * 过度休息回升斜率：实际时长每超出目标 100%，回补的疲劳占休息前指数的比例。
 * 研究表明超时休息会引发睡眠惯性 / 重新进入任务的“预热损耗”，但幅度有限，故取较缓斜率。
 * 参考：Sleep inertia（超过约 20–30min 的小睡会加剧醒后迟钝）、warm-up decrement。
 */
const OVER_REST_SLOPE = 0.15

/** 过度休息回补上限：无论休息多久，回补都不超过休息前指数的该比例（净效果仍为已休息） */
const OVER_REST_CAP = 0.4

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

/** 将 targetTime 归一化为“完全恢复”所需的时长基准（区间取中点） */
function targetOf(targetTime: number | [number, number]): number {
    return Array.isArray(targetTime) ? (targetTime[0] + targetTime[1]) / 2 : targetTime
}

/**
 * 计算休息后疲劳指数相对休息前的保留系数（乘子），随实际休息时长呈 V 形变化：
 * - actual 从 0 增至 target：线性下降至地板 RECOVERED_FLOOR_RATIO（充分恢复）；
 * - actual 超过 target：过度休息，指数自地板缓慢回升，封顶 RECOVERED_FLOOR_RATIO + OVER_REST_CAP。
 *
 * 返回值为 [0, 1] 的乘子；target/actual 非正时视为无有效休息，返回 1（不变）。
 */
export function restRecoveryFactor(
    targetTime: number | [number, number],
    actualTime: number,
): number {
    const target = targetOf(targetTime)
    if (target <= 0 || actualTime <= 0) return 1

    const ratio = actualTime / target

    if (ratio <= 1) {
        // 恢复阶段：线性下降到地板
        return 1 - ratio * (1 - RECOVERED_FLOOR_RATIO)
    }

    // 过度休息阶段：自地板缓慢回升，封顶
    const overshoot = ratio - 1
    const rebound = Math.min(overshoot * OVER_REST_SLOPE, OVER_REST_CAP)
    return clamp(RECOVERED_FLOOR_RATIO + rebound, 0, 1)
}

/**
 * 依据实际休息时长对引擎结果进行疲劳衰减，返回新的 BRIResult（不改动入参）。
 * 同比例作用于 bri 与 briDisplay，并据新的 briDisplay 重算负荷等级。
 */
export function reduceFatigue(params: ReductionParams): BRIResult {
    const { result, targetTime, actualTime } = params
    const factor = restRecoveryFactor(targetTime, actualTime)

    const briDisplay = clamp(result.briDisplay * factor, 0, 100)
    const bri = clamp(result.bri * factor, 0, 150)

    return {
        ...result,
        bri,
        briDisplay,
        level: levelOf(briDisplay),
    }
}
