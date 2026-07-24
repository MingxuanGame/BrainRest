import type { AbsoluteUrl } from "../models/types";
import type { Option } from "../models/Option";

const STORAGE_KEY = "brainrest_option";

const VALID_PROVIDERS = new Set<string>(["openai", "deepseek"]);

/** 默认配置（缺失字段时回退） */
const DEFAULT_OPTION: Option = {
    aiProvider: "openai",
    categorifyModel: "gpt-4o-mini",
    apiKey: "",
    latestSleepTime: [4, 0],
    earliestWakeTime: [6, 0],
    sleepTime: [22, 0],
    onboarded: false,
};

type RawProvider = "openai" | "deepseek" | AbsoluteUrl;

/**
 * 异步读取 chrome.storage.local 中的 Option，缺失或非法字段回退到默认值。
 * popup 与 service worker 均可调用（MV3 后台没有 localStorage，统一走此 API）。
 */
export async function loadOption(): Promise<Option> {
    let raw: unknown;
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        raw = result[STORAGE_KEY];
    } catch {
        return { ...DEFAULT_OPTION };
    }

    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch {
            return { ...DEFAULT_OPTION };
        }
    }
    if (raw === null || raw === undefined) {
        return { ...DEFAULT_OPTION };
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
        return { ...DEFAULT_OPTION };
    }

    const obj = raw as Record<string, unknown>;
    return {
        ...DEFAULT_OPTION,
        aiProvider: normalizeProvider(obj.aiProvider),
        categorifyModel:
            typeof obj.categorifyModel === "string"
                ? obj.categorifyModel
                : DEFAULT_OPTION.categorifyModel,
        apiKey: typeof obj.apiKey === "string" ? obj.apiKey : DEFAULT_OPTION.apiKey,
        latestSleepTime: normalizeTime(obj.latestSleepTime, DEFAULT_OPTION.latestSleepTime),
        earliestWakeTime: normalizeTime(obj.earliestWakeTime, DEFAULT_OPTION.earliestWakeTime),
        sleepTime: normalizeTime(obj.sleepTime, DEFAULT_OPTION.sleepTime),
        onboarded: obj.onboarded === true,
    };
}

/** 写入 Option 到 chrome.storage.local（失败被吞掉，不阻断调用方） */
export async function saveOption(option: Option): Promise<void> {
    try {
        await chrome.storage.local.set({ [STORAGE_KEY]: option });
    } catch {
        // 忽略配额超出 / 不可用等情况
    }
}

/** 清除存储的 Option */
export async function clearOption(): Promise<void> {
    try {
        await chrome.storage.local.remove(STORAGE_KEY);
    } catch {
        // 忽略
    }
}

/** 规范化 aiProvider：仅接受 openai/deepseek/合法绝对 URL */
function normalizeProvider(value: unknown): RawProvider {
    if (typeof value !== "string") {
        return DEFAULT_OPTION.aiProvider;
    }
    if (VALID_PROVIDERS.has(value)) {
        return value as RawProvider;
    }
    if (value.startsWith("http://") || value.startsWith("https://")) {
        return value as AbsoluteUrl;
    }
    return DEFAULT_OPTION.aiProvider;
}

/** 规范化 [小时, 分钟] 时刻：非法（缺失/越界/类型错误）时回退到默认值 */
function normalizeTime(value: unknown, fallback: [number, number]): [number, number] {
    if (
        Array.isArray(value) &&
        value.length === 2 &&
        typeof value[0] === "number" &&
        typeof value[1] === "number" &&
        Number.isInteger(value[0]) &&
        Number.isInteger(value[1]) &&
        value[0] >= 0 &&
        value[0] <= 23 &&
        value[1] >= 0 &&
        value[1] <= 59
    ) {
        return [value[0], value[1]];
    }
    return [...fallback];
}
