import { createEvent } from '../models/events/Event'
import type { WindowFocus } from '../models/events/WindowFocus'
import { queue } from './EventQueue'
import { engine } from './engine/CognitiveLoadEngine'
import { eventLog } from './EventLog'
import { domainTimeTracker } from './DomainTimeTracker'

chrome.windows.onFocusChanged.addListener((windowId) => {
    const focused = windowId !== chrome.windows.WINDOW_ID_NONE

    const event = createEvent<WindowFocus>({
        type: focused ? 'focus' : 'blur',
        windowId,
        url: '',
    })
    queue.push(event)
    eventLog.append(event)

    // 通知引擎窗口焦点状态变化（用于 SessionTracker 和打断抑制）
    engine.setWindowFocused(focused)

    // 域名会话时长追踪：失焦暂停、聚焦恢复
    if (focused) {
        domainTimeTracker.resume(null, event.timestamp)
    } else {
        domainTimeTracker.pause(event.timestamp)
    }
})
