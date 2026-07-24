import { type IDBPDatabase, openDB } from 'idb'

const DB_NAME = 'brainrest_routine'
const DB_VERSION = 1
const STORE = 'routine'

/** 作息记录：某一天的入睡与起床时刻 */
export interface RoutineRecord {
    /** 主键：日期字符串，如 "2026-07-24" */
    date: string
    /** 入睡时刻：小时（0-23） */
    sleepHour: number
    /** 入睡时刻：分钟（0-59） */
    sleepMinute: number
    /** 起床时刻：小时（0-23） */
    wakeHour: number
    /** 起床时刻：分钟（0-59） */
    wakeMinute: number
}

/** 获取 N 天前的日期字符串（YYYY-MM-DD，本地时区） */
function getDateNDaysAgo(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() - n)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

class RoutineStore {
    private static instance: RoutineStore | null = null
    private readonly dbPromise: Promise<IDBPDatabase>

    private constructor() {
        this.dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                db.createObjectStore(STORE, { keyPath: 'date' })
            },
        })
    }

    /** 全局唯一实例 */
    static getInstance(): RoutineStore {
        if (!RoutineStore.instance) {
            RoutineStore.instance = new RoutineStore()
        }
        return RoutineStore.instance
    }

    /** 写入或更新某天的记录 */
    async put(
        date: string,
        sleepHour: number,
        sleepMinute: number,
        wakeHour: number,
        wakeMinute: number,
    ): Promise<void> {
        const db = await this.dbPromise
        await db.put(STORE, {
            date,
            sleepHour,
            sleepMinute,
            wakeHour,
            wakeMinute,
        } satisfies RoutineRecord)
    }

    /** 读取某天记录 */
    async get(date: string): Promise<RoutineRecord | undefined> {
        const db = await this.dbPromise
        return db.get(STORE, date) as Promise<RoutineRecord | undefined>
    }

    /** 读取最近 N 天的数据（默认 14 天），按日期升序返回 */
    async getRecent(days: number = 14): Promise<RoutineRecord[]> {
        const db = await this.dbPromise
        const cutoff = getDateNDaysAgo(days)
        // date 为 YYYY-MM-DD 格式，字符串字典序即时间序
        const range = IDBKeyRange.lowerBound(cutoff, false)
        return db.getAll(STORE, range) as Promise<RoutineRecord[]>
    }

    /** 删除某天记录 */
    async delete(date: string): Promise<void> {
        const db = await this.dbPromise
        await db.delete(STORE, date)
    }
}

/** 全局唯一实例 */
export const routineStore = RoutineStore.getInstance()
