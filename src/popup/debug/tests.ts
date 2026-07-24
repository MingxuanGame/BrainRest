import type {
    CategorizeRequest,
    CategorizeResponse,
    DebugContentPingRequest,
    DebugContentPingResponse,
    DebugStateRequest,
    DebugStateResponse,
} from '../../messages'
import { clearOption, loadOption, saveOption } from '../../services/OptionStore'
import { urlCategoryDB } from '../../services/UrlCategoryDataBaseManager'
import { eventDB } from '../../services/EventDataBaseManager'
import { createEvent } from '../../models/events/Event'
import type { Event } from '../../models/events/Event'

/* ------------------------------------------------------------------ */
/* 类型定义                                                            */
/* ------------------------------------------------------------------ */

export interface SubTest {
    id: string
    name: string
    /** 执行测试：返回详情文本，失败时抛错 */
    run: () => Promise<string>
}

export interface TestGroup {
    id: string
    name: string
    scope: string
    subTests: SubTest[]
}

/* ------------------------------------------------------------------ */
/* 工具函数                                                            */
/* ------------------------------------------------------------------ */

function formatByType(byType: Record<string, number>): string {
    const entries = Object.entries(byType)
    if (entries.length === 0) return '(无)'
    return entries.map(([type, count]) => `${type}×${count}`).join(', ')
}

function formatAgo(timestamp: number | null): string {
    if (timestamp === null || timestamp === 0) return '从未'
    return `${((Date.now() - timestamp) / 1000).toFixed(1)}s 前`
}

/** 查询活动标签页（popup 所属窗口的当前标签页） */
async function getActiveTab(): Promise<chrome.tabs.Tab> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
        throw new Error('未找到活动标签页')
    }
    return tab
}

/** 向 service worker 请求调试状态快照 */
async function fetchSwState(): Promise<DebugStateResponse> {
    const request: DebugStateRequest = { type: 'debug_get_state' }
    const response = (await chrome.runtime.sendMessage(request)) as DebugStateResponse | undefined
    if (!response?.ok) {
        throw new Error(response?.error ?? 'service worker 无应答')
    }
    return response
}

/** ping 活动标签页的 content script */
async function fetchContentPing(): Promise<DebugContentPingResponse> {
    const tab = await getActiveTab()
    const request: DebugContentPingRequest = { type: 'debug_content_ping' }
    let response: DebugContentPingResponse | undefined
    try {
        response = (await chrome.tabs.sendMessage(tab.id!, request)) as DebugContentPingResponse
    } catch (e: unknown) {
        throw new Error(
            `content script 无应答（${(e as Error).message}）。` +
                'chrome:// 与扩展页面不会注入，请切到普通网页后重试',
            { cause: e },
        )
    }
    if (!response?.ok) {
        throw new Error(response?.error ?? 'content script 返回异常')
    }
    return response
}

/* ------------------------------------------------------------------ */
/* 分组 1：Service Worker 基础                                         */
/* ------------------------------------------------------------------ */

const swGroup: TestGroup = {
    id: 'sw',
    name: 'Service Worker 基础',
    scope: 'service worker',
    subTests: [
        {
            id: 'sw-ping',
            name: '存活 ping（消息往返）',
            run: async () => {
                const t0 = Date.now()
                const state = await fetchSwState()
                const rtt = Date.now() - t0
                const uptimeSec = ((Date.now() - state.startedAt) / 1000).toFixed(0)
                return `往返 ${rtt}ms，本次启动于 ${uptimeSec}s 前`
            },
        },
        {
            id: 'sw-ports',
            name: 'event-stream 端口连接',
            run: async () => {
                const state = await fetchSwState()
                const n = state.portStats.connectedPorts
                if (n < 1) {
                    return `当前存活端口: ${n}（没有已注入 content script 的标签页在连接）`
                }
                return `当前存活端口: ${n}`
            },
        },
        {
            id: 'sw-portEvents',
            name: '端口事件接收统计',
            run: async () => {
                const { portStats } = await fetchSwState()
                return [
                    `累计接收: ${portStats.total} 条（最近 ${formatAgo(portStats.lastEventAt)}）`,
                    `类型分布: ${formatByType(portStats.byType)}`,
                ].join('\n')
            },
        },
    ],
}

