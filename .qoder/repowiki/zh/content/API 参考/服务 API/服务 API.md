# 服务 API

<cite>
**本文引用的文件**
- [src/services/AI.ts](file://src/services/AI.ts)
- [src/services/CategoryService.ts](file://src/services/CategoryService.ts)
- [src/services/UrlCategoryDataBaseManager.ts](file://src/services/UrlCategoryDataBaseManager.ts)
- [src/services/EventDataBaseManager.ts](file://src/services/EventDataBaseManager.ts)
</cite>

## 目录
1. [简介](#简介)
2. [服务清单](#服务清单)
3. [子章节](#子章节)

## 简介
服务 API 指 `src/services` 下可被背景服务调用的能力函数与单例：AI 客户端初始化、URL 分类、以及基于 IndexedDB 的数据库管理器。

## 服务清单
| 服务 | 导出 | 状态 |
|------|------|------|
| AI 客户端 | `client`, `initClient` | 已接入 |
| 分类服务 | `getCategory`, `setCategory` 等 | 已接入 |
| URL 分类数据库 | 单例 `urlCategoryDB` | 已接入 |
| 事件数据库 | 单例 `eventDB` | 已实现，未被引用 |

## 子章节
- [AI 服务](AI%20服务.md)
- [分类服务](分类服务.md)
- [URL 分类数据库管理](URL%20分类数据库管理.md)
- [事件数据库管理](事件数据库管理.md)

**章节来源**
- [src/services/CategoryService.ts](file://src/services/CategoryService.ts#L1-L164)
