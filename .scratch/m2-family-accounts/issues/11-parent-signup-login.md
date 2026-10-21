# 11: 家长注册和登录

**What to build:** 家长拿到系统管理员签发的一次性注册码，在主站填写注册码、邮箱、密码、称呼、家庭名和时区（默认 `Asia/Shanghai`），勾选同意《儿童个人信息保护规则》与隐私政策后，系统创建家庭与第一位家长并直接登录；同时发出邮箱验证邮件，家长点链接完成验证（未验证也能使用，但不会收到周报）。之后家长用邮箱 + 密码登录、退出。登录入口在孩子端的登录区域（`child/login`），登录后进入家长中心。

依据：[family 需求 §4.3.1–4.3.2、§4.3.5、验收要点](../../../docs/01-requirements/modules/family.md)、[api §5.3 family](../../../docs/03-design/api.md)、[nfr §8.1–8.2](../../../docs/01-requirements/nfr.md)、[ADR 0007](../../../docs/adr/0007-family-as-tenant.md)。注册码的签发（`POST /admin/signup-codes`）不在本单，测试中用夹具直接写入注册码。

**Blocked by:** [02 平台层和初始迁移](../../m1-skeleton/issues/02-platform-layer.md)、[03 界面主题包](../../m1-skeleton/issues/03-ui-theme.md)、[10 邮件发件箱](10-email-outbox.md)

**Status:** ready-for-agent

- [ ] 注册模式 `registration.mode = invite` 时，无注册码或注册码无效 → `403 REGISTRATION_CLOSED`；注册码一次性，重复使用被拒；`closed` 模式下一律拒绝。集成测试覆盖。
- [ ] 邮箱统一小写存储，大小写不同视为同一邮箱；一个邮箱只属于一个家庭，重复 → `409 EMAIL_IN_USE`。
- [ ] 密码 ≥ 8 位并拒绝常见弱密码表；scrypt（N=2^15, r=8, p=1）哈希，并发哈希数限制为 4。
- [ ] 注册成功后在同一事务中创建家庭与家长、入队验证邮件（经 10 的发件箱），并建立家长会话。
- [ ] 邮箱验证：链接中的令牌库中只存 SHA-256，一次性；验证后记录验证时间；e2e 从 SMTP 桩取链接完成验证。
- [ ] 登录：错误统一返回 `401 INVALID_CREDENTIALS`（不区分哪一项）；同一家长连续 10 次失败锁定 15 分钟（`423 ACCOUNT_LOCKED`，`details.lockedUntil`）；另有按 IP 的限流（10 分钟 20 次，`429 RATE_LIMITED`）。用可控 Clock 测试锁定与解除。
- [ ] 会话：令牌 32 字节随机数，库中只存 SHA-256；Cookie `xy_sid` 为 HttpOnly、Secure、SameSite=Lax、Path=/，不设 `Domain`；个人设备上的家长会话 30 天滑动过期；`last_seen_at` 最多每 5 分钟更新一次。用可控 Clock 测试过期。
- [ ] 退出：注销当前会话，之后该 Cookie 的请求返回 `401 UNAUTHENTICATED`。
- [ ] `GET /me` 返回当前家长与家庭；任何家庭的会话访问其他家庭的资源一律 `404`（为本单新增路由生成跨家庭用例）。
- [ ] 页面：注册、登录、退出、邮箱验证结果页使用 `packages/ui` 主题，关键页面 axe 无严重违规；e2e 覆盖“注册 → 验证邮箱 → 退出 → 登录”。
