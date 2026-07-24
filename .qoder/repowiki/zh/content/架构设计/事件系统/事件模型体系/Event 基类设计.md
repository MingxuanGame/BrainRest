# Event 基类设计

<cite>
**本文引用的文件**
- [src/models/events/Event.ts](file://src/models/events/Event.ts)
</cite>

## 目录

1. [简介](#简介)
2. [字段定义](#字段定义)
3. [createEvent 工厂](#createevent-工厂)
4. [设计要点](#设计要点)

## 简介

`Event` 是所有被追踪事件的公共基接口，定义于 [Event.ts](file://src/models/events/Event.ts)，同时提供 `createEvent`
工厂用于安全地构造事件对象。

## 字段定义

```ts
export interface Event {
  timestamp: number;   // 事件发生的毫秒时间戳
  type: string;        // 判别式字面量
  processed: 0 | 1;    // 0=未处理，1=已处理
  url: string;         // 事件发生页面的 URL
}
```

仅四个字段：`timestamp`、`type`、`processed`、`url`。其中 `processed` 面向未来的持久化/批处理场景（配合 `EventDataBaseManager`
的 processed 索引），当前滑动窗口流程不修改它。

章节来源

- [src/models/events/Event.ts](file://src/models/events/Event.ts)

## createEvent 工厂

```ts
export function createEvent<T extends Event>(
  fields: Omit<T, 'processed' | 'timestamp'>
): T {
  return { processed: 0, timestamp: Date.now(), ...fields } as T;
}
```

调用方只需提供 `type`、`url` 及子类型特有字段，工厂自动补齐 `processed: 0` 与当前时间戳。返回值通过 `as T` 断言为具体事件类型。

章节来源

- [src/models/events/Event.ts](file://src/models/events/Event.ts)

## 设计要点

- **判别联合**：子接口把 `type` 收窄为字面量，消费侧可安全 `switch`。
- **时间戳统一**：所有事件由 `createEvent` 打时间戳，队列裁剪与频率统计依赖它。
- **无 id/session 等字段**：模型刻意保持精简，未包含 id、来源、会话等元数据。

章节来源

- [src/models/events/Event.ts](file://src/models/events/Event.ts)
