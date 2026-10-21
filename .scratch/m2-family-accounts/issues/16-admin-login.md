# 16: 系统管理员登录

**What to build:** 运维在服务器上用 `xingya admin:create` 创建系统管理员（用户名 + 强密码 + TOTP 种子，命令输出供验证器 App 绑定的信息，只显示一次）。系统管理员只能在后台子域名 `admin.<域名>` 的后台应用里，用用户名 + 密码 + TOTP 动态码登录；主站没有后台登录入口。后台会话 Cookie `xy_admin_sid` 只发给后台域名，主站与后台互不携带对方 Cookie；`/api/v1/admin/*` 只接受后台域名的请求。登录后进入后台外壳首页，可以退出。

依据：[family 需求 §4.3.1、§4.3.4–4.3.5、验收要点](../../../docs/01-requirements/modules/family.md)、[ADR 0015](../../../docs/adr/0015-admin-app-and-seeds.md) 决策 2、[api §5.1、§5.3 admin](../../../docs/03-design/api.md)、[nfr §8.1](../../../docs/01-requirements/nfr.md)、[deployment §9.2–9.2b](../../../docs/02-solution/deployment.md)、[PRD“与旧系统的取舍”](../../../docs/01-requirements/PRD.md)（放弃空库自动建 `admin/admin`）。

> 待确认：批准的拆分写的是“首次以 admin/admin 登录并强制改密”，但 PRD 明确放弃了“空库自动建 `admin/admin`”（安全风险），需求与部署文档规定系统管理员由 `xingya admin:create` 创建、强制 TOTP，`admin_accounts` 也要求 TOTP 种子非空。本单按文档编写；如需改为默认账号方案，应先修改文档与迁移。

**Blocked by:** [02 平台层和初始迁移](../../m1-skeleton/issues/02-platform-layer.md)、[03 界面主题包](../../m1-skeleton/issues/03-ui-theme.md)

**Status:** ready-for-agent

- [ ] `xingya admin:create`：交互输入用户名与强密码（拒绝弱密码），生成 TOTP 种子并以服务端主密钥（来自 `/etc/xingya/secrets.env`）加密保存；密码与种子不写日志；集成测试覆盖创建与用户名重复。
- [ ] `POST /api/v1/admin/login` 校验用户名 + 密码 + TOTP，任一错误统一返回 `401 INVALID_CREDENTIALS`；连续失败有计数与锁定（`423 ACCOUNT_LOCKED`）及 IP 限流；登录成功与失败写审计。TOTP 用可控 Clock 测试时间窗口边界。
- [ ] 会话 Cookie `xy_admin_sid`：Host-only（不设 `Domain`）、`Secure`、`HttpOnly`、`SameSite=Strict`，只在后台域名上发放；30 分钟无操作过期、最长 8 小时（用可控 Clock 测试）。
- [ ] Host 限制：`/api/v1/admin/*` 在主站 Host 上返回 `404`（服务端按 Host 拒绝，Nginx 层的 404 由 06 配置）；系统管理员主体只能由 `xy_admin_sid` 建立，主站 `xy_sid` 无法访问后台接口，`xy_admin_sid` 也无法访问主站的家长与孩子接口（集成测试）。
- [ ] 后台写请求同样校验 `Origin` 只接受后台源，并要求 `X-Client-Request-Id`。
- [ ] 权限矩阵测试：系统管理员会话调用家长与孩子接口被拒；系统管理员不存在读取家庭学习数据或修改星星、碎片的接口。
- [ ] 后台应用：登录页（用户名、密码、动态码）与登录后的外壳首页、退出；会话过期回到登录页；使用 `packages/ui` 主题；孩子端构建产物中不出现任何后台登录代码（05 的检查通过）。
- [ ] e2e（`apps/admin/e2e`）：用夹具创建的系统管理员与测试种子生成动态码登录 → 进入首页 → 退出；错误动态码被拒。
