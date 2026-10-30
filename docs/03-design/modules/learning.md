# 学习（learning）· 模块设计

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../../README.md)）。
> 2026-10-21 设计变更（用户已批准，见 [v1.0 变更记录](../../06-releases/v1.0/changes.md)）：整批提交改为作答（plays）三步：开始（只下发可见部分）→ 逐题作答（服务端判分反馈）→ 完成（一次结算，含碎片、伙伴经验、藏匿点）。
> 2026-10-22 单词本（用户决定，[ADR 0019](../../adr/0019-wordbook-as-old-system.md)）：照旧系统实现，新增 5 张表与 `/wordbook/*` 端点，见下方“单词本”。
> 2026-10-21 单元层（[ADR 0016](../../adr/0016-unit-layer.md)）：路线图按单元分组；单元在课程内、关卡在单元内顺序解锁；进度键改为 `(course_id, unit_key, level_key)`；新增 `unit_progress`。
> 2026-10-22 回归老系统（[ADR 0020](../../adr/0020-revert-to-old-system.md)）：作答不过期（删除 `expires_at` 与 `learning.play_ttl_minutes`，同一关同时只有一次未完成作答）；学习卡与学习卡碎片（通关不再发碎片）；新星级规则（按错题数：0 → 3、1 → 2、≥ 2 → 1，没有未通过，用户 2026-10-22）；隐藏奖励（`hidden_reward_claims`）与秘密路线（`secret_routes`、`plays.kind = secret`）；学习足迹与孩子自选课程；单词星算学习星、完成一轮算学习日。

## 职责

课程路线图（单元 > 关卡）与解锁、启思大陆总览、单元进度、学习卡、作答、最佳星级、隐藏奖励与秘密路线、义项与错题的间隔复习、连续学习天数、学习足迹、单词本（ADR 0019）。

## 拥有的表

plays, level_progress, unit_progress, attempts, review_items, review_sessions；单词本：word_identities, word_entries, word_book_progress, word_tasks, word_random_draws；隐藏奖励与秘密路线：hidden_reward_claims, secret_routes（共 13 张）

