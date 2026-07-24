import { Brain, Clock, Database, KeyRound, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { clearOption, loadOption, saveOption } from "../services/OptionStore";
import { eventDB } from "../services/EventDataBaseManager";
import { urlCategoryDB } from "../services/UrlCategoryDataBaseManager";
import { timeDataStore } from "../services/TimeDataStore";
import { routineStore } from "../services/RoutineStore";
import type { Option } from "../models/Option";
import { Card, InlineNotice, TimeField, Toggle } from "../ui/components";
import { PRODUCT_BOUNDARY_COPY } from "../ui/bridge";
import { isDevEnvironment } from "../utils/env";
import { joinProvider, PROVIDER_LABELS, type ProviderChoice, splitProvider } from "./provider";
import Onboarding from "./Onboarding";
import DebugModePanel from "./DebugModePanel";

/** 是否展示调试/开发者能力：生产环境（商店安装）整体隐藏，模块加载时判定一次 */
const DEBUG_AVAILABLE = isDevEnvironment();

export default function OptionsApp() {
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{
        tone: "success" | "error" | "warning";
        message: string;
    }>();
    const [providerChoice, setProviderChoice] = useState<ProviderChoice>("openai");
    const [customUrl, setCustomUrl] = useState("");
    const [model, setModel] = useState("gpt-4o-mini");
    // API Key 只保存在当前输入框状态，留空表示保持已存值不变
    const [apiKeyInput, setApiKeyInput] = useState("");
    const [keyConfigured, setKeyConfigured] = useState(false);
    // 作息时间（[小时, 分钟]）：平时入睡 / 最晚入睡 / 最早起床
    const [sleepTime, setSleepTime] = useState<[number, number]>([22, 0]);
    const [latestSleepTime, setLatestSleepTime] = useState<[number, number]>([4, 0]);
    const [earliestWakeTime, setEarliestWakeTime] = useState<[number, number]>([6, 0]);
    // 是否已完成初始配置引导：false 时展示引导向导
    const [onboarded, setOnboarded] = useState(true);
    // 调试模式仅当前会话生效，不持久化
    const [debugMode, setDebugMode] = useState(false);

    const refresh = useCallback(async () => {
        const option = await loadOption();
        const { choice, url } = splitProvider(option.aiProvider);
        setProviderChoice(choice);
        setCustomUrl(url);
        setModel(option.categorifyModel);
        setKeyConfigured(option.apiKey !== "");
        setSleepTime(option.sleepTime);
        setLatestSleepTime(option.latestSleepTime);
        setEarliestWakeTime(option.earliestWakeTime);
        setOnboarded(option.onboarded);
        setLoaded(true);
    }, []);

    useEffect(() => {
        const initial = window.setTimeout(() => void refresh(), 0);
        return () => window.clearTimeout(initial);
    }, [refresh]);

    if (!loaded) {
        return (
            <main className="app-shell options-shell">
                <InlineNotice tone="neutral">
                    <LoaderCircle className="spin" size={18} aria-hidden="true" />
                    正在读取本地设置…
                </InlineNotice>
            </main>
        );
    }

    // 首次启动（未完成引导）：先走初始配置向导，完成后回到常规设置页
    if (!onboarded) {
        return <Onboarding onDone={() => void refresh()} />;
    }

    /** 由 UI 字段还原 Option.aiProvider；自定义 URL 非法时返回 null */
    const resolveProvider = (): Option["aiProvider"] | null =>
        joinProvider(providerChoice, customUrl);

    const saveAiSettings = async (clearApiKey = false): Promise<void> => {
        const provider = resolveProvider();
        if (!provider) {
            setNotice({ tone: "warning", message: "自定义 Base URL 必须是 http(s) 绝对地址。" });
            return;
        }
        setBusy(true);
        try {
            // 读-改-写：保留 Option 中睡眠时间等 UI 未覆盖的字段
            const current = await loadOption();
            await saveOption({
                ...current,
                aiProvider: provider,
                categorifyModel: model.trim() || current.categorifyModel,
                apiKey: clearApiKey ? "" : apiKeyInput || current.apiKey,
            });
            setApiKeyInput("");
            setNotice({
                tone: "success",
                message: clearApiKey ? "API Key 已移除。" : "AI 设置已保存。",
            });
            await refresh();
        } catch (e: unknown) {
            setNotice({ tone: "error", message: (e as Error).message });
        } finally {
            setBusy(false);
        }
    };

    const saveRoutine = async (): Promise<void> => {
        setBusy(true);
        try {
            // 读-改-写：保留 Option 中 AI 等 UI 未覆盖的字段
            const current = await loadOption();
            await saveOption({
                ...current,
                sleepTime,
                latestSleepTime,
                earliestWakeTime,
            });
            setNotice({ tone: "success", message: "作息时间已保存。" });
            await refresh();
        } catch (e: unknown) {
            setNotice({ tone: "error", message: (e as Error).message });
        } finally {
            setBusy(false);
        }
    };

    const clearAllData = async (): Promise<void> => {
        if (!window.confirm("确定清除脑栖全部本地数据吗？此操作不可恢复。")) {
            return;
        }
        setBusy(true);
        try {
            await clearOption();
            await Promise.all([
                eventDB.clear(),
                urlCategoryDB.clear(),
                timeDataStore.clear(),
                routineStore.clear(),
            ]);
            setApiKeyInput("");
            setNotice({ tone: "success", message: "全部本地数据已清除。" });
            await refresh();
        } catch (e: unknown) {
            setNotice({ tone: "error", message: (e as Error).message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="app-shell options-shell">
            <header className="options-header">
                <div className="brand brand-lockup">
                    <span className="brand-icon" aria-hidden="true">
                        <Brain size={21} />
                    </span>
                    <div>
                        <strong>脑栖设置</strong>
                        <span>本地优先 · 1.0.0</span>
                    </div>
                </div>
                <p>{PRODUCT_BOUNDARY_COPY}</p>
            </header>

            <nav className="section-nav" aria-label="设置章节">
                <a href="#ai">AI</a>
                <a href="#routine">作息</a>
                <a href="#data">数据</a>
                {DEBUG_AVAILABLE ? <a href="#debug">调试</a> : null}
            </nav>

            {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

            <div id="ai">
                <Card
                    eyebrow="AI"
                    title="可选页面分类"
                    actions={<Sparkles size={21} aria-hidden="true" />}
                >
                    <p className="supporting-copy">
                        配置有效时，后台会调用兼容 OpenAI 协议的接口对页面做 URL 分类；API Key 只在
                        background 持有。
                    </p>
                    <div className="field-grid">
                        <label className="field">
                            <span>服务商</span>
                            <select
                                value={providerChoice}
                                onChange={(event) =>
                                    setProviderChoice(event.currentTarget.value as ProviderChoice)
                                }
                            >
                                {(Object.keys(PROVIDER_LABELS) as ProviderChoice[]).map(
                                    (choice) => (
                                        <option key={choice} value={choice}>
                                            {PROVIDER_LABELS[choice]}
                                        </option>
                                    ),
                                )}
                            </select>
                        </label>
                        <label className="field">
                            <span>分类模型</span>
                            <input
                                value={model}
                                onChange={(event) => setModel(event.currentTarget.value)}
                                placeholder="gpt-4o-mini"
                            />
                        </label>
                    </div>
                    {providerChoice === "custom" ? (
                        <label className="field">
                            <span>Base URL</span>
                            <input
                                type="url"
                                value={customUrl}
                                onChange={(event) => setCustomUrl(event.currentTarget.value)}
                                placeholder="https://api.example.com/v1"
                            />
                        </label>
                    ) : null}
                    <label className="field">
                        <span>
                            API Key {keyConfigured ? "（已配置；留空保持不变）" : "（未配置）"}
                        </span>
                        <input
                            type="password"
                            autoComplete="off"
                            value={apiKeyInput}
                            onChange={(event) => setApiKeyInput(event.currentTarget.value)}
                            placeholder="sk-…"
                        />
                    </label>
                    <div className="button-row">
                        <button
                            className="button primary"
                            type="button"
                            disabled={busy}
                            onClick={() => void saveAiSettings()}
                        >
                            <KeyRound size={17} aria-hidden="true" />
                            保存 AI 设置
                        </button>
                        {keyConfigured ? (
                            <button
                                className="button secondary"
                                type="button"
                                disabled={busy}
                                onClick={() => void saveAiSettings(true)}
                            >
                                移除 Key
                            </button>
                        ) : null}
                    </div>
                </Card>
            </div>

            <div id="routine">
                <Card
                    eyebrow="Routine"
                    title="作息时间"
                    actions={<Clock size={21} aria-hidden="true" />}
                >
                    <p className="supporting-copy">
                        用于识别跨夜休息：启动时若上次活动在“最晚入睡”之前、当前时间在
                        “最早起床”之后，则认为你已休息并记录入睡/起床时刻。
                    </p>
                    <div className="field-grid">
                        <TimeField label="平时入睡" value={sleepTime} onChange={setSleepTime} />
                        <TimeField
                            label="最晚入睡"
                            value={latestSleepTime}
                            onChange={setLatestSleepTime}
                        />
                        <TimeField
                            label="最早起床"
                            value={earliestWakeTime}
                            onChange={setEarliestWakeTime}
                        />
                    </div>
                    <div className="button-row">
                        <button
                            className="button primary"
                            type="button"
                            disabled={busy}
                            onClick={() => void saveRoutine()}
                        >
                            <Clock size={17} aria-hidden="true" />
                            保存作息时间
                        </button>
                    </div>
                </Card>
            </div>

            <div id="data">
                <Card
                    eyebrow="Data"
                    title="数据控制"
                    actions={<Database size={21} aria-hidden="true" />}
                >
                    <InlineNotice tone="warning">
                        一键清除会删除本地配置（含 API Key）、事件记录、域名分类、
                        时长统计与睡眠记录。此操作不可恢复。
                    </InlineNotice>
                    <button
                        className="button danger-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void clearAllData()}
                    >
                        <Trash2 size={17} aria-hidden="true" />
                        清除全部本地数据
                    </button>
                </Card>
            </div>

            {DEBUG_AVAILABLE ? (
                <div id="debug">
                    <Card eyebrow="Debug" title="开发者选项">
                        <Toggle
                            checked={debugMode}
                            onChange={setDebugMode}
                            label="调试模式"
                            description="注入监测数据、手动触发 AI 分类与引擎计算、查看实时引擎数据；仅开发环境可用，仅当前会话生效"
                        />
                    </Card>
                    {debugMode ? <DebugModePanel /> : null}
                </div>
            ) : null}
        </main>
    );
}
