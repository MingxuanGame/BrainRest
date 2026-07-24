import { getEventStats } from "./EventChannel";
import { collectComplexitySnapshot } from "./PageComplexityAnalyzer";
import { type DebugContentPingResponse, isDebugContentPingRequest } from "../messages";
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
