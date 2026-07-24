---
kind: configuration_system
name: 配置系统 — 基于 Vite + CRX 的构建期配置与运行时 Option 模型
category: configuration_system
scope:
    - '**'
source_files:
    - vite.config.ts
    - src/manifest.ts
    - src/models/Option.ts
    - src/services/OptionStore.ts
    - src/services/AI.ts
    - src/services/CategoryService.ts
    - package.json
---

本仓库是一个基于 Vite + React + TypeScript 的 Chrome 扩展，其“配置”主要分布在两类位置：构建期配置（Vite/CRX/TS）和运行时配置（Chrome Storage 中的 `Option`）。运行时配置已由 `src/services/OptionStore.ts` 实现基于 `chrome.storage.local` 的读写与默认值回退。

## 1. 构建期配置（Build-time Configuration）

- **Vite 配置**：`vite.config.ts` 通过 `defineConfig` 声明插件、构建选项与开发服务器行为，核心是集成 `@crxjs/vite-plugin` 将 React 应用打包为 Manifest V3 扩展。
- **CRX 插件配置**：`src/manifest.ts` 以 TypeScript 模块形式导出 `ManifestV3Export`，集中管理扩展名、版本、权限、background service worker、content scripts 等清单字段，并通过 `satisfies` 类型约束保证与 CRX 插件契约一致。
- **TypeScript 配置**：根级 `tsconfig.json` 引用 `tsconfig.app.json` 与 `tsconfig.node.json`，分别覆盖应用与 Node/Vite 侧编译选项；`eslint.config.js` 使用 flat config 模式组织 ESLint 规则。
- **脚本入口**：`package.json` 中 `dev/build/debug/lint/preview` 脚本串联 `tsc -b` 增量编译与 `vite build`，未引入 `.env` 或外部配置文件。

## 2. 运行时配置（Runtime Configuration）

- **数据模型**：`src/models/Option.ts` 定义了用户可配置的三个字段：
  - `aiProvider`: 支持内置提供者 `openai` / `deepseek` 或任意自定义 HTTPS URL（`AbsoluteUrl` 字面量类型），用于 OpenAI 兼容 API 基地址。
  - `categorifyModel`: 分类任务使用的具体模型名称。
  - `apiKey`: 对应 AI 提供者的访问密钥。
- **初始化入口**：`src/services/AI.ts` 暴露 `initClient(aiProvider, apiKey)`，根据 provider 映射到 `baseUrls` 或直接当作自定义 baseURL 创建 OpenAI SDK 实例。
- **持久化层**：`src/services/OptionStore.ts` 以键 `brainrest_option` 读写 `chrome.storage.local`。`loadOption` 做防御式逐字段校验（非法/缺失回退到默认 `openai` / `gpt-4o-mini` / 空 apiKey），`saveOption` / `clearOption` 吞掉异常不阻断调用方；`normalizeProvider` 仅接受 `openai` / `deepseek` 或 `http(s)://` 绝对 URL。
- **消费方约定**：`CategoryService.ts` 在分类缓存未命中时 `loadOption` 读取配置并 `initClient`，随后发起请求并将结果写回 URL 分类数据库。

## 3. 架构与约定

- **构建期与运行期解耦**：所有构建相关设置集中在 `vite.config.ts` 与 `src/manifest.ts`，不依赖环境变量文件；运行时配置由 `Option` 接口描述，并经 `OptionStore` 持久化到 `chrome.storage.local`。
- **Provider 可扩展性**：`aiProvider` 接受字符串字面量联合类型加 `AbsoluteUrl`，既限定已知提供商，又允许用户传入任意 HTTPS 端点，便于后续接入更多 LLM 服务。
- **错误处理前置**：`CategoryService` 在调用 AI 前先校验 `client` 存在，避免空引用；对 AI 返回的分类标签做白名单校验，确保只接受预定义类别。

## 4. 开发者应遵循的规则

- **新增构建配置**：统一修改 `vite.config.ts` 与 `src/manifest.ts`，保持 CRX manifest 与 Vite 插件同步。
- **新增运行时配置项**：先在 `src/models/Option.ts` 扩展接口，再在 `src/services/OptionStore.ts` 补充读取/校验逻辑，并在 `src/services/AI.ts` 或其他服务中消费。
- **新增 AI Provider**：在 `baseUrls` 中添加映射键，或在 `aiProvider` 传入自定义 HTTPS URL；注意保持 `initClient` 的 baseURL 解析逻辑不变。
- **禁止硬编码敏感信息**：`apiKey` 必须来自运行时配置（如 `chrome.storage`），不得写死在源码中。

## 5. 关键文件

- `vite.config.ts` — Vite 构建与 CRX 插件配置
- `src/manifest.ts` — Chrome 扩展 Manifest V3 定义
- `src/models/Option.ts` — 运行时配置数据结构
- `src/services/OptionStore.ts` — 运行时配置持久化（chrome.storage.local 读写与校验）
- `src/services/AI.ts` — AI 客户端初始化与 baseURL 映射
- `src/services/CategoryService.ts` — 配置消费示例（loadOption → initClient → 调用分类）
- `package.json` — 构建脚本与依赖声明
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` — TypeScript 编译配置
- `eslint.config.js` — ESLint flat config
