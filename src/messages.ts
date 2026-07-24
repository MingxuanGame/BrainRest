import type { UrlCategory } from "./models/types";
import type { BRIResult, PageComplexitySnapshot } from "./background/engine/types";
import type { Event } from "./models/events/Event";

/** content -> background：请求对当前页面做 URL 分类 */
export interface CategorizeRequest {
    type: "categorize";
    url: string;
    html: string;
}

/** background -> content：分类结果（仅确认/错误信息；分类已落 IDB 供下游反查） */
export interface CategorizeResponse {
    ok: boolean;
    error?: string;
    domain?: string;
    category?: UrlCategory;
}

/** popup -> background：查询 service worker 调试状态 */
export interface DebugStateRequest {
    type: "debug_get_state";
}

/** service worker 端口事件接收统计 */
export interface PortEventStats {
    /** 累计接收的端口事件数 */
    total: number;
    /** 按事件类型的接收计数 */
    byType: Record<string, number>;
    /** 最近一次接收事件的时间戳 (ms) */
    lastEventAt: number | null;
    /** 当前存活的 event-stream 端口数 */
    connectedPorts: number;
}

/** 引擎及分析器内部实时状态（Debug 专用，由 service worker 即时计算） */
export interface EngineInternals {
    /** SessionTracker：连续前台时长 (min) */
    frontMinutes: number;
    /** DataQualityGate：数据覆盖率 C_data (0-1) */
    coverage: number;
    /** PersonalCalibration：个人校准系数 k_personal */
    kPersonal: number;
    /** TabEventBuffer：最近 5min 标签页激活次数 N_switch */
    switchCount: number;
    /** TabEventBuffer：最近 5min 页面加载次数 N_load */
    loadCount: number;
    /** BRIHistoryBuffer：最近一条 BRI_display（null = 无采样） */
    briLatest: number | null;
    /** BRIHistoryBuffer：30min 窗口内 BRI>=70 累计时长 (min)，触发路径 A 输入 */
    highLoadMinutes: number;
    /** BRIHistoryBuffer：60min 窗口 AUC 积分 (score·min)，触发路径 B 输入 */
    auc: number;
    /** TriggerEngine：上次触发时间戳（0 = 从未触发） */
    lastTriggeredAt: number;
    /** MouseTrackAnalyzer：归一化轨迹熵 (0-1) */
    mouseEntropy: number;
    /** MouseTrackAnalyzer：眼-手延迟 (ms)，null = 无有效数据 */
    eyeHandDelayMs: number | null;
    /** EventFrequencyAnalyzer：5s 窗口事件频率 (events/s) */
    eventFrequency: number;
    /** KeyboardAnalyzer：删除键占比 (0-1) */
    deleteKeyRatio: number;
}

/** background -> popup：service worker 调试状态快照 */
export interface DebugStateResponse {
    ok: boolean;
    error?: string;
    /** service worker 本次启动时间 (ms) */
    startedAt: number;
    /** 认知负荷引擎最近一次输出（null = 尚未 tick） */
    engineResult: BRIResult | null;
    /** 5s 滑动窗口队列当前快照 */
    queueEvents: Event[];
    /** 端口事件统计 */
    portStats: PortEventStats;
    /** 引擎及分析器内部实时状态 */
    engineInternals: EngineInternals;
}

/** options 调试模式 -> background：注入监测数据以快速构造提醒触发条件 */
export interface DebugInjectMetricsRequest {
    type: "debug_inject_metrics";
    /** 回填 BRI 历史序列的数值（配合 briMinutes 使用） */
    briValue?: number;
    /** 回填 BRI 历史序列的时间跨度 (min)，按 30s 间隔回填 */
    briMinutes?: number;
    /** 直接改写连续前台时长 (min) */
    frontMinutes?: number;
    /** 铺满 120s 评估窗口的采样，把数据覆盖率拉到 1 并刷新新鲜度 */
    fillCoverage?: boolean;
    /** 清零触发冷却计时 */
    resetCooldown?: boolean;
}

/** background -> options：注入结果 */
export interface DebugInjectMetricsResponse {
    ok: boolean;
    error?: string;
}

/** options 调试模式 -> background：手动执行一次认知引擎计算 */
export interface DebugEngineTickRequest {
    type: "debug_engine_tick";
}

/** background -> options：手动计算结果（engineResult 为本次 tick 后的最新输出） */
export interface DebugEngineTickResponse {
    ok: boolean;
    error?: string;
    engineResult: BRIResult | null;
}

/** options 调试模式 -> content：强制对所在页面执行一次 AI 分类（content 中转 categorize） */
export interface DebugForceCategorizeRequest {
    type: "debug_force_categorize";
}

/** popup -> content：调试 ping（经 chrome.tabs.sendMessage 发往活动标签页） */
export interface DebugContentPingRequest {
    type: "debug_content_ping";
}

/** content 事件发送统计 */
export interface ContentEventStats {
    /** 累计发送的事件数 */
    total: number;
    /** 按事件类型的发送计数 */
    byType: Record<string, number>;
    /** 最近一次发送事件的时间戳 (ms) */
    lastEventAt: number | null;
    /** event-stream 端口是否仍存活 */
    portAlive: boolean;
}

/** content -> popup：内容脚本调试状态 */
export interface DebugContentPingResponse {
    ok: boolean;
    error?: string;
    /** 内容脚本所在页面 URL */
    url: string;
    /** 事件发送统计 */
    eventStats: ContentEventStats;
    /** 即时采集的页面复杂度快照（采集失败时为 null） */
    complexity: PageComplexitySnapshot | null;
}

/** 运行时消息判别 */
export type RuntimeMessage =
    | CategorizeRequest
    | DebugStateRequest
    | DebugContentPingRequest
    | DebugInjectMetricsRequest
    | DebugEngineTickRequest
    | DebugForceCategorizeRequest;

export function isCategorizeRequest(m: unknown): m is CategorizeRequest {
    return typeof m === "object" && m !== null && (m as { type?: unknown }).type === "categorize";
}

export function isDebugStateRequest(m: unknown): m is DebugStateRequest {
    return (
        typeof m === "object" && m !== null && (m as { type?: unknown }).type === "debug_get_state"
    );
}

export function isDebugContentPingRequest(m: unknown): m is DebugContentPingRequest {
    return (
        typeof m === "object" &&
        m !== null &&
        (m as { type?: unknown }).type === "debug_content_ping"
    );
}

export function isDebugInjectMetricsRequest(m: unknown): m is DebugInjectMetricsRequest {
    return (
        typeof m === "object" &&
        m !== null &&
        (m as { type?: unknown }).type === "debug_inject_metrics"
    );
}

export function isDebugEngineTickRequest(m: unknown): m is DebugEngineTickRequest {
    return (
        typeof m === "object" &&
        m !== null &&
        (m as { type?: unknown }).type === "debug_engine_tick"
    );
}

export function isDebugForceCategorizeRequest(m: unknown): m is DebugForceCategorizeRequest {
    return (
        typeof m === "object" &&
        m !== null &&
        (m as { type?: unknown }).type === "debug_force_categorize"
    );
}
