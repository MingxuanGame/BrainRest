/* ------------------------------------------------------------------ */
/* 数据质量门控                                                        */
/* ------------------------------------------------------------------ */

/** 数据覆盖率评估窗口 (ms) */
const EVAL_WINDOW_MS = 120_000 // 120s

/** 数据覆盖率阈值，低于此值视为数据不足 */
const COVERAGE_THRESHOLD = 0.7

/** 单次采样代表的有效时长 (ms)：与采样周期对齐 */
const SAMPLE_VALID_DURATION_MS = 30_000 // 30s

/* ------------------------------------------------------------------ */
/* 数据质量门控器                                                      */

/* ------------------------------------------------------------------ */

/**
 * 追踪最近 120s 内的有效采样覆盖时长，计算数据覆盖率 C_data。
 *
 * C_data = t_valid / 120s
 *
 * 若 C_data < 0.70：输出"数据不足"，不参与触发判定，不更新 BRI_display。
 */
export class DataQualityGate {
    /** 最近有效采样的时间戳列表 */
    private sampleTimestamps: number[] = []

    /** 记录一次有效采样（事件或页面复杂度上报） */
    recordSample(timestamp: number = Date.now()): void {
        this.sampleTimestamps.push(timestamp)
        this.trim()
    }

    /** 批量记录事件（每个事件视为一次有效采样） */
    recordEvents(count: number, timestamp: number = Date.now()): void {
        if (count > 0) {
            this.sampleTimestamps.push(timestamp)
            this.trim()
        }
    }

    /**
     * 计算当前数据覆盖率 C_data (0-1)。
     *
     * 采用"有效时段合并"算法：
     * 每个采样点代表其后 SAMPLE_VALID_DURATION_MS 时长内的有效覆盖，
     * 合并重叠时段后计算总覆盖时长占评估窗口的比例。
     */
    getCoverage(): number {
        this.trim()

        if (this.sampleTimestamps.length === 0) return 0

        const now = Date.now()
        const windowStart = now - EVAL_WINDOW_MS

        // 将每个采样点扩展为 [timestamp, timestamp + SAMPLE_VALID_DURATION_MS] 的有效区间
        // 并裁剪到评估窗口内
        const intervals: Array<[number, number]> = []
        for (const ts of this.sampleTimestamps) {
            const start = Math.max(ts, windowStart)
            const end = Math.min(ts + SAMPLE_VALID_DURATION_MS, now)
            if (start < end) {
                intervals.push([start, end])
            }
        }

        if (intervals.length === 0) return 0

        // 合并重叠区间
        intervals.sort((a, b) => a[0] - b[0])
        let mergedDuration = 0
        let currentStart = intervals[0][0]
        let currentEnd = intervals[0][1]

        for (let i = 1; i < intervals.length; i++) {
            const [start, end] = intervals[i]
            if (start <= currentEnd) {
                // 重叠或相邻，合并
                currentEnd = Math.max(currentEnd, end)
            } else {
                // 不重叠，结算前一段
                mergedDuration += currentEnd - currentStart
                currentStart = start
                currentEnd = end
            }
        }
        mergedDuration += currentEnd - currentStart

        return Math.min(mergedDuration / EVAL_WINDOW_MS, 1)
    }

    /** 判断数据是否充足 */
    isSufficient(): boolean {
        return this.getCoverage() >= COVERAGE_THRESHOLD
    }

    private trim(): void {
        const cutoff = Date.now() - EVAL_WINDOW_MS
        while (this.sampleTimestamps.length > 0 && this.sampleTimestamps[0] < cutoff) {
            this.sampleTimestamps.shift()
        }
    }
}

/** 全局唯一实例 */
export const dataQualityGate = new DataQualityGate()
