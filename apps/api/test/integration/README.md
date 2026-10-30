# 集成测试

用 Vitest 连接真实 PostgreSQL 16（CI 中为服务容器）：迁移从空库应用、授权实测、幂等与并发、租户隔离（按路由表自动生成跨家庭 404 用例）、定时任务、`seeds:apply` 幂等与示例课程导入。并发与儿童安全用例分别在 `../concurrency/`、`../safety/`。见 `docs/01-requirements/nfr.md` §10.2。

**是否上服务器**：否。
