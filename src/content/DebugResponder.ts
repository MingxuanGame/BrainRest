import { getEventStats } from "./EventChannel";
import { collectComplexitySnapshot } from "./PageComplexityAnalyzer";
import {
    type CategorizeRequest,
    type CategorizeResponse,
    type DebugContentPingResponse,
    isDebugContentPingRequest,
    isDebugForceCategorizeRequest,
} from "../messages";
import type { PageComplexitySnapshot } from "../background/engine/types";

/**
 * 响应 popup Debug 页经 chrome.tabs.sendMessage 发来的调试 ping：
 * 返回内容脚本存活状态、事件发送统计与即时页面复杂度快照。
 * 仅作诊断用途，不进入事件流。
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isDebugContentPingRequest(message)) {
        return false;
    }

    let complexity: PageComplexitySnapshot | null = null;
    try {
        complexity = collectComplexitySnapshot();
    } catch {
        // 复杂度采集失败不影响 ping 应答
    }

    const response: DebugContentPingResponse = {
        ok: true,
        url: window.location.href,
        eventStats: getEventStats(),
        complexity,
    };
    sendResponse(response);
    return false; // 同步应答，无需保持通道
});

/**
 * 响应设置页调试模式的强制分类请求：抽取当前页面 {url, html}
 * 中转给 background 执行 getCategory（与自动分类同一链路，apiKey 仅在 background 持有），
 * 并将分类结果回传给设置页。
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isDebugForceCategorizeRequest(message)) {
        return false;
    }
    void (async () => {
        try {
            const request: CategorizeRequest = {
                type: "categorize",
                url: window.location.href,
                html: document.documentElement.outerHTML,
            };
            const result = (await chrome.runtime.sendMessage(request)) as
                CategorizeResponse | undefined;
            sendResponse(result ?? { ok: false, error: "background 未响应" });
        } catch (e: unknown) {
            const response: CategorizeResponse = { ok: false, error: (e as Error).message };
            sendResponse(response);
        }
    })();
    return true; // 保持 sendResponse 通道开放（异步响应）
});
