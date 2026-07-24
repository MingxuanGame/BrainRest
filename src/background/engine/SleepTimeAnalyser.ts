import { routineStore } from "../../services/RoutineStore";
import type { RoutineRecord } from "../../services/RoutineStore";
import { MINUTES_PER_DAY, minutesToTime } from "../../utils/time";

class SleepTimeAnalyser {
    private static instance: SleepTimeAnalyser | null = null;

    static getInstance(): SleepTimeAnalyser {
        if (!SleepTimeAnalyser.instance) {
            SleepTimeAnalyser.instance = new SleepTimeAnalyser();
        }
        return SleepTimeAnalyser.instance;
    }

    private constructor() {}

    /**
     * 计算平均睡眠时间
     * @param guideMode 是否启用引导模式
     * @param frontMinutes 提前的分钟数
     * @returns 平均睡眠时间的 [小时, 分钟]，若无法计算则返回 null
     */
    async calculateSleepTime(
        guideMode: boolean,
        frontMinutes: number,
    ): Promise<[number, number] | null> {
        const recentSleepTimes = await routineStore.getRecent(14);
        void guideMode;
        void frontMinutes;
        const avgMinutes = this.averageSleepTime(recentSleepTimes);
        if (avgMinutes === null) return null;
        const [hour, minute] = minutesToTime(avgMinutes);
        if (guideMode) {
            if (minute < frontMinutes) {
                return [hour - 1, minute + 60 - frontMinutes];
            } else {
                return [hour, minute - frontMinutes];
            }
        }
        return [hour, minute];
    }

    /**
     * 根据最近 14 天的入睡时刻计算平均睡眠时间（分钟，自午夜起算）。
     * 入睡时刻是环形数据（跨午夜），故采用环形均值；用 MAD 剔除极端值；
     * 若剔除后剩余数据过少或离散度过大，则认为无法平均，返回 null。
     */
    private averageSleepTime(records: RoutineRecord[]): number | null {
        // 数据量过少无法稳定平均
        if (records.length < 3) return null;

        const minutes = records.map((r) => r.sleepHour * 60 + r.sleepMinute);

        // 环形均值（处理跨午夜情况，如 23:00 与 01:00）
        const meanMinutes = this.circularMean(minutes);
        if (meanMinutes === null) return null;

        // 计算每个样本到环形均值的环形距离（0 ~ MINUTES_PER_DAY/2）
        const deviations = minutes.map((m) => this.circularDistance(m, meanMinutes));

        // 用中位数绝对偏差（MAD）做稳健的极端值识别
        const medianDev = this.median(deviations);
        // 1.4826 为 MAD 到标准差的归一化系数；阈值下限 60 分钟避免数据过于集中时误判
        const threshold = Math.max(60, 3 * 1.4826 * medianDev);

        const filtered = minutes.filter((_, i) => deviations[i] <= threshold);

        // 剔除后剩余不足一半，说明数据特别极端，无法平均
        if (filtered.length < Math.ceil(records.length / 2)) return null;

        // 剔除后离散度仍很大（超过 2 小时），认为睡眠时间极不规律，无法平均
        const filteredMean = this.circularMean(filtered);
        if (filteredMean === null) return null;
        const remainingSpread = this.median(
            filtered.map((m) => this.circularDistance(m, filteredMean)),
        );
        if (remainingSpread > 120) return null;

        return Math.round(filteredMean);
    }

    /** 环形均值：将分钟映射到单位圆，取合成向量方向 */
    private circularMean(minutes: number[]): number | null {
        if (minutes.length === 0) return null;
        let sinSum = 0;
        let cosSum = 0;
        for (const m of minutes) {
            const angle = (m / MINUTES_PER_DAY) * 2 * Math.PI;
            sinSum += Math.sin(angle);
            cosSum += Math.cos(angle);
        }
        // 合成向量长度过小（方向几乎抵消），说明数据散布在整个圆周上，无法平均
        const r = Math.hypot(sinSum, cosSum);
        if (r / minutes.length < 0.1) return null;
        const meanAngle = Math.atan2(sinSum, cosSum);
        const meanMinutes = (meanAngle / (2 * Math.PI)) * MINUTES_PER_DAY;
        return (meanMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    }

    /** 环形距离：两个时刻之间的最短分钟差 */
    private circularDistance(a: number, b: number): number {
        const diff = Math.abs(a - b) % MINUTES_PER_DAY;
        return Math.min(diff, MINUTES_PER_DAY - diff);
    }

    /** 中位数 */
    private median(values: number[]): number {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }
}

export const sleepTimeAnalyser = SleepTimeAnalyser.getInstance();