/* ------------------------------------------------------------------ */
/* 分组 2：事件队列 EventQueue                                          */
/* ------------------------------------------------------------------ */

const queueGroup: TestGroup = {
    id: 'queue',
    name: '事件队列 EventQueue',
    scope: 'service worker',
    subTests: [
        {
            id: 'queue-snapshot',
            name: '5s 窗口快照',
            run: async () => {
                const { queueEvents } = await fetchSwState()
                const byType: Record<string, number> = {}
                for (const event of queueEvents) {
                    byType[event.type] = (byType[event.type] ?? 0) + 1
                }
                return [
                    `窗口内事件: ${queueEvents.length} 条`,
                    `类型分布: ${formatByType(byType)}`,
                    '提示: 先在网页上移动鼠标/敲键盘再立即测试',
                ].join('\n')
            },
        },
        {
            id: 'queue-window',
            name: '滑动窗口裁剪正确性',
            run: async () => {
                const { queueEvents } = await fetchSwState()
                const now = Date.now()
                // 5s 窗口 + 1s 传输/时钟余量
                const stale = queueEvents.filter((e) => now - e.timestamp > 6000)
                if (stale.length > 0) {
                    throw new Error(`发现 ${stale.length} 条超出 5s 窗口的事件未被裁剪`)
                }
                return `${queueEvents.length} 条事件全部位于 5s 窗口内`
            },
        },
        {
            id: 'queue-freq',
            name: '事件频率 f_interact',
            run: async () => {
                const { engineInternals } = await fetchSwState()
                return `f_interact = ${engineInternals.eventFrequency.toFixed(2)} events/s（满分阈值 10/s）`
            },
        },
    ],
}

/* ------------------------------------------------------------------ */
/* 分组 3：认知负荷引擎                                                 */
/* ------------------------------------------------------------------ */

