import type { Event } from "../models/events/Event";

const port = chrome.runtime.connect({
  name: "event-stream",
});

export function sendEvent(event: Event) {
  port.postMessage(event);
}
