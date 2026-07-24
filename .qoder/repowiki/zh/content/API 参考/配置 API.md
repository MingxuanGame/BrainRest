# 配置 API

<cite>
**本文引用的文件**
- [src/services/OptionStore.ts](file://src/services/OptionStore.ts)
- [src/models/Option.ts](file://src/models/Option.ts)
- [src/models/types.ts](file://src/models/types.ts)
</cite>

## 目录

1. [简介](#简介)
2. [loadOption](#loadoption)
3. [saveOption](#saveoption)
4. [clearOption](#clearoption)
5. [normalizeProvider](#normalizeprovider)
6. [默认值与存储键](#默认值与存储键)

## 简介

配置 API 由 [src/services/OptionStore.ts](file://src/services/OptionStore.ts) 提供，封装对 `chrome.storage.local` 中
`Option` 的读写。所有函数均为异步，且对异常做了防御处理。

## loadOption

```ts
export async function loadOption(): Promise<Option>
```

从 `chrome.storage.local` 读取键 `brainrest_option`。读取失败、值为字符串（尝试 `JSON.parse`）、`null`/`undefined`
、非对象或数组等异常情况一律回退到 `DEFAULT_OPTION`。逐字段校验：`aiProvider` 走 `normalizeProvider`，`categorifyModel` /
`apiKey` 非字符串时回退默认。

## saveOption

```ts
export async function saveOption(option: Option): Promise<void>
```

将 `option` 写入 `chrome.storage.local`。写入异常（配额超出/不可用）被吞掉，不阻断调用方。

## clearOption

```ts
export async function clearOption(): Promise<void>
```

移除存储键 `brainrest_option`，异常同样被忽略。

## normalizeProvider

```ts
function normalizeProvider(value: unknown): RawProvider
```

内部函数。仅接受 `"openai"`、`"deepseek"` 或以 `http://` / `https://` 开头的绝对 URL；其余一律回退到默认 `aiProvider`。

## 默认值与存储键

| 项                     | 值                 |
|------------------------|--------------------|
| 存储键                 | `brainrest_option` |
| `aiProvider` 默认      | `openai`           |
| `categorifyModel` 默认 | `gpt-4o-mini`      |
| `apiKey` 默认          | `""`               |

配置结构见 [Option](file://src/models/Option.ts)，`AbsoluteUrl` 类型见 [types.ts](file://src/models/types.ts)。

**章节来源**

- [src/services/OptionStore.ts](file://src/services/OptionStore.ts#L1-L87)
- [src/models/Option.ts](file://src/models/Option.ts#L1-L7)
