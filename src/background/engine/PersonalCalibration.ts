import type {UserAction} from "./types";

/* ------------------------------------------------------------------ */
/* 常量                                                               */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "brainrest_k_personal";
const LAST_CALIBRATION_KEY = "brainrest_last_calibration";

/** 初始校准系数 */
const INITIAL_K = 1.0;
/** 校准系数范围 */
const K_MIN = 0.5;
const K_MAX = 1.5;
/** 每次调整步长 */
const K_STEP = 0.05;
/** 连续行为计数阈值 */
const CONSECUTIVE_THRESHOLD = 3;
/** 自动校准周期 (ms)：7 天 */
const AUTO_CALIBRATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* 个人校准器                                                          */

/* ------------------------------------------------------------------ */

/**
 * 个人校准系数 k_personal 管理器。
 *
 * 在线学习规则：
 * - 连续 3 次在 BRI_display < 60 时用户主动点击"现在休息" → k -= 0.05（敏感型）
 * - 连续 3 次在 BRI_display >= 75 时用户忽略提示 → k += 0.05（耐受型）
 * - 每 7 天自动校准
 */
export class PersonalCalibration {
    private k: number = INITIAL_K;

    /** 连续低负荷主动休息计数 */
    private proactiveRestAtLowCount = 0;
    /** 连续高负荷忽略提示计数 */
    private dismissAtHighCount = 0;

    constructor() {
        void this.load();
    }

    /** 获取当前校准系数 */
    getK(): number {
        return this.k;
    }

    /**
     * 记录用户行为，触发在线学习。
     *
     * @param action - 用户行为类型
     * @param briDisplay - 行为发生时的 BRI_display 值
     */
    recordAction(action: UserAction, briDisplay: number): void {
        switch (action) {
            case "proactive_rest":
                // 用户在低负荷时主动休息 → 可能是敏感型
                if (briDisplay < 60) {
                    this.proactiveRestAtLowCount++;
                    this.dismissAtHighCount = 0; // 重置另一计数
                    if (this.proactiveRestAtLowCount >= CONSECUTIVE_THRESHOLD) {
                        this.adjustK(-K_STEP);
                        this.proactiveRestAtLowCount = 0;
                    }
                } else {
                    this.proactiveRestAtLowCount = 0;
                }
                break;

            case "dismiss_notification":
                // 用户在高负荷时忽略提示 → 可能是耐受型
                if (briDisplay >= 75) {
                    this.dismissAtHighCount++;
                    this.proactiveRestAtLowCount = 0; // 重置另一计数
                    if (this.dismissAtHighCount >= CONSECUTIVE_THRESHOLD) {
                        this.adjustK(K_STEP);
                        this.dismissAtHighCount = 0;
                    }
                } else {
                    this.dismissAtHighCount = 0;
                }
                break;

            case "acknowledge_notification":
                // 用户确认提示 → 重置计数（表示校准准确）
                this.proactiveRestAtLowCount = 0;
                this.dismissAtHighCount = 0;
                break;
        }
    }

    /**
     * 检查是否需要自动校准（每 7 天）。
     * 返回 true 表示已执行自动校准。
     */
    async checkAutoCalibration(recentBriValues: number[]): Promise<boolean> {
        const lastCalibration = await this.loadLastCalibrationTime();
        const now = Date.now();

        if (now - lastCalibration < AUTO_CALIBRATION_INTERVAL_MS) {
            return false;
        }

        // 以近 7 天 BRI 分布的 P80 作为个人高负荷线，反推 k
        if (recentBriValues.length > 0) {
            const sorted = [...recentBriValues].sort((a, b) => a - b);
            const p80Index = Math.floor(sorted.length * 0.8);
            const p80 = sorted[Math.min(p80Index, sorted.length - 1)];

            // 目标：让 P80 对应 BRI_display ≈ 70（高负荷门槛）
            // BRI_display ≈ BRI_raw × k，所以 k ≈ 70 / p80_raw
            // 这里简化：如果 P80 偏高则降低 k，偏低则提高 k
            if (p80 > 75) {
                this.adjustK(-K_STEP);
            } else if (p80 < 65) {
                this.adjustK(K_STEP);
            }
        }

        await this.saveLastCalibrationTime(now);
        return true;
    }

    /** 调整 k 并钳制到有效范围 */
    private adjustK(delta: number): void {
        this.k = Math.min(Math.max(this.k + delta, K_MIN), K_MAX);
        void this.save();
    }

    /* ---------------------------------------------------------------- */
    /* 持久化                                                           */

    /* ---------------------------------------------------------------- */

    private async load(): Promise<void> {
        try {
            const stored = await chrome.storage.local.get(STORAGE_KEY);
            const saved = stored[STORAGE_KEY];
            if (typeof saved === "number" && saved >= K_MIN && saved <= K_MAX) {
                this.k = saved;
            }
        } catch {
            // 读取失败保持初始值
        }
    }

    private async save(): Promise<void> {
        try {
            await chrome.storage.local.set({[STORAGE_KEY]: this.k});
        } catch {
            // 写入失败不影响运行时
        }
    }

    private async loadLastCalibrationTime(): Promise<number> {
        try {
            const stored = await chrome.storage.local.get(LAST_CALIBRATION_KEY);
            return (stored[LAST_CALIBRATION_KEY] as number) ?? 0;
        } catch {
            return 0;
        }
    }

    private async saveLastCalibrationTime(timestamp: number): Promise<void> {
        try {
            await chrome.storage.local.set({[LAST_CALIBRATION_KEY]: timestamp});
        } catch {
            // 写入失败不影响运行时
        }
    }
}

/** 全局唯一实例 */
export const personalCalibration = new PersonalCalibration();
