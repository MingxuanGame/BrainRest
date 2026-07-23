import {queue} from "../EventQueue";
import type {Event} from "../../models/events/Event";
import type {TabChanged} from "../../models/events/TabChanged";
import type {UrlCategory} from "../../models/types";
import {urlCategoryDB} from "../../services/UrlCategoryDataBaseManager";

/* ------------------------------------------------------------------ */
/* 常量                                                               */
/* ------------------------------------------------------------------ */

// 已知类别总数，用于熵归一化（最大熵 = log2(CATEGORY_COUNT)）
const CATEGORY_COUNT = 11;

/* ------------------------------------------------------------------ */
/* URL 提取                                                           */
/* ------------------------------------------------------------------ */

/** 从切换类事件中取出用于定类的 URL；非切换事件返回 null */
function extractSwitchUrl(e: Event): string | null {
    switch (e.type) {
        case "tab_changed":
            return (e as TabChanged).new_url || e.url || null;
        case "tab_created":
        case "tab_closed":
            return e.url || null;
        default:
            return null;
    }
}

/** 从完整 URL 中提取规范化域名（去除协议、www 前缀、路径） */
function extractDomain(url: string): string | null {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------------ */
/* 类别序列解析                                                       */
/* ------------------------------------------------------------------ */

/** 按时间顺序把切换事件解析成类别序列，无法定类的事件被忽略 */
async function resolveCategorySequence(events: Event[]): Promise<UrlCategory[]> {
    const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const categories: UrlCategory[] = [];
    for (const e of ordered) {
        const url = extractSwitchUrl(e);
        if (!url) continue;

        const domain = extractDomain(url);
        if (!domain) continue;

        const category = await urlCategoryDB.lookupCategory(domain);
        if (!category) continue;

        categories.push(category);
    }
    return categories;
}

/* ------------------------------------------------------------------ */
/* 跨类别切换熵计算                                                   */
/* ------------------------------------------------------------------ */

function calculateCrossCategoryEntropy(categories: UrlCategory[]): number {
    if (categories.length < 2) return 0;

    const transitionCounts = new Map<UrlCategory, number>();
    let totalSwitches = 0;

    for (let i = 1; i < categories.length; i++) {
        const prev = categories[i - 1];
        const curr = categories[i];

        // 同类别停留，不算跨类别切换
        if (prev === curr) continue;

        transitionCounts.set(curr, (transitionCounts.get(curr) ?? 0) + 1);
        totalSwitches++;
    }

    if (totalSwitches === 0) return 0;

    let entropy = 0;
    for (const count of transitionCounts.values()) {
        const p = count / totalSwitches;
        entropy -= p * Math.log2(p);
    }

    // 归一化到 [0, 1]（最大熵 = log2(CATEGORY_COUNT)）
    const maxEntropy = Math.log2(CATEGORY_COUNT);
    return entropy / maxEntropy;
}

/* ------------------------------------------------------------------ */
/* 公开 API                                                           */
/* ------------------------------------------------------------------ */

/**
 * 计算当前 5s 滑动窗口内标签页/窗口切换的跨类别随机性，返回 [0, 1]。
 * 依赖 URL 分类器：只统计能定类的切换事件，且仅对类别发生变化的转移计数。
 */
export async function calculateSwitchEntropy(): Promise<number> {
    const recentEvents = queue.getEvents();
    const categories = await resolveCategorySequence(recentEvents);
    return calculateCrossCategoryEntropy(categories);
}
