import "./TabListener";
import { queue } from "./EventQueue";

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "event-stream") return;

  port.onMessage.addListener((event) => {
    queue.push(event);
  });
});