import type {
    CategorizeRequest,
    CategorizeResponse,
    DebugContentPingRequest,
    DebugContentPingResponse,
    DebugStateRequest,
    DebugStateResponse,
} from "../../messages";
import { clearOption, loadOption, saveOption } from "../../services/OptionStore";
import { urlCategoryDB } from "../../services/UrlCategoryDataBaseManager";
import { eventDB } from "../../services/EventDataBaseManager";
import { type DailyTimeRecord, timeDataStore, toDayKey } from "../../services/TimeDataStore";
import {
    categoryDurationsOf,
    domainDurationsOf,
    UNKNOWN_CATEGORY,
} from "../../background/DomainTimeTracker";
import { createEvent } from "../../models/events/Event";
import type { Event } from "../../models/events/Event";
import { loadTypeProfiles } from "../../data/load-types";
import { categoryLoadType } from "../../data/category-load-type";
import { triggerBaseline } from "../../data/trigger-baseline";
import { fatigueTitle } from "../../data/fatigue-title";
import { TYPE_BASELINE, type TriggerPath } from "../../background/engine/types";
import type { UrlCategory } from "../../models/types";
import type { BRIResult } from "../../background/engine/types";
import { buildRestSuggestion, pickActivities } from "../../background/engine/RestSuggestion";

/* ------------------------------------------------------------------ */
/* 类型定义                                                            */
/* ------------------------------------------------------------------ */

export interface SubTest {
    id: string;
    name: string;
    /** 执行测试：返回详情文本，失败时抛错 */
    run: () => Promise<string>;
}

export interface TestGroup {
    id: string;
    name: string;
    scope: string;
    subTests: SubTest[];
}

/* ------------------------------------------------------------------ */
/* 工具函数                                                            */
/* ------------------------------------------------------------------ */

function formatByType(byType: Record<string, number>): string {
    const entries = Object.entries(byType);
    if (entries.length === 0) return "(无)";
    return entries.map(([type, count]) => `${type}×${count}`).join(", ");
}

function formatAgo(timestamp: number | null): string {
    if (timestamp === null || timestamp === 0) return "从未";
    return `${((Date.now() - timestamp) / 1000).toFixed(1)}s 前`;
}

/** 查询活动标签页（popup 所属窗口的当前标签页） */
async function getActiveTab(): Promise<chrome.tabs.Tab> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error("未找到活动标签页");
    }
    return tab;
}

/** 向 service worker 请求调试状态快照 */
async function fetchSwState(): Promise<DebugStateResponse> {
    const request: DebugStateRequest = { type: "debug_get_state" };
    const response = (await chrome.runtime.sendMessage(request)) as DebugStateResponse | undefined;
    if (!response?.ok) {
        throw new Error(response?.error ?? "service worker 无应答");
    }
    return response;
}

/** ping 活动标签页的 content script */
async function fetchContentPing(): Promise<DebugContentPingResponse> {
    const tab = await getActiveTab();
    const request: DebugContentPingRequest = { type: "debug_content_ping" };
    let response: DebugContentPingResponse | undefined;
    try {
        response = (await chrome.tabs.sendMessage(tab.id!, request)) as DebugContentPingResponse;
    } catch (e: unknown) {
        throw new Error(
            `content script 无应答（${(e as Error).message}）。` +
                "chrome:// 与扩展页面不会注入，请切到普通网页后重试",
            { cause: e },
        );
    }
    if (!response?.ok) {
        throw new Error(response?.error ?? "content script 返回异常");
    }
    return response;
}

/* ------------------------------------------------------------------ */
/* 分组 1：Service Worker 基础                                         */
/* ------------------------------------------------------------------ */

const swGroup: TestGroup = {
    id: "sw",
    name: "Service Worker 基础",
    scope: "service worker",
    subTests: [
        {
            id: "sw-ping",
            name: "存活 ping（消息往返）",
            run: async () => {
                const t0 = Date.now();
                const state = await fetchSwState();
                const rtt = Date.now() - t0;
                const uptimeSec = ((Date.now() - state.startedAt) / 1000).toFixed(0);
                return `往返 ${rtt}ms，本次启动于 ${uptimeSec}s 前`;
            },
        },
        {
            id: "sw-ports",
            name: "event-stream 端口连接",
            run: async () => {
                const state = await fetchSwState();
                const n = state.portStats.connectedPorts;
                if (n < 1) {
                    return `当前存活端口: ${n}（没有已注入 content script 的标签页在连接）`;
                }
                return `当前存活端口: ${n}`;
            },
        },
        {
            id: "sw-portEvents",
            name: "端口事件接收统计",
            run: async () => {
                const { portStats } = await fetchSwState();
                return [
                    `累计接收: ${portStats.total} 条（最近 ${formatAgo(portStats.lastEventAt)}）`,
                    `类型分布: ${formatByType(portStats.byType)}`,
                ].join("\n");
            },
        },
    ],
};

/* ------------------------------------------------------------------ */
/* 分组 2：事件队列 EventQueue                                          */
/* ------------------------------------------------------------------ */

