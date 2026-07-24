import {createEvent} from "../models/events/Event";
import type {TabCreated} from "../models/events/TabCreated";
import type {TabClosed} from "../models/events/TabClosed";
import type {TabChanged} from "../models/events/TabChanged";
import type {TabActivated} from "../models/events/TabActivated";
import {queue} from "./EventQueue";
import {tabEventBuffer} from "./engine/TabEventBuffer";

const tabUrls = new Map<number, string>();

chrome.tabs.onCreated.addListener((tab) => {
    const url = tab.url ?? "";
    tabUrls.set(tab.id ?? 0, url);
    queue.push(createEvent<TabCreated>({
        type: "tab_created",
        tabId: tab.id ?? 0,
        url,
    }));
});

chrome.tabs.onRemoved.addListener((tabId) => {
    const url = tabUrls.get(tabId) ?? "";
    tabUrls.delete(tabId);
    queue.push(createEvent<TabClosed>({
        type: "tab_closed",
        tabId,
        url,
    }));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // 页面加载完成：写入 TabEventBuffer（用于 N_load 统计）
    if (changeInfo.status === "complete") {
        tabEventBuffer.pushLoad();
    }

    if (!changeInfo.url) return;

    const old_url = tabUrls.get(tabId) ?? "";
    tabUrls.set(tabId, changeInfo.url);
    queue.push(createEvent<TabChanged>({
        type: "tab_changed",
        tabId,
        url: tab.url ?? changeInfo.url,
        old_url,
        new_url: changeInfo.url,
    }));
});

chrome.tabs.onActivated.addListener(({tabId, windowId}) => {
    queue.push(createEvent<TabActivated>({
        type: "tab_activated",
        tabId,
        windowId,
        url: tabUrls.get(tabId) ?? "",
    }));
});