import { queue } from "../EventQueue";
import type { Event } from "../../models/events/Event";

/**
 * 视为"标签页乱跳"的事件类型：激活其它标签、页内跳转、开/关标签。
 * 与 SwitchEntropyAnalyzer 的口径一致，并额外纳入真正的标签激活事件。
 */
const SWITCH_TYPES = new Set<string>([
  "tab_activated",
  "tab_changed",
  "tab_created",
  "tab_closed",
]);

function isSwitchEvent(event: Event): boolean {
  return SWITCH_TYPES.has(event.type);
}

/**
 * 统计当前 5s 滑动窗口内的标签页切换次数（T 指标的原始值）。
 */
export function calculateTabSwitchCount(): number {
  return queue.getEvents().filter(isSwitchEvent).length;
}
