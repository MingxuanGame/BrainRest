import { Brain, Bug, CircleAlert, Clock3, Coffee, Settings, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import DebugPage from "./debug/DebugPage";
import { InlineNotice } from "../ui/components";
import {
    deriveStatus,
    getDebugState,
    mapLoadLevel,
    PRODUCT_BOUNDARY_COPY,
    type UiLoadLevel,
    type UiStatus,
} from "../ui/bridge";
import { buildQuickBreakSuggestion } from "../ui/quick-break";
import { isDevEnvironment } from "../utils/env";
import type { RestSuggestion } from "../models/RestSuggestion";
import type { BRIResult } from "../background/engine/types";

/** 是否展示调试页入口：生产环境（商店安装）整体隐藏，模块加载时判定一次 */
const DEBUG_AVAILABLE = isDevEnvironment();

const LEVEL_COPY: Record<UiLoadLevel, string> = {
    low: "低负荷",
    medium: "中负荷",
    high: "高负荷",
    insufficient: "数据不足",
};

const STATUS_COPY: Record<
    UiStatus,
    { title: string; detail: string; tone: "success" | "warning" | "error" | "neutral" }
> = {
    running: {
        title: "本地监测运行中",
        detail: "页面行为只以聚合值参与负荷估计。",
        tone: "success",
    },
    "insufficient-data": {
        title: "正在积累有效数据",
        detail: "覆盖率不足时保持上次等级，并停止智能提醒。",
        tone: "neutral",
    },
    degraded: {
        title: "后台暂不可用",
        detail: "无法连接 service worker，请稍后重试或重载扩展。",
        tone: "error",
    },
};

interface HomeView {
    status: UiStatus;
    loadLevel: UiLoadLevel;
    continuousBrowsingMinutes: number;
    engineResult: BRIResult | null;
}

export default function App() {
    const [page, setPage] = useState<"home" | "debug">("home");
    const [view, setView] = useState<HomeView>();
    const [errorMessage, setErrorMessage] = useState<string>();
    const [quickBreak, setQuickBreak] = useState<RestSuggestion>();
    const [feedbackNotice, setFeedbackNotice] = useState<string>();

    const refresh = useCallback(async () => {
        try {
            const state = await getDebugState();
            setView({
                status: deriveStatus(state),
                loadLevel: mapLoadLevel(state.engineResult?.level),
                continuousBrowsingMinutes: Math.round(state.engineInternals.frontMinutes),
                engineResult: state.engineResult,
            });
            setErrorMessage(undefined);
        } catch (e: unknown) {
            setErrorMessage((e as Error).message);
            setView((prev) =>
                prev
                    ? { ...prev, status: "degraded" }
                    : {
                          status: "degraded",
                          loadLevel: "insufficient",
                          continuousBrowsingMinutes: 0,
                          engineResult: null,
                      },
            );
        }
    }, []);

    useEffect(() => {
        if (page !== "home") return;
        const initial = window.setTimeout(() => void refresh(), 0);
        const timer = window.setInterval(() => void refresh(), 30_000);
        return () => {
            window.clearTimeout(initial);
            window.clearInterval(timer);
        };
    }, [page, refresh]);

    if (page === "debug" && DEBUG_AVAILABLE) {
        return <DebugPage onBack={() => setPage("home")} />;
    }

    if (!view) {
        return (
            <main className="app-shell popup-shell">
                <InlineNotice tone={errorMessage ? "error" : "neutral"}>
                    {errorMessage ?? "正在读取本地状态…"}
                </InlineNotice>
            </main>
        );
    }

    const status = STATUS_COPY[view.status];

    const startQuickBreak = (): void => {
        // 本地生成建议卡：引擎未触发时走兜底路径
        setQuickBreak(buildQuickBreakSuggestion(view.engineResult));
        setFeedbackNotice(undefined);
    };

    const submitFeedback = (): void => {
        // v1 仅做 UI 反馈，不接 personalCalibration（Phase 4 延伸项）
        setQuickBreak(undefined);
        setFeedbackNotice("已收到反馈，休息愉快。");
    };

    return (
        <main className="app-shell popup-shell">
            <header className="brand header-row">
                <div className="brand-lockup">
                    <span className="brand-icon" aria-hidden="true">
                        <Brain size={20} />
                    </span>
                    <div>
                        <strong>脑栖</strong>
                        <span>BrainRest 1.0</span>
                    </div>
                </div>
                <div className="button-row">
                    {DEBUG_AVAILABLE ? (
                        <button
                            className="icon-button"
                            type="button"
                            aria-label="打开调试页"
                            title="调试"
                            onClick={() => setPage("debug")}
                        >
                            <Bug size={18} />
                        </button>
                    ) : null}
                    <button
                        className="icon-button"
                        type="button"
                        aria-label="打开脑栖设置"
                        title="打开设置"
                        onClick={() => void chrome.runtime.openOptionsPage()}
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </header>

            <InlineNotice tone={status.tone}>
                <span className="status-dot" aria-hidden="true" />
                <span>
                    <strong>{status.title}</strong>
                    <small>{status.detail}</small>
                </span>
            </InlineNotice>

            <section className="load-card" aria-labelledby="load-heading">
                <div>
                    <p className="eyebrow">当前估计</p>
                    <h1 id="load-heading">{LEVEL_COPY[view.loadLevel]}</h1>
                    <div className="level-meter" aria-label={`当前${LEVEL_COPY[view.loadLevel]}`}>
                        {(["low", "medium", "high"] as const).map((level) => (
                            <span
                                key={level}
                                className={view.loadLevel === level ? `active level-${level}` : ""}
                            />
                        ))}
                    </div>
                </div>
                <div className="session-time">
                    <Clock3 size={17} aria-hidden="true" />
                    <strong>{view.continuousBrowsingMinutes}</strong>
                    <span>分钟连续浏览</span>
                </div>
            </section>

            {quickBreak ? (
                <section className="card quick-break-card" aria-labelledby="quick-break-heading">
                    <p className="eyebrow">
                        <Sparkles size={14} aria-hidden="true" /> 快速休息
                    </p>
                    <h2 id="quick-break-heading">{quickBreak.duration}</h2>
                    <p>
                        <strong>{quickBreak.title}</strong> — {quickBreak.body}
                    </p>
                    <ol className="activity-list">
                        {quickBreak.actions.split("\n").map((line) => (
                            <li key={line}>
                                <strong>{line}</strong>
                            </li>
                        ))}
                    </ol>
                    <fieldset className="feedback-row">
                        <legend>这次建议怎么样？</legend>
                        <button type="button" onClick={submitFeedback}>
                            有帮助
                        </button>
                        <button type="button" onClick={submitFeedback}>
                            时机不好
                        </button>
                        <button type="button" onClick={submitFeedback}>
                            不需要
                        </button>
                    </fieldset>
                </section>
            ) : (
                <div className="primary-actions">
                    <button className="button primary" type="button" onClick={startQuickBreak}>
                        <Coffee size={18} aria-hidden="true" />
                        快速休息
                    </button>
                </div>
            )}

            {feedbackNotice ? <InlineNotice tone="success">{feedbackNotice}</InlineNotice> : null}

            {errorMessage ? (
                <InlineNotice tone="error">
                    <CircleAlert size={17} aria-hidden="true" />
                    <span>{errorMessage}</span>
                </InlineNotice>
            ) : null}
            <p className="boundary-copy">{PRODUCT_BOUNDARY_COPY}</p>
        </main>
    );
}
