# API 参考

<cite>
**本文引用的文件**
- [src/messages.ts](file://src/messages.ts)
- [src/services/CategoryService.ts](file://src/services/CategoryService.ts)
- [src/services/AI.ts](file://src/services/AI.ts)
- [src/services/OptionStore.ts](file://src/services/OptionStore.ts)
- [src/background/engine/CognitiveLoadEngine.ts](file://src/background/engine/CognitiveLoadEngine.ts)
</cite>

## 目录

1. [简介](#简介)
2. [API 分组](#api-分组)
3. [子章节](#子章节)

## 简介

本章汇总 BrainRest 内部的可调用接口与数据契约。需要说明的是，BrainRest 是一个浏览器扩展，并不对外暴露 HTTP/REST
API；这里的"API"指的是模块间的函数接口、事件模型契约与运行时消息协议。

## API 分组

| 分组     | 内容                                                     |
|----------|----------------------------------------------------------|
| 事件 API | 各类事件模型的字段契约（采集侧数据结构）                 |
| 扩展 API | 基于 Chrome 扩展的运行时机制：消息、连接、存储、生命周期 |
| 服务 API | 服务层可调用函数：AI、分类、数据库                       |
| 配置 API | `Option` 配置的读写接口                                  |

## 子章节

- [事件 API](事件%20API/事件%20API.md)
- [扩展 API](扩展%20API/扩展%20API.md)
- [服务 API](服务%20API/服务%20API.md)
- [配置 API](配置%20API.md)

**章节来源**

- [src/messages.ts](file://src/messages.ts#L1-L23)