const engineGroup: TestGroup = {
    id: 'engine',
    name: '认知负荷引擎',
    scope: 'service worker',
    subTests: [
        {
            id: 'engine-result',
            name: 'BRIResult 总览（30s/tick）',
            run: async () => {
                const { engineResult: r } = await fetchSwState()
                if (!r) {
                    return '引擎已启动但尚未产出结果（每 30s tick 一次，请稍后重试）'
                }
                return [
                    `level=${r.level}  BRI_display=${r.briDisplay.toFixed(1)}`,
                    `CL_cog=${r.clCog.toFixed(1)}  CL_phy=${r.clPhy.toFixed(1)}  BRI_raw=${r.briRaw.toFixed(1)}  BRI=${r.bri.toFixed(1)}`,
                    `triggerPath=${r.triggerPath ?? '无'}  计算于 ${formatAgo(r.timestamp)}`,
                ].join('\n')
            },
        },
        {
            id: 'engine-cog',
            name: '认知信号 D/B/ρ/S/P/T',
            run: async () => {
                const { engineResult: r } = await fetchSwState()
                if (!r) return '尚无 tick 结果'
                const s = r.cognitiveSignals
                return [
                    `D(时长)=${s.D.toFixed(1)}  B(类型基线)=${s.B.toFixed(1)}`,
                    `ρ(文字密度)=${s.rho.toFixed(1)}  S(结构)=${s.S.toFixed(1)}  P(综合)=${s.P.toFixed(1)}`,
                    `T(切换负荷)=${s.T.toFixed(1)}`,
                    `合成 CL_cog = 0.35·D + 0.15·B + 0.30·P + 0.20·T = ${r.clCog.toFixed(1)}`,
                ].join('\n')
            },
        },
        {
            id: 'engine-phy',
            name: '身体信号 E/L/I/R/R_rest',
            run: async () => {
                const { engineResult: r } = await fetchSwState()
                if (!r) return '尚无 tick 结果'
                const s = r.physicalSignals
                return [
                    `E(轨迹熵)=${s.E.toFixed(1)}  L(眼手延迟)=${s.L.toFixed(1)}`,
                    `I(交互强度)=${s.I.toFixed(1)}  R(修正负荷)=${s.R.toFixed(1)}`,
                    `R_rest(休息衰减)=${s.R_rest.toFixed(1)}`,
                    `合成 CL_phy = ${r.clPhy.toFixed(1)}`,
                ].join('\n')
            },
        },
        {
            id: 'engine-gate',
            name: '数据质量门控 C_data',
            run: async () => {
                const { engineInternals } = await fetchSwState()
                const c = engineInternals.coverage
                return [
                    `C_data = ${c.toFixed(2)}（阈值 0.70，${c >= 0.7 ? '数据充足' : '数据不足'}）`,
                    '数据不足时引擎不更新 BRI_display、不参与触发判定',
                ].join('\n')
            },
        },
        {
            id: 'engine-session',
            name: 'SessionTracker 前台时长',
            run: async () => {
                const { engineInternals } = await fetchSwState()
                return `连续前台时长 t_front = ${engineInternals.frontMinutes.toFixed(1)} min（触发硬门槛 ≥30min）`
            },
        },
        {
            id: 'engine-tabbuf',
            name: 'TabEventBuffer 5min 切换缓冲',
            run: async () => {
                const { engineInternals: i } = await fetchSwState()
                const t = Math.min(i.switchCount * 12.5 + i.loadCount * 7.5, 100)
                return [
                    `N_switch=${i.switchCount}  N_load=${i.loadCount}（最近 5min）`,
                    `推导切换负荷 T = min(N_switch×12.5 + N_load×7.5, 100) = ${t.toFixed(1)}`,
                    '提示: 切换几个标签页后重测，N_switch 应增加',
                ].join('\n')
            },
        },
        {
            id: 'engine-brihistory',
            name: 'BRIHistoryBuffer 60min 历史',
            run: async () => {
                const { engineInternals: i } = await fetchSwState()
                return [
                    `最近 BRI_display = ${i.briLatest?.toFixed(1) ?? '无采样'}`,
                    `路径A输入: 30min 内高负荷(≥70)时长 = ${i.highLoadMinutes.toFixed(1)} min（阈值 20min）`,
                    `路径B输入: 60min AUC = ${i.auc.toFixed(0)} score·min（阈值 4000）`,
                ].join('\n')
            },
        },
        {
            id: 'engine-trigger',
            name: 'TriggerEngine 触发状态',
            run: async () => {
                const { engineInternals: i, engineResult } = await fetchSwState()
                const inCooldown =
                    i.lastTriggeredAt > 0 && Date.now() - i.lastTriggeredAt < 30 * 60 * 1000
                return [
                    `上次触发: ${formatAgo(i.lastTriggeredAt)}${inCooldown ? '（冷却期内）' : ''}`,
                    `最近 tick 命中路径: ${engineResult?.triggerPath ?? '无'}`,
                    `硬门槛: 前台 ${i.frontMinutes.toFixed(1)}/30 min，C_data ${i.coverage.toFixed(2)}/0.70`,
                ].join('\n')
            },
        },
        {
            id: 'engine-calibration',
            name: 'PersonalCalibration k_personal',
            run: async () => {
                const { engineInternals } = await fetchSwState()
                const k = engineInternals.kPersonal
                if (k < 0.5 || k > 1.5) {
                    throw new Error(`k_personal=${k} 超出有效范围 [0.5, 1.5]`)
                }
                // 校验与 chrome.storage.local 持久化值一致（未持久化时为初始值 1.0）
                const stored = await chrome.storage.local.get('brainrest_k_personal')
                const saved = stored['brainrest_k_personal']
                if (typeof saved === 'number' && Math.abs(saved - k) > 1e-9) {
                    throw new Error(`内存值 ${k} 与存储值 ${saved} 不一致`)
                }
                return `k_personal = ${k.toFixed(2)}（存储值: ${typeof saved === 'number' ? saved.toFixed(2) : '未持久化，用初始值'}）`
            },
        },
    ],
}

