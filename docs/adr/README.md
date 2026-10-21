# 架构决策记录（ADR）

| 编号 | 决策 | 状态 |
| --- | --- | --- |
| [0001](0001-modular-monolith.md) | 采用模块化单体 | 已接受 |
| [0002](0002-mysql-local-only-ssh-tunnel.md) | MySQL 只监听本机，管理经 SSH 隧道 | 已接受 |
| [0003](0003-content-as-code-build-time-tts.md) | 内容即代码，构建期生成发音 | 已被 ADR 0008、0010 取代 |
| [0004](0004-append-only-star-ledger.md) | 星星账本只追加 | 已接受（由 ADR 0011 修订） |
| [0005](0005-web-only-pwa-launch.md) | 首发只做 Web（可安装 PWA） | 已接受 |
| [0006](0006-cross-family-social-safeguards.md) | 跨家庭社交带安全护栏 | 已接受 |
| [0007](0007-family-as-tenant.md) | 以家庭为租户 | 已接受 |
| [0008](0008-db-versioned-courses-word-bank.md) | 课程入库并版本化，共享词库 | 已接受（取代 ADR 0003 的“内容即代码”部分） |
| [0009](0009-studio-mysql-job-queue.md) | AI 工作室使用 MySQL 任务队列与月度预算 | 已接受 |
| [0010](0010-oss-cdn-publish-time-piper.md) | 素材放 OSS + CDN，发布时一次性运行 Piper | 已接受（取代 ADR 0003 的“构建期生成发音”部分） |
| [0011](0011-fragments-second-currency.md) | 引入碎片作为第二种货币 | 已接受（修订 ADR 0004） |
| [0012](0012-server-decided-discovery-ai-filled-rules.md) | 呀哈哈由服务器决定，AI 只填写规则表单 | 已接受 |
| [0013](0013-keyframe-motion-template-animation.md) | 伙伴与呀哈哈动画采用“关键帧图 + 动作模板” | 已接受 |

新决策按序号追加；被取代的 ADR 保留，状态改为“已被 ADR NNNN 取代”。
