import type { Event } from '../models/events/Event'
import { eventDB } from '../services/EventDataBaseManager'

/** 定时 flush 间隔 (ms)：崩溃丢失窗口上限 */
const FLUSH_INTERVAL_MS = 5000

/**
 * 事件写前日志（WAL）。
 *
 * 所有事件先在内存缓冲，每 5s（或显式）批量刷入 eventDB，
 * 作为崩溃恢复的备份来源。eventDB.batchPut 已自带 24h prune。
 */
class EventLog {
    private buffer: Event[] = []
    private timer: ReturnType<typeof setTimeout> | null = null

    /** 追加一条事件到缓冲，并确保定时 flush 已预位 */
    append(event: Event): void {
        this.buffer.push(event)
        if (this.timer === null) {
            this.timer = setTimeout(() => {
                void this.flush()
            }, FLUSH_INTERVAL_MS)
        }
    }

    /** 立即刷盘（引擎 tick 兜底 / 恢复前调用） */
    async flush(): Promise<void> {
        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }
        if (this.buffer.length === 0) return
        const batch = this.buffer
        this.buffer = []
        try {
            await eventDB.batchPut(batch)
        } catch {
            // 写入失败：退回缓冲，等待下次 flush
            this.buffer.unshift(...batch)
        }
    }
}

/** 全局唯一实例 */
export const eventLog = new EventLog()