/* ------------------------------------------------------------------ */
/* 分组 4：行为分析器 helper                                            */
/* ------------------------------------------------------------------ */

const helperGroup: TestGroup = {
    id: 'helper',
    name: '行为分析器 (helper)',
    scope: 'service worker',
    subTests: [
        {
            id: 'helper-mouse',
            name: 'MouseTrackAnalyzer 轨迹熵',
            run: async () => {
                const { engineInternals } = await fetchSwState()
                const h = engineInternals.mouseEntropy
                return [
                    `归一化轨迹熵 = ${h.toFixed(3)}（0=单向直线，1=8向均匀）`,
                    '提示: 在网页上乱画鼠标后 5s 内重测，数值应上升',
                ].join('\n')
            },
        },
        {
            id: 'helper-eyehand',
            name: 'MouseTrackAnalyzer 眼-手延迟',
            run: async () => {
                const { engineInternals } = await fetchSwState()
                const d = engineInternals.eyeHandDelayMs
                return d === null
                    ? 'τ_eye = null（5s 窗口内无"移动到目标后点击"的配对样本，属正常）'
                    : `τ_eye = ${d} ms（满分阈值 500ms）`
            },
        },
        {
            id: 'helper-freq',
            name: 'EventFrequencyAnalyzer 交互频率',
            run: async () => {
                const { engineInternals, queueEvents } = await fetchSwState()
                const expected = queueEvents.length / 5
                const actual = engineInternals.eventFrequency
                // 两次 getEvents 之间窗口可能滑动，允许小偏差
                if (Math.abs(actual - expected) > 2) {
                    throw new Error(
                        `频率 ${actual.toFixed(2)}/s 与队列快照推算值 ${expected.toFixed(2)}/s 偏差过大`,
                    )
                }
                return `f_interact = ${actual.toFixed(2)} events/s（队列 ${queueEvents.length} 条 / 5s）`
            },
        },
        {
            id: 'helper-keyboard',
            name: 'KeyboardAnalyzer 删除键占比',
            run: async () => {
                const { engineInternals } = await fetchSwState()
                const r = engineInternals.deleteKeyRatio
                if (r < 0 || r > 1) {
                    throw new Error(`删除键占比 ${r} 超出 [0,1]`)
                }
                return [
                    `r_correct = ${(r * 100).toFixed(1)}%（Backspace/Delete ÷ 非快捷键按键）`,
                    '提示: 在网页输入框敲几个退格后 5s 内重测',
                ].join('\n')
            },
        },
    ],
}

/* ------------------------------------------------------------------ */
/* 分组 5：Content Script                                              */
/* ------------------------------------------------------------------ */

const contentGroup: TestGroup = {
    id: 'content',
    name: 'Content Script',
    scope: 'content script',
    subTests: [
        {
            id: 'content-ping',
            name: '存活 ping（活动标签页）',
            run: async () => {
                const t0 = Date.now()
                const response = await fetchContentPing()
                return `往返 ${Date.now() - t0}ms\n页面: ${response.url}`
            },
        },
        {
            id: 'content-port',
            name: 'EventChannel 端口状态',
            run: async () => {
                const { eventStats } = await fetchContentPing()
                if (!eventStats.portAlive) {
                    throw new Error(
                        'event-stream 端口已断开（service worker 可能被回收后未重连，刷新页面可恢复）',
                    )
                }
                return 'event-stream 端口存活'
            },
        },
        {
            id: 'content-events',
            name: 'DomListener 采集统计',
            run: async () => {
                const { eventStats } = await fetchContentPing()
                return [
                    `累计发送: ${eventStats.total} 条（最近 ${formatAgo(eventStats.lastEventAt)}）`,
                    `类型分布: ${formatByType(eventStats.byType)}`,
                    '覆盖: mousemove/click/keydown/keyup/scroll/touch*/fullscreen_change',
                ].join('\n')
            },
        },
        {
            id: 'content-complexity',
            name: 'PageComplexityAnalyzer 即时采样',
            run: async () => {
                const { complexity: c } = await fetchContentPing()
                if (!c) {
                    throw new Error('页面复杂度采集失败')
                }
                return [
                    `文字密度 ρ = ${c.textDensity.toExponential(2)} chars·px⁻²`,
                    `table=${c.tableCount}  code=${c.codeCount}  list=${c.listCount}  heading=${c.headingCount}`,
                    `采样于 ${formatAgo(c.timestamp)}`,
                ].join('\n')
            },
        },
    ],
}

