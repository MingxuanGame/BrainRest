import {queue} from "../EventQueue";
import type {Event} from "../../models/events/Event";
import type {UiClickEvent} from "../../models/events/UiClickEvent";
import type {UiMouseMoveEvent} from "../../models/events/UiMouseMoveEvent";
import type {UiTouchEvent} from "../../models/events/UiTouchEvent";

/* ------------------------------------------------------------------ */
/* 常量                                                               */
/* ------------------------------------------------------------------ */

const DIRECTION_BINS = 8;        // 8 个方向，每个 45°
const MIN_DISTANCE_PX = 5;       // 小于 5 px 的位移视为噪声，忽略
const MAX_TIME_GAP_MS = 500;     // 两帧间隔超过 500 ms 视为不连续，忽略
const TARGET_RADIUS_PX = 12;
const MAX_EYE_HAND_DELAY_MS = 2000;
const TWO_PI = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* 类型守卫                                                           */

/* ------------------------------------------------------------------ */

function isClickEvent(e: Event): e is UiClickEvent {
    return e.type === "click";
}

function isMouseMoveEvent(e: Event): e is UiMouseMoveEvent {
    return e.type === "mousemove";
}

function isTouchEvent(e: Event): e is UiTouchEvent {
    return (
        e.type === "touchstart" ||
        e.type === "touchmove" ||
        e.type === "touchend"
    );
}

/* ------------------------------------------------------------------ */
/* 坐标提取                                                           */

/* ------------------------------------------------------------------ */

interface Point {
    x: number;
    y: number;
    t: number; // timestamp
}

function extractPoints(events: Event[]): Point[] {
    const points: Point[] = [];
    for (const e of events) {
        if (isClickEvent(e) || isMouseMoveEvent(e)) {
            points.push({x: e.clientX, y: e.clientY, t: e.timestamp});
        } else if (isTouchEvent(e)) {
            points.push({x: e.clientX, y: e.clientY, t: e.timestamp});
        }
    }
    return points.sort((a, b) => a.t - b.t);
}

/* ------------------------------------------------------------------ */
/* 方向熵计算                                                         */

/* ------------------------------------------------------------------ */

function calculateDirectionEntropy(points: Point[]): number {
    if (points.length < 2) return 0;

    const binCounts = new Array(DIRECTION_BINS).fill(0);
    let totalVectors = 0;

    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        // 时间间隔过大，视为不连续轨迹
        if (curr.t - prev.t > MAX_TIME_GAP_MS) continue;

        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const dist = Math.hypot(dx, dy);

        // 距离过短，视为噪声
        if (dist < MIN_DISTANCE_PX) continue;

        // atan2 返回值范围 [-π, π]，映射到 [0, 2π)
        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += TWO_PI;

        const bin = Math.floor((angle / TWO_PI) * DIRECTION_BINS) % DIRECTION_BINS;
        binCounts[bin]++;
        totalVectors++;
    }

    if (totalVectors === 0) return 0;

    let entropy = 0;
    for (const count of binCounts) {
        if (count === 0) continue;
        const p = count / totalVectors;
        entropy -= p * Math.log2(p);
    }

    // 归一化到 [0, 1]（最大熵 = log2(DIRECTION_BINS)）
    const maxEntropy = Math.log2(DIRECTION_BINS);
    return entropy / maxEntropy;
}

/* ------------------------------------------------------------------ */
/* 公开 API                                                           */

/* ------------------------------------------------------------------ */

export function calcuateMouseAnthropy(): number {
    const recentEvents = queue.getEvents();
    const points = extractPoints(recentEvents);
    return calculateDirectionEntropy(points);
}

/**
 * Returns the dwell time between reaching the most recently clicked target
 * and the click itself. null means that no matching mouse movement exists.
 */
export function calculateEyeHandDelay(): number | null {
    const events = queue.getEvents().sort((a, b) => a.timestamp - b.timestamp);
    const click = [...events].reverse().find(isClickEvent);
    if (!click) return null;

    for (let index = events.length - 1; index >= 0; index--) {
        const event = events[index];
        if (!isMouseMoveEvent(event) || event.timestamp > click.timestamp || event.url !== click.url) {
            continue;
        }

        const delay = click.timestamp - event.timestamp;
        if (delay > MAX_EYE_HAND_DELAY_MS) return null;

        const distanceToTarget = Math.hypot(event.clientX - click.clientX, event.clientY - click.clientY);
        if (distanceToTarget <= TARGET_RADIUS_PX) {
            return delay;
        }
    }

    return null;
}
