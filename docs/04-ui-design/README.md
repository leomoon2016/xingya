# 04 界面设计

| 目录 | 内容 |
| --- | --- |
| `tokens/` | 设计令牌：颜色、字号、间距、圆角、阴影、动效（含“减少动画”） |
| `flows/` | 用户流程图（家庭设备登录、闯关、复习、兑换审批、加时等） |
| `wireframes/<功能>/` | 线框图，按功能：login、learn、review、shop、social、chat、parent、admin |
| `mockups/<功能>/` | 高保真效果图，功能划分同上 |
| `components/` | 组件规范（与 `apps/web/src/components` 对应） |
| `characters/` | 原创角色设定：呀哈哈小树灵、宠物、头像与装扮（禁止第三方 IP） |

无障碍基线（对比度 ≥ 4.5:1、触控目标 ≥ 44×44 px、200% 字号不破版等）见 `docs/01-requirements/nfr.md` §8.3。

**是否上服务器**：否。最终使用的图片资源进入 `content/`（课程包）或 `apps/web/public/`。
