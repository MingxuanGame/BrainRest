import { type IDBPDatabase, openDB } from 'idb'
import type { UrlCategory } from '../models/types'

export type { UrlCategory }

/** URL 分类记录 (domain -> category) */
export interface UrlCategoryRecord {
    /** 主键：域名，例如 "example.com" 或 "a.b.example.com" */
    domain: string
    /** 类别 */
    category: UrlCategory
    /** 最后更新时间 (ms) */
    updatedAt: number
}

const DB_NAME = 'brainrest_url_categories'
const DB_VERSION = 1
const STORE = 'url_categories'

/** 查询时允许的最深二级域名层级 */
const MIN_LEVEL = 2
/** 查询时允许的最深层级（含） */
const MAX_LEVEL = 5

class UrlCategoryDataBaseManager {
    private static instance: UrlCategoryDataBaseManager | null = null
    private readonly dbPromise: Promise<IDBPDatabase>

    private constructor() {
        this.dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore(STORE, { keyPath: 'domain' })
                // 主索引：按 domain 精确查询
                store.createIndex('domain', 'domain', { unique: true })
                // 辅助索引：按类别反向查询（列出某类别下所有 domain）
                store.createIndex('category', 'category', { unique: false })
                // 时间戳索引：用于增量同步 / 批量清理
                store.createIndex('updatedAt', 'updatedAt', { unique: false })
            },
        })
    }

    static getInstance(): UrlCategoryDataBaseManager {
        if (!UrlCategoryDataBaseManager.instance) {
            UrlCategoryDataBaseManager.instance = new UrlCategoryDataBaseManager()
        }
        return UrlCategoryDataBaseManager.instance
    }

    /** 写入或更新一条 (domain -> category) 记录 */
    async put(domain: string, category: UrlCategory): Promise<void> {
        const db = await this.dbPromise
        const record: UrlCategoryRecord = {
            domain: normalizeDomain(domain),
            category,
            updatedAt: Date.now(),
        }
        await db.put(STORE, record)
    }

    /** 批量写入或更新 */
    async batchPut(records: Array<{ domain: string; category: UrlCategory }>): Promise<void> {
        if (records.length === 0) return
        const db = await this.dbPromise
        const tx = db.transaction(STORE, 'readwrite')
        const now = Date.now()
        for (const { domain, category } of records) {
            await tx.store.put({
                domain: normalizeDomain(domain),
                category,
                updatedAt: now,
            } satisfies UrlCategoryRecord)
        }
        await tx.done
    }

    /** 删除一条记录 */
    async delete(domain: string): Promise<void> {
        const db = await this.dbPromise
        await db.delete(STORE, normalizeDomain(domain))
    }

    /** 精确读取某 domain 的分类（不做逐级回溯） */
    async getExact(domain: string): Promise<UrlCategoryRecord | undefined> {
        const db = await this.dbPromise
        return db.get(STORE, normalizeDomain(domain))
    }

    /** 列出某类别下的所有 domain */
    async listByCategory(category: UrlCategory): Promise<UrlCategoryRecord[]> {
        const db = await this.dbPromise
        return db.getAllFromIndex(STORE, 'category', category)
    }

    /** 清空 store */
    async clear(): Promise<void> {
        const db = await this.dbPromise
        await db.clear(STORE)
    }

    /**
     * 根据完整 domain 查询分类：从二级域名开始，逐级添加直到 5 级。
     * 命中第一个即返回；全部未命中则返回 undefined（归为不存在）。
     *
     * 例如 domain = "a.b.c.example.com" 会依次查询：
     *   1. example.com         (2 级)
     *   2. c.example.com        (3 级)
     *   3. b.c.example.com      (4 级)
     *   4. a.b.c.example.com    (5 级)
     */
    async lookup(domain: string): Promise<UrlCategoryRecord | undefined> {
        const normalized = normalizeDomain(domain)
        const parts = normalized.split('.')
        if (parts.length < MIN_LEVEL) {
            return undefined
        }
        const maxLevel = Math.min(parts.length, MAX_LEVEL)
        const db = await this.dbPromise
        for (let level = MIN_LEVEL; level <= maxLevel; level++) {
            const candidate = parts.slice(parts.length - level).join('.')
            const record = await db.get(STORE, candidate)
            if (record) {
                return record
            }
        }
        return undefined
    }

    /** lookup 的便捷封装：仅返回类别字符串或 undefined */
    async lookupCategory(domain: string): Promise<UrlCategory | undefined> {
        const record = await this.lookup(domain)
        return record?.category
    }
}

/** 将输入域名标准化为小写并去除前后空白及可能存在的尾部点 */
function normalizeDomain(domain: string): string {
    return domain.trim().toLowerCase().replace(/\.+$/, '')
}

/** 全局导出的单例 */
export const urlCategoryDB = UrlCategoryDataBaseManager.getInstance()

export default urlCategoryDB
