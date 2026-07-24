import "./TabListener";
import "./WindowFocusListener";
import "./IdleListener";
import { queue } from "./EventQueue";
import { engine } from "./engine/CognitiveLoadEngine";
import { tabEventBuffer } from "./engine/TabEventBuffer";
import { sessionTracker } from "./engine/SessionTracker";
import { dataQualityGate } from "./engine/DataQualityGate";
import { personalCalibration } from "./engine/PersonalCalibration";
import { briHistoryBuffer } from "./engine/BRIHistoryBuffer";
import { triggerEngine } from "./engine/TriggerEngine";
import { eventLog } from "./EventLog";
import { applyEventToTracker, domainTimeTracker } from "./DomainTimeTracker";
import { calcuateMouseAnthropy, calculateEyeHandDelay } from "./helper/MouseTrackAnalyzer";
import { calculateEventFrequency } from "./helper/EventFrequencyAnalyzer";
import { calculateDeleteKeyRatio } from "./helper/KeyboardAnalyzer";
import { getCategory } from "../services/CategoryService";
import { eventDB } from "../services/EventDataBaseManager";
import { timeDataStore, toDayKey } from "../services/TimeDataStore";
import {
    type CategorizeResponse,
    type DebugEngineTickResponse,
    type DebugInjectMetricsResponse,
    type DebugStateResponse,
    type EngineInternals,
    isCategorizeRequest,
    isDebugEngineTickRequest,
    isDebugInjectMetricsRequest,
    isDebugStateRequest,
    type PortEventStats,
} from "../messages";
import type { Event } from "../models/events/Event";
import type { PageComplexitySnapshot } from "./engine/types";
import { loadOption } from "../services/OptionStore";
import { compareTime } from "../utils/time";
import { isDevEnvironment } from "../utils/env";
import { routineStore } from "../services/RoutineStore";

// 启动认知负荷引擎（纯计算，结果通过 engine.getLastResult() 查询）
engine.start();

/* --- 持久化层：崩溃恢复 + 周期性 checkpoint --- */

const PERSIST_ALARM_NAME = "brainrest-persist-tick";

/**
 * SW 启动恢复：从 TimeDataStore 载入今日状态，重放 checkpoint 之后的
 * 未处理事件补齐缺口，随后落盘并收敛 WAL。
 */
async function recoverPersistence(): Promise<void> {
    const now = Date.now();
    await domainTimeTracker.init(now);

    const today = await timeDataStore.getDay(toDayKey(now));
    const checkpointAt = today?.checkpointAt ?? 0;

    const unprocessed = await eventDB.getUnprocessed();
    const replay = unprocessed
        .filter((e) => e.timestamp > checkpointAt)
        .sort((a, b) => a.timestamp - b.timestamp);
    for (const event of replay) {
        applyEventToTracker(event);
    }

    await domainTimeTracker.checkpoint(now);
    await eventDB.markProcessedBefore(now);
    await timeDataStore.prune();
}

/** 周期性 checkpoint：刷 WAL、落盘时长快照、收敛已处理事件 */
async function persistTick(): Promise<void> {
    const now = Date.now();
    await eventLog.flush();
    await domainTimeTracker.checkpoint(now);
    await eventDB.markProcessedBefore(now);
}

void recoverPersistence();

void chrome.alarms.get(PERSIST_ALARM_NAME).then((alarm) => {
    if (!alarm) {
        void chrome.alarms.create(PERSIST_ALARM_NAME, { periodInMinutes: 0.5 });
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === PERSIST_ALARM_NAME) {
        void persistTick();
    }
});

