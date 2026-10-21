# 课程模型（数据库课程、模板、题型、自动检查、发布）

> 本文原为《课程包格式》（规格 §7，提交 6b463ed）。2026-10-21 设计变更（用户已批准，见 [v1.0 变更记录](../06-releases/v1.0/changes.md)）取消课程包：课程存数据库并版本化（[ADR 0008](../adr/0008-db-versioned-courses-word-bank.md)），素材在 OSS/CDN、发布时生成音频（[ADR 0010](../adr/0010-oss-cdn-publish-time-piper.md)）。原校验规则 C1–C13 由本文 §7.4 的 K1–K12 取代；原 §7.5“旧内容转换”取消。

## 7. 课程模型

### 7.1 存储位置
| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 词与义项 | `words`、`word_senses` | 全站共享；`en.apple`、`en.bat.animal`；文本/释义不可改 |
| 课程身份 | `courses` | 稳定 ID（如 `en-g1-u01`）、学科、年级、排序、模板、当前版本 |
| 草稿 | `course_drafts.document`（JSON，§7.3） | 唯一可编辑的地方；含答案与解析 |
| 已发布版本 | `course_versions` → `levels` → `questions`（可见部分）+ `question_answers`（答案部分） | 只追加，应用账号不能修改或删除 |
| 素材 | `assets` + OSS | 草稿在 `draft/`，发布时复制到 `pub/`（CDN） |
| 模板定义 | 仓库 `content/templates/<id>.json` | 随 api 打包；草稿与版本记录 `template_id` + `template_version` |
| 示例课程 | 仓库 `content/english/grade-1/<courseId>.json` | 与 §7.3 草稿文档同一结构；`xingya course:import` 导入为草稿 |

