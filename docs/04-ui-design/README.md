# 04 界面设计

| 目录 | 内容 |
| --- | --- |
| `tokens/` | 设计令牌：`design-tokens.json`（颜色、字号、间距、圆角、阴影、动效，含“减少动画”），`packages/ui` 由它生成孩子端与后台共用的主题 |
| `flows/{child,parent,admin}/` | 用户流程图，按使用者分组：孩子（家庭设备登录、学习卡与闯关、隐藏奖励与秘密路线、藏匿点、复习、单词本、星星小铺四卡、领养 / 退订 / 赠送伙伴、信箱）、家长（兑换审批、累计奖励核销、加星与扣星、加时、好友家庭）、后台（工作室生成与发布、技能与角色、流水线） |
| `wireframes/<使用者>/<功能>/` | 线框图：`child/`（login、learn、review、wordbook、companion、discovery、album、shop、social、chat，以及 2026-10-22 恢复的 footprint、inbox、settings）、`parent/`（dashboard、reports、controls、approvals，以及 overview、rewards）、`admin/`（studio、skills、agents、runs、courses、pets、yahaha、rules、families、settings、audit，以及 ai-providers、voice），与 `apps/web/src/features/{child,parent}` 和 `apps/admin/src/features` 一一对应 |
| `mockups/<使用者>/<功能>/` | 高保真效果图，分组同上 |
| `components/` | 组件规范（与 `packages/ui`、`apps/web/src/components`、`apps/admin/src/components` 对应） |
| `characters/` | 原创角色设定：呀哈哈队长（固定形象）、呀哈哈家族风格基准、伙伴风格模板、头像与探险徽章（禁止第三方 IP；具名例外只有游戏搭档马里奥 / 林克（`seeds/partners/`，ADR 0018）与旧系统种子宠物（`seeds/pets/`，ADR 0021），都只用固定素材） |

无障碍基线（对比度 ≥ 4.5:1、触控目标 ≥ 44×44 px、200% 字号不破版等）见 `docs/01-requirements/nfr.md` §8.3。

**画框与屏幕**（用户 2026-10-22 决定，见 `docs/01-requirements/nfr.md` §8.4 与开放问题 Q29）：
- 孩子端的线框图与效果图一律**先从横屏平板画框（1024×768）开始**，再出一个**手机竖屏变体（360×800，紧凑布局）**；需要时补桌面（1280×800）。
- 家长中心：手机竖屏与桌面两种画框都要有（响应式，窄屏单列）。
- 后台：只出桌面画框（≥ 1280 px），不做手机变体。
- 断点（紧凑 `< 768`、平板 `768–1279`、桌面 `≥ 1280`）与触控目标尺寸写进 `tokens/design-tokens.json`。

**孩子端外壳**（用户 2026-10-22 按回归老系统总规则决定，[ADR 0020](../adr/0020-revert-to-old-system.md)）：采用旧系统**原型 D**——六项导航“我的学习 / 闯关地图 / 星星小铺 / 星星伙伴 / 宠物家园 / 我的单词”（手机竖屏移到底部；我的设置、学习足迹从头像菜单进入）、顶栏（课程下拉、呀哈哈 N / 上限、星星余额、信箱未读数、带徽章的头像）、单元冒险地图与启思大陆总览、星星拖尾动效。旧原型 zip 里“马里奥不能进入正式版”的说明**已作废**（用户 2026-10-22 决定一直使用马里奥，ADR 0018；盘点 X5）。

**是否上服务器**：否。设计稿不部署；最终使用的图片素材进入素材库（阿里云 OSS，经 CDN）或 `apps/web/public/`（图标等）；设计令牌经 `packages/ui` 进入构建产物。