/* --- 调试统计（供 popup Debug 页查询，不参与业务计算） --- */
const swStartedAt = Date.now();
const portStats: PortEventStats = {
    total: 0,
    byType: {},
    lastEventAt: null,
    connectedPorts: 0,
};

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "event-stream") return;

    portStats.connectedPorts += 1;
    port.onDisconnect.addListener(() => {
        portStats.connectedPorts -= 1;
    });

    port.onMessage.addListener((message: Event) => {
        // 调试统计：记录接收到的端口事件
        portStats.total += 1;
        portStats.byType[message.type] = (portStats.byType[message.type] ?? 0) + 1;
        portStats.lastEventAt = message.timestamp;

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

        // 写前日志（WAL 崩溃备份）+ 域名会话时长追踪
        eventLog.append(message);
        domainTimeTracker.onActivity(message.url, message.timestamp);
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

/**
 * popup Debug 页调试查询：同步返回 service worker 当前运行状态
 * （引擎输出、5s 事件队列快照、端口事件统计、引擎/分析器内部实时值）。
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isDebugStateRequest(message)) {
        return false;
    }
    // 阅读式采集：阅读各单例/分析器当前值，不改变业务状态
    const engineInternals: EngineInternals = {
        frontMinutes: sessionTracker.getFrontMinutes(),
        coverage: dataQualityGate.getCoverage(),
        kPersonal: personalCalibration.getK(),
        switchCount: tabEventBuffer.getSwitchCount(),
        loadCount: tabEventBuffer.getLoadCount(),
        briLatest: briHistoryBuffer.getLatest(),
        highLoadMinutes: briHistoryBuffer.getHighLoadDuration(70, 30),
        auc: briHistoryBuffer.getAUC(60),
        lastTriggeredAt: triggerEngine.getLastTriggeredAt(),
        mouseEntropy: calcuateMouseAnthropy(),
        eyeHandDelayMs: calculateEyeHandDelay(),
        eventFrequency: calculateEventFrequency(),
        deleteKeyRatio: calculateDeleteKeyRatio(),
    };
    const response: DebugStateResponse = {
        ok: true,
        startedAt: swStartedAt,
        engineResult: engine.getLastResult(),
        queueEvents: queue.getEvents(),
        portStats: { ...portStats, byType: { ...portStats.byType } },
        engineInternals,
    };
    sendResponse(response);
    return false; // 同步应答，无需保持通道
});

/**
 * 设置页调试模式：注入监测数据，快速构造提醒触发条件。
 * 只改写内存态（BRI 历史、前台时长、覆盖率采样、冷却），不落盘。
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isDebugInjectMetricsRequest(message)) {
        return false;
    }
    // 生产环境（商店安装）整体屏蔽调试写入通道
    if (!isDevEnvironment()) {
        const response: DebugInjectMetricsResponse = {
            ok: false,
            error: "生产环境已禁用调试通道",
        };
        sendResponse(response);
        return false;
    }
    try {
        const now = Date.now();

        // 回填 BRI 历史序列：按引擎采样节奏（30s）铺满指定时间跨度
        if (message.briValue !== undefined && message.briMinutes !== undefined) {
            const value = Math.min(Math.max(message.briValue, 0), 100);
            const spanMs = Math.min(Math.max(message.briMinutes, 0), 60) * 60_000;
            for (let offset = spanMs; offset >= 0; offset -= 30_000) {
                briHistoryBuffer.push(value, now - offset);
            }
        }

        // 改写连续前台时长（硬门槛：>=30min）
        if (message.frontMinutes !== undefined) {
            sessionTracker.debugSetFrontMinutes(message.frontMinutes);
        }

        // 铺满 120s 评估窗口采样：覆盖率拉到 1，同时刷新引擎样本新鲜度
        if (message.fillCoverage) {
            for (let offset = 120_000; offset >= 0; offset -= 20_000) {
                dataQualityGate.recordSample(now - offset);
            }
            engine.debugTouchSample();
        }

        // 清零冷却，允许立即再次命中触发路径
        if (message.resetCooldown) {
            triggerEngine.resetCooldown();
        }

        const response: DebugInjectMetricsResponse = { ok: true };
        sendResponse(response);
    } catch (e: unknown) {
        const response: DebugInjectMetricsResponse = { ok: false, error: (e as Error).message };
        sendResponse(response);
    }
    return false; // 同步应答，无需保持通道
});

/** 设置页调试模式：手动执行一次认知引擎计算，返回本次 tick 后的最新输出 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isDebugEngineTickRequest(message)) {
        return false;
    }
    // 生产环境（商店安装）整体屏蔽调试写入通道
    if (!isDevEnvironment()) {
        const response: DebugEngineTickResponse = {
            ok: false,
            error: "生产环境已禁用调试通道",
            engineResult: null,
        };
        sendResponse(response);
        return false;
    }
    void (async () => {
        try {
            const engineResult = await engine.forceTick();
            const response: DebugEngineTickResponse = { ok: true, engineResult };
            sendResponse(response);
        } catch (e: unknown) {
            const response: DebugEngineTickResponse = {
                ok: false,
                error: (e as Error).message,
                engineResult: null,
            };
            sendResponse(response);
        }
    })();
    return true; // 保持 sendResponse 通道开放（异步响应）
});

chrome.runtime.onStartup.addListener(async () => {
    const lastEvent = await eventDB.getRecentEvent();
    if (!lastEvent) return;
    const lastEventDate = new Date(lastEvent.timestamp);
    const now = new Date();
    const options = await loadOption();
    // 如果上次事件发生在用户的睡眠时间之前，并且当前时间在用户的清醒时间之后
    // 就认为用户已经休息过了。记录入睡时刻（最后活动时间）与起床时刻（当前时间）到数据库
    if (
        compareTime(
            [lastEventDate.getHours(), lastEventDate.getMinutes()],
            options.latestSleepTime,
        ) <= 0 &&
        compareTime([now.getHours(), now.getMinutes()], options.earliestWakeTime) >= 0
    ) {
        let day = lastEventDate.getDate();
        if (lastEventDate.getHours() >= 0) {
            day -= 1;
        }
        await routineStore.put(
            `${lastEventDate.getFullYear()}-${lastEventDate.getMonth() + 1}-${day}`,
            lastEventDate.getHours(),
            lastEventDate.getMinutes(),
            now.getHours(),
            now.getMinutes(),
        );
    }
});
