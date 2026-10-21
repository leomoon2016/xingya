# 星芽学园（Xingya）

面向家庭的儿童英语学习系统（全新设计）。首发：一个家庭使用、只有 Web（可安装 PWA）、只有英语；以家庭为租户，以后开放给更多家庭，并复用同一 API 做小程序与苹果应用。

- 孩子：在家庭设备上点头像 + 4 位 PIN 进入；闯关（看图选词、听音选词、拼写、跟读）、间隔复习、用学习得到的星星在商店换原创装扮与宠物、申请家长定义的现实奖励；与兄弟姐妹及（家长批准的）好友家庭互动；呀哈哈 AI 聊天。
- 家长：管理孩子档案与设备、设置每日时长与可用时段、查看每日报告与周报邮件、审批兑换与好友请求。
- 技术：模块化单体（Node 24 + Fastify 5 + Kysely + Zod + mysql2），MySQL 8.4 只监听本机，Nginx，单台阿里云 ECS；课程内容即代码，发音在构建期由 Piper 生成。

当前状态：**只有设计文档与目录骨架，尚无产品代码**。从 [docs/README.md](docs/README.md) 开始阅读。

## 目录结构

```
xingya/
├── .github/
│   └── workflows/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── chat/
│   │   │   │   ├── content/
│   │   │   │   ├── controls/
│   │   │   │   ├── family/
│   │   │   │   ├── learning/
│   │   │   │   ├── reports/
│   │   │   │   ├── social/
│   │   │   │   └── stars/
│   │   │   └── platform/
│   │   └── test/
│   │       └── integration/
│   └── web/
│       ├── e2e/
│       ├── public/
│       └── src/
│           ├── app/
│           ├── components/
│           ├── features/
│           │   ├── admin/
│           │   ├── chat/
│           │   ├── learn/
│           │   ├── login/
│           │   ├── parent/
│           │   ├── review/
│           │   ├── shop/
│           │   └── social/
│           └── lib/
├── content/
│   ├── english/
│   │   └── grade-1/
│   ├── phrases/
│   └── shop/
├── db/
│   ├── migrations/
│   │   └── 0001_init.sql
│   ├── seeds/
│   ├── verify/
│   │   ├── result.txt
│   │   └── verify.mjs
│   └── roles.sql
├── deploy/
│   ├── nginx/
│   ├── scripts/
│   └── systemd/
├── docs/
│   ├── 01-requirements/
│   │   ├── modules/
│   │   │   ├── chat.md
│   │   │   ├── content.md
│   │   │   ├── controls.md
│   │   │   ├── family.md
│   │   │   ├── learning.md
│   │   │   ├── reports.md
│   │   │   ├── social.md
│   │   │   └── stars.md
│   │   ├── PRD.md
│   │   ├── nfr.md
│   │   └── open-questions.md
│   ├── 02-solution/
│   │   ├── deployment.md
│   │   ├── overview.md
│   │   └── roadmap.md
│   ├── 03-design/
│   │   ├── modules/
│   │   │   ├── chat.md
│   │   │   ├── content.md
│   │   │   ├── controls.md
│   │   │   ├── family.md
│   │   │   ├── learning.md
│   │   │   ├── reports.md
│   │   │   ├── social.md
│   │   │   └── stars.md
│   │   ├── api.md
│   │   ├── content-pack.md
│   │   └── data-model.md
│   ├── 04-ui-design/
│   │   ├── characters/
│   │   ├── components/
│   │   ├── flows/
│   │   ├── mockups/
│   │   │   ├── admin/
│   │   │   ├── chat/
│   │   │   ├── learn/
│   │   │   ├── login/
│   │   │   ├── parent/
│   │   │   ├── review/
│   │   │   ├── shop/
│   │   │   └── social/
│   │   ├── tokens/
│   │   └── wireframes/
│   │       ├── admin/
│   │       ├── chat/
│   │       ├── learn/
│   │       ├── login/
│   │       ├── parent/
│   │       ├── review/
│   │       ├── shop/
│   │       └── social/
│   ├── 05-plans/
│   ├── 06-releases/
│   │   ├── v1.0/
│   │   │   ├── acceptance.md
│   │   │   ├── changes.md
│   │   │   ├── release-notes.md
│   │   │   └── scope.md
│   │   └── backlog.md
│   └── adr/
│       ├── 0001-modular-monolith.md
│       ├── 0002-mysql-local-only-ssh-tunnel.md
│       ├── 0003-content-as-code-build-time-tts.md
│       ├── 0004-append-only-star-ledger.md
│       ├── 0005-web-only-pwa-launch.md
│       ├── 0006-cross-family-social-safeguards.md
│       └── 0007-family-as-tenant.md
├── packages/
│   ├── content-schema/
│   ├── contracts/
│   └── rules/
├── tools/
│   ├── build-audio/
│   └── validate-content/
├── .gitignore
├── CHANGELOG.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

（树中省略了各目录的 `README.md` 与空目录的 `.gitkeep`。）

各目录的用途与是否部署到服务器，见该目录下的 `README.md` 与 [docs/02-solution/overview.md](docs/02-solution/overview.md)。
