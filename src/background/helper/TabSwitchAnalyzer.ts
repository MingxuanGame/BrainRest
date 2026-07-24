import { tabEventBuffer } from "../engine/TabEventBuffer";

/**
 * 统计最近 5 分钟内的标签页激活次数 N_switch。
 * 数据来源：TabEventBuffer（由 TabListener 写入）。
 */
export function calculateTabSwitchCount(): number {
    return tabEventBuffer.getSwitchCount();
}

/**
 * 统计最近 5 分钟内的页面加载完成次数 N_load。
 * 数据来源：TabEventBuffer（由 TabListener 写入）。
 */
export function calculatePageLoadCount(): number {
    return tabEventBuffer.getLoadCount();
}