const queueGroup: TestGroup = {
    id: "queue",
    name: "事件队列 EventQueue",
    scope: "service worker",
    subTests: [
        {
            id: "queue-snapshot",
            name: "5s 窗口快照",
            run: async () => {
                const { queueEvents } = await fetchSwState();
                const byType: Record<string, number> = {};
                for (const event of queueEvents) {
                    byType[event.type] = (byType[event.type] ?? 0) + 1;
                }
                return [
                    `窗口内事件: ${queueEvents.length} 条`,
                    `类型分布: ${formatByType(byType)}`,
                    "提示: 先在网页上移动鼠标/敲键盘再立即测试",
                ].join("\n");
            },
        },
        {
            id: "queue-window",
            name: "滑动窗口裁剪正确性",
            run: async () => {
                const { queueEvents } = await fetchSwState();
                const now = Date.now();
                // 5s 窗口 + 1s 传输/时钟余量
                const stale = queueEvents.filter((e) => now - e.timestamp > 6000);
                if (stale.length > 0) {
                    throw new Error(`发现 ${stale.length} 条超出 5s 窗口的事件未被裁剪`);
                }
                return `${queueEvents.length} 条事件全部位于 5s 窗口内`;
            },
        },
        {
            id: "queue-freq",
            name: "事件频率 f_interact",
            run: async () => {
                const { engineInternals } = await fetchSwState();
                return `f_interact = ${engineInternals.eventFrequency.toFixed(2)} events/s（满分阈值 10/s）`;
            },
        },
    ],
};

/* ------------------------------------------------------------------ */
/* 分组 3：认知负荷引擎                                                 */
/* ------------------------------------------------------------------ */

const engineGroup: TestGroup = {
    id: "engine",
    name: "认知负荷引擎",
    scope: "service worker",
    subTests: [
        {
            id: "engine-result",
            name: "BRIResult 总览（30s/tick）",
            run: async () => {
                const { engineResult: r } = await fetchSwState();
                if (!r) {
                    return "引擎已启动但尚未产出结果（每 30s tick 一次，请稍后重试）";
                }
                return [
                    `level=${r.level}  BRI_display=${r.briDisplay.toFixed(1)}`,
                    `CL_cog=${r.clCog.toFixed(1)}  CL_phy=${r.clPhy.toFixed(1)}  BRI_raw=${r.briRaw.toFixed(1)}  BRI=${r.bri.toFixed(1)}`,
                    `triggerPath=${r.triggerPath ?? "无"}  计算于 ${formatAgo(r.timestamp)}`,
                ].join("\n");
            },
        },
        {
            id: "engine-cog",
            name: "认知信号 D/B/ρ/S/P/T",
            run: async () => {
                const { engineResult: r } = await fetchSwState();
                if (!r) return "尚无 tick 结果";
                const s = r.cognitiveSignals;
                return [
                    `D(时长)=${s.D.toFixed(1)}  B(类型基线)=${s.B.toFixed(1)}`,
                    `ρ(文字密度)=${s.rho.toFixed(1)}  S(结构)=${s.S.toFixed(1)}  P(综合)=${s.P.toFixed(1)}`,
                    `T(切换负荷)=${s.T.toFixed(1)}`,
                    `合成 CL_cog = 0.35·D + 0.15·B + 0.30·P + 0.20·T = ${r.clCog.toFixed(1)}`,
                ].join("\n");
            },
        },
        {
            id: "engine-phy",
            name: "身体信号 E/L/I/R/R_rest",
            run: async () => {
                const { engineResult: r } = await fetchSwState();
                if (!r) return "尚无 tick 结果";
                const s = r.physicalSignals;
                return [
                    `E(轨迹熵)=${s.E.toFixed(1)}  L(眼手延迟)=${s.L.toFixed(1)}`,
                    `I(交互强度)=${s.I.toFixed(1)}  R(修正负荷)=${s.R.toFixed(1)}`,
                    `R_rest(休息衰减)=${s.R_rest.toFixed(1)}`,
                    `合成 CL_phy = ${r.clPhy.toFixed(1)}`,
                ].join("\n");
            },
        },
        {
            id: "engine-gate",
            name: "数据质量门控 C_data",
            run: async () => {
                const { engineInternals } = await fetchSwState();
                const c = engineInternals.coverage;
                return [
                    `C_data = ${c.toFixed(2)}（阈值 0.70，${c >= 0.7 ? "数据充足" : "数据不足"}）`,
                    "数据不足时引擎不更新 BRI_display、不参与触发判定",
                ].join("\n");
            },
        },
        {
            id: "engine-session",
            name: "SessionTracker 前台时长",
            run: async () => {
                const { engineInternals } = await fetchSwState();
                return `连续前台时长 t_front = ${engineInternals.frontMinutes.toFixed(1)} min（触发硬门槛 ≥30min）`;
            },
        },
        {
            id: "engine-tabbuf",
            name: "TabEventBuffer 5min 切换缓冲",
            run: async () => {
                const { engineInternals: i } = await fetchSwState();
                const t = Math.min(i.switchCount * 12.5 + i.loadCount * 7.5, 100);
                return [
                    `N_switch=${i.switchCount}  N_load=${i.loadCount}（最近 5min）`,
                    `推导切换负荷 T = min(N_switch×12.5 + N_load×7.5, 100) = ${t.toFixed(1)}`,
                    "提示: 切换几个标签页后重测，N_switch 应增加",
                ].join("\n");
            },
        },
        {
            id: "engine-brihistory",
            name: "BRIHistoryBuffer 60min 历史",
            run: async () => {
                const { engineInternals: i } = await fetchSwState();
                return [
                    `最近 BRI_display = ${i.briLatest?.toFixed(1) ?? "无采样"}`,
                    `路径A输入: 30min 内高负荷(≥70)时长 = ${i.highLoadMinutes.toFixed(1)} min（阈值 20min）`,
                    `路径B输入: 60min AUC = ${i.auc.toFixed(0)} score·min（阈值 4000）`,
                ].join("\n");
            },
        },
        {
            id: "engine-trigger",
            name: "TriggerEngine 触发状态",
            run: async () => {
                const { engineInternals: i, engineResult } = await fetchSwState();
                const inCooldown =
                    i.lastTriggeredAt > 0 && Date.now() - i.lastTriggeredAt < 30 * 60 * 1000;
                return [
                    `上次触发: ${formatAgo(i.lastTriggeredAt)}${inCooldown ? "（冷却期内）" : ""}`,
                    `最近 tick 命中路径: ${engineResult?.triggerPath ?? "无"}`,
                    `硬门槛: 前台 ${i.frontMinutes.toFixed(1)}/30 min，C_data ${i.coverage.toFixed(2)}/0.70`,
                ].join("\n");
            },
        },
        {
            id: "engine-calibration",
            name: "PersonalCalibration k_personal",
            run: async () => {
                const { engineInternals } = await fetchSwState();
                const k = engineInternals.kPersonal;
                if (k < 0.5 || k > 1.5) {
                    throw new Error(`k_personal=${k} 超出有效范围 [0.5, 1.5]`);
                }
                // 校验与 chrome.storage.local 持久化值一致（未持久化时为初始值 1.0）
                const stored = await chrome.storage.local.get("brainrest_k_personal");
                const saved = stored["brainrest_k_personal"];
                if (typeof saved === "number" && Math.abs(saved - k) > 1e-9) {
                    throw new Error(`内存值 ${k} 与存储值 ${saved} 不一致`);
                }
                return `k_personal = ${k.toFixed(2)}（存储值: ${typeof saved === "number" ? saved.toFixed(2) : "未持久化，用初始值"}）`;
            },
        },
    ],
};

