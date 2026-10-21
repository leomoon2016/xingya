# 星星（stars）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。


## 职责

只追加星星流水与余额缓存、发放与扣除、商店购买与穿戴、宠物陪伴、家长定义的现实奖励与兑换审批。

## 拥有的表

star_ledger, star_balances, child_items, reward_options, redemptions

列与约束见 [数据模型 [§6.1](../data-model.md)](../data-model.md)。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/stars/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`、`*.test.ts`。

## 接口（原 §3.5）

以 TypeScript 签名表示（省略 `Promise<>`；`P` = 已鉴权主体 Principal；`Tx` = Kysely 事务）。

**stars**

```ts
getBalance(childId): {available, held}
listLedger(familyId, childId, cursor)
creditInTx(tx, {familyId, childId, kind, delta, sourceKey, localDate, actorParentId?, note?}): LedgerEntry
debitInTx(tx, …同上): LedgerEntry                     // 余额不足 → INSUFFICIENT_STARS
parentAward(p, childId, {amount, note})
purchase(child, {itemId, expectedPrice}) / setEquipment(child, {slot, itemId | null}) / listOwned(childId)
listRewardOptions(familyId) / createRewardOption(p, …) / updateRewardOption(p, id, patch & {version})
requestRedemption(child, {rewardOptionId, expectedPrice}) / cancelRedemption(child, id)
decideRedemption(p, id, {decision: 'approve' | 'reject', note?, version})
listPendingRedemptions(familyId)
verifyBalances(): Mismatch[]                          // 夜间对账
```

## 时序

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
  S->>DB: 待审批数 < 3；SELECT star_balances FOR UPDATE；可用 ≥ 价格 否则 409 INSUFFICIENT_STARS
  S->>DB: INSERT redemptions(pending, 快照)
  S->>DB: INSERT star_ledger(redeem_hold, −价格, redemption:{id}:hold)；UPDATE star_balances
  API->>DB: 写幂等响应；COMMIT
  API-->>K: 已提交，等待家长确认（可用余额减少，冻结增加）
  P->>API: GET /approvals（审批收件箱）
  P->>API: POST /redemptions/{id}/decision {approve|reject, version}（请求 ID R2）
  API->>DB: BEGIN；INSERT idempotency(R2)
  API->>S: decideRedemption
  S->>DB: SELECT redemptions … FOR UPDATE；status ≠ pending → 409 ALREADY_DECIDED；version 不符 → 409 VERSION_CONFLICT
  S->>DB: SELECT star_balances FOR UPDATE
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

见 [API 概要 [§5.3](../api.md)](../api.md) 中“stars”一组。

## 需求

见 [星星 · 需求](../../01-requirements/modules/stars.md)。
