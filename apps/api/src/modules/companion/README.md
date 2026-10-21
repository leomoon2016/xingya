# companion —— 学习伙伴

**职责**：伙伴档位与成长阶段、伙伴种类（工作室设计、审核上架）、领养（星星或碎片）、营地扩建、学习陪伴经验与等级。

**拥有的表**：pet_tiers, pet_tier_stages, pet_species, pet_dens, child_pets。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）、`*.test.ts`（单元测试）。

需求：`docs/01-requirements/modules/companion.md`；设计：`docs/03-design/modules/companion.md`。
