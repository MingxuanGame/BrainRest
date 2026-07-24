import { engine } from './engine/CognitiveLoadEngine'
import { domainTimeTracker } from './DomainTimeTracker'

/**
 * 通过 chrome.idle 监听系统锁屏 / 息屏状态，驱动休息权重 R 的"主动锁屏"场景。
 * state 为 "locked" 时视为设备锁定，其余（active/idle）视为未锁定。
 */

// 达到 60s 无输入即上报 idle；锁屏由系统即时上报为 "locked"
chrome.idle.setDetectionInterval(60)

chrome.idle.onStateChanged.addListener((state) => {
    engine.setDeviceLocked(state === 'locked')

    // 域名会话时长追踪：idle / 锁屏暂停计时，active 恢复
    if (state === 'active') {
        domainTimeTracker.resume()
    } else {
        domainTimeTracker.pause()
    }
})

// 启动时对齐一次当前状态
chrome.idle.queryState(60, (state) => {
    engine.setDeviceLocked(state === 'locked')
})