/* ------------------------------------------------------------------ */
/* 分组 4：行为分析器 helper                                            */
/* ------------------------------------------------------------------ */

const helperGroup: TestGroup = {
    id: "helper",
    name: "行为分析器 (helper)",
    scope: "service worker",
    subTests: [
        {
            id: "helper-mouse",
            name: "MouseTrackAnalyzer 轨迹熵",
            run: async () => {
                const { engineInternals } = await fetchSwState();
                const h = engineInternals.mouseEntropy;
                return [
                    `归一化轨迹熵 = ${h.toFixed(3)}（0=单向直线，1=8向均匀）`,
                    "提示: 在网页上乱画鼠标后 5s 内重测，数值应上升",
                ].join("\n");
            },
        },
        {
            id: "helper-eyehand",
            name: "MouseTrackAnalyzer 眼-手延迟",
            run: async () => {
                const { engineInternals } = await fetchSwState();
                const d = engineInternals.eyeHandDelayMs;
                return d === null
                    ? 'τ_eye = null（5s 窗口内无"移动到目标后点击"的配对样本，属正常）'
                    : `τ_eye = ${d} ms（满分阈值 500ms）`;
            },
        },
        {
            id: "helper-freq",
            name: "EventFrequencyAnalyzer 交互频率",
            run: async () => {
                const { engineInternals, queueEvents } = await fetchSwState();
                const expected = queueEvents.length / 5;
                const actual = engineInternals.eventFrequency;
                // 两次 getEvents 之间窗口可能滑动，允许小偏差
                if (Math.abs(actual - expected) > 2) {
                    throw new Error(
                        `频率 ${actual.toFixed(2)}/s 与队列快照推算值 ${expected.toFixed(2)}/s 偏差过大`,
                    );
                }
                return `f_interact = ${actual.toFixed(2)} events/s（队列 ${queueEvents.length} 条 / 5s）`;
            },
        },
        {
            id: "helper-keyboard",
            name: "KeyboardAnalyzer 删除键占比",
            run: async () => {
                const { engineInternals } = await fetchSwState();
                const r = engineInternals.deleteKeyRatio;
                if (r < 0 || r > 1) {
                    throw new Error(`删除键占比 ${r} 超出 [0,1]`);
                }
                return [
                    `r_correct = ${(r * 100).toFixed(1)}%（Backspace/Delete ÷ 非快捷键按键）`,
                    "提示: 在网页输入框敲几个退格后 5s 内重测",
                ].join("\n");
            },
        },
    ],
};

/* ------------------------------------------------------------------ */
/* 分组 5：Content Script                                              */
/* ------------------------------------------------------------------ */

