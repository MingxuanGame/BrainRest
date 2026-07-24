import type { TimeData, TimeRange } from "../models/TimeData";
import type { UrlCategory } from "../models/types";
import type { Event } from "../models/events/Event";
import { extractDomain } from "../models/url";
import { type DailyTimeRecord, timeDataStore, toDayKey } from "../services/TimeDataStore";
import { urlCategoryDB } from "../services/UrlCategoryDataBaseManager";

/** 未分类域名在分类汇总中的兜底桶键 */
export const UNKNOWN_CATEGORY = "unknown";

/** 分类时长汇总结果（含未分类兜底桶） */
export type CategoryDurations = Partial<Record<UrlCategory, number>> & {
    [UNKNOWN_CATEGORY]?: number;
};

/**
 * 按域名统计各时间段总时长（秒）。开放段（end === null）用 now 结算。
 */
export function domainDurationsOf(
    record: TimeData,
    now: number = Date.now(),
): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [domain, ranges] of Object.entries(record.apps)) {
        let ms = 0;
        for (const [start, end] of ranges) {
            ms += Math.max(0, (end ?? now) - start);
        }
        result[domain] = ms / 1000;
    }
    return result;
}

/**
 * 按分类汇总时长（秒）：遍历域名经 lookupCategory 归类累加，未分类归入兜底桶。
 */
export async function categoryDurationsOf(
    record: TimeData,
    now: number = Date.now(),
): Promise<CategoryDurations> {
    const domainSeconds = domainDurationsOf(record, now);
    const result: CategoryDurations = {};
    for (const [domain, seconds] of Object.entries(domainSeconds)) {
        const category = await urlCategoryDB.lookupCategory(domain);
        const key = category ?? UNKNOWN_CATEGORY;
        result[key] = (result[key] ?? 0) + seconds;
    }
    return result;
}

/**
 * 域名会话时间追踪器。
 *
 * 常驻 service-worker，事件驱动地开合"当前活跃域名"的时间段，
 * 按天持久化到 TimeDataStore（每天一条 DailyTimeRecord）。
 * "活跃" = 窗口聚焦且未锁屏未 idle；开放段以 [start, null] 表示。
 */
class DomainTimeTracker {
    private currentDayKey = toDayKey();
    private dayStartTime = toDayKey();

    /** 今日已关闭的时间段（不含当前开放段） */
    private apps: Record<string, TimeRange[]> = {};

    /** 当前活跃域名（null = 无开放段） */
    private currentDomain: string | null = null;
    /** 当前开放段起点 (ms)，null = 无开放段 */
    private openStart: number | null = null;
    /** 是否处于活跃计时状态（聚焦、未锁屏、未 idle） */
    private active = true;
    /** 最近一次已知的活跃 url */
    private lastUrl = "";

    /* ---------------------------------------------------------------- */
    /* 生命周期                                                         */
    /* ---------------------------------------------------------------- */

    /** 从持久化记录恢复今日内存状态（SW 启动时调用一次） */
    async init(now: number = Date.now()): Promise<void> {
        this.currentDayKey = toDayKey(now);
        this.dayStartTime = toDayKey(now);
        this.apps = {};
        this.currentDomain = null;
        this.openStart = null;

        const existing = await timeDataStore.getDay(this.currentDayKey);
        if (!existing) return;

        this.dayStartTime = existing.startTime;
        for (const [domain, ranges] of Object.entries(existing.apps)) {
            const closed: TimeRange[] = [];
            for (const [start, end] of ranges) {
                if (end === null) {
                    // 悬空开放段 → 恢复为当前开放段（继续计时）
                    this.currentDomain = domain;
                    this.openStart = start;
                    this.active = true;
                } else {
                    closed.push([start, end]);
                }
            }
            this.apps[domain] = closed;
        }
    }

    /* ---------------------------------------------------------------- */
    /* 事件驱动开合段                                                    */
    /* ---------------------------------------------------------------- */

    /** 用户在某 url 上活跃（内容事件 / 标签激活）。同域名仅刷新，切换则开合段。 */
    onActivity(url: string, timestamp: number = Date.now()): void {
        const domain = extractDomain(url);
        if (!domain) return;
        this.ensureDay(timestamp);
        this.lastUrl = url;

        // 活动即意味着前台活跃
        this.active = true;

        if (this.currentDomain === domain && this.openStart !== null) {
            return; // 同域名持续活跃，无需开合
        }
        this.closeRange(timestamp);
        this.currentDomain = domain;
        this.openStart = timestamp;
    }

