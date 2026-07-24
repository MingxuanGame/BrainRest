import type {Event} from "../models/events/Event";

export const SLIDE_WINDOW_MS = 5000;

class SlidingWindowQueue {
    private buffer: Event[] = [];

    push(...items: Event[]): number {
        const result = this.buffer.push(...items);
        this.trim();
        return result;
    }

    /** 返回当前 5s 滑动窗口内的事件副本 */
    getEvents(): Event[] {
        this.trim();
        return [...this.buffer];
    }

    private trim(): void {
        const cutoff = Date.now() - SLIDE_WINDOW_MS;
        while (this.buffer.length > 0 && this.buffer[0].timestamp < cutoff) {
            this.buffer.shift();
        }
    }
}

export const queue = new SlidingWindowQueue();
