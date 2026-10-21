# 业务模块（11 个）

| 目录 | 模块 |
| --- | --- |
| `family/` | 家庭账号 |
| `studio/` | AI 工作室 |
| `content/` | 课程内容 |
| `learning/` | 学习 |
| `stars/` | 星星 |
| `companion/` | 学习伙伴 |
| `discovery/` | 呀哈哈发现 |
| `social/` | 社交 |
| `chat/` | AI 聊天（呀哈哈队长） |
| `controls/` | 家长管控 |
| `reports/` | 报告通知 |

规则（CI 强制）：
1. 其他模块只能 import 某模块的 `index.ts`。
2. 模块的 `repo.ts` 只能访问本模块拥有的表。
3. 跨模块写入在同一事务内：发起方开启事务并把 `tx` 传给对方 `…InTx` 函数，被调用方不自行提交。
4. 依赖无环（见 `docs/02-solution/overview.md` §3.4）；studio 只依赖 platform，业务模块向 studio 注册自己的任务处理器。