const contentGroup: TestGroup = {
    id: "content",
    name: "Content Script",
    scope: "content script",
    subTests: [
        {
            id: "content-ping",
            name: "存活 ping（活动标签页）",
            run: async () => {
                const t0 = Date.now();
                const response = await fetchContentPing();
                return `往返 ${Date.now() - t0}ms\n页面: ${response.url}`;
            },
        },
        {
            id: "content-port",
            name: "EventChannel 端口状态",
            run: async () => {
                const { eventStats } = await fetchContentPing();
                if (!eventStats.portAlive) {
                    throw new Error(
                        "event-stream 端口已断开（service worker 可能被回收后未重连，刷新页面可恢复）",
                    );
                }
                return "event-stream 端口存活";
            },
        },
        {
            id: "content-events",
            name: "DomListener 采集统计",
            run: async () => {
                const { eventStats } = await fetchContentPing();
                return [
                    `累计发送: ${eventStats.total} 条（最近 ${formatAgo(eventStats.lastEventAt)}）`,
                    `类型分布: ${formatByType(eventStats.byType)}`,
                    "覆盖: mousemove/click/keydown/keyup/scroll/touch*/fullscreen_change",
                ].join("\n");
            },
        },
        {
            id: "content-complexity",
            name: "PageComplexityAnalyzer 即时采样",
            run: async () => {
                const { complexity: c } = await fetchContentPing();
                if (!c) {
                    throw new Error("页面复杂度采集失败");
                }
                return [
                    `文字密度 ρ = ${c.textDensity.toExponential(2)} chars·px⁻²`,
                    `table=${c.tableCount}  code=${c.codeCount}  list=${c.listCount}  heading=${c.headingCount}`,
                    `采样于 ${formatAgo(c.timestamp)}`,
                ].join("\n");
            },
        },
    ],
};

/* ------------------------------------------------------------------ */
/* 分组 6：URL 分类链路                                                 */
/* ------------------------------------------------------------------ */

const categorizeGroup: TestGroup = {
    id: "categorize",
    name: "URL 分类链路",
    scope: "content ↔ SW 同链路",
    subTests: [
        {
            id: "cat-active",
            name: "活动标签页分类（缓存/AI）",
            run: async () => {
                const tab = await getActiveTab();
                if (!tab.url || !/^https?:/.test(tab.url)) {
                    throw new Error("活动标签页不是 http(s) 页面，无法测试分类");
                }
                const request: CategorizeRequest = {
                    type: "categorize",
                    url: tab.url,
                    html: `<html><head><title>${tab.title ?? ""}</title></head></html>`,
                };
                const response = (await chrome.runtime.sendMessage(request)) as
                    CategorizeResponse | undefined;
                if (!response) {
                    throw new Error("service worker 无应答");
                }
                if (!response.ok) {
                    throw new Error(
                        `分类失败: ${response.error ?? "未知错误"}（未命中缓存时需配置 apiKey）`,
                    );
                }
                return `${tab.url}\n分类结果: ${response.domain} -> ${response.category}`;
            },
        },
        {
            id: "cat-dbverify",
            name: "分类结果落库反查",
            run: async () => {
                const tab = await getActiveTab();
                if (!tab.url || !/^https?:/.test(tab.url)) {
                    throw new Error("活动标签页不是 http(s) 页面");
                }
                const domain = new URL(tab.url).hostname.toLowerCase().replace(/^www\./, "");
                const record = await urlCategoryDB.lookup(domain);
                if (!record) {
                    throw new Error(`本地库未收录 ${domain}（先运行"活动标签页分类"使其落库）`);
                }
                return [
                    `${domain} 命中记录: ${record.domain} -> ${record.category}`,
                    `更新于 ${formatAgo(record.updatedAt)}`,
                ].join("\n");
            },
        },
    ],
};

/* ------------------------------------------------------------------ */
/* 分组 7：OptionStore                                                  */
/* ------------------------------------------------------------------ */

const optionGroup: TestGroup = {
    id: "option",
    name: "OptionStore",
    scope: "services / chrome.storage",
    subTests: [
        {
            id: "opt-load",
            name: "loadOption 读取",
            run: async () => {
                const option = await loadOption();
                return [
                    `aiProvider=${option.aiProvider}  categorifyModel=${option.categorifyModel}`,
                    `apiKey: ${option.apiKey ? "已设置" : "未设置"}`,
                ].join("\n");
            },
        },
        {
            id: "opt-roundtrip",
            name: "saveOption 写读回环",
            run: async () => {
                const before = await loadOption();
                await saveOption(before);
                const after = await loadOption();
                if (JSON.stringify(before) !== JSON.stringify(after)) {
                    throw new Error("保存后读取的 Option 与保存前不一致");
                }
                return "读 -> 写 -> 读 回环一致";
            },
        },
        {
            id: "opt-clear",
            name: "clearOption 默认值回退（自动恢复）",
            run: async () => {
                const backup = await loadOption();
                try {
                    await clearOption();
                    const cleared = await loadOption();
                    if (
                        cleared.aiProvider !== "openai" ||
                        cleared.categorifyModel !== "gpt-4o-mini" ||
                        cleared.apiKey !== ""
                    ) {
                        throw new Error(`清除后未回退到默认值: ${JSON.stringify(cleared)}`);
                    }
                } finally {
                    // 无论成败都恢复原配置
                    await saveOption(backup);
                }
                const restored = await loadOption();
                if (JSON.stringify(restored) !== JSON.stringify(backup)) {
                    throw new Error("原配置恢复失败，请在设置中检查 Option");
                }
                return "clear -> 默认值校验 -> 原配置恢复 全部通过";
            },
        },
    ],
};

