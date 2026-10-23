# tokens

设计令牌是界面视觉的**唯一来源**：颜色、字体、间距、圆角、阴影、动效、断点与触控尺寸。

| 文件 | 说明 |
| --- | --- |
| [`design-tokens.json`](design-tokens.json) | 机器可读令牌；`packages/ui` 构建时由此生成孩子端与后台共用主题。应用内不硬编码颜色与字号。 |

## 孩子端基调（原型 D）

色板取自分支 `prototype/child-ui` 方案 D「森林探险图」：`forest` / `teal` / `mint` / `paper` / `wood` / `gold` 等（见 JSON `color.child`）。英文学习内容用 **Andika**（单层 a/g）；数字与 Unit 标签用 **Baloo 2**；中文用系统黑体栈。

家长中心与后台复用 `color.neutral` 与同一组断点 / 触控 / 焦点色；孩子端专用冒险色不强制用于后台表格。

## 画框与断点

- 孩子端主画框 **1024×768** 横屏，另出 **360×800** 手机竖屏；需要时补 1280×800。
- 断点：`< 768` / `768–1279` / `≥ 1280`；最小宽度 360；触控目标 ≥ 44×44（见 [nfr §8.3–8.4](../../01-requirements/nfr.md)）。

## 动效

默认尊重 `prefers-reduced-motion`；孩子设置里的「减少动画」对应 `pref_reduced_motion`。减少动画时关闭呼吸光与星星拖尾滑动，保留静态状态切换。
