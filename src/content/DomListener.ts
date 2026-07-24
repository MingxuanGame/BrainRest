import { sendEvent } from './EventChannel'
import { createEvent } from '../models/events/Event'
import type { UiClickEvent } from '../models/events/UiClickEvent'
import type { UiKeyEvent } from '../models/events/UiKeyEvent'
import type { UiMouseMoveEvent } from '../models/events/UiMouseMoveEvent'
import type { UiScrollEvent } from '../models/events/UiScrollEvent'
import type { UiTouchEvent } from '../models/events/UiTouchEvent'
import type { FullscreenChange } from '../models/events/FullscreenChange'

let lastMouseMoveAt = 0
// 主动降低鼠标轨迹采样率，避免高频 mousemove 淹没按秒事件频率统计
const MOUSE_MOVE_SAMPLE_MS = 200

document.addEventListener('mousemove', (e) => {
    const now = Date.now()
    if (now - lastMouseMoveAt < MOUSE_MOVE_SAMPLE_MS) return

    lastMouseMoveAt = now
    const target = e.target as HTMLElement | null
    sendEvent(
        createEvent<UiMouseMoveEvent>({
            type: 'mousemove',
            url: window.location.href,
            clientX: e.clientX,
            clientY: e.clientY,
            targetTag: target?.tagName,
            targetId: target?.id || undefined,
            targetClass: target?.className || undefined,
        }),
    )
})

document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null
    sendEvent(
        createEvent<UiClickEvent>({
            type: 'click',
            url: window.location.href,
            button: e.button,
            clientX: e.clientX,
            clientY: e.clientY,
            targetTag: target?.tagName,
            targetId: target?.id || undefined,
            targetClass: target?.className || undefined,
        }),
    )
})

function createKeyEvent(type: UiKeyEvent['type'], e: KeyboardEvent): UiKeyEvent {
    const target = e.target as HTMLElement | null
    return createEvent<UiKeyEvent>({
        type,
        url: window.location.href,
        key: e.key,
        code: e.code,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        targetTag: target?.tagName,
        targetId: target?.id || undefined,
        targetClass: target?.className || undefined,
    })
}

document.addEventListener('keydown', (e) => {
    sendEvent(createKeyEvent('keydown', e))
})

document.addEventListener('keyup', (e) => {
    sendEvent(createKeyEvent('keyup', e))
})

document.addEventListener('scroll', (e) => {
    const target = e.target as HTMLElement | null
    sendEvent(
        createEvent<UiScrollEvent>({
            type: 'scroll',
            url: window.location.href,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            targetTag: target?.tagName,
            targetId: target?.id || undefined,
            targetClass: target?.className || undefined,
        }),
    )
})

function createTouchEvent(type: UiTouchEvent['type'], touch: Touch): UiTouchEvent {
    const target = touch.target as HTMLElement | null
    return createEvent<UiTouchEvent>({
        type,
        url: window.location.href,
        identifier: touch.identifier,
        clientX: touch.clientX,
        clientY: touch.clientY,
        force: touch.force,
        radiusX: touch.radiusX,
        radiusY: touch.radiusY,
        rotationAngle: touch.rotationAngle,
        targetTag: target?.tagName,
        targetId: target?.id || undefined,
        targetClass: target?.className || undefined,
    })
}

document.addEventListener('touchstart', (e) => {
    for (const touch of e.changedTouches) {
        sendEvent(createTouchEvent('touchstart', touch))
    }
})

document.addEventListener('touchend', (e) => {
    for (const touch of e.changedTouches) {
        sendEvent(createTouchEvent('touchend', touch))
    }
})

document.addEventListener('touchmove', (e) => {
    for (const touch of e.changedTouches) {
        sendEvent(createTouchEvent('touchmove', touch))
    }
})

document.addEventListener('fullscreenchange', () => {
    sendEvent(
        createEvent<FullscreenChange>({
            type: 'fullscreen_change',
            url: window.location.href,
            active: document.fullscreenElement !== null,
        }),
    )
})
