# ADR 0015：系统管理端独立为后台应用；`content/` 改名为 `seeds/`

- 状态：已接受
- 日期：2026-10-21
- 依据：2026-10-21 用户批准的目录调整（见 [v1.0 变更记录](../06-releases/v1.0/changes.md)）；修订 ADR 0001（前端应用划分）、ADR 0005（Web 端组成）

## 背景
- 原结构中，系统管理端（含 AI 工作室、技能库与 AI 角色）是 `apps/web` 里的第三个懒加载路由块。即使懒加载，后台的路由表、组件名和接口路径仍可能出现在孩子端的构建清单里；孩子端与后台共用一个源、一套 CSP 与 Cookie，后台需要的 OSS 签名 URL 与直传地址会迫使主站 CSP 放宽。
- 仓库目录 `content/` 的名字沿用自已取代的“内容即代码”（ADR 0003），实际已不放课程内容，而是模板、安全词表、默认技能与角色等**内置数据**；`packages/content-schema` 与 `tools/validate-content` 的名字同样会误导。

## 决策
1. **独立后台应用 `apps/admin`**：独立的 Vite 构建、独立子域名 `admin.<备案域名>`、独立 CSP；不做 PWA、无 Service Worker、不经 CDN；`X-Robots-Tag: noindex`。`apps/web` 只包含孩子端（`features/child/`）与家长中心（`features/parent/`）。CI 检查 web 构建产物中不含后台代码。
2. **同一个服务进程**服务两个站点（不新增进程与内存预算）：`/api/v1/admin/*` 只接受后台域名的请求（主站 Nginx 返回 404，服务端按 Host 再拒绝）；后台会话 Cookie `xy_admin_sid` 为 Host-only、`Secure`、`HttpOnly`、`SameSite=Strict`，主站 Cookie 也不设 `Domain`，两站互不携带。可选运维 IP 白名单，默认关闭。
3. **ICP 与证书**：后台子域名属于已备案主域名，主域名备案覆盖其子域名；DNS 与证书需覆盖主域名、`cdn.` 与 `admin.`。
4. **共享前端包**：`packages/ui`（主题由 `docs/04-ui-design/tokens/design-tokens.json` 生成，web 与 admin 共用）、`packages/skill-format`（SKILL.md 格式与校验，api 与 admin 共用）。
5. **`content/` → `seeds/`**（`content/templates` → `seeds/course-templates`，`content/english` → `seeds/samples/english`）；`packages/content-schema` → `packages/seed-schema`；`tools/validate-content` → `tools/validate-seeds`；新增 `tools/safety-eval`。`seeds/` 随发布包部署到 `releases/<ts>/seeds/`，分两类：
   - **启动时读取、不入库**：`course-templates`、`safety`（含 `agent-guard.md`，守则不进数据库）、`phrases`、`avatars`。
   - **部署时补齐**：`shop`、`skills`、`agents` 由每次部署在 `xingya migrate` 与 `db/roles.sql` 之后运行的 `xingya seeds:apply` 写入；幂等，只插入缺失行，从不修改或删除，后台修改永不被覆盖。它取代原 `xingya skills:seed` 与 `xingya shop:import`。
   - `samples` 不自动导入，只在运维手动 `xingya course:import` 时导入为草稿。
6. `db/dev-fixtures/` 保持为开发与 e2e 的 SQL 示例行，从不部署；与顶层 `seeds/` 的区别写在两个目录的 README 中。迁移 `0001_init.sql` 中的 INSERT 属于迁移本身。
7. 服务端 `apps/api/src/platform/` 分为 `db`、`auth`、`logging`、`config`；studio 模块内部分 `jobs`、`assets`、`skills`、`agents`、`runner`、`tools`、`providers` 子目录（仍是一个模块、一个 `index.ts`）；测试集中在 `apps/api/test/{unit,integration,concurrency,safety}`。

## 后果
- 孩子端包体与攻击面更小，主站 CSP 不因后台放宽；后台多一套构建、一个 Nginx `server` 块、一张证书覆盖与一套 e2e。
- 发布目录变为 `releases/<ts>/{api,web,admin,seeds}`；部署多一步 `seeds:apply`。
- 数据库结构不变（只改了迁移文件中的注释路径）。
- 文档、CI 与 README 中的旧路径全部更新；CHANGELOG 旧条目、已取代的 ADR 0003 与早期评审段落作为历史记录保留旧名。

## 未采用的方案
- 继续在 `apps/web` 中懒加载后台：构建清单仍暴露后台路由，且 CSP 与 Cookie 只能共用。
- 后台单独部署一个进程：2 GB 内存预算不允许，且没有必要。
- 把 `seeds/` 全部在部署时写入数据库：安全守则必须不入库（防止后台修改），模板定义由代码版本化，写库没有收益。
