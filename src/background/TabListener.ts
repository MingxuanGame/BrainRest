import type { TabCreated } from "../models/events/TabCreated";
import type { TabClosed } from "../models/events/TabClosed";
import type { TabChanged } from "../models/events/TabChanged";
import { queue } from "./EventQueue";

const tabUrls = new Map<number, string>();

chrome.tabs.onCreated.addListener((tab) => {
  const url = tab.url ?? "";
  tabUrls.set(tab.id ?? 0, url);
  const event: TabCreated = {
    type: "tab_created",
    tabId: tab.id ?? 0,
    url,
    timestamp: Date.now(),
  };
  queue.push(event);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const url = tabUrls.get(tabId) ?? "";
  tabUrls.delete(tabId);
  const event: TabClosed = {
    type: "tab_closed",
    tabId,
    url,
    timestamp: Date.now(),
  };
  queue.push(event);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  const old_url = tabUrls.get(tabId) ?? "";
  const event: TabChanged = {
    type: "tab_changed",
    tabId,
    url: tab.url ?? changeInfo.url,
    timestamp: Date.now(),
    old_url,
    new_url: changeInfo.url,
  };
  tabUrls.set(tabId, changeInfo.url);
  queue.push(event);
});