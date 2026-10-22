# 课程模型（数据库课程、模板、题型、自动检查、发布）

> 本文原为《课程包格式》（规格 §7，提交 6b463ed）。2026-10-21 设计变更（用户已批准，见 [v1.0 变更记录](../06-releases/v1.0/changes.md)）取消课程包：课程存数据库并版本化（[ADR 0008](../adr/0008-db-versioned-courses-word-bank.md)），素材在 OSS/CDN、发布时生成音频（[ADR 0010](../adr/0010-oss-cdn-publish-time-piper.md)）。原校验规则 C1–C13 由本文 §7.4 的 K1–K12 取代（单元层增加 K13，[ADR 0016](../adr/0016-unit-layer.md)）；原 §7.5“旧内容转换”取消。
> 2026-10-21 用户决定（[ADR 0016](../adr/0016-unit-layer.md)）：内容层级为 **年级 > 课程（一册）> 单元 > 关卡 > 题目**；发布与版本仍以整门课程为单位，课程版本包含它的全部单元。
> 2026-10-22 回归老系统（[ADR 0020](../adr/0020-revert-to-old-system.md)）：每关先有**学习卡**（1–50 张），单元可有**拓展卡**；第 10 种题型 `listen_pick_image`；1–2 年级禁 `spell` 与 `reading_choose`；拼写提交前不播放发音（`audioHint` 只给六年级）；答后显示 `reveal`；题目来源 `source`；关卡站点名 `station` 与隐藏奖励 `hiddenReward`（每单元 ≤ 2 关）；旧英语课程可一次性导入为草稿。

## 7. 课程模型

### 7.1 存储位置
| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 词与义项 | `words`、`word_senses` | 全站共享；`en.apple`、`en.bat.animal`；文本/释义不可改 |
| 课程身份 | `courses` | 一册一门课，稳定 ID（如 `en-g1-a` = 一年级上册、`en-g1-b` = 下册）、学科、年级、排序、模板、当前版本 |
| 草稿 | `course_drafts.document`（JSON，§7.3） | 唯一可编辑的地方；含答案与解析 |
| 已发布版本 | `course_versions` → `units` → `levels` → `learning_cards`（学习卡与拓展卡）+ `questions`（可见部分）+ `question_answers`（答案部分与 `reveal`） | 只追加，应用账号不能修改或删除；`unit_key` 版本内唯一，`level_key` 单元内唯一 |
| 素材 | `assets` + OSS | 草稿在 `draft/`，发布时复制到 `pub/`（CDN） |
| 模板定义 | 仓库 `seeds/course-templates/<id>.json` | 随发布包部署（`seeds/`），api 启动时读取、不入库；草稿与版本记录 `template_id` + `template_version` |
| 示例课程 | 仓库 `seeds/samples/english/grade-1/<courseId>.json` | 与 §7.3 草稿文档同一结构；`xingya course:import` 导入为草稿 |
| 旧英语课程 | 运维提供的旧系统课程导出 JSON（不进仓库） | `xingya legacy:import-courses <目录>` 一次性转为草稿（单元、关卡、学习卡、题目、来源页码），仍需审核与发布；不读旧系统数据库、`data` 或配置 |

