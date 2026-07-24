import { buildRestSuggestion } from "../background/engine/RestSuggestion";
import type { BRIResult, TriggerPath } from "../background/engine/types";
import { triggerBaseline } from "../data/trigger-baseline";
import { fatigueTitle } from "../data/fatigue-title";
import type { RestSuggestion } from "../models/RestSuggestion";
import { formatDuration } from "../utils/time";

const MARKS = ["①", "②", "③", "④", "⑤"] as const;

/** 根据引擎结果挑一条兜底触发路径：身体信号占优→C，高负荷→A，其余→B */
function pickFallbackPath(result: BRIResult): TriggerPath {
    if (result.clPhy > result.clCog) return "C";
    if (result.level === "high") return "A";
    return "B";
}

/** 完全无引擎结果时的固定兜底：用路径 B（累积等效负荷）基调造一条建议 */
function buildDefaultSuggestion(): RestSuggestion {
    const base = triggerBaseline.B;
    return {
        title: fatigueTitle[base.fatigue] ?? "该休息了",
        duration: formatDuration(base.durationMin),
        body: base.rationale,
        actions: base.coreActivities.map((name, i) => `${MARKS[i] ?? "·"} ${name}`).join("\n"),
    };
}

/**
 * 用户主动点击"快速休息"时生成建议：
 * 1. 引擎已触发（triggerPath 非空）→ 直接走 buildRestSuggestion；
 * 2. 引擎有结果但未触发 → 强制指定兜底路径再生成（保留 pageType 档案信息）；
 * 3. 引擎尚无结果 → 固定兜底建议。
 */
export function buildQuickBreakSuggestion(result: BRIResult | null): RestSuggestion {
    if (result) {
        const direct = buildRestSuggestion(result);
        if (direct) return direct;
        const forced = buildRestSuggestion({ ...result, triggerPath: pickFallbackPath(result) });
        if (forced) return forced;
    }
    return buildDefaultSuggestion();
}