### 7.2 模板定义（`content/templates/<id>.json`，Zod 模式在 `packages/content-schema`）
```jsonc
{
  "id": "word-quest", "templateVersion": 1, "name": "单词闯关课",
  "grades": [1, 2, 3, 4, 5, 6],
  "levelPlan": [                                   // 关卡顺序：每个元素生成一关或多关
    { "key": "learn",     "title": "认识", "count": 1,
      "mix": { "pick_image": [2, 4], "listen_choose": [2, 4] } },
    { "key": "practice",  "title": "练习", "count": [1, 3],
      "mix": { "pick_image": [1, 3], "listen_choose": [1, 3], "read_aloud": [0, 2] } },
    { "key": "challenge", "title": "挑战", "count": 1,
      "mix": { "listen_choose": [2, 4], "spell": [2, 4] }, "gradeOverrides": { "1-2": { "spell": [0, 0], "pick_image": [2, 4] } } }
  ],
  "questionsPerLevel": [5, 8], "minScoredPerLevel": 4,
  "promptHints": { "analysis": "…", "generation": "…", "imageStyle": "…" }   // 生成提示词片段（不含答案逻辑）
}
```
- `mix` 的数值是该题型在一关中的 `[最少, 最多]`；同一关各题型之和必须落在 `questionsPerLevel` 内且计分题 ≥ `minScoredPerLevel`。
- 首发 4 个模板（[studio 需求 §4.8.3](../01-requirements/modules/studio.md#483-课程模板首发-4-个)）：`word-quest`、`sentence-dialogue`（`dialogue_choose`、`order`、`cloze`、`read_aloud`）、`picture-book`（关卡带 `pages`，`reading_choose`、`read_aloud`）、`phonics`（`listen_discriminate`、`listen_choose`、`read_aloud`，年级 1–3）。
- 模板改版 = 新的 `templateVersion`；已有草稿与版本按自己记录的版本解释，不受影响。

### 7.3 草稿文档结构（`course_drafts.document`）
```jsonc
{
  "title": "Unit 1 Fruits", "instructionLang": "zh", "coverAssetId": 12,
  "knowledge": {                                     // AI 分析产出、管理员可编辑的清单
    "senses":   ["en.apple.fruit", "en.pear.fruit", { "draft": { "wordId": "en.peach", "text": "peach", "senseId": "en.peach.fruit", "meaningZh": "桃子" } }],
    "patterns": ["I like …", "Do you like …?"],
    "points":   ["水果类名词", "like 的用法"]
  },
  "levels": [{
    "levelKey": "l01", "title": "认识水果", "sceneAssetId": 30,
    "hidingSpots": [{ "kind": "leaf", "x": 0.18, "y": 0.62 }, { "kind": "rock", "x": 0.55, "y": 0.8 }, { "kind": "cloud", "x": 0.8, "y": 0.2 }],
    "pages": null,                                   // 绘本阅读课：[{imageAssetId, text, audioText}]
    "questions": [
      { "questionKey": "q1", "type": "pick_image", "senseId": "en.apple.fruit",
        "visible": { "imageAssetId": 41, "options": [{ "id": "o1", "senseId": "en.apple.fruit" }, { "id": "o2", "senseId": "en.pear.fruit" }, { "id": "o3", "senseId": "en.peach.fruit" }] },
        "answer": { "optionId": "o1" }, "explanation": "apple 是苹果。" }
    ]
  }]
}
```
发布时每题拆成两部分：`visible` → `questions.visible`；`answer` + `explanation` → `question_answers`。`visible` 中出现答案字段会被数据库 CHECK 拒绝（`answer`、`accept`、`explanation`、`correct`、`correctOptionId`）。

**9 种题型的两部分**（选项 ID 在题目内唯一且稳定；下发时由 learning 重新打乱顺序，并把选项/词块 ID 替换为本次作答的随机令牌、去掉 `senseId`，映射存在 `plays.items`，见 [learning 设计](modules/learning.md)）：

| 题型 | `visible`（作答前下发） | `answer`（只在服务端，作答后返回） |
| --- | --- | --- |
| `pick_image` | `imageAssetId`、`options[{id, senseId}]`（3–4） | `optionId` |
| `listen_choose` | `audioText`（发布时转 `audioAssetId`）、`options[{id, senseId}]` | `optionId` |
| `spell` | `imageAssetId`、`hintZh`、`audioAssetId`、`length`、`letterTiles?` | `text`、`accept[]` |
| `read_aloud` | `text`、`audioAssetId` | —（无答案，不计分） |
| `dialogue_choose` | `sceneAssetId`、`lines[{speaker, text?, audioAssetId?, blank?}]`、`options[{id, text}]` | `optionId` |
| `order` | `tiles[{id, text}]`（3–6） | `sequence[]`（tile ID 的正确顺序） |
| `cloze` | `sentence`（含一个 `___`）、`options[{id, text}]` | `optionId` |
| `reading_choose` | `pageRef`、`question`、`options[{id, text}]` | `optionId` |
| `listen_discriminate` | `audioAssetId`、`options[{id, label}]`（2–4） | `optionId` |

判分：选择类比较选项 ID；`order` 整个序列相等才算对；`spell` 规范化后与 `text` 或 `accept[]` 之一相同（[learning 需求 §4.1.3](../01-requirements/modules/learning.md#413-题型9-种)）。

### 7.4 自动检查规则（K 规则）
草稿每次修改后运行；任何错误使 `check_passed = 0`，题目在编辑器中标红并写明规则号与原因。示例课程在 CI 中由 `tools/validate-content` 运行同一套规则。

| # | 规则 |
| --- | --- |
| K1 | 结构：文档符合 Zod 模式；`levelKey`/`questionKey` 符合 `^[a-z0-9]+(-[a-z0-9]+)*$` 且在课程/关卡内唯一；已发布过的 `levelKey` 若删除需确认（进度保留，但不再显示） |
| K2 | 模板：关卡序列、每关题型组合与数量符合模板 `levelPlan` 与 `mix`；题型属于模板允许范围 |
| K3 | 每关 5–8 题，计分题（非 `read_aloud`）≥ 4 |
| K4 | 答案在选项中：选择类 `optionId` 存在于 `options`；`order` 的 `sequence` 恰好是全部 tile 的一个排列；选项 ID 不重复 |
| K5 | 年级：1–2 年级课程不得含 `spell`；`phonics` 只用于 1–3 年级；课程年级在模板 `grades` 内 |
| K6 | 重复：同一关两题的题干与答案不得相同；同一题选项文本/义项不得重复 |
| K7 | 干扰项不能过近：干扰项与正确答案规范化后（大小写、空格、撇号）相同、或属于 `accept[]`、或同一义项，均判错；编辑距离 ≤ 1 的拼写型干扰项给出警告（不阻断） |
| K8 | 引用完整：引用的义项存在且未退役（或为本草稿的候选新义项）；`pick_image` 的义项有图；需要图片/场景图的题与关卡有素材 |
| K9 | 拼写答案只含字母、空格、撇号、连字符；`text` 长度 ≤ 24 |
| K10 | 可见部分不含答案字段（与数据库 CHECK 一致）；`explanation` ≤ 200 字 |
| K11 | 内容安全：题干、选项、解析、绘本文字不命中安全词表；不含网址、电话等个人信息模式 |
| K12 | 关卡场景：每关有 3 个藏匿点定义（`kind` 属于场景允许的种类，坐标在 0–1） |

### 7.5 发布流程
1. 草稿 `in_review` → 审核人点“发布”（必须已完成学生视角试玩；单管理员时允许自审，见[开放问题](../01-requirements/open-questions.md) Q9）→ 状态 `publishing`，入队 `publish_audio` 任务（本机进程类，费用 0）。
2. 任务：收集所有需要发音的文本（新词 `text`、`listen_choose`/`spell`/`read_aloud`/对话/绘本的文本）→ 对每段计算 `sha256(voiceId + 规范化文本 + 参数)`，已有同哈希素材直接复用 → 否则以一次性进程运行 Piper（`systemd-run --user --scope -p MemoryMax=350M /opt/xingya/piper/bin/piper --model <voice>`）→ ffmpeg 编码单声道 48 kbps MP3 → 上传 OSS `pub/audio/<hash>.mp3` → 写 `assets`。草稿引用的图片素材复制到 `pub/` 并把 `visibility` 改为 `public`。
3. 任务成功后在**一个事务**内：`SELECT courses … FOR UPDATE` → 插入 `course_versions`（`version_no + 1`）、`levels`、`questions`、`question_answers` → 草稿中的候选词与义项从 `draft` 转为 `active` → `UPDATE courses SET current_version_id = 新版本` → 草稿 `published` → 写审计。
4. 任务失败（重试 3 次后）：草稿回到 `in_review` 并显示失败原因；课程当前版本不变；已上传的素材保留，下次复用。
5. 孩子端从下一次“开始作答”起使用新版本；进行中的作答在旧版本上完成。

### 7.6 首发内容
- 仓库附带一年级英语 2 个示例单元（`word-quest`），用于开发、测试与首发种子；导入后同样走审核与发布。
- 其余首发课程在后台制作：用 AI 生成课程（[studio 需求 §4.8](../01-requirements/modules/studio.md#48-ai-生成课程)）或表单手工编辑。首发目标：一年级英语 Unit 1–6，四个模板各至少 1 门课。
- 不迁移旧系统的课程数据与美术素材（版权与结构问题，见评审报告）；需要的教材内容由管理员重新上传为资料，经 AI 分析与人工审核后生成。
