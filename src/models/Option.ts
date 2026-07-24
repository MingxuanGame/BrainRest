import type { AbsoluteUrl } from "./types";

export interface Option {
    aiProvider: "openai" | "deepseek" | AbsoluteUrl; // TODO: add more providers
    categorifyModel: string;
    apiKey: string;

    latestSleepTime: [number, number]; // [hour, minute], 24-hour format
    earliestWakeTime: [number, number]; // [hour, minute], 24-hour format
    sleepTime: [number, number]; // [hour, minute], 24-hour format

    onboarded: boolean; // 是否已完成初始配置引导
}
