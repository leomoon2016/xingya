# 架构决策记录（ADR）

| 编号 | 决策 | 状态 |
| --- | --- | --- |
| [0001](0001-modular-monolith.md) | 采用模块化单体 | 已接受（由 ADR 0015 补充） |
| [0002](0002-mysql-local-only-ssh-tunnel.md) | MySQL 只监听本机，管理经 SSH 隧道 | 已接受 |
| [0003](0003-content-as-code-build-time-tts.md) | 内容即代码，构建期生成发音 | 已被 ADR 0008、0010 取代 |
| [0004](0004-append-only-star-ledger.md) | 星星账本只追加 | 已接受（由 ADR 0011、0017 修订） |
| [0005](0005-web-only-pwa-launch.md) | 首发只做 Web（可安装 PWA） | 已接受（由 ADR 0015 修订） |
| [0006](0006-cross-family-social-safeguards.md) | 跨家庭社交带安全护栏 | 已接受 |
| [0007](0007-family-as-tenant.md) | 以家庭为租户 | 已接受 |
| [0008](0008-db-versioned-courses-word-bank.md) | 课程入库并版本化，共享词库 | 已接受（取代 ADR 0003 的“内容即代码”部分；由 ADR 0016 修订） |
| [0009](0009-studio-mysql-job-queue.md) | AI 工作室使用 MySQL 任务队列与月度预算 | 已接受（由 ADR 0014 扩展） |
| [0010](0010-oss-cdn-publish-time-piper.md) | 素材放 OSS + CDN，发布时一次性运行 Piper | 已接受（取代 ADR 0003 的“构建期生成发音”部分） |
| [0011](0011-fragments-second-currency.md) | 引入碎片作为第二种货币 | 已接受（修订 ADR 0004；由 ADR 0017 修订） |
| [0012](0012-server-decided-discovery-ai-filled-rules.md) | 呀哈哈家族的投放由服务器决定，AI 只填写规则表单 | 已接受（由 ADR 0014 扩展：由活动策划角色填写） |
| [0013](0013-keyframe-motion-template-animation.md) | 伙伴与呀哈哈家族动画采用“关键帧图 + 动作模板” | 已接受 |
| [0014](0014-skills-and-agent-roles.md) | 技能入库版本化、AI 角色执行、无可执行代码 | 已接受（扩展 ADR 0009、0012） |
| [0015](0015-admin-app-and-seeds.md) | 系统管理端独立为后台应用；`content/` 改名为 `seeds/` | 已接受（修订 ADR 0001、0005） |
| [0016](0016-unit-layer.md) | 保留单元层（课程 > 单元 > 关卡），版本以整门课程为单位 | 已接受（修订 ADR 0008） |
| [0017](0017-points-currency.md) | 恢复积分（与旧系统完全一致），10 积分换 1 颗星星 | 已接受（修订 ADR 0004、0011） |
| [0018](0018-mario-game-partner.md) | 正式系统一直使用马里奥（游戏搭档），第三方 IP 的唯一具名例外 | 已接受 |
| [0019](0019-wordbook-as-old-system.md) | 单词本照旧系统实现（进入 v1.0） | 已接受（修订 ADR 0012、0017 §5） |

新决策按序号追加；被取代的 ADR 保留，状态改为“已被 ADR NNNN 取代”。
