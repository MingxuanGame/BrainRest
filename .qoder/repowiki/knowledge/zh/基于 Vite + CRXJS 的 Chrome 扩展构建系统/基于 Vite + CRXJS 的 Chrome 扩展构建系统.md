---
kind: build_system
name: 基于 Vite + CRXJS 的 Chrome 扩展构建系统
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.ts
    - tsconfig.json
    - tsconfig.app.json
    - eslint.config.js
    - src/manifest.ts
---

## 构建系统与工具链概览

本项目采用 **Vite + TypeScript + React** 作为前端工程化基础，通过 `@crxjs/vite-plugin` 将标准 Vite 应用直接打包为符合
Manifest V3 规范的 Chrome 扩展。整个构建流程完全由 npm scripts 驱动，无 Makefile、Dockerfile 或 CI 配置文件。

### 核心构建脚本（package.json）

- `dev`: 启动 Vite 开发服务器，支持热重载
- `build`: 先执行 `tsc -b` 进行增量类型检查与项目引用编译，再调用 `vite build` 生成扩展产物
- `debug`: 在构建时启用 sourcemap，便于调试
- `lint`: 使用 ESLint 对源码进行静态检查
- `preview`: 预览构建产物

### 关键构建配置

**Vite 配置 (`vite.config.ts`)**

- 启用 `@vitejs/plugin-react` 提供 JSX/TSX 支持
- 通过 `@crxjs/vite-plugin` 的 `crx()` 插件将 Vite 输出映射为 Chrome 扩展结构
- 声明 content script 入口：`src/content/index.ts`
- 构建产物默认开启 sourcemap，关闭压缩（minify: false），便于调试
- 开发服务器忽略 sourcemap 文件列表，避免干扰断点定位

**TypeScript 多项目引用 (`tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`)**

- 使用 project references 模式分离应用代码与 Node 端配置
- 目标 ES2023，模块解析策略为 `bundler`，启用 `verbatimModuleSyntax` 和 `moduleDetection: force` 等严格模式
- `noEmit: true` 表示仅做类型检查，实际 JS 输出由 Vite 负责
- 包含 `chrome` 类型定义，使 `chrome.*` API 获得完整智能提示
- 启用 `allowImportingTsExtensions` 允许 `.ts` 后缀导入

**ESLint 配置 (`eslint.config.js`)**

- 使用 Flat Config 格式（ESLint 9+ 新语法）
- 继承 `@eslint/js/recommended`、`typescript-eslint/recommended`、`react-hooks` 和 `react-refresh` 规则集
- 全局浏览器环境，忽略 `dist` 目录

**Chrome 扩展清单 (`src/manifest.ts`)**

- 以 TypeScript 模块形式声明 Manifest V3，利用 `satisfies ManifestV3Export` 获得类型安全校验
- 固定版本 `1.0.0`，硬编码了扩展 key（用于已发布扩展的更新）
- 声明 background service worker 和 content_scripts 入口

### 构建产物与目录约定

- 源码位于 `src/` 下，按功能域划分：`background/`、`content/`、`popup/`、`services/`、`models/`
- 构建输出默认到 `dist/` 目录（被 eslint 忽略）
- 每个子目录对应 Chrome 扩展的一个独立上下文（background、content script、popup）

### 依赖管理

- 运行时依赖：React 19、IndexedDB 封装 `idb`、OpenAI SDK、HTML 解析库
- 开发依赖：Vite 8、CRXJS 2.7、TypeScript 6、ESLint 10、各类类型定义
- 使用 `package-lock.json` 锁定依赖版本，确保构建可重现性

### 缺失的构建能力

仓库中未发现以下常见构建系统组件：

- 无 Makefile / shell 构建脚本
- 无 Dockerfile / 容器化配置
- 无 GitHub Actions / CI 流水线配置
- 无自动化测试框架集成
- 无发布/版本号自动递增逻辑
- 无跨平台交叉编译配置
