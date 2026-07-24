# 事件 API

<cite>
**本文引用的文件**
- [src/models/events/Event.ts](file://src/models/events/Event.ts)
- [src/models/events/TabEvent.ts](file://src/models/events/TabEvent.ts)
- [src/models/events/UiEvent.ts](file://src/models/events/UiEvent.ts)
- [src/models/events/WindowFocus.ts](file://src/models/events/WindowFocus.ts)
- [src/models/events/MediaEvent.ts](file://src/models/events/MediaEvent.ts)
</cite>

## 目录

1. [简介](#简介)
2. [公共字段契约](#公共字段契约)
3. [子章节](#子章节)

## 简介

事件 API 指采集侧的事件数据契约。所有事件都是继承自 `Event` 的普通对象（interface，非 class），由 `createEvent<T>`
工厂函数构造，经内容脚本 Port 或背景监听器进入滑动窗口队列。

## 公共字段契约

每条事件都携带以下公共字段：

| 字段        | 类型     | 说明                       |
|-------------|----------|----------------------------|
| `timestamp` | `number` | `Date.now()`               |
| `type`      | `string` | 事件类型标识               |
| `processed` | `0 \| 1` | 处理标记，创建时为 `0`     |
| `url`       | `string` | 页面 URL（窗口事件为空串） |

## 子章节

- [标签页事件](标签页事件.md)
- [窗口事件](窗口事件.md)
- [用户界面事件](用户界面事件.md)
- [媒体事件](媒体事件.md)

**章节来源**

- [src/models/events/Event.ts](file://src/models/events/Event.ts#L1-L20)
