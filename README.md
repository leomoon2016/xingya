# 星芽学园（Xingya）

面向家庭的儿童英语学习系统（全新设计）。首发：一个家庭使用、只有 Web（可安装 PWA）、只有英语；以家庭为租户，以后开放给更多家庭，并复用同一 API 做小程序与苹果应用。

- 孩子：在家庭设备上点头像 + 4 位 PIN 进入；闯关（9 种题型，逐题反馈）、间隔复习；用星星在商店换原创装扮、申请家长定义的现实奖励；用学习得到的星星或碎片领养**学习伙伴**并陪它成长；通关后点开藏匿点寻找**呀哈哈**、收集图鉴；与兄弟姐妹及（家长批准的）好友家庭互动；与呀哈哈队长 AI 聊天（面向孩子的 AI 角色，不保存对话）。
- 家长：管理孩子档案与设备、设置每日时长与可用时段、查看每日报告与周报邮件、审批兑换与好友请求。
- 系统管理员：独立的后台应用（`apps/admin`，部署在 `admin.<域名>` 子域名，独立 CSP，孩子端不含后台代码）中的 **AI 工作室**——设计伙伴与呀哈哈款式、上传资料由 AI 生成课程、用一句话描述投放规则；**技能库**（版本化提示词包，兼容 SKILL.md，无可执行代码）与 **AI 角色**（课程设计师、美术设计师、配音师、活动策划、质检员、运营分析师）分工执行，可串成流水线；每个页面有一句话框。AI 只写草稿，所有生成内容先预估费用、经审核才发布，全站与角色月度预算有上限。
- 技术：模块化单体（Node 24 + Fastify 5 + Kysely + Zod + mysql2），MySQL 8.4 只监听本机，Nginx，单台阿里云 ECS；课程存数据库并版本化（已发布版本不可修改）；素材放阿里云 OSS + CDN；发音在课程发布时由 Piper 一次性生成。仓库分为 `apps/{api,web,admin}`、共享包 `packages/`、内置数据 `seeds/`（随发布部署，见 [seeds/README.md](seeds/README.md)）、`db/`、`deploy/`、`tools/`。

当前状态：**只有设计文档与目录骨架，尚无产品代码**。从 [docs/README.md](docs/README.md) 开始阅读。

## 目录结构

