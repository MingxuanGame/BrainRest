import "./TabListener";
import "./WindowFocusListener";
import "./IdleListener";
import {queue} from "./EventQueue";
import {engine} from "./engine/CognitiveLoadEngine";
import {tabEventBuffer} from "./engine/TabEventBuffer";
import {getCategory} from "../services/CategoryService";
import {type CategorizeResponse, isCategorizeRequest} from "../messages";
import type {Event} from "../models/events/Event";
import type {PageComplexitySnapshot} from "./engine/types";

// 启动认知负荷引擎（纯计算，结果通过 engine.getLastResult() 查询）
engine.start();

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "event-stream") return;

    port.onMessage.addListener((message: Event) => {
        // 页面复杂度事件：转发给引擎，不进入 5s 事件队列
        if (message.type === "page_complexity") {
            const raw = message as unknown as Record<string, unknown>;
            const snapshot: PageComplexitySnapshot = {
                textDensity: (raw.textDensity as number) ?? 0,
                tableCount: (raw.tableCount as number) ?? 0,
                codeCount: (raw.codeCount as number) ?? 0,
                listCount: (raw.listCount as number) ?? 0,
                headingCount: (raw.headingCount as number) ?? 0,
                timestamp: message.timestamp,
            };
            engine.receivePageComplexity(snapshot);
            return;
        }

        // 标签页激活事件：写入 TabEventBuffer（用于 5min 切换负荷统计）
        if (message.type === "tab_activated") {
            tabEventBuffer.pushSwitch(message.timestamp);
        }

        // 所有事件进入 5s 滑动窗口队列（物理信号计算用）
        queue.push(message);

        // 转发给引擎（活跃度追踪、数据质量门控等）
        engine.receiveEvent(message);
    });
});

/**
 * 接收 content script 发来的分类请求，在 service worker 中执行 getCategory。
 * apiKey 只在 background 持有，页面上下文无法访问；分类结果落 IDB 供下游反查。
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isCategorizeRequest(message)) {
        return false;
    }
    void (async () => {
        try {
            const result = await getCategory(message.url, message.html);
            const response: CategorizeResponse = {
                ok: true,
                domain: result.domain,
                category: result.category,
            };
            sendResponse(response);
        } catch (e: unknown) {
            const response: CategorizeResponse = {
                ok: false,
                error: (e as Error).message,
            };
            sendResponse(response);
        }
    })();
    return true; // 保持 sendResponse 通道开放（异步响应）
});
