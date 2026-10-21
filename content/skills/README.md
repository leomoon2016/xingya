# skills —— 默认技能（种子）

每个子目录是一个 SKILL.md 文件夹格式的技能（v1.0 共 17 个，见 `docs/03-design/modules/agents.md` 工具目录一节）：

```
<skill-key>/
├── SKILL.md          # frontmatter: name, description（何时使用）；正文 = 指令
├── xingya.json       # 受众、工具白名单、默认参数、推荐模型
├── schemas/
│   ├── input.json    # JSON Schema
│   └── output.json   # JSON Schema（type 必须是 object）
└── references/       # 参考资料（文本）
```

- 首次部署后由运维执行一次 `xingya skills:seed` 导入为 **v1 草稿**（幂等，不覆盖后台修改），写入技能侧白名单并按 `content/agents/defaults.json` 挂到默认角色；之后技能只在后台维护（数据库版本化）。
- **不允许任何可执行文件**：CI（`tools/validate-content`）拒绝 `scripts/` 与可执行扩展名；导入外部包时脚本只作惰性文本保存，永不执行。
- `child-safety` 是系统技能（迁移已建技能行，不能停用），所有面向孩子的角色必须挂载。

目录尚为空：内容随 W5–6 实现一起提交。
