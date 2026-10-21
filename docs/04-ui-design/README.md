# 04 界面设计

| 目录 | 内容 |
| --- | --- |
| `tokens/` | 设计令牌：颜色、字号、间距、圆角、阴影、动效（含“减少动画”） |
| `flows/` | 用户流程图（家庭设备登录、闯关与藏匿点、复习、领养伙伴、兑换审批、加时、工作室生成与发布等） |
| `wireframes/<功能>/` | 线框图，按功能：login、learn、review、shop、companion、discovery、album、social、chat、parent、admin、studio |
| `mockups/<功能>/` | 高保真效果图，功能划分同上 |
| `components/` | 组件规范（与 `apps/web/src/components` 对应） |
| `characters/` | 原创角色设定：呀哈哈队长（固定形象）、呀哈哈家族风格基准、伙伴风格模板、头像与装扮（禁止第三方 IP） |

无障碍基线（对比度 ≥ 4.5:1、触控目标 ≥ 44×44 px、200% 字号不破版等）见 `docs/01-requirements/nfr.md` §8.3。

**是否上服务器**：否。设计稿不部署；最终使用的图片素材进入素材库（阿里云 OSS，经 CDN）或 `apps/web/public/`（图标等）。
