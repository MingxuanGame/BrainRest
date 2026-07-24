/* ------------------------------------------------------------------ */
/* 5 分钟环形缓冲：标签页切换 & 页面加载事件                           */
/* ------------------------------------------------------------------ */

const WINDOW_MS = 5 * 60 * 1000; // 5 min

interface TimestampEntry {
    timestamp: number;
}

/**
 * 维护最近 5 分钟内的标签页激活事件（N_switch）和页面加载完成事件（N_load）。
 * 用于计算切换负荷 T = min(N_switch × 12.5 + N_load × 7.5, 100)。
 */
export class TabEventBuffer {
    private switchBuffer: TimestampEntry[] = [];
    private loadBuffer: TimestampEntry[] = [];

    /** 记录一次标签页激活事件 */
    pushSwitch(timestamp: number = Date.now()): void {
        this.switchBuffer.push({timestamp});
        this.trim();
    }

    /** 记录一次页面加载完成事件 */
    pushLoad(timestamp: number = Date.now()): void {
        this.loadBuffer.push({timestamp});
        this.trim();
    }

    /** 最近 5 分钟内的标签页激活次数 N_switch */
    getSwitchCount(): number {
        this.trim();
        return this.switchBuffer.length;
    }

    /** 最近 5 分钟内的页面加载完成次数 N_load */
    getLoadCount(): number {
        this.trim();
        return this.loadBuffer.length;
    }

    private trim(): void {
        const cutoff = Date.now() - WINDOW_MS;
        while (this.switchBuffer.length > 0 && this.switchBuffer[0].timestamp < cutoff) {
            this.switchBuffer.shift();
        }
        while (this.loadBuffer.length > 0 && this.loadBuffer[0].timestamp < cutoff) {
            this.loadBuffer.shift();
        }
    }
}

/** 全局唯一实例 */
export const tabEventBuffer = new TabEventBuffer();
