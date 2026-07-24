import type { BRIResult } from "./types";
import { loadTypeProfiles } from "../../data/load-types";
import { categoryLoadType } from "../../data/category-load-type";
import { triggerBaseline } from "../../data/trigger-baseline";
import { fatigueTitle } from "../../data/fatigue-title";
import type { RecoveryActivity } from "../../data/types";
import type { RestSuggestion } from "../../models/RestSuggestion";
import { formatDuration } from "../../utils/time";

/**
 * 从活动池中抽取 count 个恢复活动：
 * - ⭐ 优先活动（star=true）必选，排在最前
 * - 其余从池中随机抽取补足
 */
export function pickActivities(pool: RecoveryActivity[], count = 3): RecoveryActivity[] {
    const starred = pool.filter((a) => a.star);
    const rest = pool.filter((a) => !a.star);

    // Fisher–Yates 洗牌
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    return [...starred, ...rest].slice(0, count);
}

const MARKS = ["①", "②", "③", "④", "⑤"] as const;

function formatActions(activities: RecoveryActivity[]): string {
    return activities
        .map((a, i) => {
            const mark = MARKS[i] ?? "·";
            const detail = a.detail ? `（${a.detail}）` : "";
            return `${mark} ${a.name}${detail}`;
        })
        .join("\n");
}

export function buildRestSuggestion(result: BRIResult): RestSuggestion | null {
    if (result.triggerPath === null) return null;

    const base = triggerBaseline[result.triggerPath];
    const loadType = result.pageType ? categoryLoadType[result.pageType] : null;
    const profile = loadType ? loadTypeProfiles[loadType] : null;

    // 有负荷类型档案时从活动池抽 3 个；否则回退到路径基调的核心活动
    const activities: RecoveryActivity[] = profile
        ? pickActivities(profile.activities, 3)
        : base.coreActivities.map((name) => ({ name, purpose: "" }));

    return {
        title: fatigueTitle[base.fatigue] ?? "该休息了",
        duration: formatDuration(profile?.durationMin ?? base.durationMin),
        body: profile?.message ?? base.rationale,
        actions: formatActions(activities.slice(0, 3)),
    };
}
