import type {Event} from "../models/events/Event";
import type {ContentEventStats} from "../messages";

/* 调试统计（供 DebugResponder 查询，不影响业务发送） */
const stats: ContentEventStats = {
    total: 0,
    byType: {},
    lastEventAt: null,
    portAlive: true,
};

const port = chrome.runtime.connect({
    name: "event-stream",
});

port.onDisconnect.addListener(() => {
    stats.portAlive = false;
});

export function sendEvent(event: Event) {
    port.postMessage(event);
    stats.total += 1;
    stats.byType[event.type] = (stats.byType[event.type] ?? 0) + 1;
    stats.lastEventAt = event.timestamp;
}

/** 返回当前事件发送统计的快照 */
export function getEventStats(): ContentEventStats {
    return {...stats, byType: {...stats.byType}};
}