列与约束见 [数据模型 §6.1](../data-model.md#61-表清单82-张)。

## 边界

- 其他模块只能通过本模块的 `index.ts` 调用它（[§3.4](../../02-solution/overview.md#34-模块与边界规则) 边界规则）；`repo.ts` 只访问上面列出的表。
- 计划文件：`apps/api/src/modules/learning/` 下的 `index.ts`、`routes.ts`、`service.ts`、`repo.ts`；单元测试在 `apps/api/test/unit/learning/`。
- 依赖：controls（开放与时长）、content（版本、题目、判分）、stars（星星与碎片）、companion（经验）、discovery（藏匿点）、studio（启动时注册呀哈哈队长的只读工具 `child.learned_words`：只返回会话孩子已学的义项文本与中文释义，最多 50 个，无参数，见 [agents.md](agents.md#工具目录v10)）。

## 接口

以 TypeScript 签名表示（省略 `Promise<>`；`P` = 已鉴权主体 Principal；`Tx` = Kysely 事务）。

```ts
getCourseMap(child, courseId): {units: UnitState[], yahahaLeftToday}   // 单元 locked | open | completed，含 levels: LevelState[]（locked | open | passed(stars)）；按 (unit_key, level_key)
getCourseOverview(child, courseId): OverviewView                        // 启思大陆总览
startLevelPlay(child, levelId, requestId): PlayView                         // 学习卡、可见题目、打乱后的选项、素材 CDN 地址；已有未完成作答时返回它
cardSeen(child, playId, cardKey): {fragmentsDelta}                        // 学习卡首次展示碎片（每次作答每张卡一次）
abandon(child, playId): void                                                // “重新开始”
listSecretRoutes(child, courseId, unitKey): SecretRouteView[]
startSecretPlay(child, courseId, unitKey, route, {expectedFee}, requestId): PlayView   // 第一次扣入场费
getFootprint(child): FootprintView                                          // 学习足迹
overviewForParent(familyId, childId, courseId) / knowledgeGraph(familyId, childId, courseId)   // 家长中心学习全览与知识图谱
startReviewPlay(child, requestId): PlayView                                 // ≤ 20 − 今日已复习
answer(child, playId, {questionRef, response}): {correct?, reveal?}      // 每题只记第一次
finish(child, playId): AttemptResult | ReviewResult                         // 幂等：重复返回第一次的结果
getReviewSummary(child): {dueToday, doneToday, remainingToday, completedToday}
getStreak(child): {current, longest, todayCounts}
statsForDay(familyId, childId, date): LearningDayStats                      // 供 reports 聚合（含首次完成单元数）
unitProgress(familyId, childId): UnitProgressView[]                         // 供家长中心与周报：各课程各单元进度
purgeAbandonedPlays(now)                                                    // 调度任务：清理 90 天前已放弃的作答（作答不过期，没有 expirePlays）
```

- `plays.items` 记录本次下发的题目 ID（或复习生成题的义项与选项）以及每题的选项顺序；`plays.responses` 按题记录第一次作答与对错。`answer` 在 `plays` 行锁内检查“该题已有作答则直接返回已记录结果”。
- **不过期**（旧系统，Q6）：没有有效期；生成列 `open_slot` + `UNIQUE(child_id, open_slot)` 保证同一关（同一条秘密路线、复习）同时只有一次未完成作答，再次开始返回原作答。课程发布新版本后，旧版本上的未完成作答仍可完成（按开始时的版本判分），孩子也可以“重新开始”（`abandoned`）。
- **学习卡**：开始作答时随可见题目下发当前版本该关的 `learning_cards`（关卡卡）；`cardSeen` 在 `plays` 行锁内确认卡属于本次作答，然后 `creditInTx(fragment, learning_card, randomInt(1,4), card:{playId}:{cardKey})`（已存在则返回 0）。拓展卡由 `GET /units/:courseId/:unitKey/extension-cards` 下发，不发碎片。
- **星级**（用户 2026-10-22，按错题数）：错 0 题 3；错 1 题 2；错 ≥ 2 题 1。**没有未通过**：每次结算都通关。`attempts` 的生成列复核（3/4、7/8 → 2；6/8、0/4 → 1；5/5 → 3），`attempts` 没有 `passed` 列，`level_progress.best_stars` 为 1–3。
- **隐藏奖励**：结算时若关卡 `hidden_reward` 非空且该孩子该关没有 `hidden_reward_claims` 行（第一次完成必然满足，星级至少 1）→ 插入领取行（每关唯一）并 `creditInTx(star, hidden_reward, n, hidden:{attemptId})`（`double` 的 n = 本次 `level_pass` 差额，为 0 时只写领取行；`fixed` = 20）。
- **秘密路线**：结算后按单元条件（任一关 3 星级 / 通过 ≥ 3 关 / 单元复习累计答对 ≥ 5）`INSERT IGNORE secret_routes(..., discovered_at)`；`startSecretPlay` 在 `secret_routes FOR UPDATE` 内，第一次写 `entered_at` 并 `debitInTx(star, secret_entry, fee, secret:entry:{child}:{course}:{unit}:{route})`；作答题目 = 来源关卡前 3 道计分题；3 题全对且 `passed_at` 为空 → 写 `passed_at`、`creditInTx(star, secret_reward, 2 × fee, secret:reward:{attemptId})`、伙伴经验与附赠积分。
- 完成要求全部题目已作答（`409 PLAY_INCOMPLETE`）。
- **解锁**（按当前版本 `courseOutline`）：第 1 单元第 1 关始终可玩；单元内第 k 关在第 k−1 关已通过后解锁；第 N+1 单元在第 N 单元已完成（`unit_progress.first_completed_at` 非空）后解锁。`first_completed_at` 一旦写入不再清除，所以新版本给已完成单元加关卡时，后面的单元不会重新锁上（新增关卡在本单元内照常按顺序解锁）。
- **单元进度**：每次结算（= 通关）后在同一事务内按当前版本该单元的关卡列表重算 `level_count`、`levels_passed`、`levels_three_star`；`levels_passed = level_count` 且 `first_completed_at` 为空 → 写入（返回 `unitCompleted`）；`levels_three_star = level_count` 且 `first_all_three_star_at` 为空 → 写入，并把 `trigger.unitFirstAllThreeStar = true` 传给 discovery（只触发一次）。

## 时序：开始 → 作答 → 完成

```mermaid
sequenceDiagram
  autonumber
  participant C as 孩子端
  participant API as Fastify 路由
  participant CT as controls
  participant L as learning
  participant CO as content
  participant S as stars
  participant CP as companion
  participant D as discovery
  participant DB as PostgreSQL
  C->>API: POST /levels/:levelId/plays（X-Client-Request-Id: R）
  API->>CT: checkAccess(child, 'start')
  API->>L: startLevelPlay
  L->>CT: isCourseOpen；L 检查解锁（所在单元已解锁且单元内前一关已通过）
  L->>CO: getLevel(当前版本) → 可见部分
  L->>L: crypto 打乱每题选项顺序，并把选项/词块 ID 换成本次作答的随机令牌（映射存 items）
  L->>CP: getCompanion(child) → 跟随伙伴等级（没有则 NULL）
  L->>DB: INSERT plays(version, level, items, companion_level)（R 唯一，重放返回同一作答；open_slot 唯一：已有未完成作答则返回它）
  API-->>C: {playId, cards(学习卡), questions(可见部分)}
  opt 每张学习卡第一次展示
    C->>API: POST /plays/:id/cards/:cardKey/seen
    API->>L: cardSeen → S.creditInTx(fragment, learning_card, 1–3, card:{playId}:{cardKey})
  end
  loop 每一题
    C->>API: POST /plays/:id/answers {questionId, response}
    API->>CT: checkAccess(child, 'submit')
    API->>L: answer → BEGIN；plays FOR UPDATE；状态 open
    alt 该题已有作答
      L-->>API: 返回已记录的结果
    else 第一次
      L->>CO: gradeInTx(questionId, response)
      L->>DB: UPDATE plays.responses；COMMIT
    end
    API-->>C: {correct, correctOptionId/answer, explanation, reveal}
  end
  C->>API: POST /plays/:id/finish（请求 ID R2）
  API->>CT: checkAccess(child, 'submit')
  API->>DB: BEGIN；INSERT idempotency(R2)
  API->>L: finishInTx
  L->>S: lockBalancesInTx(child: star → fragment → point)（锁顺序 ②，见 nfr §4.5.2）
  L->>DB: plays FOR UPDATE（全部已答）；SELECT level_progress、unit_progress … FOR UPDATE
  L->>DB: INSERT attempts（生成列按新规则复核星级；play_id 唯一）
  L->>DB: UPSERT level_progress(course, unit_key, level_key)；复习入队（义项 / 无义项的错题）
  L->>DB: UPSERT unit_progress（重算计数；首次完成 / 首次全 3 星级时间只写一次）
  opt awarded > 0
    L->>S: creditInTx(star, level_pass, awarded, attempt:{id})
  end
  opt 关卡有隐藏奖励且本孩子未领过（第一次完成）
    L->>DB: INSERT hidden_reward_claims（每孩子每关唯一）
    L->>S: creditInTx(star, hidden_reward, n, hidden:{attemptId})（n > 0 时）
  end
  opt 学习星合计 > 0（通关差额 + 隐藏奖励）
    L->>CP: addXpInTx(child, 学习星合计)
    opt plays.companion_level 不为空（开始作答时有跟随伙伴）
      L->>S: creditInTx(point, pet_bonus, 学习星合计 × petRateUnits(companion_level), petbonus:attempt:{id})（ADR 0017）
    end
  end
  Note over L: 每次结算都通关（没有未通过，用户 2026-10-22）
  L->>D: placeSpotsInTx(attempt, unitKey, levelKey, trigger) → 3 个 hiding_spots（通关不再发碎片）
  L->>DB: INSERT IGNORE secret_routes（满足出现条件的路线写 discovered_at）
  opt 单元首次全 3 星级（first_all_three_star_at 本次写入）
    L->>D: placeUnitMilestoneSpotInTx(child, course, unitKey)（必得，每孩子每单元一次；放不下记待领取）
  end
  L->>L: 连续天数；里程碑 → S.creditInTx(star, streak) + CP.addXpInTx
  L->>DB: plays → finished；写幂等响应；COMMIT
  API-->>C: {accuracy, stars, awarded, hiddenReward, xp, petPoints, spots(只有编号与位置), secretRoutesFound, nextLevelUnlocked, unitCompleted, nextUnitUnlocked, streak}
```

复习作答相同：`POST /review/plays` 开始，同样的 `answers` 与 `finish`；完成时写 `review_sessions`（`play_id` 唯一）、更新盒与到期日；对每个答对的条目 `creditInTx(point, review_correct, 100, review_correct:{date}:{reviewItemId})`（已存在则跳过；当天该 kind 合计达到 30 积分后不再写，在积分余额行锁内计数）；“今日完成”时只发 `fragment review_day 2`。复习不发星星、不加伙伴经验（ADR 0017）。

听发音：`POST /plays/:id/listen {target}` → BEGIN；`lockBalancesInTx(child, [point])`；`plays FOR UPDATE`；`status = 'finished'` → `409 PLAY_FINISHED`；`target` 必须能在 `plays.items` 中找到且带音频（否则 400）；`creditInTx(point, level_listen, 10, listen:{playId}:{target})`，重复返回 `{awarded:false}`；COMMIT。不经幂等表（`source_key` 已保证只发一次）。

## 单词本（ADR 0019）

```ts
listWords(child, {q, status, cursor}): WordPage                // 考试中只返回词形
createWord / updateWord(child, input & {version}) / deleteWord(child, id, version)
explainWord(child, word): WordExplanation                      // 调 studio.runChildSkill('word-explain')；不写库
listenWord(child, {text, source, entryId?, taskId?}): ListenResult
startWordTask(child, {mode, entryIds?, sound}, requestId): WordTaskView
answerWordTask / advanceWordTask / finishWordTask / abandonWordTask
reconcileWordRewards(child): SpotView[]
isWordExamActive(child): boolean                               // chat 与 explain 在调用模型前检查
```

- **归一化与词身份**：`normalize = NFKC → trim → 合并空白 → toLowerCase`；新增或改单词时 `INSERT IGNORE word_identities(child, normalized)` 取得身份，再写 `word_entries`。重复会被 `uq_word_entries_child` 拦下（返回 `409 WORD_DUPLICATE`）。条数上限在 `word_book_progress` 行锁内用 `COUNT(*)` 检查。
- **文字过滤**：每个文本字段先过 `chat.filterChildText`（与呀哈哈队长的输入过滤共用同一个函数与词表）；个人信息规则命中 → `400 TEXT_BLOCKED`。
- **开始**（一个事务）：
  1. 锁定 `word_book_progress`，没有这一行就先插入。
  2. 检查没有进行中的一轮（生成列唯一键兜底）。
  3. 选词，用 `crypto.randomInt` 出题；干扰项来自自己的词条和 `content.sensesForOpenCourses(child)`。
  4. 快照写入 `snapshot`，包括题目、答案、`settings.probabilityBps` 与 `grade`。闯关时把跟随伙伴等级写入 `companion_level`。
  5. 返回可见部分。
- **作答**：`word_tasks FOR UPDATE`，然后检查 `expectedRevision`。学习和闯关模式只能答当前题，每题只记一次（再答 → 409），返回对错与解释，再用 `advance` 进入下一题。考试模式可以答任意题，交卷前可以修改答案，与旧系统一致（`server/wordbook-study/tasks.mjs`）。
- **结算**（锁顺序：幂等行 → `balances` star → fragment → point → `word_tasks` → `word_book_progress` → `word_identities` 按 id 升序 → `hiding_spots`；与 nfr §4.5.2 一致）：
  1. 判分。
  2. 按词更新状态与 `first_passed_at`。
  3. 闯关或考试：`best = max(best, tier)`，新增单位加余量；`floor/5` 颗星写入 `stars.creditInTx(star, word_{mode}, n, word:{taskId})`，余数写回。
  4. 闯关得星时写入 `pet_bonus`，`source_key = petbonus:word:{taskId}`。
  5. 里程碑：`floor(首次学会数 / 5)` 与已放置的里程碑藏匿点比较，逐个调用 `discovery.placeWordSpotInTx({milestoneNo})`。
  6. 随机：得分 ≥ 80% 且模式不是学习时，先插入本轮每个词的 `word_random_draws`；遇到重复则本轮不判定。然后依次检查开关 → 当天单词本随机次数 < `daily_limit` → 抽签（`randomInt(10000) < probabilityBps`），中签后调用 `discovery.placeWordSpotInTx({wordTaskId})`。
  7. 写入 `result`，状态改为 `completed`。
  8. 更新连续天数（完成一轮单词本算学习日，用户 2026-10-22）；单词星是学习星，同一事务给跟随伙伴加经验（`companion.addXpInTx`）。
- **听发音**：锁定 `balances(child, point)`，校验 `text` 属于该词条的发音目标，或属于进行中的一轮（考试除外）的题目和选项；然后检查当天 10 积分上限和 5 秒冷却，写入 `word:{date}:{sha256(normalized)}`，重复时返回 `{awarded:false}`。
- 依赖：stars（发星、积分）、companion（等级快照）、discovery（`placeWordSpotInTx`）、studio（`runChildSkill`）、chat（文字过滤）、content（干扰项义项与词库音频地址）。

## 端点

见 [API 概要 §5.3](../api.md#53-端点按模块) 中“content / learning”一组。

## 需求

见 [学习 · 需求](../../01-requirements/modules/learning.md)。