```
xingya/
├── .github/
│   └── workflows/
├── apps/
│   ├── admin/
│   │   ├── e2e/
│   │   └── src/
│   │       ├── app/
│   │       ├── components/
│   │       ├── features/
│   │       │   ├── agents/
│   │       │   ├── audit/
│   │       │   ├── courses/
│   │       │   ├── families/
│   │       │   ├── pets/
│   │       │   ├── rules/
│   │       │   ├── runs/
│   │       │   ├── settings/
│   │       │   ├── skills/
│   │       │   ├── studio/
│   │       │   └── yahaha/
│   │       └── lib/
│   ├── api/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── chat/
│   │   │   │   ├── companion/
│   │   │   │   ├── content/
│   │   │   │   ├── controls/
│   │   │   │   ├── discovery/
│   │   │   │   ├── family/
│   │   │   │   ├── learning/
│   │   │   │   ├── reports/
│   │   │   │   ├── social/
│   │   │   │   ├── stars/
│   │   │   │   └── studio/
│   │   │   │       ├── agents/
│   │   │   │       ├── assets/
│   │   │   │       ├── jobs/
│   │   │   │       ├── providers/
│   │   │   │       ├── runner/
│   │   │   │       ├── skills/
│   │   │   │       └── tools/
│   │   │   └── platform/
│   │   │       ├── auth/
│   │   │       ├── config/
│   │   │       ├── db/
│   │   │       └── logging/
│   │   └── test/
│   │       ├── concurrency/
│   │       ├── integration/
│   │       ├── safety/
│   │       └── unit/
│   └── web/
│       ├── e2e/
│       ├── public/
│       └── src/
│           ├── app/
│           ├── components/
│           ├── features/
│           │   ├── child/
│           │   │   ├── album/
│           │   │   ├── chat/
│           │   │   ├── companion/
│           │   │   ├── discovery/
│           │   │   ├── learn/
│           │   │   ├── login/
│           │   │   ├── review/
│           │   │   ├── shop/
│           │   │   └── social/
│           │   └── parent/
│           │       ├── approvals/
│           │       ├── controls/
│           │       ├── dashboard/
│           │       └── reports/
│           └── lib/
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
│   │   │   ├── agents.md
│   │   │   ├── chat.md
│   │   │   ├── companion.md
│   │   │   ├── content.md
│   │   │   ├── controls.md
│   │   │   ├── discovery.md
│   │   │   ├── family.md
│   │   │   ├── learning.md
│   │   │   ├── reports.md
│   │   │   ├── social.md
│   │   │   ├── stars.md
│   │   │   └── studio.md
│   │   ├── PRD.md
│   │   ├── nfr.md
│   │   └── open-questions.md
│   ├── 02-solution/
│   │   ├── deployment.md
│   │   ├── overview.md
│   │   └── roadmap.md
│   ├── 03-design/
│   │   ├── modules/
│   │   │   ├── agents.md
│   │   │   ├── chat.md
│   │   │   ├── companion.md
│   │   │   ├── content.md
│   │   │   ├── controls.md
│   │   │   ├── discovery.md
│   │   │   ├── family.md
│   │   │   ├── learning.md
│   │   │   ├── reports.md
│   │   │   ├── social.md
│   │   │   ├── stars.md
│   │   │   └── studio.md
│   │   ├── api.md
│   │   ├── course-model.md
│   │   └── data-model.md
│   ├── 04-ui-design/
│   │   ├── characters/
│   │   ├── components/
│   │   ├── flows/
│   │   │   ├── admin/
│   │   │   ├── child/
│   │   │   └── parent/
│   │   ├── mockups/
│   │   │   ├── admin/
│   │   │   │   ├── agents/
│   │   │   │   ├── audit/
│   │   │   │   ├── courses/
│   │   │   │   ├── families/
│   │   │   │   ├── pets/
│   │   │   │   ├── rules/
│   │   │   │   ├── runs/
│   │   │   │   ├── settings/
│   │   │   │   ├── skills/
│   │   │   │   ├── studio/
│   │   │   │   └── yahaha/
│   │   │   ├── child/
│   │   │   │   ├── album/
│   │   │   │   ├── chat/
│   │   │   │   ├── companion/
│   │   │   │   ├── discovery/
│   │   │   │   ├── learn/
│   │   │   │   ├── login/
│   │   │   │   ├── review/
│   │   │   │   ├── shop/
│   │   │   │   └── social/
│   │   │   └── parent/
│   │   │       ├── approvals/
│   │   │       ├── controls/
│   │   │       ├── dashboard/
│   │   │       └── reports/
│   │   ├── tokens/
│   │   └── wireframes/
│   │       ├── admin/
│   │       │   ├── agents/
│   │       │   ├── audit/
│   │       │   ├── courses/
│   │       │   ├── families/
│   │       │   ├── pets/
│   │       │   ├── rules/
│   │       │   ├── runs/
│   │       │   ├── settings/
│   │       │   ├── skills/
│   │       │   ├── studio/
│   │       │   └── yahaha/
│   │       ├── child/
│   │       │   ├── album/
│   │       │   ├── chat/
│   │       │   ├── companion/
│   │       │   ├── discovery/
│   │       │   ├── learn/
│   │       │   ├── login/
│   │       │   ├── review/
│   │       │   ├── shop/
│   │       │   └── social/
│   │       └── parent/
│   │           ├── approvals/
│   │           ├── controls/
│   │           ├── dashboard/
│   │           └── reports/
│   ├── 05-plans/
│   ├── 06-releases/
│   │   ├── v1.0/
│   │   │   ├── acceptance.md
│   │   │   ├── changes.md
│   │   │   ├── release-notes.md
│   │   │   └── scope.md
│   │   └── backlog.md
│   ├── adr/
│   │   ├── 0001-modular-monolith.md
│   │   ├── 0002-mysql-local-only-ssh-tunnel.md
│   │   ├── 0003-content-as-code-build-time-tts.md
│   │   ├── 0004-append-only-star-ledger.md
│   │   ├── 0005-web-only-pwa-launch.md
│   │   ├── 0006-cross-family-social-safeguards.md
│   │   ├── 0007-family-as-tenant.md
│   │   ├── 0008-db-versioned-courses-word-bank.md
│   │   ├── 0009-studio-mysql-job-queue.md
│   │   ├── 0010-oss-cdn-publish-time-piper.md
│   │   ├── 0011-fragments-second-currency.md
│   │   ├── 0012-server-decided-discovery-ai-filled-rules.md
│   │   ├── 0013-keyframe-motion-template-animation.md
│   │   ├── 0014-skills-and-agent-roles.md
│   │   └── 0015-admin-app-and-seeds.md
│   └── reviews/
│       └── 2026-10-21-整体评审.md
├── packages/
│   ├── contracts/
│   ├── rules/
│   ├── seed-schema/
│   ├── skill-format/
│   └── ui/
├── seeds/
│   ├── agents/
│   ├── avatars/
│   ├── course-templates/
│   ├── phrases/
│   ├── safety/
│   ├── samples/
│   │   └── english/
│   │       └── grade-1/
│   ├── shop/
│   └── skills/
├── tools/
│   ├── safety-eval/
│   └── validate-seeds/
├── .gitignore
├── CHANGELOG.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

（树中省略了各目录的 `README.md` 与空目录的 `.gitkeep`。）

各目录的用途与是否部署到服务器，见该目录下的 `README.md` 与 [docs/02-solution/overview.md](docs/02-solution/overview.md)。
