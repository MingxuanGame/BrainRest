/* ------------------------------------------------------------------ */
/* 60 分钟环形缓冲：BRI_display 历史序列                               */
/* ------------------------------------------------------------------ */

const WINDOW_MS = 60 * 60 * 1000 // 60 min

interface BRIEntry {
    value: number
    timestamp: number
}

/**
 * 维护最近 60 分钟的 BRI_display 采样序列（每 30s 一条）。
 * 支持触发引擎的路径 A（持续高负荷时长）和路径 B（AUC 积分）判定。
 */
export class BRIHistoryBuffer {
    private buffer: BRIEntry[] = []

    /** 存入一条 BRI_display 采样 */
    push(value: number, timestamp: number = Date.now()): void {
        this.buffer.push({ value, timestamp })
        this.trim()
    }

    /**
     * 路径 A：最近 windowMin 分钟内，BRI_display >= threshold 的累计时长（分钟）。
     * 采用相邻采样点间的线性插值估算。
     */
    getHighLoadDuration(threshold: number, windowMin: number): number {
        this.trim()
        const windowMs = windowMin * 60 * 1000
        const cutoff = Date.now() - windowMs
        const entries = this.buffer.filter((e) => e.timestamp >= cutoff)

        if (entries.length < 2) return 0

        let highMs = 0
        for (let i = 1; i < entries.length; i++) {
            const prev = entries[i - 1]
            const curr = entries[i]
            const dt = curr.timestamp - prev.timestamp

            // 两个端点都 >= threshold，整段计入
            if (prev.value >= threshold && curr.value >= threshold) {
                highMs += dt
            } else if (prev.value >= threshold || curr.value >= threshold) {
                // 线性插值：估算跨越阈值的比例
                const ratio =
                    prev.value >= threshold
                        ? prev.value / (prev.value + (threshold - curr.value))
                        : (threshold - prev.value) / (curr.value - prev.value)
                highMs += dt * Math.min(Math.max(ratio, 0), 1)
            }
        }

        return highMs / 60_000 // 转换为分钟
    }

    /**
     * 路径 B：最近 windowMin 分钟内的 AUC 积分（score·min）。
     * 采用梯形法则。
     */
    getAUC(windowMin: number): number {
        this.trim()
        const windowMs = windowMin * 60 * 1000
        const cutoff = Date.now() - windowMs
        const entries = this.buffer.filter((e) => e.timestamp >= cutoff)

        if (entries.length < 2) return 0

        let auc = 0
        for (let i = 1; i < entries.length; i++) {
            const prev = entries[i - 1]
            const curr = entries[i]
            const dtMin = (curr.timestamp - prev.timestamp) / 60_000
            // 梯形面积 = (y1 + y2) / 2 × Δt
            auc += ((prev.value + curr.value) / 2) * dtMin
        }

        return auc
    }

    /** 获取最近一条 BRI_display 值 */
    getLatest(): number | null {
        this.trim()
        return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1].value : null
    }

    private trim(): void {
        const cutoff = Date.now() - WINDOW_MS
        while (this.buffer.length > 0 && this.buffer[0].timestamp < cutoff) {
            this.buffer.shift()
        }
    }
}

/** 全局唯一实例 */
export const briHistoryBuffer = new BRIHistoryBuffer()
