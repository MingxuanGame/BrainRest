# AI 服务

<cite>
**本文引用的文件**
- [src/services/AI.ts](file://src/services/AI.ts)
- [src/services/CategoryService.ts](file://src/services/CategoryService.ts)
- [src/models/Option.ts](file://src/models/Option.ts)
</cite>

## 目录
1. [简介](#简介)
2. [导出](#导出)
3. [initClient](#initclient)
4. [base URL 解析规则](#base-url-解析规则)
5. [权限声明](#权限声明)

## 简介
[src/services/AI.ts](file://src/services/AI.ts) 是对 `openai` SDK 的极薄封装，负责用 `Option` 中的配置创建 `OpenAI` 客户端实例，供分类服务调用。

## 导出
```ts
export let client: OpenAI | null = null;

export function initClient(provider: string, apiKey: string): OpenAI;
```

`client` 为模块级可变单例，初始为 `null`，`initClient` 调用后被赋值。

## initClient
```ts
const baseUrls = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
};

export function initClient(provider: string, apiKey: string): OpenAI {
  client = new OpenAI({ baseURL: baseUrls[provider] ?? provider, apiKey });
  return client;
}
```

分类服务在缓存未命中时会 `loadOption` 后调用 `initClient(aiProvider, apiKey)`。

## base URL 解析规则
| provider 取值 | 实际 baseURL |
|---------------|--------------|
| `openai` | `https://api.openai.com/v1` |
| `deepseek` | `https://api.deepseek.com/v1` |
| 其它字符串 | 直接作为自定义 baseURL 使用 |

## 权限声明
`src/manifest.ts` 的 `host_permissions` 已声明 `https://api.openai.com/*` 与 `https://api.deepseek.com/*`。若使用自定义 base URL，需自行确保对应主机在权限范围内。

**章节来源**
- [src/services/AI.ts](file://src/services/AI.ts#L1-L16)
- [src/services/CategoryService.ts](file://src/services/CategoryService.ts#L1-L164)
