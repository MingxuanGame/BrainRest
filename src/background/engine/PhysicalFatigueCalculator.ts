import type {PhysicalSignals} from "./types";
import {calcuateMouseAnthropy, calculateEyeHandDelay} from "../helper/MouseTrackAnalyzer";
import {calculateEventFrequency} from "../helper/EventFrequencyAnalyzer";
import {calculateDeleteKeyRatio} from "../helper/KeyboardAnalyzer";

/* ------------------------------------------------------------------ */
/* 常量                                                               */
/* ------------------------------------------------------------------ */

/** 8 方向桶最大理论熵 = log₂(8) = 3 bit */
const MAX_ENTROPY_BIT = 3;

/** 眼-手延迟满分阈值 (ms) */
const MAX_EYE_HAND_DELAY_MS = 500;

/** 交互频率满分阈值 (events/s) */
const MAX_INTERACT_FREQ = 10;

/** 休息衰减因子查表 */
const REST_WEIGHT = {
    normal: 0,
    videoFullscreen: 30,
    mouseIdle: 40,
    windowBlur: 50,
    deviceLocked: 80,
} as const;

/** 判定"鼠标静止"的时长阈值 (ms) */
const MOUSE_IDLE_MS = 20_000;
/** 判定"窗口失焦"的时长阈值 (ms) */
const WINDOW_BLUR_MS = 30_000;

/* ------------------------------------------------------------------ */
/* 工具函数                                                           */

/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/* ------------------------------------------------------------------ */
/* 休息状态输入                                                        */

/* ------------------------------------------------------------------ */

export interface RestState {
    videoFullscreen: boolean;
    deviceLocked: boolean;
    isFocused: boolean;
    lastBlurAt: number | null;
    lastActivityAt: number;
}

/* ------------------------------------------------------------------ */
/* 身体疲劳计算器                                                      */

/* ------------------------------------------------------------------ */

/**
 * 计算身体疲劳子指数 CL_phy (0-100)。
 *
 * CL_phy = [(0.30·E + 0.20·L + 0.25·I + 0.25·R) / 100] × (1 - R_rest/100) × 100
 *
 * @param restState - 当前休息状态
 */
export function calculatePhysicalFatigue(
    restState: RestState,
): { clPhy: number; signals: PhysicalSignals } {
    // E：轨迹熵得分 = H_traj / 3 bit × 100
    // calcuateMouseAnthropy() 返回归一化到 [0,1] 的熵，需还原到 bit 再除以 3
    const normalizedEntropy = calcuateMouseAnthropy(); // [0, 1]
    const entropyBit = normalizedEntropy * MAX_ENTROPY_BIT; // [0, 3] bit
    const E = clamp((entropyBit / MAX_ENTROPY_BIT) * 100, 0, 100);

    // L：眼-手延迟得分 = min(τ_eye / 500ms × 100, 100)
    const delayMs = calculateEyeHandDelay();
    const L =
        delayMs === null
            ? 0
            : clamp((delayMs / MAX_EYE_HAND_DELAY_MS) * 100, 0, 100);

    // I：交互强度得分 = min(f_interact / 10 s⁻¹ × 100, 100)
    const freq = calculateEventFrequency();
    const I = clamp((freq / MAX_INTERACT_FREQ) * 100, 0, 100);

    // R：修正负荷得分 = r_correct × 100
    const deleteRatio = calculateDeleteKeyRatio();
    const R = clamp(deleteRatio * 100, 0, 100);

    // R_rest：休息衰减因子（查表取最大值）
    const R_rest = computeRestWeight(restState);

    // CL_phy = [(0.30·E + 0.20·L + 0.25·I + 0.25·R) / 100] × (1 - R_rest/100) × 100
    const weightedSum = 0.3 * E + 0.2 * L + 0.25 * I + 0.25 * R;
    const clPhy = clamp(
        (weightedSum / 100) * (1 - R_rest / 100) * 100,
        0,
        100,
    );

    const signals: PhysicalSignals = {E, L, I, R, R_rest};

    return {clPhy, signals};
}

/* ------------------------------------------------------------------ */
/* 休息权重计算                                                        */

/* ------------------------------------------------------------------ */

function computeRestWeight(state: RestState): number {
    if (state.deviceLocked) return REST_WEIGHT.deviceLocked;

    const now = Date.now();
    let rest: number = REST_WEIGHT.normal;

    if (
        !state.isFocused &&
        state.lastBlurAt !== null &&
        now - state.lastBlurAt > WINDOW_BLUR_MS
    ) {
        rest = Math.max(rest, REST_WEIGHT.windowBlur);
    }

    if (now - state.lastActivityAt > MOUSE_IDLE_MS) {
        rest = Math.max(rest, REST_WEIGHT.mouseIdle);
    }

    if (state.videoFullscreen) {
        rest = Math.max(rest, REST_WEIGHT.videoFullscreen);
    }

    return rest;
}
