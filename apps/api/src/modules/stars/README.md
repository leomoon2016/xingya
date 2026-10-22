# stars —— 星星

**职责**：只追加账本（星星、碎片与积分）与余额缓存、星星小铺（探险徽章购买与佩戴）、现实奖励按份兑换与审批、累计奖励（用掉 / 核销）、家长加星与扣星、星级荣誉。

**拥有的表**：ledger, balances, shop_items, child_items, reward_options, redemptions, reward_balances, reward_ledger。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）；单元测试在 `apps/api/test/unit/stars/`。

需求：`docs/01-requirements/modules/stars.md`；设计：`docs/03-design/modules/stars.md`。
