# mockups —— 高保真效果图（静态 HTML）

按使用者分组。本目录为**可浏览器打开的静态稿**，不是生产构建产物；样式手工对齐 [`tokens/design-tokens.json`](../tokens/design-tokens.json)。

## 如何打开

```bash
cd docs/04-ui-design/mockups
python3 -m http.server 8765
# 浏览器打开 http://127.0.0.1:8765/
```

也可直接用浏览器打开 `index.html`（`file://`）。共享样式在 [`_shared/`](_shared/)。

## 目录

| 端 | 入口 | 说明 |
| --- | --- | --- |
| 总图集 | [index.html](index.html) | 三端入口 |
| 孩子 | [child/index.html](child/index.html) | 森林 D：学习/地图/作答/结算/单词本/小铺/家园/图鉴/PIN |
| 家长 | [parent/index.html](parent/index.html) | 首页/审批/核销/加减星/家庭设置 |
| 后台 | [admin/index.html](admin/index.html) | 工作室/课程/伙伴/家庭/模型配置/审计 |

**未做**：种子宠物/搭档 SVG 精修；全部次要页面的高保真（线框已覆盖）。
