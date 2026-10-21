# 03: 界面主题包

**What to build:** 建立设计令牌文件 `design-tokens.json`（放在 `docs/04-ui-design/tokens/`，颜色、字号、间距、圆角、阴影、动效，含“减少动画”），并让 `packages/ui` 在构建时由它生成主题（CSS 变量与 TypeScript 常量）。孩子端（`apps/web`）和系统管理端（`apps/admin`）都使用同一主题，打开两个应用外壳能看到一致的配色与字体；以后改一个令牌、重新构建，两边一起变。令牌是唯一来源，应用里不硬编码颜色与字号。

依据：[tokens/README](../../../docs/04-ui-design/tokens/README.md)、[packages/ui/README](../../../packages/ui/README.md)、[ADR 0015](../../../docs/adr/0015-admin-app-and-seeds.md) 决策 4、[nfr §8.3](../../../docs/01-requirements/nfr.md) 无障碍基线、[整体评审](../../../docs/reviews/2026-10-21-整体评审.md)“目录调整评审”C.5（`design-tokens.json` 尚不存在，需在 W1–2 建立）。

文档没有规定具体色值与字号；本单先提交一套满足无障碍基线的初始令牌，正式视觉随界面设计再替换。

**Blocked by:** [01 仓库骨架打通](01-repo-skeleton.md)

**Status:** ready-for-agent

- [ ] `design-tokens.json` 已提交，覆盖颜色、字号、间距、圆角、阴影、动效六类，并包含“减少动画”下的动效取值。
- [ ] 令牌有模式校验：缺少类别或取值格式错误时生成步骤失败（有测试）。
- [ ] `packages/ui` 构建时由令牌生成 CSS 变量与 TypeScript 常量；生成结果不手改（重新生成后与提交内容一致，有检查）。
- [ ] 孩子端与系统管理端外壳都引入该主题，页面使用令牌中的颜色与字号；有检查确认两个应用源码中没有硬编码的颜色值。
- [ ] 文字与背景的令牌组合对比度 ≥ 4.5:1（有自动测试计算）；动效令牌遵从 `prefers-reduced-motion`。
- [ ] `packages/ui` 只包含无业务的内容；孩子端构建不会因为引入主题而带入任何后台代码。
