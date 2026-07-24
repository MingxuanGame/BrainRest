import type {
    CategorizeResponse,
    DebugEngineTickRequest,
    DebugEngineTickResponse,
    DebugForceCategorizeRequest,
    DebugInjectMetricsRequest,
    DebugInjectMetricsResponse,
    DebugStateRequest,
    DebugStateResponse,
} from "../messages";
import type { BRIResult, LoadLevel } from "../background/engine/types";

/** UI 展示用负荷等级（ADVX 视觉沿用 low/medium/high/insufficient 命名） */
export type UiLoadLevel = "low" | "medium" | "high" | "insufficient";

/** UI 展示用运行状态（BrainRest 无授权/暂停语义，仅保留三态） */
export type UiStatus = "running" | "insufficient-data" | "degraded";

/** 产品边界文案（估计值声明） */
export const PRODUCT_BOUNDARY_COPY =
    "脑栖根据浏览行为和页面结构估计负荷，不是医学、生理或真实认知状态测量。";

/**
 * 查询 service worker 调试状态快照（UI 与 messages.ts 的唯一接口）。
 * 失败（SW 未就绪 / 消息通道异常）时抛出，由调用方降级为 degraded。
 */
export async function getDebugState(): Promise<DebugStateResponse> {
    const request: DebugStateRequest = { type: "debug_get_state" };
    const response = (await chrome.runtime.sendMessage(request)) as DebugStateResponse | undefined;
    if (!response || !response.ok) {
        throw new Error(response?.error ?? "service worker 未响应");
    }
    return response;
}

/** 引擎等级 → UI 等级：moderate→medium、insufficient_data→insufficient */
export function mapLoadLevel(level: LoadLevel | null | undefined): UiLoadLevel {
    switch (level) {
        case "low":
            return "low";
        case "moderate":
            return "medium";
        case "high":
            return "high";
        default:
            return "insufficient";
    }
}

/** 由调试快照推导 UI 运行状态：有结果且覆盖率达标→running；否则→insufficient-data */
export function deriveStatus(state: DebugStateResponse): UiStatus {
    if (state.engineResult && state.engineResult.level !== "insufficient_data") {
        return "running";
    }
    return "insufficient-data";
}

/* ------------------------------------------------------------------ */
/* 设置页调试模式专用接口                                              */
/* ------------------------------------------------------------------ */

/** 向 service worker 注入监测数据（仅改内存态），失败时抛出 */
export async function injectDebugMetrics(
    payload: Omit<DebugInjectMetricsRequest, "type">,
): Promise<void> {
    const request: DebugInjectMetricsRequest = { type: "debug_inject_metrics", ...payload };
    const response = (await chrome.runtime.sendMessage(request)) as
        DebugInjectMetricsResponse | undefined;
    if (!response || !response.ok) {
        throw new Error(response?.error ?? "service worker 未响应");
    }
}

/** 手动执行一次认知引擎计算，返回本次 tick 后的最新输出 */
export async function forceEngineTick(): Promise<BRIResult | null> {
    const request: DebugEngineTickRequest = { type: "debug_engine_tick" };
    const response = (await chrome.runtime.sendMessage(request)) as
        DebugEngineTickResponse | undefined;
    if (!response || !response.ok) {
        throw new Error(response?.error ?? "service worker 未响应");
    }
    return response.engineResult;
}

/** 找到最适合分类的网页标签页：优先各窗口活动的 http(s) 页，按最近访问时间排序 */
async function findCategorizableTab(): Promise<chrome.tabs.Tab> {
    const tabs = await chrome.tabs.query({});
    const webTabs = tabs.filter((t) => t.url?.startsWith("http"));
    if (webTabs.length === 0) {
        throw new Error("未找到可分类的网页标签页（需 http/https 页面）");
    }
    webTabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
    return webTabs.find((t) => t.active) ?? webTabs[0];
}

/** 对最近使用的网页标签页强制执行一次 AI 分类，返回分类结果与页面 URL */
export async function forceCategorizeActiveTab(): Promise<{
    result: CategorizeResponse;
    tabUrl: string;
}> {
    const tab = await findCategorizableTab();
    const request: DebugForceCategorizeRequest = { type: "debug_force_categorize" };
    let result: CategorizeResponse | undefined;
    try {
        result = (await chrome.tabs.sendMessage(tab.id!, request)) as CategorizeResponse;
    } catch (e: unknown) {
        throw new Error(
            `content script 无应答（${(e as Error).message}）。页面可能尚未注入，请刷新目标页面后重试`,
            { cause: e },
        );
    }
    if (!result) {
        throw new Error("content script 未返回分类结果");
    }
    return { result, tabUrl: tab.url ?? "" };
}
