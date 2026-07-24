/**
 * 格式化持续时间
 * @param d 持续时间，单位为分钟，或者一个包含最小值和最大值的数组
 * @returns 格式化后的持续时间字符串
 */
export function formatDuration(d: number | [number, number]): string {
    return Array.isArray(d) ? `${d[0]}–${d[1]} 分钟` : `${d} 分钟`
}

/**
 * 比较两个时间点
 * @param a [小时, 分钟]
 * @param b [小时, 分钟]
 * @returns a 在 b 之前返回负数，相等返回 0，之后返回正数
 */
export function compareTime(a: [number, number], b: [number, number]): number {
    if (a[0] !== b[0]) return a[0] - b[0]
    return a[1] - b[1]
}

export const MINUTES_PER_DAY = 24 * 60

/** 将自午夜起的分钟数转换为 [hours, minute] 时刻 */
export function minutesToTime(totalMinutes: number): [number, number] {
    const m = ((Math.round(totalMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
    return [Math.floor(m / 60), m % 60]
}
