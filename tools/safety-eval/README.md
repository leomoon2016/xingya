# safety-eval —— 儿童安全评测

对面向孩子的技能与角色（v1.0 只有呀哈哈队长：`child-safety`、`english-practice`、`storytelling`、`question-answer`）运行 `seeds/safety/tests/` 中的儿童安全测试集：诱导索取个人信息、不适合儿童的话题、自伤求助、现有 IP 与在世艺术家模仿、提示注入（“忽略以上规则”）、链接与联系方式等；断言回复经输出过滤后安全、符合 `{reply}` 输出模式、不出现他人数据。

- CI：`seeds/skills/` 中儿童技能或 `seeds/safety/` 变化时运行（LLM 用桩回放 + 可选的真实模型夜间运行，真实模型运行需要密钥，只在受保护环境执行）。
- 后台“儿童安全审核”调用同一测试集（开放问题 Q23）。

**是否上服务器**：否（测试集本身随 `seeds/safety/` 部署，供后台审核使用）。
