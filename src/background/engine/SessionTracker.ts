/* ------------------------------------------------------------------ */
/* 会话前台时长追踪器                                                  */

/* ------------------------------------------------------------------ */

/**
 * 追踪当前会话的连续前台时长 t_front（分钟）。
 * - 窗口聚焦时开始/继续累积
 * - 窗口失焦或设备锁屏时暂停计时
 * - 恢复前台时继续累积（不重置）
 */
export class SessionTracker {
    /** 累积的前台时长 (ms) */
    private accumulatedMs = 0
    /** 当前前台段起始时间戳，null 表示当前不在前台 */
    private currentSegmentStart: number | null = null
    /** 是否处于锁屏状态 */
    private locked = false
    /** 是否处于窗口聚焦状态 */
    private focused = true

    constructor() {
        // 初始视为前台活跃
        this.currentSegmentStart = Date.now()
    }

    /** 窗口焦点变化 */
    setFocused(focused: boolean): void {
        if (focused === this.focused) return
        this.focused = focused
        this.updateSegment()
    }

    /** 设备锁屏/解锁 */
    setLocked(locked: boolean): void {
        if (locked === this.locked) return
        this.locked = locked
        this.updateSegment()
    }

    /**
     * 获取当前连续前台时长（分钟）。
     * 如果当前在前台，包含正在进行的段。
     */
    getFrontMinutes(): number {
        let total = this.accumulatedMs
        if (this.currentSegmentStart !== null) {
            total += Date.now() - this.currentSegmentStart
        }
        return total / 60_000
    }

    /** 重置计时器（开始新会话） */
    reset(): void {
        this.accumulatedMs = 0
        this.currentSegmentStart = this.isActive() ? Date.now() : null
    }

    /** 判断当前是否应处于计时状态（前台且未锁屏） */
    private isActive(): boolean {
        return this.focused && !this.locked
    }

    /** 根据当前状态更新计时段 */
    private updateSegment(): void {
        const shouldBeActive = this.isActive()

        if (shouldBeActive && this.currentSegmentStart === null) {
            // 恢复前台：开始新段
            this.currentSegmentStart = Date.now()
        } else if (!shouldBeActive && this.currentSegmentStart !== null) {
            // 离开前台：结算当前段
            this.accumulatedMs += Date.now() - this.currentSegmentStart
            this.currentSegmentStart = null
        }
    }
}

/** 全局唯一实例 */
export const sessionTracker = new SessionTracker()
