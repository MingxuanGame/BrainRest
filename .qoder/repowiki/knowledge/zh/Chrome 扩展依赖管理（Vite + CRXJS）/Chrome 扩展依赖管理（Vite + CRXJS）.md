---
kind: dependency_management
name: Chrome 扩展依赖管理（Vite + CRXJS）
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - vite.config.ts
---

本项目采用基于 npm 的依赖管理体系，使用 Vite 作为构建工具并通过 @crxjs/vite-plugin 将 React 应用打包为 Chrome 扩展。

**包管理器与版本锁定**
- 使用 npm 进行依赖管理，通过 `package.json` 声明运行时依赖和开发依赖
- 存在 `package-lock.json` 文件用于锁定依赖树版本，确保构建可重现性
- 项目标记为 `private: true`，表明这是内部使用的私有项目

**依赖分类策略**
- 运行时依赖：`react`、`react-dom`、`idb`（IndexedDB 封装）、`markitdown-html`、`openai`（AI 功能）
- 开发依赖：TypeScript、ESLint、Vite、@crxjs/vite-plugin、Chrome API 类型定义等
- 多数依赖使用 `^` 前缀允许小版本更新；`typescript` 使用 `~6.0.2` 前缀，仅允许补丁级更新

**构建与打包配置**
- 通过 `vite.config.ts` 配置 CRXJS 插件，将 TypeScript/React 代码转换为 Chrome 扩展格式
- 使用 `src/manifest.ts` 作为扩展清单文件的动态生成源
- 内容脚本通过 `standaloneFiles` 配置单独打包

**脚本命令**
- `dev`: 启动开发服务器
- `build`: TypeScript 类型检查后构建生产版本
- `debug`: 生成带 source map 的调试构建
- `lint`: 运行 ESLint 代码检查
- `preview`: 预览构建结果

**无 vendoring 策略**
- 项目未使用 vendor 目录或类似机制
- 依赖直接从 npm 注册表安装
- 没有私有 npm 仓库配置