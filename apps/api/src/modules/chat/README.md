# chat —— AI 聊天（呀哈哈队长）

**职责**：呀哈哈队长浮动聊天：开关与配额、输入输出过滤、调用 studio 同步运行儿童 AI 角色 `yahaha-captain`（预算计入全站与角色预算）、只记录元数据（不存对话，无聊天记忆）。依赖 controls、studio。

**拥有的表**：ai_chat_usage。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）、`*.test.ts`（单元测试）。

需求：`docs/01-requirements/modules/chat.md`；设计：`docs/03-design/modules/chat.md`。
