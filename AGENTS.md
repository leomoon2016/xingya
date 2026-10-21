# AGENTS.md

星芽学园（xingya）仓库的 AI 协作入口。开工前先读本文件，再按需读 `docs/README.md` 的文档索引。

## 基本约定

- 所有文档只用 Markdown（.md），不使用 docx。
- 本仓库目前只在本地，不推送远程。
- 不要读取或提交任何密钥文件；生产密钥只在服务器 `/etc/xingya/secrets.env`。
- 用词以根目录术语表 [GLOSSARY.md](GLOSSARY.md) 为准（例如“伙伴 / 跟随伙伴”“星级 / 学习星 / 奖励星”“审核 / 审批”），不要使用其中 _Avoid_ 列出的词。

## Agent skills

### Issue tracker

任务单以本地 Markdown 存在 `.scratch/` 下。See `docs/agents/issue-tracker.md`.

### Triage labels

使用默认五个状态：needs-triage、needs-info、ready-for-agent、ready-for-human、wontfix。See `docs/agents/triage-labels.md`.

### Domain docs

single-context：根目录 [GLOSSARY.md](GLOSSARY.md) + `docs/adr/`。See `docs/agents/domain.md`.
