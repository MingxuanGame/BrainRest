---
kind: error_handling
name: 基于原生 Error 抛出的轻量错误处理模式
category: error_handling
scope:
    - '**'
source_files:
    - src/services/CategoryService.ts
    - src/services/UrlCategoryDataBaseManager.ts
---

该 Chrome 扩展项目未建立统一的错误处理框架或自定义错误类型体系，而是采用最直接的 JavaScript 原生 `Error` 抛出与
`try/catch` 捕获方式。具体表现如下：

1. **同步异常**：在 `src/services/CategoryService.ts` 中，当 AI 客户端未初始化、模型无输出、输出格式非法或类别不在白名单时，直接
   `throw new Error(...)` 抛出带描述信息的字符串错误，调用方需自行 `catch`。
2. **容错式静默失败**：对非关键操作（如 URL 分类结果写入本地数据库）使用空 `catch {}` 块吞掉异常，确保主流程不受影响；对输入解析类函数（
   `extractDomain`）则返回 `null` 作为降级值，避免向上抛错。
3. **无全局中间件或 Promise 统一拒绝处理**：未发现 `.catch()`、`Promise.reject`、全局 `unhandledrejection`
   监听或自定义错误中间件，异步错误依赖调用链逐层传播并由上层决定如何处理。
4. **无错误码/错误枚举**：所有错误仅通过字符串消息区分，没有集中定义的错误码常量或结构化错误对象。

整体而言，该项目处于“最小可行”的错误处理阶段——适合小型工具型扩展，但缺乏可观测性、可测试性与跨模块一致性。若后续需要增强，建议引入统一错误基类、错误码枚举以及顶层
Promise 拒绝处理器。