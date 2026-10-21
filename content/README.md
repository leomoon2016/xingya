# content —— 课程内容源（内容即代码）

课程、词、题目、商店物品、预设短语等都以 JSON 放在这里，经 CI 校验（`tools/validate-content`）、生成音频（`tools/build-audio`）后组装成**课程包**。格式见 `docs/03-design/content-pack.md`。

- `english/grade-1/` …：按年级分目录的英语课程（以后的学科按 `<subject>/grade-N/` 增加）。
- `shop/`：商店物品（装扮、宠物，全部原创形象）。
- `phrases/`：跨家庭预设短语与表情白名单。

**是否上服务器**：是。源文件本身不上服务器；**校验通过的课程包**（content.json、manifest、压缩后的图片、生成的音频）部署到 `/opt/xingya/releases/<ts-version>/content/`，并在部署时导入数据库内容表。
