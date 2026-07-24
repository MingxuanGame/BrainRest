import { Brain, ChevronLeft, ChevronRight, Clock, Rocket, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { loadOption, saveOption } from "../services/OptionStore";
import { Card, InlineNotice, TimeField } from "../ui/components";
import { PRODUCT_BOUNDARY_COPY } from "../ui/bridge";
import { joinProvider, PROVIDER_LABELS, type ProviderChoice, splitProvider } from "./provider";

/** 引导步骤：欢迎 → 作息时间 → AI（可选） */
const STEP_TITLES = ["欢迎使用脑栖", "设置作息时间", "AI 页面分类（可选）"];

export default function Onboarding({ onDone }: { onDone: () => void }) {
    const [step, setStep] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    const [sleepTime, setSleepTime] = useState<[number, number]>([22, 0]);
    const [latestSleepTime, setLatestSleepTime] = useState<[number, number]>([4, 0]);
    const [earliestWakeTime, setEarliestWakeTime] = useState<[number, number]>([6, 0]);
    const [providerChoice, setProviderChoice] = useState<ProviderChoice>("openai");
    const [customUrl, setCustomUrl] = useState("");
    const [model, setModel] = useState("gpt-4o-mini");
    const [apiKeyInput, setApiKeyInput] = useState("");

    // 引导默认值沿用已存配置（例如清除数据后再次进入）
    const prefill = useCallback(async () => {
        const option = await loadOption();
        const { choice, url } = splitProvider(option.aiProvider);
        setProviderChoice(choice);
        setCustomUrl(url);
        setModel(option.categorifyModel);
        setSleepTime(option.sleepTime);
        setLatestSleepTime(option.latestSleepTime);
        setEarliestWakeTime(option.earliestWakeTime);
    }, []);

    useEffect(() => {
        const initial = window.setTimeout(() => void prefill(), 0);
        return () => window.clearTimeout(initial);
    }, [prefill]);

    const finish = async (): Promise<void> => {
        // AI 为可选项：自定义 URL 填了但非法才拦截，其余情况直接完成引导
        const provider = joinProvider(providerChoice, customUrl);
        if (providerChoice === "custom" && customUrl.trim() !== "" && !provider) {
            setError("自定义 Base URL 必须是 http(s) 绝对地址。");
            return;
        }
        setBusy(true);
        try {
            const current = await loadOption();
            await saveOption({
                ...current,
                aiProvider: provider ?? current.aiProvider,
                categorifyModel: model.trim() || current.categorifyModel,
                apiKey: apiKeyInput || current.apiKey,
                sleepTime,
                latestSleepTime,
                earliestWakeTime,
                onboarded: true,
            });
            onDone();
        } catch (e: unknown) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const isLast = step === STEP_TITLES.length - 1;

    return (
        <main className="app-shell options-shell">
            <header className="options-header">
                <div className="brand brand-lockup">
                    <span className="brand-icon" aria-hidden="true">
                        <Brain size={21} />
                    </span>
                    <div>
                        <strong>脑栖初始配置</strong>
                        <span>
                            第 {step + 1} / {STEP_TITLES.length} 步
                        </span>
                    </div>
                </div>
                <p>{PRODUCT_BOUNDARY_COPY}</p>
            </header>

            {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

            <Card
                eyebrow="Setup"
                title={STEP_TITLES[step]}
                actions={
                    step === 0 ? (
                        <Rocket size={21} aria-hidden="true" />
                    ) : step === 1 ? (
                        <Clock size={21} aria-hidden="true" />
                    ) : (
                        <Sparkles size={21} aria-hidden="true" />
                    )
                }
            >
                {step === 0 ? (
                    <p className="supporting-copy">
                        脑栖在本地估计你的认知负荷与疲劳，并在合适时机建议休息。
                        接下来两步会配置作息时间与可选的 AI 分类，全部数据仅保存在本机。
                    </p>
                ) : null}

                {step === 1 ? (
                    <>
                        <p className="supporting-copy">
                            用于识别跨夜休息：启动时若上次活动在“最晚入睡”之前、当前时间在
                            “最早起床”之后，则认为你已休息。
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
                    </>
                ) : null}

                {step === 2 ? (
                    <>
                        <p className="supporting-copy">
                            配置有效时，后台会调用兼容 OpenAI 协议的接口对页面做 URL
                            分类；留空可稍后在 设置页补充。API Key 只在 background 持有。
                        </p>
                        <div className="field-grid">
                            <label className="field">
                                <span>服务商</span>
                                <select
                                    value={providerChoice}
                                    onChange={(event) =>
                                        setProviderChoice(
                                            event.currentTarget.value as ProviderChoice,
                                        )
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
                            <span>API Key（可选）</span>
                            <input
                                type="password"
                                autoComplete="off"
                                value={apiKeyInput}
                                onChange={(event) => setApiKeyInput(event.currentTarget.value)}
                                placeholder="sk-…"
                            />
                        </label>
                    </>
                ) : null}

                <div className="button-row">
                    {step > 0 ? (
                        <button
                            className="button secondary"
                            type="button"
                            disabled={busy}
                            onClick={() => setStep((s) => s - 1)}
                        >
                            <ChevronLeft size={17} aria-hidden="true" />
                            上一步
                        </button>
                    ) : null}
                    {isLast ? (
                        <button
                            className="button primary"
                            type="button"
                            disabled={busy}
                            onClick={() => void finish()}
                        >
                            <Rocket size={17} aria-hidden="true" />
                            完成配置
                        </button>
                    ) : (
                        <button
                            className="button primary"
                            type="button"
                            disabled={busy}
                            onClick={() => setStep((s) => s + 1)}
                        >
                            下一步
                            <ChevronRight size={17} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </Card>
        </main>
    );
}