/* ------------------------------------------------------------------ */
/* 分组 8：URL 分类库 (IndexedDB)                                       */
/* ------------------------------------------------------------------ */

/** 测试专用域名统一使用 .invalid TLD，保证不与真实数据冲突 */
const TEST_DOMAIN = "debug-check.brainrest.invalid";
const TEST_DOMAIN_2 = "debug-check2.brainrest.invalid";

const urlDbGroup: TestGroup = {
    id: "urlDb",
    name: "URL 分类库 (IndexedDB)",
    scope: "services",
    subTests: [
        {
            id: "urldb-putget",
            name: "put / getExact",
            run: async () => {
                try {
                    await urlCategoryDB.put(TEST_DOMAIN, "low_load_utility");
                    const exact = await urlCategoryDB.getExact(TEST_DOMAIN);
                    if (exact?.category !== "low_load_utility") {
                        throw new Error("写入后精确查询未命中");
                    }
                    // 覆盖更新
                    await urlCategoryDB.put(TEST_DOMAIN, "social_feed");
                    const updated = await urlCategoryDB.getExact(TEST_DOMAIN);
                    if (updated?.category !== "social_feed") {
                        throw new Error("同 domain 覆盖更新失败");
                    }
                    return "写入、精确查询、覆盖更新 全部通过";
                } finally {
                    await urlCategoryDB.delete(TEST_DOMAIN);
                }
            },
        },
        {
            id: "urldb-batch",
            name: "batchPut 批量写入",
            run: async () => {
                try {
                    await urlCategoryDB.batchPut([
                        { domain: TEST_DOMAIN, category: "low_load_utility" },
                        { domain: TEST_DOMAIN_2, category: "low_load_utility" },
                    ]);
                    const a = await urlCategoryDB.getExact(TEST_DOMAIN);
                    const b = await urlCategoryDB.getExact(TEST_DOMAIN_2);
                    if (!a || !b) {
                        throw new Error("批量写入后存在未命中记录");
                    }
                    return "批量写入 2 条并逐条验证通过";
                } finally {
                    await urlCategoryDB.delete(TEST_DOMAIN);
                    await urlCategoryDB.delete(TEST_DOMAIN_2);
                }
            },
        },
        {
            id: "urldb-lookup",
            name: "lookup 子域名回溯 / lookupCategory",
            run: async () => {
                try {
                    await urlCategoryDB.put(TEST_DOMAIN, "low_load_utility");
                    // 子域名逐级回溯应命中父级记录
                    const record = await urlCategoryDB.lookup(`a.b.${TEST_DOMAIN}`);
                    if (record?.domain !== TEST_DOMAIN) {
                        throw new Error("子域名回溯查询未命中父级记录");
                    }
                    const category = await urlCategoryDB.lookupCategory(`sub.${TEST_DOMAIN}`);
                    if (category !== "low_load_utility") {
                        throw new Error("lookupCategory 返回值不正确");
                    }
                    const missing = await urlCategoryDB.lookup("no-such.brainrest.invalid");
                    if (missing) {
                        throw new Error("不存在的域名不应命中");
                    }
                    return "回溯命中、lookupCategory、未收录域名返回空 全部通过";
                } finally {
                    await urlCategoryDB.delete(TEST_DOMAIN);
                }
            },
        },
        {
            id: "urldb-list",
            name: "listByCategory 反向查询",
            run: async () => {
                try {
                    await urlCategoryDB.put(TEST_DOMAIN, "audio_low_visual");
                    const list = await urlCategoryDB.listByCategory("audio_low_visual");
                    if (!list.some((r) => r.domain === TEST_DOMAIN)) {
                        throw new Error("类别反查未包含测试记录");
                    }
                    return `audio_low_visual 类别下共 ${list.length} 条记录（含测试记录）`;
                } finally {
                    await urlCategoryDB.delete(TEST_DOMAIN);
                }
            },
        },
        {
            id: "urldb-delete",
            name: "delete 删除",
            run: async () => {
                await urlCategoryDB.put(TEST_DOMAIN, "low_load_utility");
                await urlCategoryDB.delete(TEST_DOMAIN);
                if (await urlCategoryDB.getExact(TEST_DOMAIN)) {
                    throw new Error("删除后记录仍存在");
                }
                return "写入后删除并验证不存在，通过（clear 会清空真实数据，不在此测试）";
            },
        },
    ],
};

/* ------------------------------------------------------------------ */
/* 分组 9：事件库 (IndexedDB)                                           */
/* ------------------------------------------------------------------ */

function createDebugEvent(): Event {
    return createEvent<Event>({
        type: "debug_test",
        url: "debug://popup",
    });
}

