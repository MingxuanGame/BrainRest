import {queue, SLIDE_WINDOW_MS} from "../EventQueue";

/* ------------------------------------------------------------------ */
/* 常量                                                               */
/* ------------------------------------------------------------------ */

// 滑动窗口时长（秒），用于把事件计数换算成每秒频率
const WINDOW_SECONDS = SLIDE_WINDOW_MS / 1000;

/* ------------------------------------------------------------------ */
/* 公开 API                                                           */
/* ------------------------------------------------------------------ */

/**
 * 计算当前滑动窗口内的按秒事件频率（events/s）。
 * 即窗口内事件总数除以窗口时长（秒）。
 */
export function calculateEventFrequency(): number {
    const count = queue.getEvents().length;
    return count / WINDOW_SECONDS;
}
