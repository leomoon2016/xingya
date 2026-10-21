# 星星（stars）· 需求

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。
> 2026-10-21 设计变更（用户已批准，见 [v1.0 变更记录](../../06-releases/v1.0/changes.md)）：账本改名为 `ledger` 并增加 `currency`，碎片作为第二币种记入同一本只追加账本（[ADR 0011](../../adr/0011-fragments-second-currency.md)）；新增星星来源“发现奖励”与支出“领养伙伴/扩建营地”；商店只卖装扮，伙伴移到 [companion](companion.md)。

职责：只追加账本（星星与碎片）与余额缓存、发放与扣除、商店装扮购买与穿戴、家长定义的现实奖励与兑换审批。

## 4.1.8 星星来源（仅此 6 种）
| 来源 | 流水 kind | 数量 | 算“学习星”（排行、伙伴经验、领养门槛） |
| --- | --- | --- | --- |
| 首次通过或星级提高 | `level_pass` | 1–3（差额） | 是 |
| 完成当日复习 | `review_day` | 2 | 是 |
| 连续天数里程碑 | `streak` | 3 / 7 / 20 | 是 |
| 呀哈哈发现奖励（集齐套组、累计里程碑） | `discovery_bonus` | 1–50 | 否 |
| 家长手动奖励 | `parent_award` | 1–50 / 次，只能加 | 否 |
| 收到赠送 | `gift_in` | 1–20 | 否 |

点喇叭、看卡片、登录、聊天等被动行为一律不发星。星星支出：`purchase`（装扮）、`pet_adopt`（用星星领养伙伴）、`den_expand`（扩建营地）、`gift_out`、`redeem_hold`（冻结）、`redeem_release`（释放）、`redeem_debit`（批准扣除）。

碎片来源与用途见 [companion 需求 §4.6.2](companion.md#462-碎片第二种货币)：只来自 `level_pass`、`review_day`、`discovery`，只用于 `pet_adopt`。

## 4.2.1 账本与余额
- `ledger` 只追加：每行 `currency`（`star` / `fragment`）、`kind`、`delta`（正负号由 kind 决定，CHECK 约束）、`balance_after ≥ 0`（该币种余额）、`source_key`（同一孩子同一币种唯一，业务级幂等）、`local_date`。数据库 CHECK 规定每个币种允许哪些 kind、每个 kind 的数量范围。
- **可用余额 = 该孩子该币种全部流水 `SUM(delta)`**。`balances`（主键 `(child_id, currency)`）是同一事务内维护的缓存，同时充当行锁；每晚对账（[§3.6](../../02-solution/overview.md#36-后台任务进程内调度器单实例)）。没有任何“直接改余额”的接口或 SQL。
- 一个操作同时涉及两个币种时（例如通关同时发星与碎片），按固定顺序先锁 `star` 行再锁 `fragment` 行（[§4.5.2](../nfr.md)）。
- “冻结中”= 该孩子待审批兑换的价格之和（`redemptions.status='pending'`）。孩子界面显示“可用 N 颗，冻结 M 颗”，以及碎片余额。

## 4.2.2 商店与装扮
- 装扮（`head`/`body`/`accessory` 三个槽位）由系统管理员在后台维护：ID、名称、价格（1–1000）、图片（素材库）、上架/下架；初始数据来自仓库 `content/shop/`。图片必须原创或已授权（提示词禁止词表同样适用于上传的名称与描述）。
- 购买 `POST /shop/purchases {itemId, expectedPrice}`：服务端读取**当前**价格；与 `expectedPrice` 不同 → `409 PRICE_CHANGED`（返回新价格，孩子确认后重试）；已下架 → `404`；已拥有 → `409 ALREADY_OWNED`；余额不足 → `409 INSUFFICIENT_STARS`。成功则同一事务写 `purchase` 流水（`source_key = purchase:{itemId}`）与 `child_items`。
- 每件物品每个孩子只能买一次；无退货、无转赠。下架物品不再出售，已拥有的仍可穿戴。
- 穿戴：`PUT /me/equipment {slot, itemId | null}`；每个槽位最多一件（唯一键）。学习伙伴不在商店里，见 [companion 需求](companion.md)。

## 4.2.3 现实奖励兑换
- 家长维护本家庭的奖励清单（标题 ≤40 字、星价 1–2000、启用/停用，乐观锁）。
- 孩子申请 → 冻结；家长批准 → 扣除；拒绝 → 释放；孩子可撤回待审批申请 → 释放。每个孩子最多 3 个待审批申请。
- 申请时同样做价格复核（`expectedPrice`）；申请单保存标题与价格快照，之后家长改价不影响已申请的单。
- 只能用星星兑换，碎片不能兑换。

> 时序图见 [星星模块设计](../../03-design/modules/stars.md)。

## 验收要点
- 星星只有表中 6 种来源、碎片只有 3 种来源；被动行为（点喇叭、看卡片、登录、聊天）不产生任何流水（集成测试遍历这些接口后账本行数不变）。
- 账本只追加：应用数据库账号对 `ledger` 的 UPDATE/DELETE 被拒（[附录 A](../../03-design/data-model.md#附录-a-数据库验证结果)）；任一孩子任一币种 `SUM(delta)` = `balances.balance` = 最后一行 `balance_after`，夜间对账差异为 0。
- 同一 `source_key` 并发或重放只入账一次；余额不足时购买、领养、赠送、兑换均被拒且不写任何流水。
- 购买时价格已变 → `409 PRICE_CHANGED`，孩子确认新价格后重试成功；同一装扮只能买一次；同一槽位只能穿一件。
- 兑换：申请冻结、批准扣除、拒绝或撤回释放，三者之后“可用 + 冻结”与流水一致；每个孩子最多 3 个待审批申请；碎片不能用于兑换。
- 通关同时发星星与碎片时按“星星行 → 碎片行”加锁，并发测试无死锁。