const eventDbGroup: TestGroup = {
    id: "eventDb",
    name: "事件库 (IndexedDB)",
    scope: "services",
    subTests: [
        {
            id: "eventdb-put",
            name: "batchPut / getUnprocessed",
            run: async () => {
                const testEvent = createDebugEvent();
                await eventDB.batchPut([testEvent]);
                const unprocessed = await eventDB.getUnprocessed();
                const found = unprocessed.some((e) => e.timestamp === testEvent.timestamp);
                // 清理：标记已处理，避免残留在未处理列表
                await eventDB.markProcessed([testEvent.timestamp]);
                if (!found) {
                    throw new Error("入库后未在未处理列表中找到测试事件");
                }
                return `入库并查询通过，当前未处理事件共 ${unprocessed.length} 条`;
            },
        },
        {
            id: "eventdb-update",
            name: "updateByTimestamp 部分更新",
            run: async () => {
                const testEvent = createDebugEvent();
                await eventDB.batchPut([testEvent]);
                try {
                    await eventDB.updateByTimestamp(testEvent.timestamp, {
                        url: "debug://updated",
                    });
                    const unprocessed = await eventDB.getUnprocessed();
                    const updated = unprocessed.find((e) => e.timestamp === testEvent.timestamp);
                    if (updated?.url !== "debug://updated") {
                        throw new Error("部分更新后 url 字段未生效");
                    }
                    if (updated.type !== "debug_test") {
                        throw new Error("部分更新破坏了未修改字段");
                    }
                    return "部分更新生效且未破坏其他字段";
                } finally {
                    await eventDB.markProcessed([testEvent.timestamp]);
                }
            },
        },
        {
            id: "eventdb-mark",
            name: "markProcessed 标记",
            run: async () => {
                const testEvent = createDebugEvent();
                await eventDB.batchPut([testEvent]);
                await eventDB.markProcessed([testEvent.timestamp]);
                const after = await eventDB.getUnprocessed();
                if (after.some((e) => e.timestamp === testEvent.timestamp)) {
                    throw new Error("标记已处理后事件仍出现在未处理列表");
                }
                return "标记后不再出现在未处理列表";
            },
        },
        {
            id: "eventdb-prune",
            name: "prune / 24h 滚动清理",
            run: async () => {
                // 写入一条 25h 前的过期事件：batchPut 的自动清理应立即将其删除
                const oldEvent: Event = {
                    type: "debug_test",
                    url: "debug://expired",
                    processed: 0,
                    timestamp: Date.now() - 25 * 60 * 60 * 1000,
                };
                await eventDB.batchPut([oldEvent]);
                await eventDB.prune();
                const unprocessed = await eventDB.getUnprocessed();
                const cutoff = Date.now() - 24 * 60 * 60 * 1000;
                if (unprocessed.some((e) => e.timestamp < cutoff)) {
                    throw new Error("清理后仍存在超过 24h 的未处理事件");
                }
                return "过期事件已被自动清理，库中无 24h 前数据";
            },
        },
    ],
};

/* ------------------------------------------------------------------ */
/* 导出全部分组                                                        */
/* ------------------------------------------------------------------ */

