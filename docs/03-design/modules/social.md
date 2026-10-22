# 社交（social）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。

> 2026-10-22 回归老系统（[ADR 0020](../../adr/0020-revert-to-old-system.md)）：星星伙伴列表（跨家庭只显示昵称与头像 ⚠）、家庭内信件（主题 + 500 字、不限条数）、信箱；系统通知表在 family。依赖：stars（赠星）、companion（赠送伙伴、伙伴列表的跟随伙伴）、discovery（伙伴列表的收藏数，只读）、family；只有 controls 与 reports 只读调用 social，依赖无环。

## 职责

周排行榜、星星伙伴列表、赠送星星、家庭内信件与跨家庭短语消息、信箱聚合（信件 + family 的系统通知）、好友家庭、举报与屏蔽。

## 拥有的表

family_friendships, gifts, messages, blocks, abuse_reports

列与约束见 [数据模型 §6.1](../data-model.md)。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/social/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`；单元测试在 `apps/api/test/unit/social/`。

## 接口（原 §3.5）

以 TypeScript 签名表示（省略 `Promise<>`；`P` = 已鉴权主体 Principal；`Tx` = Kysely 事务）。

**social**

```ts
getLeaderboard(viewer, scope: 'family' | 'friends' | 'all', isoWeek): Board
listPartners(child): PartnerCard[]                    // 家庭内：昵称、头像、年级、跟随伙伴、星级荣誉、收藏数；好友家庭：只有昵称与头像（ADR 0020 R6）
giftPet(child, {childPetId, toChildId})               // 路由 POST /companion/pets/:id/gifts 由本模块处理：先校验跨家庭前提（好友、双方开启、未屏蔽），再调 companion.transferPetInTx
getInbox(viewer, cursor): {letters, notifications, unread}
sendGift(child, {toChildId, amount})                  // 内部调用 stars.debitInTx/creditInTx
listContacts(child) / listConversation(viewer, withPrincipal, cursor)
sendMessage(sender, {to, kind, subject?, body? | phraseKey? | emojiKey?}) / markRead(viewer, messageId)   // 家庭内信件 subject ≤ 60、body ≤ 500，过滤个人信息；跨家庭只能短语 / 表情，每天 ≤ 50
reportMessage(reporter, messageId, {reason, note?}) / block(actor, childId) / unblock(p, blockId)
requestFriendship(p, friendCode) / decideFriendship(p, id, decision, version) / endFriendship(p, id)
listIncomingFriendRequests(familyId) / listChildMessagesForParent(p, childId, cursor)
adminListReports(status) / adminResolveReport(admin, id, action, note)
```

## 端点

见 [API 概要 §5.3](../api.md) 中“social”一组。

## 需求

见 [社交 · 需求](../../01-requirements/modules/social.md)。
