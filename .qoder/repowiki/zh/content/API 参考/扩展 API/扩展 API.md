# 扩展 API

<cite>
**本文引用的文件**
- [src/manifest.ts](file://src/manifest.ts)
- [src/background/service-worker.ts](file://src/background/service-worker.ts)
- [src/content/EventChannel.ts](file://src/content/EventChannel.ts)
- [src/messages.ts](file://src/messages.ts)
- [src/services/OptionStore.ts](file://src/services/OptionStore.ts)
</cite>

## 目录

1. [简介](#简介)
2. [扩展清单概览](#扩展清单概览)
3. [子章节](#子章节)

## 简介

扩展 API 指 BrainRest 基于 Chrome 扩展平台使用的运行时机制，包括长连接与消息传递、存储访问、事件监听注册与生命周期。它们围绕
Manifest V3 的 service worker 模型组织。

## 扩展清单概览

[src/manifest.ts](file://src/manifest.ts) 以默认导出对象加 `satisfies ManifestV3Export`（来自 `@crxjs/vite-plugin`
）声明清单，关键字段：

| 字段                        | 值                                                       |
|-----------------------------|----------------------------------------------------------|
| `manifest_version`          | 3                                                        |
| `name` / `version`          | `BrainRest` / `1.0.0`                                    |
| `permissions`               | `tabs`, `windows`, `storage`, `idle`                     |
| `host_permissions`          | `https://api.openai.com/*`, `https://api.deepseek.com/*` |
| `background.service_worker` | `src/background/service-worker.ts`（`type: module`）     |
| `content_scripts`           | 匹配 `<all_urls>` → `src/content/index.ts`               |
| `action.default_popup`      | **当前被注释**（指向 `src/popup/index.html`）            |

## 子章节

- [消息传递机制](消息传递机制.md)
- [事件系统](事件系统.md)
- [存储访问接口](存储访问接口.md)
- [扩展生命周期管理](扩展生命周期管理.md)

**章节来源**

- [src/manifest.ts](file://src/manifest.ts#L1-L39)
