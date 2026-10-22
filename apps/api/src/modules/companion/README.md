# companion —— 伙伴

**职责**：伙伴档位与成长阶段、伙伴种类（旧系统种子宠物 `seeds/pets/` 与工作室设计的原创伙伴）、领养（星星或碎片）、营地扩建、跟随伙伴经验与等级、改名、亲密度互动、退订、赠送（由 social 发起）。

**拥有的表**：pet_tiers, pet_tier_stages, pet_species, pet_dens, child_pets, pet_interactions, pet_gifts。

**规则**：其他模块只能通过本目录的 `index.ts` 调用本模块；`repo.ts` 只访问上面列出的表。

**计划文件**（尚未创建）：`index.ts`（公开接口）、`routes.ts`（HTTP 路由与 Zod 模式）、`service.ts`（业务规则）、`repo.ts`（Kysely 查询）；单元测试在 `apps/api/test/unit/companion/`。

需求：`docs/01-requirements/modules/companion.md`；设计：`docs/03-design/modules/companion.md`。