const persistenceGroup: TestGroup = {
    id: "persistence",
    name: "持久化层 (WAL + 时长追踪)",
    scope: "services",
    subTests: [
        {
            id: "eventdb-mark-before",
            name: "markProcessedBefore 按上界标记",
            run: async () => {
                const now = Date.now();
                const older: Event = {
                    type: "debug_test",
                    url: "debug://mb-old",
                    processed: 0,
                    timestamp: now - 5000,
                };
                const newer: Event = {
                    type: "debug_test",
                    url: "debug://mb-new",
                    processed: 0,
                    timestamp: now,
                };
                await eventDB.batchPut([older, newer]);
                await eventDB.markProcessedBefore(now - 2500);
                const unprocessed = await eventDB.getUnprocessed();
                const oldStillThere = unprocessed.some((e) => e.timestamp === older.timestamp);
                const newStillThere = unprocessed.some((e) => e.timestamp === newer.timestamp);
                // 清理：标记剩余测试事件
                await eventDB.markProcessed([newer.timestamp]);
                if (oldStillThere) {
                    throw new Error("上界之前的事件未被标记为已处理");
                }
                if (!newStillThere) {
                    throw new Error("上界之后的事件不应被标记");
                }
                return "仅 timestamp <= cutoff 的事件被收敛为已处理";
            },
        },
        {
            id: "timedata-store",
            name: "TimeDataStore putDay / getDay / prune",
            run: async () => {
                const today = toDayKey();
                const record: DailyTimeRecord = {
                    dayKey: today,
                    startTime: Date.now(),
                    endTime: Date.now(),
                    apps: { "store-test.example": [[Date.now(), Date.now() + 1000]] },
                    checkpointAt: Date.now(),
                };
                await timeDataStore.putDay(record);
                const read = await timeDataStore.getDay(today);
                if (!read || read.apps["store-test.example"] === undefined) {
                    throw new Error("putDay 后 getDay 未读到写入的记录");
                }

                // 写入一条远古旧日，prune 应删除
                const ancientDay = toDayKey(new Date(2000, 0, 1).getTime());
                const oldRecord: DailyTimeRecord = {
                    dayKey: ancientDay,
                    startTime: 0,
                    endTime: 0,
                    apps: {},
                    checkpointAt: 0,
                };
                await timeDataStore.putDay(oldRecord);
                await timeDataStore.prune();
                const prunedOld = await timeDataStore.getDay(ancientDay);
                if (prunedOld !== undefined) {
                    throw new Error("prune 后过期旧日仍存在");
                }
                return "putDay/getDay 可用，prune 正确删除过期旧日";
            },
        },
        {
            id: "domain-durations",
            name: "domainDurationsOf 开放段以 now 结算",
            run: async () => {
                const now = Date.now();
                const record = {
                    startTime: now - 60000,
                    endTime: now,
                    apps: {
                        "dur-test.example": [
                            [now - 60000, now - 30000],
                            [now - 20000, null],
                        ],
                    },
                } as unknown as DailyTimeRecord;
                const durations = domainDurationsOf(record, now);
                const seconds = durations["dur-test.example"];
                // 30s （已关闭） + 20s （开放段以 now 结算）≈ 50s
                if (Math.abs(seconds - 50) > 1) {
                    throw new Error(`预期约 50s，实际 ${seconds.toFixed(1)}s`);
                }
                return `开放段正确以 now 结算，总时长 ${seconds.toFixed(1)}s`;
            },
        },
        {
            id: "category-durations",
            name: "categoryDurationsOf 归类汇总 + unknown 兑底",
            run: async () => {
                const now = Date.now();
                const known = "cat-test.example";
                await urlCategoryDB.put(known, "deep_work_productivity");
                try {
                    const record = {
                        startTime: now - 90000,
                        endTime: now,
                        apps: {
                            [known]: [[now - 60000, now]],
                            "cat-unknown.example": [[now - 30000, now]],
                        },
                    } as unknown as DailyTimeRecord;
                    const result = await categoryDurationsOf(record, now);
                    const work = result["deep_work_productivity"] ?? 0;
                    const unknown = result[UNKNOWN_CATEGORY] ?? 0;
                    if (Math.abs(work - 60) > 1) {
                        throw new Error(`已分类时长预期约 60s，实际 ${work.toFixed(1)}s`);
                    }
                    if (Math.abs(unknown - 30) > 1) {
                        throw new Error(`unknown 桶预期约 30s，实际 ${unknown.toFixed(1)}s`);
                    }
                    return "已分类归入对应桶，未分类归入 unknown 兑底桶";
                } finally {
                    await urlCategoryDB.delete(known);
                }
            },
        },
    ],
};

/* ------------------------------------------------------------------ */
/* 分组 11：休息建议数据                                                */
/* ------------------------------------------------------------------ */

/** 构造用于测试的 BRIResult（仅填充 buildRestSuggestion 关注的字段） */
function mockBriResult(triggerPath: TriggerPath | null, pageType: UrlCategory | null): BRIResult {
    return {
        clCog: 0,
        clPhy: 0,
        briRaw: 0,
        bri: 0,
        briDisplay: 0,
        kPersonal: 1,
        cData: 1,
        level: "high",
        triggerPath,
        pageType,
        cognitiveSignals: { D: 0, B: 0, rho: 0, S: 0, P: 0, T: 0 },
        physicalSignals: { E: 0, L: 0, I: 0, R: 0, R_rest: 0 },
        timestamp: Date.now(),
    };
}

