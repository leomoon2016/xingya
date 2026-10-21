# 星星（stars）· 需求

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。


职责：只追加星星流水与余额缓存、发放与扣除、商店购买与穿戴、宠物陪伴、家长定义的现实奖励与兑换审批。

## 4.1.8 星星来源（仅此 5 种）
| 来源 | 流水 kind | 数量 | 计入排行榜 |
| --- | --- | --- | --- |
| 首次通过或星级提高 | `level_pass` | 1–3（差额） | 是 |
| 完成当日复习 | `review_day` | 2 | 是 |
| 连续天数里程碑 | `streak` | 3 / 7 / 20 | 是 |
| 家长手动奖励 | `parent_award` | 1–50 / 次，只能加 | 否 |
| 收到赠送 | `gift_in` | 1–20 | 否 |

点喇叭、看卡片、登录、聊天等被动行为一律不发星。支出类：`purchase`、`gift_out`、`redeem_hold`（冻结）、`redeem_release`（释放）、`redeem_debit`（批准扣除）。

## 4.2.1 账本与余额
- `star_ledger` 只追加：每行 `delta`（正负号由 kind 决定，CHECK 约束）、`balance_after ≥ 0`、`source_key`（同一孩子唯一，业务级幂等）、`local_date`。
- **可用余额 = 该孩子全部流水 `SUM(delta)`**。`star_balances` 是同一事务内维护的缓存，同时充当该孩子的行锁；每晚对账（[§3.6](../../02-solution/overview.md)）。没有任何“直接改余额”的接口或 SQL。
- “冻结中”= 该孩子待审批兑换的价格之和（`redemptions.status='pending'`）。孩子界面显示“可用 N 颗，冻结 M 颗”。

## 4.2.2 商店、装扮与宠物
- 物品（装扮：`head`/`body`/`accessory` 三个槽位；宠物：`pet` 槽）在课程包 `economy/shop.json` 定义：ID、名称、价格、图片、`artSource`（必须为原创或已授权，校验器拒绝第三方 IP 关键词）。
- 购买 `POST /shop/purchases {itemId, expectedPrice}`：服务端读取**当前**价格；与 `expectedPrice` 不同 → `409 PRICE_CHANGED`（返回新价格，孩子确认后重试）；已退役 → `404`；已拥有 → `409 ALREADY_OWNED`；余额不足 → `409 INSUFFICIENT_STARS`。成功则同一事务写 `purchase` 流水（`source_key = purchase:{itemId}`）与 `child_items`。
- 每件物品每个孩子只能买一次；无退货、无转赠。退役物品不再出售，已拥有的仍可穿戴。
- 穿戴：`PUT /me/equipment {slot, itemId | null}`；每个槽位最多一件（唯一键）。宠物可收藏多只，`pet` 槽中的一只陪伴头像显示。无喂食、饥饿、等级、亲密度。

## 4.2.3 现实奖励兑换
- 家长维护本家庭的奖励清单（标题 ≤40 字、星价 1–2000、启用/停用，乐观锁）。
- 孩子申请 → 冻结；家长批准 → 扣除；拒绝 → 释放；孩子可撤回待审批申请 → 释放。每个孩子最多 3 个待审批申请。
- 申请时同样做价格复核（`expectedPrice`）；申请单保存标题与价格快照，之后家长改价不影响已申请的单。

> 时序图见 [星星模块设计](../../03-design/modules/stars.md)。
