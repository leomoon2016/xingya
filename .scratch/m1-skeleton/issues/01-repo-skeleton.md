# 01: 仓库骨架打通

**What to build:** 开发者克隆仓库、执行一次安装后，可以在本机同时启动服务端（`apps/api`）、孩子端与家长中心（`apps/web`）和系统管理端（`apps/admin`）三个应用外壳；打开孩子端页面，就能看到服务端 `/api/v1/health` 返回的结果（`{ok, version}`）。三个应用通过共享的 `packages/contracts` 使用同一份健康检查 Zod 模式。仓库已经具备 pnpm 单仓库、TypeScript strict、lint、typecheck、单元测试的统一命令，并有一条会让违反模块边界的代码直接失败的检查。这是后续所有任务单的地基。

技术栈以 [overview §3.2](../../../docs/02-solution/overview.md) 为准：Node 24、TypeScript（strict）、Fastify 5、React 19 + Vite；后台是独立应用（[ADR 0015](../../../docs/adr/0015-admin-app-and-seeds.md)），孩子端不引用任何后台代码。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] 在干净环境中执行一次 pnpm 安装即可装好所有工作区包；锁文件已提交；Node 版本要求为 ≥ 24。
- [ ] 根目录提供统一命令：lint、typecheck、单元测试、构建（全部应用与包），在空实现状态下全部通过。
- [ ] 服务端外壳启动后，`GET /api/v1/health` 返回 `{ok: true, version}`，不含任何敏感信息；响应体由 `packages/contracts` 中的 Zod 模式定义，有单元测试断言响应符合模式。
- [ ] 孩子端外壳（`apps/web`）在本地开发模式下请求服务端健康检查并把结果显示在页面上（服务未启动时显示可读的失败提示）；有组件或端到端测试覆盖“显示健康结果”。
- [ ] 系统管理端外壳（`apps/admin`）可独立构建、独立启动，不做 PWA、不注册 Service Worker。
- [ ] `apps/web` 不依赖 `apps/admin`，也不依赖任何后台专用代码；依赖关系由边界检查强制。
- [ ] 模块边界检查（dependency-cruiser 规则，[overview §3.4](../../../docs/02-solution/overview.md) 边界规则 1）：服务端业务模块之间只能 import 对方的 `index.ts`；有一个故意违规的测试样例能让检查失败（样例不留在主代码中）。
- [ ] 服务端 11 个业务模块与 platform 层的目录骨架与仓库中已有的 README 约定一致（每个模块一个 `index.ts` 出口）。
- [ ] 仓库中没有任何密钥、口令或令牌；本地开发用的配置示例只含占位值。
