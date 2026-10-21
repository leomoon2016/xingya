# skill-format —— SKILL.md 导入包格式与校验

- 解析 SKILL.md 文件夹（YAML frontmatter 安全模式）：`name` → 技能标识、`description` → 何时使用、正文 → 指令；`schemas/input.json`、`schemas/output.json` → 输入输出模式（输出必须是 object）；`references/` → 参考资料；可选 `xingya.json` → 受众、工具白名单、默认参数、推荐模型。
- 导入包限制与校验（开放问题 Q21）：ZIP ≤ 5 MB、解压后 ≤ 20 MB、≤ 100 个文件、拒绝绝对路径 / `..` / 符号链接、未知工具名拒绝；`scripts/` 与可执行文件只识别为**惰性文本**，本包不包含任何执行它们的代码。
- 导出：生成同样结构的文件夹 / ZIP。

设计见 `docs/03-design/modules/agents.md` 导入导出一节。

**是否上服务器**：否（编译进 api 与 admin）。
