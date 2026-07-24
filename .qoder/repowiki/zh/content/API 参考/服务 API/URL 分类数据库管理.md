# URL 分类数据库管理

<cite>
**本文引用的文件**
- [src/services/UrlCategoryDataBaseManager.ts](file://src/services/UrlCategoryDataBaseManager.ts)
- [src/models/types.ts](file://src/models/types.ts)
</cite>

## 目录
1. [简介](#简介)
2. [数据库结构](#数据库结构)
3. [记录结构](#记录结构)
4. [方法一览](#方法一览)
5. [lookup 逐级回溯](#lookup-逐级回溯)

## 简介
[src/services/UrlCategoryDataBaseManager.ts](file://src/services/UrlCategoryDataBaseManager.ts) 以单例 `urlCategoryDB` 管理 URL 分类缓存，基于 `idb` 封装 IndexedDB。

## 数据库结构
| 项 | 值 |
|------|------|
| 数据库名 | `brainrest_url_categories` |
| 版本 | 1 |
| 对象仓库 | `url_categories` |
| 主键 | `domain` |
| 索引 | `domain`（唯一）、`category`、`updatedAt` |

## 记录结构
```ts
export interface UrlCategoryRecord {
  domain: string;
  category: UrlCategory;
  updatedAt: number;
}
```

## 方法一览
| 方法 | 签名 | 说明 |
|------|------|------|
| `put` | `(domain, category) => Promise<void>` | 写入/更新单条 |
| `batchPut` | `(records[]) => Promise<void>` | 事务批量写入 |
| `delete` | `(domain) => Promise<void>` | 删除单条 |
| `getExact` | `(domain) => Promise<Record?>` | 精确读取（不回溯） |
| `listByCategory` | `(category) => Promise<Record[]>` | 按类别反查 |
| `clear` | `() => Promise<void>` | 清空仓库 |
| `lookup` | `(domain) => Promise<Record?>` | 逐级回溯查询 |
| `lookupCategory` | `(domain) => Promise<UrlCategory?>` | `lookup` 便捷封装 |

所有写入前会经 `normalizeDomain` 统一为小写、去空白与尾部点。

## lookup 逐级回溯
`lookup` 从二级域名（`MIN_LEVEL = 2`）开始逐级向上匹配到最多 5 级（`MAX_LEVEL = 5`），命中第一个即返回。例如 `a.b.c.example.com` 依次尝试：

1. `example.com`（2 级）
2. `c.example.com`（3 级）
3. `b.c.example.com`（4 级）
4. `a.b.c.example.com`（5 级）

全部未命中返回 `undefined`。此机制使得对某个主域名的分类可覆盖其所有子域名。

**章节来源**
- [src/services/UrlCategoryDataBaseManager.ts](file://src/services/UrlCategoryDataBaseManager.ts#L1-L144)