/* ------------------------------------------------------------------ */
/* 分组 6：URL 分类链路                                                 */
/* ------------------------------------------------------------------ */

const categorizeGroup: TestGroup = {
    id: 'categorize',
    name: 'URL 分类链路',
    scope: 'content ↔ SW 同链路',
    subTests: [
        {
            id: 'cat-active',
            name: '活动标签页分类（缓存/AI）',
            run: async () => {
                const tab = await getActiveTab()
                if (!tab.url || !/^https?:/.test(tab.url)) {
                    throw new Error('活动标签页不是 http(s) 页面，无法测试分类')
                }
                const request: CategorizeRequest = {
                    type: 'categorize',
                    url: tab.url,
                    html: `<html><head><title>${tab.title ?? ''}</title></head></html>`,
                }
                const response = (await chrome.runtime.sendMessage(request)) as
                    CategorizeResponse | undefined
                if (!response) {
                    throw new Error('service worker 无应答')
                }
                if (!response.ok) {
                    throw new Error(
                        `分类失败: ${response.error ?? '未知错误'}（未命中缓存时需配置 apiKey）`,
                    )
                }
                return `${tab.url}\n分类结果: ${response.domain} -> ${response.category}`
            },
        },
        {
            id: 'cat-dbverify',
            name: '分类结果落库反查',
            run: async () => {
                const tab = await getActiveTab()
                if (!tab.url || !/^https?:/.test(tab.url)) {
                    throw new Error('活动标签页不是 http(s) 页面')
                }
                const domain = new URL(tab.url).hostname.toLowerCase().replace(/^www\./, '')
                const record = await urlCategoryDB.lookup(domain)
                if (!record) {
                    throw new Error(`本地库未收录 ${domain}（先运行"活动标签页分类"使其落库）`)
                }
                return [
                    `${domain} 命中记录: ${record.domain} -> ${record.category}`,
                    `更新于 ${formatAgo(record.updatedAt)}`,
                ].join('\n')
            },
        },
    ],
}

/* ------------------------------------------------------------------ */
/* 分组 7：OptionStore                                                  */
/* ------------------------------------------------------------------ */

const optionGroup: TestGroup = {
    id: 'option',
    name: 'OptionStore',
    scope: 'services / chrome.storage',
    subTests: [
        {
            id: 'opt-load',
            name: 'loadOption 读取',
            run: async () => {
                const option = await loadOption()
                return [
                    `aiProvider=${option.aiProvider}  categorifyModel=${option.categorifyModel}`,
                    `apiKey: ${option.apiKey ? '已设置' : '未设置'}`,
                ].join('\n')
            },
        },
        {
            id: 'opt-roundtrip',
            name: 'saveOption 写读回环',
            run: async () => {
                const before = await loadOption()
                await saveOption(before)
                const after = await loadOption()
                if (JSON.stringify(before) !== JSON.stringify(after)) {
                    throw new Error('保存后读取的 Option 与保存前不一致')
                }
                return '读 -> 写 -> 读 回环一致'
            },
        },
        {
            id: 'opt-clear',
            name: 'clearOption 默认值回退（自动恢复）',
            run: async () => {
                const backup = await loadOption()
                try {
                    await clearOption()
                    const cleared = await loadOption()
                    if (
                        cleared.aiProvider !== 'openai' ||
                        cleared.categorifyModel !== 'gpt-4o-mini' ||
                        cleared.apiKey !== ''
                    ) {
                        throw new Error(`清除后未回退到默认值: ${JSON.stringify(cleared)}`)
                    }
                } finally {
                    // 无论成败都恢复原配置
                    await saveOption(backup)
                }
                const restored = await loadOption()
                if (JSON.stringify(restored) !== JSON.stringify(backup)) {
                    throw new Error('原配置恢复失败，请在设置中检查 Option')
                }
                return 'clear -> 默认值校验 -> 原配置恢复 全部通过'
            },
        },
    ],
}

