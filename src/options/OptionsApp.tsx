import { Brain, Database, KeyRound, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { clearOption, loadOption, saveOption } from "../services/OptionStore";
import { eventDB } from "../services/EventDataBaseManager";
import { urlCategoryDB } from "../services/UrlCategoryDataBaseManager";
import { timeDataStore } from "../services/TimeDataStore";
import { sleepTimeStore } from "../services/SleepTimeStore";
import type { Option } from "../models/Option";
import { Card, InlineNotice, Toggle } from "../ui/components";
import { PRODUCT_BOUNDARY_COPY } from "../ui/bridge";
import DebugModePanel from "./DebugModePanel";

/** provider 下拉项：openai / deepseek / 自定义绝对 URL */
type ProviderChoice = "openai" | "deepseek" | "custom";

const PROVIDER_LABELS: Record<ProviderChoice, string> = {
    openai: "OpenAI",
    deepseek: "DeepSeek",
    custom: "自定义 Base URL",
};

/** 将 Option.aiProvider 拆成下拉选择 + 自定义 URL 两个 UI 字段 */
function splitProvider(provider: Option["aiProvider"]): { choice: ProviderChoice; url: string } {
    if (provider === "openai" || provider === "deepseek") {
        return { choice: provider, url: "" };
    }
    return { choice: "custom", url: provider };
}

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
    // 调试模式仅当前会话生效，不持久化
    const [debugMode, setDebugMode] = useState(false);

    const refresh = useCallback(async () => {
        const option = await loadOption();
        const { choice, url } = splitProvider(option.aiProvider);
        setProviderChoice(choice);
        setCustomUrl(url);
        setModel(option.categorifyModel);
        setKeyConfigured(option.apiKey !== "");
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

    /** 由 UI 字段还原 Option.aiProvider；自定义 URL 非法时返回 null */
    const resolveProvider = (): Option["aiProvider"] | null => {
        if (providerChoice !== "custom") return providerChoice;
        const url = customUrl.trim();
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return url as Option["aiProvider"];
        }
        return null;
    };

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
                sleepTimeStore.clear(),
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
                <a href="#data">数据</a>
                <a href="#debug">调试</a>
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

            <div id="debug">
                <Card eyebrow="Debug" title="开发者选项">
                    <Toggle
                        checked={debugMode}
                        onChange={setDebugMode}
                        label="调试模式"
                        description="注入监测数据、手动触发 AI 分类与引擎计算、查看实时引擎数据；仅当前会话生效"
                    />
                </Card>
                {debugMode ? <DebugModePanel /> : null}
            </div>
        </main>
    );
}