const restDataGroup: TestGroup = {
    id: "rest-data",
    name: "休息建议数据",
    scope: "src/data",
    subTests: [
        {
            id: "rest-mapping-coverage",
            name: "categoryLoadType 覆盖全部 UrlCategory",
            run: async () => {
                const expected = Object.keys(TYPE_BASELINE).sort();
                const actual = Object.keys(categoryLoadType).sort();
                const missing = expected.filter((k) => !actual.includes(k));
                const extra = actual.filter((k) => !expected.includes(k));
                if (missing.length > 0 || extra.length > 0) {
                    throw new Error(`缺失: [${missing.join(", ")}]，多余: [${extra.join(", ")}]`);
                }
                for (const [cat, lt] of Object.entries(categoryLoadType)) {
                    if (!loadTypeProfiles[lt]) {
                        throw new Error(`${cat} 映射到不存在的负荷类型 ${lt}`);
                    }
                }
                return `已覆盖全部 ${expected.length} 类页面类型，映射目标均存在`;
            },
        },
        {
            id: "rest-profiles-fields",
            name: "loadTypeProfiles 字段有效性",
            run: async () => {
                for (const [lt, p] of Object.entries(loadTypeProfiles)) {
                    if (p.durationMin <= 0) throw new Error(`${lt}: durationMin 非正`);
                    if (p.activities.length < 3) throw new Error(`${lt}: 活动池不足 3 个`);
                    if (p.message.trim() === "") throw new Error(`${lt}: message 为空`);
                    if (p.mainLoads.length === 0) throw new Error(`${lt}: mainLoads 为空`);
                    for (const a of p.activities) {
                        if (a.name.trim() === "") throw new Error(`${lt}: 存在空活动名`);
                    }
                }
                const count = Object.keys(loadTypeProfiles).length;
                return `全部 ${count} 类负荷档案有效，活动池均 ≥3 个`;
            },
        },
        {
            id: "rest-pick-activities",
            name: "pickActivities 抽取 3 个不重复且 ⭐ 必含",
            run: async () => {
                for (const [lt, p] of Object.entries(loadTypeProfiles)) {
                    const picked = pickActivities(p.activities, 3);
                    if (picked.length !== 3) {
                        throw new Error(`${lt}: 抽取数量 ${picked.length}，应为 3`);
                    }
                    const names = picked.map((a) => a.name);
                    if (new Set(names).size !== 3) {
                        throw new Error(`${lt}: 抽取结果重复 [${names.join(", ")}]`);
                    }
                    for (const a of picked) {
                        if (!p.activities.includes(a)) {
                            throw new Error(`${lt}: 「${a.name}」不在活动池中`);
                        }
                    }
                    const starred = p.activities.filter((a) => a.star);
                    for (const s of starred.slice(0, 3)) {
                        if (!picked.includes(s)) {
                            throw new Error(`${lt}: ⭐ 活动「${s.name}」未被抽中`);
                        }
                    }
                }
                return "全部负荷类型抽取 3 个、不重复、⭐ 必含";
            },
        },
        {
            id: "rest-trigger-baseline",
            name: "triggerBaseline 覆盖 A/B/C 且区间合法",
            run: async () => {
                const paths: TriggerPath[] = ["A", "B", "C"];
                for (const p of paths) {
                    const b = triggerBaseline[p];
                    if (!b) throw new Error(`缺少路径 ${p}`);
                    const [min, max] = b.durationMin;
                    if (!(min > 0 && min <= max)) {
                        throw new Error(`${p}: durationMin 区间非法 [${min}, ${max}]`);
                    }
                    if (b.coreActivities.length === 0) throw new Error(`${p}: coreActivities 为空`);
                }
                return "路径 A/B/C 齐全，时长区间与活动均有效";
            },
        },
        {
            id: "rest-fatigue-title",
            name: "fatigueTitle 覆盖 triggerBaseline 所有 fatigue",
            run: async () => {
                for (const [p, b] of Object.entries(triggerBaseline)) {
                    if (!fatigueTitle[b.fatigue]) {
                        throw new Error(
                            `路径 ${p} 的 fatigue=${b.fatigue} 在 fatigueTitle 中无标题`,
                        );
                    }
                }
                return "全部 fatigue 类型均有对应标题";
            },
        },
        {
            id: "rest-build-null",
            name: "buildRestSuggestion 未触发时返回 null",
            run: async () => {
                const out = buildRestSuggestion(mockBriResult(null, "deep_work_productivity"));
                if (out !== null) {
                    throw new Error(`triggerPath=null 应返回 null，实际返回对象`);
                }
                return "triggerPath=null 时正确返回 null";
            },
        },
        {
            id: "rest-build-page",
            name: "buildRestSuggestion 命中负荷类型走活动池",
            run: async () => {
                const out = buildRestSuggestion(mockBriResult("A", "deep_work_productivity"));
                if (!out) throw new Error("应返回建议对象，实际为 null");
                const profile = loadTypeProfiles[categoryLoadType.deep_work_productivity];
                if (out.title !== fatigueTitle.cognitive) {
                    throw new Error(
                        `title 应为「${fatigueTitle.cognitive}」，实际「${out.title}」`,
                    );
                }
                if (out.body !== profile.message) {
                    throw new Error("body 应取负荷类型的 message");
                }
                if (out.duration !== `${profile.durationMin} 分钟`) {
                    throw new Error(
                        `duration 应为「${profile.durationMin} 分钟」，实际「${out.duration}」`,
                    );
                }
                const lines = out.actions.split("\n");
                if (lines.length !== 3) {
                    throw new Error(`actions 应为 3 行，实际 ${lines.length} 行`);
                }
                const poolNames = profile.activities.map((a) => a.name);
                for (const line of lines) {
                    if (!poolNames.some((n) => line.includes(n))) {
                        throw new Error(`actions 行「${line}」不来自活动池`);
                    }
                }
                return `title=「${out.title}」duration=「${out.duration}」，3 个活动均来自池`;
            },
        },
        {
            id: "rest-build-fallback",
            name: "buildRestSuggestion 无页面类型回退到路径基调",
            run: async () => {
                const out = buildRestSuggestion(mockBriResult("C", null));
                if (!out) throw new Error("应返回建议对象，实际为 null");
                const base = triggerBaseline.C;
                if (out.title !== fatigueTitle.physical) {
                    throw new Error(`title 应为「${fatigueTitle.physical}」，实际「${out.title}」`);
                }
                if (out.duration !== `${base.durationMin[0]}–${base.durationMin[1]} 分钟`) {
                    throw new Error(`duration 应为区间格式，实际「${out.duration}」`);
                }
                return `回退基调正确，duration=「${out.duration}」`;
            },
        },
    ],
};

export const TEST_GROUPS: TestGroup[] = [
    swGroup,
    queueGroup,
    engineGroup,
    helperGroup,
    contentGroup,
    categorizeGroup,
    optionGroup,
    urlDbGroup,
    eventDbGroup,
    persistenceGroup,
    restDataGroup,
];
