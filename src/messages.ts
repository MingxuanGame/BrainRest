import type {UrlCategory} from "./models/types";

/** content -> background：请求对当前页面做 URL 分类 */
export interface CategorizeRequest {
    type: "categorize";
    url: string;
    html: string;
}

/** background -> content：分类结果（仅确认/错误信息；分类已落 IDB 供下游反查） */
export interface CategorizeResponse {
    ok: boolean;
    error?: string;
    domain?: string;
    category?: UrlCategory;
}

/** 运行时消息判别 */
export type RuntimeMessage = CategorizeRequest;

export function isCategorizeRequest(m: unknown): m is CategorizeRequest {
    return typeof m === "object" && m !== null && (m as { type?: unknown }).type === "categorize";
}