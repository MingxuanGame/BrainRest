import { type IDBPDatabase, openDB } from "idb";
import type { Event } from "../models/events/Event";

const DB_NAME = "brainrest";
const DB_VERSION = 1;
const EVENT_STORE = "events";
const DAY_MS = 24 * 60 * 60 * 1000;

class EventDataBaseManager {
    private static instance: EventDataBaseManager | null = null;
    private readonly dbPromise: Promise<IDBPDatabase>;

    private constructor() {
        this.dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore(EVENT_STORE, {
                    keyPath: "timestamp",
                });
                // 索引：快速查 processed 状态
                store.createIndex("processed", "processed", { unique: false });
            },
        });
    }

    /** 全局唯一实例 */
    static getInstance(): EventDataBaseManager {
        if (!EventDataBaseManager.instance) {
            EventDataBaseManager.instance = new EventDataBaseManager();
        }
        return EventDataBaseManager.instance;
    }

    /** 批量入库（timestamp 为主键，重复则覆盖），同时自动清理 24h 前的旧数据 */
    async batchPut(events: Event[]): Promise<void> {
        const db = await this.dbPromise;
        const tx = db.transaction(EVENT_STORE, "readwrite");
        // 写入新事件
        for (const event of events) {
            await tx.store.put(event);
        }
        // 自动清理过期数据
        const cutoff = Date.now() - DAY_MS;
        let cursor = await tx.store.openCursor(IDBKeyRange.upperBound(cutoff, true));
        while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
        }
        await tx.done;
    }

    /** 批量取出所有 processed === false 的事件 */
    async getUnprocessed(): Promise<Event[]> {
        const db = await this.dbPromise;
        return db.getAllFromIndex(EVENT_STORE, "processed", 0);
    }

    /** 根据 timestamp 更新事件属性（部分更新） */
    async updateByTimestamp(
        timestamp: number,
        patch: Partial<Omit<Event, "timestamp">>,
    ): Promise<void> {
        const db = await this.dbPromise;
        const tx = db.transaction(EVENT_STORE, "readwrite");
        const existing = await tx.store.get(timestamp);
        if (existing) {
            await tx.store.put({ ...existing, ...patch, timestamp });
        }
        await tx.done;
    }

    /** 批量标记为已处理 */
    async markProcessed(timestamps: number[]): Promise<void> {
        const db = await this.dbPromise;
        const tx = db.transaction(EVENT_STORE, "readwrite");
        for (const ts of timestamps) {
            const event = await tx.store.get(ts);
            if (event) {
                event.processed = 1;
                await tx.store.put(event);
            }
        }
        await tx.done;
    }

    /**
     * 将 timestamp <= cutoff 的未处理事件批量标记为已处理。
     * checkpoint 落盘后调用，收敛 getUnprocessed 的规模。
     */
    async markProcessedBefore(cutoff: number): Promise<void> {
        const db = await this.dbPromise;
        const tx = db.transaction(EVENT_STORE, "readwrite");
        const range = IDBKeyRange.upperBound(cutoff);
        let cursor = await tx.store.openCursor(range);
        while (cursor) {
            if (cursor.value.processed === 0) {
                await cursor.update({ ...cursor.value, processed: 1 });
            }
            cursor = await cursor.continue();
        }
        await tx.done;
    }

    /** 清理 24h 之前的旧数据（滚动窗口） */
    async prune(): Promise<void> {
        const db = await this.dbPromise;
        const cutoff = Date.now() - DAY_MS;
        const tx = db.transaction(EVENT_STORE, "readwrite");
        const range = IDBKeyRange.upperBound(cutoff, true);
        let cursor = await tx.store.openCursor(range);
        while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
        }
        await tx.done;
    }

    /** 获取最近一条事件（按 timestamp 降序） */
    async getRecentEvent(): Promise<Event | undefined> {
        const db = await this.dbPromise;
        const tx = db.transaction(EVENT_STORE, "readonly");
        const cursor = await tx.store.openCursor(null, "prev");
        const recentEvent = cursor?.value;
        await tx.done;
        return recentEvent;
    }

    /** 清空全部事件（Options 页"数据控制"一键清除用） */
    async clear(): Promise<void> {
        const db = await this.dbPromise;
        await db.clear(EVENT_STORE);
    }
}

/** 全局导出的单例 */
export const eventDB = EventDataBaseManager.getInstance();
