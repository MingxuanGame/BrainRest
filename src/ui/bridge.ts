import type { DebugStateRequest, DebugStateResponse } from "../messages";
import type { LoadLevel } from "../background/engine/types";

/** UI 展示用负荷等级（ADVX 视觉沿用 low/medium/high/insufficient 命名） */
export type UiLoadLevel = "low" | "medium" | "high" | "insufficient";

/** UI 展示用运行状态（BrainRest 无授权/暂停语义，仅保留三态） */
export type UiStatus = "running" | "insufficient-data" | "degraded";

/** 产品边界文案（估计值声明） */
export const PRODUCT_BOUNDARY_COPY =
    "脑栖根据浏览行为和页面结构估计负荷，不是医学、生理或真实认知状态测量。";

/**
 * 查询 service worker 调试状态快照（UI 与 messages.ts 的唯一接口）。
 * 失败（SW 未就绪 / 消息通道异常）时抛出，由调用方降级为 degraded。
 */
export async function getDebugState(): Promise<DebugStateResponse> {
    const request: DebugStateRequest = { type: "debug_get_state" };
    const response = (await chrome.runtime.sendMessage(request)) as DebugStateResponse | undefined;
    if (!response || !response.ok) {
        throw new Error(response?.error ?? "service worker 未响应");
    }
    return response;
}

/** 引擎等级 → UI 等级：moderate→medium、insufficient_data→insufficient */
export function mapLoadLevel(level: LoadLevel | null | undefined): UiLoadLevel {
    switch (level) {
        case "low":
            return "low";
        case "moderate":
            return "medium";
        case "high":
            return "high";
        default:
            return "insufficient";
    }
}

/** 由调试快照推导 UI 运行状态：有结果且覆盖率达标→running；否则→insufficient-data */
export function deriveStatus(state: DebugStateResponse): UiStatus {
    if (state.engineResult && state.engineResult.level !== "insufficient_data") {
        return "running";
    }
    return "insufficient-data";
}
