import type { Option } from "../models/Option";

/** provider 下拉项：openai / deepseek / 自定义绝对 URL */
export type ProviderChoice = "openai" | "deepseek" | "custom";

export const PROVIDER_LABELS: Record<ProviderChoice, string> = {
    openai: "OpenAI",
    deepseek: "DeepSeek",
    custom: "自定义 Base URL",
};

/** 将 Option.aiProvider 拆成下拉选择 + 自定义 URL 两个 UI 字段 */
export function splitProvider(provider: Option["aiProvider"]): {
    choice: ProviderChoice;
    url: string;
} {
    if (provider === "openai" || provider === "deepseek") {
        return { choice: provider, url: "" };
    }
    return { choice: "custom", url: provider };
}

/** 由下拉选择 + 自定义 URL 还原 Option.aiProvider；自定义 URL 非法时返回 null */
export function joinProvider(choice: ProviderChoice, url: string): Option["aiProvider"] | null {
    if (choice !== "custom") return choice;
    const trimmed = url.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed as Option["aiProvider"];
    }
    return null;
}
