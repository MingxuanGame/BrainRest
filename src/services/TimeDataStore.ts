import { type IDBPDatabase, openDB } from "idb";
import type { TimeData } from "../models/TimeData";

const DB_NAME = "brainrest_time_data";
const DB_VERSION = 1;
const STORE = "daily_time_data";

/** 默认保留最近天数 */
const DEFAULT_KEEP_DAYS = 7;

/** 单日时间追踪记录（每天一条，主键 dayKey） */
export interface DailyTimeRecord extends TimeData {
    /** 主键：本地当日零点时间戳 (ms) */
    dayKey: number;
    /** 最后一次成功落盘的时间戳 (ms)，用于崩溃恢复时确定重放起点 */
    checkpointAt: number;
}

/** 将时间戳归一化为本地当日零点时间戳 (ms) */
export function toDayKey(timestamp: number = Date.now()): number {
    const d = new Date(timestamp);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

/**
 * 单日时间追踪数据持久化。
 *
 * 独立 DB（brainrest_time_data），与事件库解耦，避免版本协调。
 * 每天一条记录（keyPath: dayKey），供 DomainTimeTracker 落盘与恢复。
 */
class TimeDataStore {
    private static instance: TimeDataStore | null = null;
    private readonly dbPromise: Promise<IDBPDatabase>;

    private constructor() {
        this.dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                db.createObjectStore(STORE, { keyPath: "dayKey" });
            },
        });
    }

    static getInstance(): TimeDataStore {
        if (!TimeDataStore.instance) {
            TimeDataStore.instance = new TimeDataStore();
        }
        return TimeDataStore.instance;
    }

    /** 读取某天记录（不存在返回 undefined） */
    async getDay(dayKey: number): Promise<DailyTimeRecord | undefined> {
        const db = await this.dbPromise;
        return db.get(STORE, dayKey) as Promise<DailyTimeRecord | undefined>;
    }

    /** 写入或覆盖某天记录 */
    async putDay(record: DailyTimeRecord): Promise<void> {
        const db = await this.dbPromise;
        await db.put(STORE, record);
    }

    /** 清理超出保留窗口的旧天（默认保留最近 7 天） */
    async prune(keepDays: number = DEFAULT_KEEP_DAYS): Promise<void> {
        const db = await this.dbPromise;
        const cutoff = toDayKey(Date.now() - keepDays * 24 * 60 * 60 * 1000);
        const tx = db.transaction(STORE, "readwrite");
        // dayKey 为当日零点时间戳，数值序即时间序，可直接用上界范围
        const range = IDBKeyRange.upperBound(cutoff, true);
        let cursor = await tx.store.openCursor(range);
        while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
        }
        await tx.done;
    }

    /** 清空全部时间记录（Options 页"数据控制"一键清除用） */
    async clear(): Promise<void> {
        const db = await this.dbPromise;
        await db.clear(STORE);
    }
}

/** 全局唯一实例 */
export const timeDataStore = TimeDataStore.getInstance();
