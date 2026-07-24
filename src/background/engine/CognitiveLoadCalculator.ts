import type {CognitiveSignals, PageComplexitySnapshot} from "./types";
import {TYPE_BASELINE} from "./types";
import type {UrlCategory} from "../../models/types";
import {sessionTracker} from "./SessionTracker";
import {tabEventBuffer} from "./TabEventBuffer";

/* ------------------------------------------------------------------ */
/* 常量                                                               */
/* ------------------------------------------------------------------ */

/** 满密度参考阈值：50 chars / 10⁴ px² = 50×10⁻⁴ chars·px⁻² */
const MAX_TEXT_DENSITY = 50e-4;

/** 切换负荷系数：每次标签页激活记 12.5 分 */
const SWITCH_UNIT = 12.5;
/** 切换负荷系数：每次页面加载记 7.5 分 */
const LOAD_UNIT = 7.5;

/* ------------------------------------------------------------------ */
/* 工具函数                                                           */

/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/* ------------------------------------------------------------------ */
/* 认知负荷计算器                                                      */

/* ------------------------------------------------------------------ */

/**
 * 计算认知负荷子指数 CL_cog (0-100)。
 *
 * CL_cog = 0.35·D + 0.15·B + 0.30·P + 0.20·T
 *
 * @param pageType - 当前页面的 URL 分类（用于查 B 分值）
 * @param complexity - 最新的页面复杂度快照
 */
export function calculateCognitiveLoad(
    pageType: UrlCategory | null,
    complexity: PageComplexitySnapshot | null,
): { clCog: number; signals: CognitiveSignals } {
    // D：时长得分 = min(t_front / 60min × 100, 100)
    const tFront = sessionTracker.getFrontMinutes();
    const D = clamp((tFront / 60) * 100, 0, 100);

    // B：页面类型基线（查表）
    const B = pageType ? TYPE_BASELINE[pageType] : 50; // 未知类型取中间值

    // ρ：文字密度得分 = min(ρ_raw / MAX_TEXT_DENSITY × 100, 100)
    const rhoRaw = complexity?.textDensity ?? 0;
    const rho = clamp((rhoRaw / MAX_TEXT_DENSITY) * 100, 0, 100);

    // S：结构复杂度得分
    const nTable = complexity?.tableCount ?? 0;
    const nCode = complexity?.codeCount ?? 0;
    const nList = complexity?.listCount ?? 0;
    const nHeading = complexity?.headingCount ?? 0;
    const structureScore =
        (nTable * 3 + nCode * 2 + nList * 1.5 + nHeading * 1) / 10;
    const S = clamp(structureScore, 0, 1) * 100;

    // P：页面综合复杂度 = 0.70·ρ + 0.30·S
    const P = 0.7 * rho + 0.3 * S;

    // T：切换负荷 = min(N_switch × 12.5 + N_load × 7.5, 100)
    const nSwitch = tabEventBuffer.getSwitchCount();
    const nLoad = tabEventBuffer.getLoadCount();
    const T = clamp(nSwitch * SWITCH_UNIT + nLoad * LOAD_UNIT, 0, 100);

    // CL_cog = 0.35·D + 0.15·B + 0.30·P + 0.20·T
    const clCog = clamp(0.35 * D + 0.15 * B + 0.3 * P + 0.2 * T, 0, 100);

    const signals: CognitiveSignals = {D, B, rho, S, P, T};

    return {clCog, signals};
}
