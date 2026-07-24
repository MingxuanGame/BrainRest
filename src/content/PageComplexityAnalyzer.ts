import { sendEvent } from "./EventChannel";
import type { Event } from "../models/events/Event";
import { createEvent } from "../models/events/Event";
import type { PageComplexitySnapshot } from "../background/engine/types";

/* ------------------------------------------------------------------ */
/* 常量                                                               */
/* ------------------------------------------------------------------ */

/** 采样周期 30s */
const SAMPLE_INTERVAL_MS = 30_000;

/* ------------------------------------------------------------------ */
/* 页面复杂度事件类型                                                  */

/* ------------------------------------------------------------------ */

export interface PageComplexityEvent extends Event {
    type: "page_complexity";
    /** 可视区域文字字符数 / 视口面积 (chars·px⁻²) */
    textDensity: number;
    /** 页面表格元素数量 */
    tableCount: number;
    /** 页面代码块元素数量 */
    codeCount: number;
    /** 页面列表元素数量 */
    listCount: number;
    /** 页面标题元素数量 */
    headingCount: number;
}

/* ------------------------------------------------------------------ */
/* 文字密度计算                                                        */

/* ------------------------------------------------------------------ */

/**
 * 统计可视区域内的文字字符数。
 * 使用 TreeWalker 遍历 body 下的文本节点，
 * 仅计入父元素在视口内可见的文本。
 */
function countVisibleTextChars(): number {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let totalChars = 0;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;

            // 跳过不可见元素
            const style = window.getComputedStyle(parent);
            if (
                style.display === "none" ||
                style.visibility === "hidden" ||
                style.opacity === "0"
            ) {
                return NodeFilter.FILTER_REJECT;
            }

            // 检查元素是否在视口内（至少部分可见）
            const rect = parent.getBoundingClientRect();
            if (
                rect.bottom < 0 ||
                rect.top > viewportHeight ||
                rect.right < 0 ||
                rect.left > viewportWidth
            ) {
                return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_ACCEPT;
        },
    });

    let node: Node | null;
    while ((node = walker.nextNode())) {
        const text = node.textContent?.trim();
        if (text) {
            totalChars += text.length;
        }
    }

    return totalChars;
}

/**
 * 计算文字密度 ρ_raw = 可视区域文字字符数 / 视口面积 (chars·px⁻²)
 */
function calculateTextDensity(): number {
    const viewportArea = window.innerWidth * window.innerHeight;
    if (viewportArea === 0) return 0;

    const charCount = countVisibleTextChars();
    return charCount / viewportArea;
}

/* ------------------------------------------------------------------ */
/* 结构元素计数                                                        */

/* ------------------------------------------------------------------ */

function countStructureElements(): {
    tableCount: number;
    codeCount: number;
    listCount: number;
    headingCount: number;
} {
    return {
        tableCount: document.querySelectorAll("table").length,
        codeCount: document.querySelectorAll("pre, code").length,
        listCount: document.querySelectorAll("ul, ol, dl").length,
        headingCount: document.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
    };
}

/* ------------------------------------------------------------------ */
/* 采样与上报                                                          */

/* ------------------------------------------------------------------ */

/** 即时采集一份页面复杂度快照（供 DebugResponder 按需调用，不上报） */
export function collectComplexitySnapshot(): PageComplexitySnapshot {
    const { tableCount, codeCount, listCount, headingCount } = countStructureElements();
    return {
        textDensity: calculateTextDensity(),
        tableCount,
        codeCount,
        listCount,
        headingCount,
        timestamp: Date.now(),
    };
}

function sampleAndReport(): void {
    // 页面不可见时跳过采样
    if (document.hidden) return;

    const textDensity = calculateTextDensity();
    const { tableCount, codeCount, listCount, headingCount } = countStructureElements();

    const event = createEvent<PageComplexityEvent>({
        type: "page_complexity",
        url: window.location.href,
        textDensity,
        tableCount,
        codeCount,
        listCount,
        headingCount,
    });

    sendEvent(event);
}

/* ------------------------------------------------------------------ */
/* 启动定时采样                                                        */
/* ------------------------------------------------------------------ */

// 页面加载后延迟 5s 首次采样（等待 UI 稳定），之后每 30s 采样
window.addEventListener("load", () => {
    setTimeout(() => {
        sampleAndReport();
        setInterval(sampleAndReport, SAMPLE_INTERVAL_MS);
    }, 5_000);
});