/* ------------------------------------------------------------------ */
/* 分组 8：URL 分类库 (IndexedDB)                                       */
/* ------------------------------------------------------------------ */

/** 测试专用域名统一使用 .invalid TLD，保证不与真实数据冲突 */
const TEST_DOMAIN = 'debug-check.brainrest.invalid'
const TEST_DOMAIN_2 = 'debug-check2.brainrest.invalid'

const urlDbGroup: TestGroup = {
    id: 'urlDb',
    name: 'URL 分类库 (IndexedDB)',
    scope: 'services',
    subTests: [
        {
            id: 'urldb-putget',
            name: 'put / getExact',
            run: async () => {
                try {
                    await urlCategoryDB.put(TEST_DOMAIN, 'low_load_utility')
                    const exact = await urlCategoryDB.getExact(TEST_DOMAIN)
                    if (exact?.category !== 'low_load_utility') {
                        throw new Error('写入后精确查询未命中')
                    }
                    // 覆盖更新
                    await urlCategoryDB.put(TEST_DOMAIN, 'social_feed')
                    const updated = await urlCategoryDB.getExact(TEST_DOMAIN)
                    if (updated?.category !== 'social_feed') {
                        throw new Error('同 domain 覆盖更新失败')
                    }
                    return '写入、精确查询、覆盖更新 全部通过'
                } finally {
                    await urlCategoryDB.delete(TEST_DOMAIN)
                }
            },
        },
        {
            id: 'urldb-batch',
            name: 'batchPut 批量写入',
            run: async () => {
                try {
                    await urlCategoryDB.batchPut([
                        { domain: TEST_DOMAIN, category: 'low_load_utility' },
                        { domain: TEST_DOMAIN_2, category: 'low_load_utility' },
                    ])
                    const a = await urlCategoryDB.getExact(TEST_DOMAIN)
                    const b = await urlCategoryDB.getExact(TEST_DOMAIN_2)
                    if (!a || !b) {
                        throw new Error('批量写入后存在未命中记录')
                    }
                    return '批量写入 2 条并逐条验证通过'
                } finally {
                    await urlCategoryDB.delete(TEST_DOMAIN)
                    await urlCategoryDB.delete(TEST_DOMAIN_2)
                }
            },
        },
        {
            id: 'urldb-lookup',
            name: 'lookup 子域名回溯 / lookupCategory',
            run: async () => {
                try {
                    await urlCategoryDB.put(TEST_DOMAIN, 'low_load_utility')
                    // 子域名逐级回溯应命中父级记录
                    const record = await urlCategoryDB.lookup(`a.b.${TEST_DOMAIN}`)
                    if (record?.domain !== TEST_DOMAIN) {
                        throw new Error('子域名回溯查询未命中父级记录')
                    }
                    const category = await urlCategoryDB.lookupCategory(`sub.${TEST_DOMAIN}`)
                    if (category !== 'low_load_utility') {
                        throw new Error('lookupCategory 返回值不正确')
                    }
                    const missing = await urlCategoryDB.lookup('no-such.brainrest.invalid')
                    if (missing) {
                        throw new Error('不存在的域名不应命中')
                    }
                    return '回溯命中、lookupCategory、未收录域名返回空 全部通过'
                } finally {
                    await urlCategoryDB.delete(TEST_DOMAIN)
                }
            },
        },
        {
            id: 'urldb-list',
            name: 'listByCategory 反向查询',
            run: async () => {
                try {
                    await urlCategoryDB.put(TEST_DOMAIN, 'audio_low_visual')
                    const list = await urlCategoryDB.listByCategory('audio_low_visual')
                    if (!list.some((r) => r.domain === TEST_DOMAIN)) {
                        throw new Error('类别反查未包含测试记录')
                    }
                    return `audio_low_visual 类别下共 ${list.length} 条记录（含测试记录）`
                } finally {
                    await urlCategoryDB.delete(TEST_DOMAIN)
                }
            },
        },
        {
            id: 'urldb-delete',
            name: 'delete 删除',
            run: async () => {
                await urlCategoryDB.put(TEST_DOMAIN, 'low_load_utility')
                await urlCategoryDB.delete(TEST_DOMAIN)
                if (await urlCategoryDB.getExact(TEST_DOMAIN)) {
                    throw new Error('删除后记录仍存在')
                }
                return '写入后删除并验证不存在，通过（clear 会清空真实数据，不在此测试）'
            },
        },
    ],
}

