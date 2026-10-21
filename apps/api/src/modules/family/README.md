# family —— 家庭账号

**职责**：家庭、家长、孩子、系统管理员、家庭设备、会话与令牌、登录与锁定、审计。

**拥有的表**：families, parents, children, admin_accounts, family_devices, sessions, auth_tokens, audit_events。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）、`*.test.ts`（单元测试）。

需求：`docs/01-requirements/modules/family.md`；设计：`docs/03-design/modules/family.md`。
