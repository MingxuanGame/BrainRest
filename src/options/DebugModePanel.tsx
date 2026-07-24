import { Activity, FlaskConical, Gauge, RefreshCw, Sparkles, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { DebugStateResponse } from "../messages";
import type { BRIResult } from "../background/engine/types";
import { Card, InlineNotice, Toggle } from "../ui/components";
import {
    forceCategorizeActiveTab,
    forceEngineTick,
    getDebugState,
    injectDebugMetrics,
} from "../ui/bridge";

/** 实时数据自动刷新间隔 (ms) */
const LIVE_REFRESH_MS = 2000;

/** 把 BRIResult 摘要成一行关键指标 */
function summarizeResult(result: BRIResult | null): string {
    if (!result) return "引擎尚未产生结果（null）";
    return [
        `等级 ${result.level}`,
        `BRI_display ${result.briDisplay.toFixed(1)}`,
        `CL_cog ${result.clCog.toFixed(1)}`,
        `CL_phy ${result.clPhy.toFixed(1)}`,
        `触发路径 ${result.triggerPath ?? "未触发"}`,
        `页面类型 ${result.pageType ?? "未知"}`,
    ].join(" · ");
}

/**
 * 设置页调试模式面板：
 * 1. 注入监测数据快速构造提醒触发条件
 * 2. 对当前页面手动触发 AI 分类
 * 3. 手动调用一次认知引擎计算
 * 4. 实时查看认知引擎数据
 */
export default function DebugModePanel() {
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{
        tone: "success" | "error" | "warning";
        message: string;
    }>();

    /* --- 数据注入表单 --- */
    const [briValue, setBriValue] = useState("85");
    const [briMinutes, setBriMinutes] = useState("35");
    const [frontMinutes, setFrontMinutes] = useState("35");
    const [fillCoverage, setFillCoverage] = useState(true);
    const [resetCooldown, setResetCooldown] = useState(true);

    /* --- 各操作输出 --- */
    const [tickOutput, setTickOutput] = useState<string>();
    const [categorizeOutput, setCategorizeOutput] = useState<string>();

    /* --- 实时数据 --- */
    const [live, setLive] = useState(false);
    const [liveState, setLiveState] = useState<DebugStateResponse>();
    const [liveError, setLiveError] = useState<string>();

    const refreshLive = useCallback(async () => {
        try {
            const state = await getDebugState();
            setLiveState(state);
            setLiveError(undefined);
        } catch (e: unknown) {
            setLiveError((e as Error).message);
        }
    }, []);

    useEffect(() => {
        if (!live) return;
        const timer = window.setInterval(() => void refreshLive(), LIVE_REFRESH_MS);
        const initial = window.setTimeout(() => void refreshLive(), 0);
        return () => {
            window.clearInterval(timer);
            window.clearTimeout(initial);
        };
    }, [live, refreshLive]);

    /** 包装忙碌态与错误提示的操作执行器 */
    const run = async (action: () => Promise<void>): Promise<void> => {
        setBusy(true);
        try {
            await action();
        } catch (e: unknown) {
            setNotice({ tone: "error", message: (e as Error).message });
        } finally {
            setBusy(false);
        }
    };

    const injectCustom = (): Promise<void> =>
        run(async () => {
            const value = Number(briValue);
            const minutes = Number(briMinutes);
            const front = Number(frontMinutes);
            if (Number.isNaN(value) || Number.isNaN(minutes) || Number.isNaN(front)) {
                setNotice({ tone: "warning", message: "注入参数必须是数字。" });
                return;
            }
            await injectDebugMetrics({
                briValue: value,
                briMinutes: minutes,
                frontMinutes: front,
                fillCoverage,
                resetCooldown,
            });
            setNotice({
                tone: "success",
                message: `已注入：BRI ${value} × ${minutes}min，前台 ${front}min${fillCoverage ? "，覆盖率已铺满" : ""}${resetCooldown ? "，冷却已清零" : ""}；popup 负荷等级已同步。`,
            });
        });

    /** 一键构造路径 A 触发条件：高负荷序列 + 前台时长 + 覆盖率 + 清冷却 */
    const injectPreset = (): Promise<void> =>
        run(async () => {
            await injectDebugMetrics({
                briValue: 85,
                briMinutes: 35,
                frontMinutes: 35,
                fillCoverage: true,
                resetCooldown: true,
            });
            setNotice({
                tone: "success",
                message:
                    "已一键构造触发条件（路径 A），popup 负荷等级已同步。点击「立即计算一次」后 triggerPath 应命中。",
            });
        });

    const runTick = (): Promise<void> =>
        run(async () => {
            const result = await forceEngineTick();
            setTickOutput(summarizeResult(result));
            setNotice({
                tone: "success",
                message: result?.triggerPath
                    ? `引擎计算完成，命中触发路径 ${result.triggerPath}！`
                    : "引擎计算完成。",
            });
        });

    const runCategorize = (): Promise<void> =>
        run(async () => {
            setCategorizeOutput(undefined);
            const { result, tabUrl } = await forceCategorizeActiveTab();
            if (result.ok) {
                setCategorizeOutput(`${tabUrl}\n${result.domain} → ${result.category}`);
                setNotice({ tone: "success", message: "AI 分类完成，结果已写入本地分类库。" });
            } else {
                setCategorizeOutput(`${tabUrl}\n分类失败：${result.error ?? "未知错误"}`);
                setNotice({ tone: "error", message: result.error ?? "分类失败" });
            }
        });

    const internals = liveState?.engineInternals;

    return (
        <Card
            eyebrow="Debug"
            title="调试模式"
            actions={<FlaskConical size={21} aria-hidden="true" />}
        >
            <p className="supporting-copy">
                以下操作只改写 service worker 的内存态，不影响已落盘的数据；重载扩展即可全部还原。
            </p>

            {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

            {/* --- 1. 模拟监测数据 --- */}
            <div className="debug-group">
                <div className="debug-group-header">
                    <Gauge size={15} aria-hidden="true" />
                    <strong>模拟监测数据</strong>
                    <span className="debug-scope">[提醒触发测试]</span>
                </div>
                <div className="field-grid">
                    <label className="field">
                        <span>BRI 值 (0-100)</span>
                        <input
                            value={briValue}
                            onChange={(event) => setBriValue(event.currentTarget.value)}
                            inputMode="numeric"
                        />
                    </label>
                    <label className="field">
                        <span>回填跨度 (min)</span>
                        <input
                            value={briMinutes}
                            onChange={(event) => setBriMinutes(event.currentTarget.value)}
                            inputMode="numeric"
                        />
                    </label>
                    <label className="field">
                        <span>前台时长 (min)</span>
                        <input
                            value={frontMinutes}
                            onChange={(event) => setFrontMinutes(event.currentTarget.value)}
                            inputMode="numeric"
                        />
                    </label>
                </div>
                <Toggle
                    checked={fillCoverage}
                    onChange={setFillCoverage}
                    label="铺满数据覆盖率"
                    description="把 120s 窗口覆盖率拉到 1 并刷新样本新鲜度（硬门槛）"
                />
                <Toggle
                    checked={resetCooldown}
                    onChange={setResetCooldown}
                    label="清零触发冷却"
                    description="跳过 30min 冷却期，允许立即再次命中"
                />
                <div className="button-row">
                    <button
                        className="button primary compact"
                        type="button"
                        disabled={busy}
                        onClick={() => void injectPreset()}
                    >
                        <Zap size={15} aria-hidden="true" />
                        一键构造触发条件
                    </button>
                    <button
                        className="button secondary compact"
                        type="button"
                        disabled={busy}
                        onClick={() => void injectCustom()}
                    >
                        按上方参数注入
                    </button>
                </div>
            </div>

            {/* --- 2. 引擎手动计算 --- */}
            <div className="debug-group">
                <div className="debug-group-header">
                    <RefreshCw size={15} aria-hidden="true" />
                    <strong>认知引擎手动计算</strong>
                    <span className="debug-scope">[跳过 30s 节拍]</span>
                </div>
                <div className="button-row">
                    <button
                        className="button primary compact"
                        type="button"
                        disabled={busy}
                        onClick={() => void runTick()}
                    >
                        立即计算一次
                    </button>
                </div>
                {tickOutput ? <pre className="debug-pre">{tickOutput}</pre> : null}
            </div>

            {/* --- 3. AI 分类 --- */}
            <div className="debug-group">
                <div className="debug-group-header">
                    <Sparkles size={15} aria-hidden="true" />
                    <strong>手动 AI 分类</strong>
                    <span className="debug-scope">[最近使用的网页标签页]</span>
                </div>
                <div className="button-row">
                    <button
                        className="button primary compact"
                        type="button"
                        disabled={busy}
                        onClick={() => void runCategorize()}
                    >
                        对当前页面触发分类
                    </button>
                </div>
                {categorizeOutput ? <pre className="debug-pre">{categorizeOutput}</pre> : null}
            </div>

            {/* --- 4. 实时引擎数据 --- */}
            <div className="debug-group">
                <div className="debug-group-header">
                    <Activity size={15} aria-hidden="true" />
                    <strong>实时引擎数据</strong>
                    <span className="debug-scope">[每 {LIVE_REFRESH_MS / 1000}s 刷新]</span>
                </div>
                <Toggle checked={live} onChange={setLive} label="自动刷新" />
                {liveError ? <pre className="debug-pre is-fail">{liveError}</pre> : null}
                {internals ? (
                    <pre className="debug-pre">
                        {[
                            `前台时长 ${internals.frontMinutes.toFixed(1)} min（门槛 ≥30）`,
                            `覆盖率 ${(internals.coverage * 100).toFixed(0)}%（门槛 ≥70%）`,
                            `高负荷时长 ${internals.highLoadMinutes.toFixed(1)} min（路径 A ≥20）`,
                            `AUC ${internals.auc.toFixed(0)} score·min（路径 B ≥4000）`,
                            `最近 BRI ${internals.briLatest?.toFixed(1) ?? "无采样"}`,
                            `上次触发 ${internals.lastTriggeredAt === 0 ? "从未" : new Date(internals.lastTriggeredAt).toLocaleTimeString()}`,
                        ].join("\n")}
                    </pre>
                ) : null}
                {liveState ? (
                    <pre className="debug-pre">{summarizeResult(liveState.engineResult)}</pre>
                ) : null}
            </div>
        </Card>
    );
}