/* ------------------------------------------------------------------ */
/* 分组 9：事件库 (IndexedDB)                                           */
/* ------------------------------------------------------------------ */

function createDebugEvent(): Event {
    return createEvent<Event>({
        type: 'debug_test',
        url: 'debug://popup',
    })
}

const eventDbGroup: TestGroup = {
    id: 'eventDb',
    name: '事件库 (IndexedDB)',
    scope: 'services',
    subTests: [
        {
            id: 'eventdb-put',
            name: 'batchPut / getUnprocessed',
            run: async () => {
                const testEvent = createDebugEvent()
                await eventDB.batchPut([testEvent])
                const unprocessed = await eventDB.getUnprocessed()
                const found = unprocessed.some((e) => e.timestamp === testEvent.timestamp)
                // 清理：标记已处理，避免残留在未处理列表
                await eventDB.markProcessed([testEvent.timestamp])
                if (!found) {
                    throw new Error('入库后未在未处理列表中找到测试事件')
                }
                return `入库并查询通过，当前未处理事件共 ${unprocessed.length} 条`
            },
        },
        {
            id: 'eventdb-update',
            name: 'updateByTimestamp 部分更新',
            run: async () => {
                const testEvent = createDebugEvent()
                await eventDB.batchPut([testEvent])
                try {
                    await eventDB.updateByTimestamp(testEvent.timestamp, { url: 'debug://updated' })
                    const unprocessed = await eventDB.getUnprocessed()
                    const updated = unprocessed.find((e) => e.timestamp === testEvent.timestamp)
                    if (updated?.url !== 'debug://updated') {
                        throw new Error('部分更新后 url 字段未生效')
                    }
                    if (updated.type !== 'debug_test') {
                        throw new Error('部分更新破坏了未修改字段')
                    }
                    return '部分更新生效且未破坏其他字段'
                } finally {
                    await eventDB.markProcessed([testEvent.timestamp])
                }
            },
        },
        {
            id: 'eventdb-mark',
            name: 'markProcessed 标记',
            run: async () => {
                const testEvent = createDebugEvent()
                await eventDB.batchPut([testEvent])
                await eventDB.markProcessed([testEvent.timestamp])
                const after = await eventDB.getUnprocessed()
                if (after.some((e) => e.timestamp === testEvent.timestamp)) {
                    throw new Error('标记已处理后事件仍出现在未处理列表')
                }
                return '标记后不再出现在未处理列表'
            },
        },
        {
            id: 'eventdb-prune',
            name: 'prune / 24h 滚动清理',
            run: async () => {
                // 写入一条 25h 前的过期事件：batchPut 的自动清理应立即将其删除
                const oldEvent: Event = {
                    type: 'debug_test',
                    url: 'debug://expired',
                    processed: 0,
                    timestamp: Date.now() - 25 * 60 * 60 * 1000,
                }
                await eventDB.batchPut([oldEvent])
                await eventDB.prune()
                const unprocessed = await eventDB.getUnprocessed()
                const cutoff = Date.now() - 24 * 60 * 60 * 1000
                if (unprocessed.some((e) => e.timestamp < cutoff)) {
                    throw new Error('清理后仍存在超过 24h 的未处理事件')
                }
                return '过期事件已被自动清理，库中无 24h 前数据'
            },
        },
    ],
}

/* ------------------------------------------------------------------ */
/* 导出全部分组                                                        */
/* ------------------------------------------------------------------ */

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
]