    /** 暂停计时（失焦 / 锁屏 / idle）：关闭当前开放段 */
    pause(timestamp: number = Date.now()): void {
        this.ensureDay(timestamp);
        this.closeRange(timestamp);
        this.currentDomain = null;
        this.active = false;
    }

    /** 恢复计时（聚焦 / active）：为最近已知域名开新段 */
    resume(url: string | null = null, timestamp: number = Date.now()): void {
        this.ensureDay(timestamp);
        this.active = true;
        if (url) this.lastUrl = url;
        const domain = extractDomain(this.lastUrl);
        if (!domain) return; // 暂无已知域名，等待下一次 onActivity
        this.currentDomain = domain;
        this.openStart = timestamp;
    }

    /* ---------------------------------------------------------------- */
    /* 落盘 / 查询                                                       */
    /* ---------------------------------------------------------------- */

    /** 心跳落盘（引擎 tick 调用）：把当前快照写入 TimeDataStore */
    async checkpoint(now: number = Date.now()): Promise<void> {
        this.ensureDay(now);
        await timeDataStore.putDay(this.buildRecord(now));
    }

    /** 今日按域名时长（秒） */
    getTodayDomainDurations(now: number = Date.now()): Record<string, number> {
        return domainDurationsOf(this.buildRecord(now), now);
    }

    /** 今日按分类时长（秒） */
    getTodayCategoryDurations(now: number = Date.now()): Promise<CategoryDurations> {
        return categoryDurationsOf(this.buildRecord(now), now);
    }

    /* ---------------------------------------------------------------- */
    /* 内部                                                             */
    /* ---------------------------------------------------------------- */

    /** 关闭当前开放段，写入 apps（若存在） */
    private closeRange(end: number): void {
        if (this.currentDomain !== null && this.openStart !== null && end > this.openStart) {
            (this.apps[this.currentDomain] ??= []).push([this.openStart, end]);
        }
        this.openStart = null;
    }

    /** 跨天翻滚：在零点结算旧日、落盘、以新日重开 */
    private ensureDay(timestamp: number): void {
        const key = toDayKey(timestamp);
        if (key === this.currentDayKey) return;

        const midnight = toDayKey(timestamp);
        const hadOpen = this.currentDomain !== null && this.openStart !== null;
        const openDomain = this.currentDomain;
        this.closeRange(midnight);
        // 落盘旧日最终快照（fire-and-forget）
        void timeDataStore.putDay(this.buildRecord(midnight));

        // 切换到新日
        this.currentDayKey = key;
        this.dayStartTime = midnight;
        this.apps = {};
        if (hadOpen && openDomain && this.active) {
            this.currentDomain = openDomain;
            this.openStart = midnight;
        } else {
            this.currentDomain = null;
            this.openStart = null;
        }
    }

    /** 构建当前快照记录（开放段以 [start, null] 附加） */
    private buildRecord(now: number): DailyTimeRecord {
        const apps: Record<string, TimeRange[]> = {};
        for (const [domain, ranges] of Object.entries(this.apps)) {
            apps[domain] = ranges.map(([s, e]) => [s, e] as TimeRange);
        }
        if (this.active && this.currentDomain !== null && this.openStart !== null) {
            (apps[this.currentDomain] ??= []).push([this.openStart, null]);
        }
        return {
            dayKey: this.currentDayKey,
            startTime: this.dayStartTime,
            endTime: now,
            apps,
            checkpointAt: now,
        };
    }
}

/** 全局唯一实例 */
export const domainTimeTracker = new DomainTimeTracker();

/**
 * 把一条存储事件重放到追踪器（崩溃恢复用）。
 * 映射与实时接线保持一致：focus→resume、blur→pause、带 url 事件→onActivity。
 */
export function applyEventToTracker(event: Event): void {
    if (event.type === "focus") {
        domainTimeTracker.resume(null, event.timestamp);
        return;
    }
    if (event.type === "blur") {
        domainTimeTracker.pause(event.timestamp);
        return;
    }
    if (event.url) {
        domainTimeTracker.onActivity(event.url, event.timestamp);
    }
}
