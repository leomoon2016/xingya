# 04 界面设计

| 目录 | 内容 |
| --- | --- |
| `tokens/` | 设计令牌：`design-tokens.json`（颜色、字号、间距、圆角、阴影、动效，含“减少动画”），`packages/ui` 由它生成孩子端与后台共用的主题 |
| `flows/{child,parent,admin}/` | 用户流程图，按使用者分组：孩子（家庭设备登录、闯关与藏匿点、复习、领养伙伴）、家长（兑换审批、加时、好友家庭）、后台（工作室生成与发布、技能与角色、流水线） |
| `wireframes/<使用者>/<功能>/` | 线框图：`child/`（login、learn、review、companion、discovery、album、shop、social、chat）、`parent/`（dashboard、reports、controls、approvals）、`admin/`（studio、skills、agents、runs、courses、pets、yahaha、rules、families、settings、audit），与 `apps/web/src/features/{child,parent}` 和 `apps/admin/src/features` 一一对应 |
| `mockups/<使用者>/<功能>/` | 高保真效果图，分组同上 |
| `components/` | 组件规范（与 `packages/ui`、`apps/web/src/components`、`apps/admin/src/components` 对应） |
| `characters/` | 原创角色设定：呀哈哈队长（固定形象）、呀哈哈家族风格基准、伙伴风格模板、头像与装扮（禁止第三方 IP） |

无障碍基线（对比度 ≥ 4.5:1、触控目标 ≥ 44×44 px、200% 字号不破版等）见 `docs/01-requirements/nfr.md` §8.3。

**画框与屏幕**（用户 2026-10-22 决定，见 `docs/01-requirements/nfr.md` §8.4 与开放问题 Q29）：
- 孩子端的线框图与效果图一律**先从横屏平板画框（1024×768）开始**，再出一个**手机竖屏变体（360×800，紧凑布局）**；需要时补桌面（1280×800）。
- 家长中心：手机竖屏与桌面两种画框都要有（响应式，窄屏单列）。
- 后台：只出桌面画框（≥ 1280 px），不做手机变体。
- 断点（紧凑 `< 768`、平板 `768–1279`、桌面 `≥ 1280`）与触控目标尺寸写进 `tokens/design-tokens.json`。

**是否上服务器**：否。设计稿不部署；最终使用的图片素材进入素材库（阿里云 OSS，经 CDN）或 `apps/web/public/`（图标等）；设计令牌经 `packages/ui` 进入构建产物。
