# 社交（social）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。


## 职责

周排行榜、赠送星星、家庭内与跨家庭消息、好友家庭、举报与屏蔽。

## 拥有的表

family_friendships, gifts, messages, blocks, abuse_reports

列与约束见 [数据模型 [§6.1](../data-model.md)](../data-model.md)。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/social/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`、`*.test.ts`。

## 接口（原 §3.5）

以 TypeScript 签名表示（省略 `Promise<>`；`P` = 已鉴权主体 Principal；`Tx` = Kysely 事务）。

**social**

```ts
getLeaderboard(viewer, scope: 'family' | 'friends' | 'all', isoWeek): Board
sendGift(child, {toChildId, amount})                  // 内部调用 stars.debitInTx/creditInTx
listContacts(child) / listConversation(viewer, withPrincipal, cursor)
sendMessage(sender, {to, kind, body? | phraseKey? | emojiKey?}) / markRead(viewer, messageId)
reportMessage(reporter, messageId, {reason, note?}) / block(actor, childId) / unblock(p, blockId)
requestFriendship(p, friendCode) / decideFriendship(p, id, decision, version) / endFriendship(p, id)
listIncomingFriendRequests(familyId) / listChildMessagesForParent(p, childId, cursor)
adminListReports(status) / adminResolveReport(admin, id, action, note)
```

## 端点

见 [API 概要 [§5.3](../api.md)](../api.md) 中“social”一组。

## 需求

见 [社交 · 需求](../../01-requirements/modules/social.md)。
