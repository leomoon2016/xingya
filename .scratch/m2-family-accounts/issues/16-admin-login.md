# 16: 系统管理员登录与签发注册码

**What to build:** 运维在服务器上用 `xingya admin:create` 创建系统管理员（用户名 + 强密码 + TOTP 种子，命令输出供验证器 App 绑定的信息，只显示一次）。系统管理员只能在后台子域名 `admin.<域名>` 的后台应用里，用用户名 + 密码 + TOTP 动态码登录；主站没有后台登录入口。后台会话 Cookie `xy_admin_sid` 只发给后台域名，主站与后台互不携带对方 Cookie；`/api/v1/admin/*` 只接受后台域名的请求。登录后，系统管理员在后台“家庭”页签发一次性注册码（14 天有效，签发后只显示一次；可选填邮箱，同时发出注册邀请邮件），把注册码交给家长，家长就能在主站用它注册家庭（见 11）。至此，生产环境中第一个真实家庭可以完成注册。

依据：[family 需求 §4.3.1、§4.3.4–4.3.5、验收要点](../../../docs/01-requirements/modules/family.md)、[ADR 0015](../../../docs/adr/0015-admin-app-and-seeds.md) 决策 2、[api §5.1、§5.3 admin（`POST /admin/login`、`POST /admin/signup-codes`）、§5.4 权限矩阵](../../../docs/03-design/api.md)、[nfr §8.1](../../../docs/01-requirements/nfr.md)、[deployment §9.2–9.2b](../../../docs/02-solution/deployment.md)、[data-model §6.1](../../../docs/03-design/data-model.md)（`auth_tokens` 的 `family_signup` 用途）。

**Blocked by:** [02 平台层和初始迁移](../../m1-skeleton/issues/02-platform-layer.md)、[03 界面主题包](../../m1-skeleton/issues/03-ui-theme.md)、[10 邮件发件箱](10-email-outbox.md)、[11 家长注册和登录](11-parent-signup-login.md)

**Status:** ready-for-agent

**系统管理员登录**

- [ ] `xingya admin:create`：输入用户名与强密码（拒绝弱密码），生成 TOTP 种子并以服务端主密钥（来自 `/etc/xingya/secrets.env`）加密保存；密码与种子不写日志；集成测试覆盖创建与用户名重复。
- [ ] `POST /api/v1/admin/login` 校验用户名 + 密码 + TOTP，任一错误统一返回 `401 INVALID_CREDENTIALS`；连续失败有计数与锁定（`423 ACCOUNT_LOCKED`）及 IP 限流；登录成功与失败写审计。TOTP 用可控 Clock 测试时间窗口边界。
- [ ] 会话 Cookie `xy_admin_sid`：Host-only（不设 `Domain`）、`Secure`、`HttpOnly`、`SameSite=Strict`，只在后台域名上发放；30 分钟无操作过期、最长 8 小时（用可控 Clock 测试）。
- [ ] Host 限制：`/api/v1/admin/*` 在主站 Host 上返回 `404`（服务端按 Host 拒绝，Nginx 层的 404 由 06 配置）；系统管理员主体只能由 `xy_admin_sid` 建立，主站 `xy_sid` 无法访问后台接口，`xy_admin_sid` 也无法访问主站的家长与孩子接口（集成测试）。
- [ ] 后台写请求同样校验 `Origin` 只接受后台源，并要求 `X-Client-Request-Id`。
- [ ] 权限矩阵测试：系统管理员会话调用家长与孩子接口被拒；系统管理员不存在读取家庭学习数据或修改星星、碎片的接口。
- [ ] 后台应用：登录页（用户名、密码、动态码）与登录后的外壳首页、退出；会话过期回到登录页；使用 `packages/ui` 主题；孩子端构建产物中不出现任何后台代码（05 的检查通过）。

**签发注册码**

- [ ] `POST /api/v1/admin/signup-codes` 只允许系统管理员会话调用（家长、孩子或未登录 → 拒绝；主站 Host → `404`）；签发一个一次性注册码（`family_signup` 令牌，库中只存 SHA-256，记录签发的系统管理员），14 天有效；写审计。
- [ ] 注册码明文只在签发响应中出现一次，之后任何接口与日志都拿不到明文（测试断言）。
- [ ] 可选填邮箱：填写时在同一事务中经 10 的发件箱入队注册邀请邮件（`family_signup` 类型）；不填时不发邮件。
- [ ] 后台“家庭”页提供签发表单（可选邮箱），签发后显示一次注册码并提示“只显示一次”，离开页面后不可再次查看。
- [ ] 用本单签发的注册码可以通过 11 的注册流程创建家庭；同一注册码第二次使用被拒；超过 14 天的注册码被拒（可控 Clock 测试）；`registration.mode = invite` 下这是创建家庭的唯一途径。
- [ ] 跨应用 e2e（`apps/admin/e2e`，同时打开两个站点）：系统管理员用夹具创建的账号与测试种子生成动态码登录 → 签发带邮箱的注册码 → 从 SMTP 桩取到邀请邮件 → 家长在主站用该注册码注册并登录 → 再次使用同一注册码被拒；错误动态码登录被拒。
- [ ] 运维说明写明生产环境第一个家庭的开通步骤：`xingya admin:create` → 经后台子域名登录（备案前通过 SSH 端口转发）→ 签发注册码 → 交给家长注册。
