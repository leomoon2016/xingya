# validate-content

运行课程包校验（规则见 `docs/03-design/content-pack.md` §7.4），任何错误使 CI 失败；`--public` 模式额外拒绝 `legacy-family:*` 素材。校验通过后输出 `dist/pack-<packVersion>/`。

**是否上服务器**：否（产物上服务器）。