### 7.2 模板定义（`seeds/course-templates/<id>.json`，Zod 模式在 `packages/seed-schema`）
```jsonc
{
  "id": "word-quest", "templateVersion": 1, "name": "单词闯关课",
  "grades": [1, 2, 3, 4, 5, 6],
  "levelsPerUnit": [3, 6],                         // 每个单元的关卡数；必须落在系统设置 content.unit_levels（默认 3–6）之内
  "unitPlan": [                                    // 每个单元的关卡结构（所有单元相同）：每个元素生成一关或多关
    { "key": "learn",     "title": "认识", "count": 1,
      "mix": { "pick_image": [2, 4], "listen_choose": [2, 4] } },
    { "key": "practice",  "title": "练习", "count": [1, 3],
      "mix": { "pick_image": [1, 3], "listen_choose": [1, 3], "read_aloud": [0, 2] } },
    { "key": "challenge", "title": "挑战", "count": 1,
      "mix": { "listen_choose": [2, 4], "spell": [2, 4] }, "gradeOverrides": { "1-2": { "spell": [0, 0], "listen_pick_image": [2, 4] } } }
  ],
  "questionsPerLevel": [5, 8], "minScoredPerLevel": 4,
  "cardsPerLevel": [1, 50],                        // 每关学习卡数（旧系统：每关必须有学习卡）
  "cardKinds": ["word", "sentence"],               // 本模板允许的学习卡种类（phonics 模板另含 letter、phonics）
  "promptHints": { "analysis": "…", "generation": "…", "imageStyle": "…" }   // 生成提示词片段（不含答案逻辑）
}
```
- 模板描述的是**一个单元**的结构；一门课程的每个单元都按同一模板生成（开放问题 Q27）。单元数不由模板规定，由资料拆分或系统管理员决定（每门课至少 1 个单元）。
- `unitPlan` 各元素 `count` 之和的可能范围必须与 `levelsPerUnit` 相交；`levelsPerUnit` 超出 `content.unit_levels` 的部分无效（以系统设置为准，K13）。
- `mix` 的数值是该题型在一关中的 `[最少, 最多]`；同一关各题型之和必须落在 `questionsPerLevel` 内且计分题 ≥ `minScoredPerLevel`。
- 首发 4 个模板（[studio 需求 §4.8.3](../01-requirements/modules/studio.md#483-课程模板首发-4-个)）：`word-quest`、`sentence-dialogue`（`dialogue_choose`、`order`、`cloze`、`read_aloud`）、`picture-book`（关卡带 `pages`，`reading_choose`、`read_aloud`）、`phonics`（`listen_discriminate`、`listen_choose`、`read_aloud`，年级 1–3）。
- 模板改版 = 新的 `templateVersion`；已有草稿与版本按自己记录的版本解释，不受影响。

### 7.3 草稿文档结构（`course_drafts.document`）
```jsonc
{
  "title": "一年级上册", "instructionLang": "zh", "coverAssetId": 12,
  "units": [{
    "unitKey": "u01", "title": "Unit 1 Fruits", "titleZh": "水果", "coverAssetId": 13,
    "knowledge": {                                   // AI 分析产出、系统管理员可编辑的清单（按单元）
      "senses":   ["en.apple.fruit", "en.pear.fruit", { "draft": { "wordId": "en.peach", "text": "peach", "senseId": "en.peach.fruit", "meaningZh": "桃子" } }],
      "patterns": ["I like …", "Do you like …?"],
      "points":   ["水果类名词", "like 的用法"]
    },
    "levels": [{
      "levelKey": "l01", "title": "认识水果", "sceneAssetId": 30,
      "station": "果园", "hiddenReward": null,      // 站点名（地图分组）；隐藏奖励 "double" | "fixed" | null（每单元 ≤ 2 关）
      "cards": [                                     // 关卡学习卡：先学后练，不计分
        { "cardKey": "c1", "kind": "word", "senseId": "en.apple.fruit",
          "content": { "word": "apple", "meaning": "苹果", "sentence": "I like apples.", "sentenceMeaning": "我喜欢苹果。", "imageAssetId": 41 } }
      ],
      "hidingSpots": [{ "kind": "leaf", "x": 0.18, "y": 0.62 }, { "kind": "rock", "x": 0.55, "y": 0.8 }, { "kind": "cloud", "x": 0.8, "y": 0.2 }],
      "pages": null,                                 // 绘本阅读课：[{imageAssetId, text, audioText}]
      "questions": [
        { "questionKey": "q1", "type": "pick_image", "senseId": "en.apple.fruit",
          "visible": { "imageAssetId": 41, "options": [{ "id": "o1", "senseId": "en.apple.fruit" }, { "id": "o2", "senseId": "en.pear.fruit" }, { "id": "o3", "senseId": "en.peach.fruit" }] },
          "answer": { "optionId": "o1" }, "explanation": "apple 是苹果。",
          "reveal": { "transcript": "apple", "zh": "苹果" }, "source": "一年级上册 第 12 页" }
      ]
    }],                                              // 每个单元 3–6 关（content.unit_levels）
    "extensionCards": [                              // 单元拓展卡（附加听读，可选）：不计分、不发碎片
      { "cardKey": "x1", "kind": "sentence", "content": { "sentence": "Look at the fruit!", "sentenceMeaning": "看这些水果！" } }
    ],
    "extensionTitle": "拓展听读 第 13 页"
  }]                                                 // 单元数组的顺序 = 单元顺序；levels 数组的顺序 = 单元内关卡顺序
}
```
- 单元与关卡的顺序由数组位置决定，发布时写入 `units.seq` 与 `levels.seq`（单元内从 1 开始）。
- “生成单个单元”= 在 `units` 中插入一个新单元（指定位置与 `unitKey`），其余单元不动；删除单元同理。已发布过的 `unitKey` 被删除时需确认（进度保留，但不再显示）。
- `unitKey` 建议用 `u01`、`u02`…；一旦发布就不要改名或复用给别的主题（改名 = 新单元，进度不迁移）。

发布时每题拆成两部分：`visible` → `questions.visible`；`answer` + `explanation` + `reveal` → `question_answers`（`reveal` 只在作答后随反馈返回）；`source` → `questions.source`（只在后台显示）。学习卡 → `learning_cards`（关卡卡 `level_id` 非空，拓展卡 `level_id` 为空）。`visible` 中出现答案字段会被数据库 CHECK 拒绝（`answer`、`accept`、`explanation`、`correct`、`correctOptionId`）。

**10 种题型的两部分**（选项 ID 在题目内唯一且稳定；下发时由 learning 重新打乱顺序，并把选项/词块 ID 替换为本次作答的随机令牌、去掉 `senseId`，映射存在 `plays.items`，见 [learning 设计](modules/learning.md)）：

| 题型 | `visible`（作答前下发） | `answer`（只在服务端，作答后返回） |
| --- | --- | --- |
| `pick_image` | `imageAssetId`、`options[{id, senseId}]`（3–4） | `optionId` |
| `listen_choose` | `audioText`（发布时转 `audioAssetId`）、`options[{id, senseId}]` | `optionId` |
| `spell` | `imageAssetId`、`hintZh`、`length`、`letterTiles?`；`audioAssetId` 只在 `audioHint: true`（六年级）时下发，否则提交后才返回 | `text`、`accept[]` |
| `read_aloud` | `text`、`audioAssetId` | —（无答案，不计分） |
| `dialogue_choose` | `sceneAssetId`、`lines[{speaker, text?, audioAssetId?, blank?}]`、`options[{id, text}]` | `optionId` |
| `order` | `tiles[{id, text}]`（3–6） | `sequence[]`（tile ID 的正确顺序） |
| `cloze` | `sentence`（含一个 `___`）、`options[{id, text}]` | `optionId` |
| `reading_choose` | `pageRef`、`question`、`options[{id, text}]` | `optionId` |
| `listen_discriminate` | `audioAssetId`、`options[{id, label}]`（2–4） | `optionId` |
| `listen_pick_image` | `audioText`（发布时转 `audioAssetId`）、`options[{id, imageAssetId, labelZh}]`（3–4；**选项不带音频**，ADR 0020 R3） | `optionId` |

判分：选择类比较选项 ID；`order` 整个序列相等才算对；`spell` 规范化后与 `text` 或 `accept[]` 之一相同（[learning 需求 §4.1.3](../01-requirements/modules/learning.md#413-题型10-种)）。

### 7.4 自动检查规则（K 规则）
草稿每次修改后运行；任何错误使 `check_passed = 0`，题目在编辑器中标红并写明规则号与原因。示例课程在 CI 中由 `tools/validate-seeds` 运行同一套规则。

| # | 规则 |
| --- | --- |
| K1 | 结构：文档符合 Zod 模式；`unitKey`/`levelKey`/`questionKey` 符合 `^[a-z0-9]+(-[a-z0-9]+)*$`，`unitKey` 在课程内唯一、`levelKey` 在单元内唯一、`questionKey` 在关卡内唯一；已发布过的 `unitKey` 或 `(unitKey, levelKey)` 若删除需确认（进度保留，但不再显示） |
| K2 | 模板：每个单元的关卡序列、每关题型组合与数量符合模板 `unitPlan` 与 `mix`；题型属于模板允许范围 |
| K3 | 每关 5–8 题，计分题（非 `read_aloud`）≥ 4 |
| K4 | 答案在选项中：选择类 `optionId` 存在于 `options`；`order` 的 `sequence` 恰好是全部 tile 的一个排列；选项 ID 不重复 |
| K5 | 年级：1–2 年级课程不得含 `spell` 与 `reading_choose`（旧系统，ADR 0020）；`audioHint: true` 只允许六年级；`phonics` 只用于 1–3 年级；课程年级在模板 `grades` 内 |
| K6 | 重复：同一关两题的题干与答案不得相同；同一题选项文本/义项不得重复 |
| K7 | 干扰项不能过近：干扰项与正确答案规范化后（大小写、空格、撇号）相同、或属于 `accept[]`、或同一义项，均判错；编辑距离 ≤ 1 的拼写型干扰项给出警告（不阻断） |
| K8 | 引用完整：引用的义项存在且未退役（或为本草稿的候选新义项）；`pick_image` 的义项有图、`listen_pick_image` 每个选项有图；需要图片/场景图的题与关卡有素材 |
| K9 | 拼写答案只含字母、空格、撇号、连字符；`text` 长度 ≤ 24 |
| K10 | 可见部分不含答案字段（与数据库 CHECK 一致）；`explanation` ≤ 200 字 |
| K11 | 内容安全：题干、选项、解析、绘本文字不命中安全词表；不含网址、电话等个人信息模式 |
| K12 | 关卡场景：每关有 3 个藏匿点定义（`kind` 属于场景允许的种类，坐标在 0–1） |
| K13 | 学习卡与隐藏奖励：每关学习卡数在模板 `cardsPerLevel`（默认 1–50）内、种类属于 `cardKinds`、`cardKey` 在关卡（或单元拓展卡）内唯一、字母卡例词 ≤ 50；每个单元 `hiddenReward` 非空的关卡 ≤ 2。单元：课程至少 1 个单元；每个单元的关卡数在系统设置 `content.unit_levels`（默认 3–6，Q26）与模板 `levelsPerUnit` 的交集内；单元有标题 |

### 7.5 发布流程
1. 草稿 `in_review` → 审核人点“发布”（孩子视角试玩为可选项，不作为发布前提；只有一位系统管理员时允许自审，见[开放问题](../01-requirements/open-questions.md) Q9）→ 状态 `publishing`，入队 `publish_audio` 任务（本机进程类，费用 0）。
2. 任务：收集所有需要发音的文本（新词 `text`、`listen_choose`/`spell`/`read_aloud`/对话/绘本的文本）→ 对每段计算 `sha256(voiceId + 规范化文本 + 参数)`，已有同哈希素材直接复用 → 否则以一次性进程运行 Piper（`systemd-run --user --scope -p MemoryMax=350M /opt/xingya/piper/bin/piper --model <voice>`）→ ffmpeg 编码单声道 48 kbps MP3 → 上传 OSS `pub/audio/<hash>.mp3` → 写 `assets`。草稿引用的图片素材复制到 `pub/` 并把 `visibility` 改为 `public`。
3. 任务成功后在**一个事务**内：`SELECT courses … FOR UPDATE` → 插入 `course_versions`（`version_no + 1`）、全部 `units`、`levels`、`questions`、`question_answers`（未改动的单元也原样写入新版本） → 草稿中的候选词与义项从 `draft` 转为 `active` → `UPDATE courses SET current_version_id = 新版本` → 草稿 `published` → 写审计。
4. 任务失败（重试 3 次后）：草稿回到 `in_review` 并显示失败原因；课程当前版本不变；已上传的素材保留，下次复用。
5. 孩子端从下一次“开始作答”起使用新版本；进行中的作答在旧版本上完成。

### 7.6 首发内容
- 仓库附带一门一年级英语示例课程 `en-g1-a`（一年级上册，`word-quest`，2 个单元 `u01`、`u02`，每单元 3 关），用于开发、测试与首发种子；导入后同样走审核与发布。
- 其余首发课程在后台制作：用 AI 生成课程（[studio 需求 §4.8](../01-requirements/modules/studio.md#48-ai-生成课程)）或表单手工编辑。首发目标：一年级英语上册（`en-g1-a`）Unit 1–6；其余三个模板各至少 1 门课（可以只有 1–2 个单元）。
- 旧系统的英语课程可用 `xingya legacy:import-courses` **一次性导入为草稿**（ADR 0020；照旧系统“课程可导入”），转换后跑 K1–K13、审核后发布；旧美术素材不迁移（游戏搭档与种子宠物除外，ADR 0018、0021），导入的题目缺图时 K8 会标红，由美术设计师补图。其余教材内容由系统管理员上传为资料，经 AI 分析与人工审核后生成。
