# 星星（stars）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。
> 2026-10-21 设计变更（用户已批准，见 [v1.0 变更记录](../../06-releases/v1.0/changes.md)）：`star_ledger`/`star_balances` 改为 `ledger`/`balances`，增加 `currency`（星星、碎片，[ADR 0011](../../adr/0011-fragments-second-currency.md)）；商店物品表 `shop_items` 归本模块（只卖装扮）；伙伴移到 companion。

## 职责

只追加账本（星星、碎片与积分，ADR 0017）与余额缓存、发放与扣除、积分换星、商店装扮购买与穿戴、家长定义的现实奖励与兑换审批、夜间对账。

## 拥有的表

ledger, balances, shop_items, child_items, reward_options, redemptions

列与约束见 [数据模型 §6.1](../data-model.md#61-表清单72-张)。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md#34-模块与边界规则) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/stars/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`；单元测试在 `apps/api/test/unit/stars/`。
- 依赖：family（孩子、家长）、studio（装扮图片素材只读）。不依赖 content。

## 接口

以 TypeScript 签名表示（省略 `Promise<>`；`P` = 已鉴权主体 Principal；`Tx` = Kysely 事务）。

```ts
type Currency = 'star' | 'fragment' | 'point'          // point 以 0.01 积分为单位
getBalances(childId): {stars: {available, held}, fragments, points}
getPointsSummary(childId, localDate): {points, reviewToday, wordListenToday, nextWordListenAt?}   // 今日复习积分 /30、单词本听读 /10
convertPoints(child, {stars}): {pointsSpent, starsGained, balances}   // 10 积分 = 1 星，1–1000；不足 → INSUFFICIENT_POINTS
petRateUnits(level): number                            // 旧系统节点 (1,10)(20,20)(40,35)(60,55)(80,75)(100,100) 分段线性
listLedger(familyId, childId, {currency?, cursor})
creditInTx(tx, {familyId, childId, currency, kind, delta, sourceKey, localDate, actorParentId?, note?}): LedgerEntry | 'duplicate'
debitInTx(tx, …同上): LedgerEntry                    // 余额不足 → INSUFFICIENT_STARS / INSUFFICIENT_FRAGMENTS
lockBalancesInTx(tx, childId, currencies[]): void     // 按 star → fragment → point 顺序加行锁（不存在则插入 0 余额行）
learningStarsTotal(childId): number                  // SUM(delta) WHERE counts_for_leaderboard = 1（companion 门槛）
parentAward(p, childId, {amount, note})
listShopItems() / purchase(child, {itemId, expectedPrice}) / setEquipment(child, {slot, itemId | null}) / listOwned(childId)
adminUpsertShopItem(admin, item & {version}) / importShopSeed(file)
listRewardOptions(familyId) / createRewardOption(p, …) / updateRewardOption(p, id, patch & {version})
requestRedemption(child, {rewardOptionId, expectedPrice}) / cancelRedemption(child, id)
decideRedemption(p, id, {decision: 'approve' | 'reject', note?, version})
listPendingRedemptions(familyId)
verifyBalances(): Mismatch[]                         // 夜间对账（三个币种）
```

- `creditInTx`/`debitInTx` 在 `balances(child_id, currency)` 行锁内计算 `balance_after`；同一事务涉及多个币种时按 `star` → `fragment` → `point` 加锁。
- 积分的每日上限（复习 30、单词本 10）与单词本 5 秒冷却在 `balances(child, point)` 行锁内按当天流水计数判断（与旧系统同为服务端判断，不另建表）；每个目标只发一次由 `source_key` 唯一键保证。
- 换星：一个事务内先锁 `star` 再锁 `point`，写 `point point_convert −stars×1000` 与 `star point_convert +stars`，两行 `source_key` 都是 `convert:{请求 ID}`；外层幂等表保证重放返回第一次结果。`source_key` 冲突返回 `'duplicate'`（调用方据此跳过，例如“同一关当天已发过碎片”）。
- 碎片的 kind 只允许 `level_pass`、`review_day`、`discovery`（入）与 `pet_adopt`（出）；积分只允许 `level_listen`、`word_listen`、`review_correct`、`pet_bonus`（入）与 `point_convert`（出）；星星新增 `word_challenge`（1–30）与 `word_exam`（1–20）两种奖励星（ADR 0019），`pet_bonus` 单次上限 3000 单位；星星不再有 `review_day`。均由数据库 CHECK 保证；接口层也拒绝其他组合。

## 时序：兑换（冻结 → 批准/拒绝）

```mermaid
sequenceDiagram
  autonumber
  participant K as 孩子端
  participant P as 家长端
  participant API as 服务
  participant S as stars
  participant DB as MySQL
  K->>API: POST /redemptions {rewardOptionId, expectedPrice}（请求 ID R1）
  API->>DB: BEGIN；INSERT idempotency(R1)
  API->>S: requestRedemption
  S->>DB: 读奖励项（同家庭、启用）；价格 ≠ expectedPrice → 409 PRICE_CHANGED
  S->>DB: 待审批数 < 3；SELECT balances(child, star) FOR UPDATE；可用 ≥ 价格 否则 409 INSUFFICIENT_STARS
  S->>DB: INSERT redemptions(pending, 快照)
  S->>DB: INSERT ledger(star, redeem_hold, −价格, redemption:{id}:hold)；UPDATE balances
  API->>DB: 写幂等响应；COMMIT
  API-->>K: 已提交，等待家长确认（可用余额减少，冻结增加）
  P->>API: GET /approvals（审批收件箱）
  P->>API: POST /redemptions/{id}/decision {approve|reject, version}（请求 ID R2）
  API->>DB: BEGIN；INSERT idempotency(R2)
  API->>S: decideRedemption
  S->>DB: SELECT redemptions … FOR UPDATE；status ≠ pending → 409 ALREADY_DECIDED；version 不符 → 409 VERSION_CONFLICT
  S->>DB: SELECT balances(child, star) FOR UPDATE
  alt 批准
    S->>DB: INSERT redeem_release(+价格) 与 redeem_debit(−价格)（净额 0，冻结变为正式扣除）
    S->>DB: UPDATE redemptions SET status='approved', decided_by, decided_at, version+1
  else 拒绝
    S->>DB: INSERT redeem_release(+价格)
    S->>DB: UPDATE redemptions SET status='rejected' …
  end
  API->>DB: 写幂等响应；COMMIT
  API-->>P: 完成；孩子端下次刷新看到结果
```

## 端点

见 [API 概要 §5.3](../api.md#53-端点按模块) 中“stars”一组。

## 需求

见 [星星 · 需求](../../01-requirements/modules/stars.md)。
