# 课程包格式

> 本文由已确认的《星芽学园全新系统设计规格》（2026-10-21，提交 6b463ed）拆分而来；章节编号沿用原规格，便于交叉引用（编号与文件的对应见 [docs/README.md](../README.md)）。


## 7. 课程包格式

### 7.1 目录结构（仓库 `content/`；当前仓库只建了 `english/grade-1/`、`shop/`、`phrases/`，其余在放入内容时创建）
```
content/
  pack.json                    # schemaVersion、packVersion（YYYY.MM.DD.N）、textCorrections[]
  ids.lock.json                # 已发布过的全部 ID 及其类型（构建器生成，提交入库）
  avatars.json                 # 原创头像库
  shop/shop.json               # 商店物品（装扮/宠物、价格、图片、artSource）
  phrases/phrases.json         # 跨家庭预设短语
  phrases/emoji.json           # 表情白名单
  safety/blocklist/*.txt       # 分类敏感词表（中/英）
  safety/patterns.json         # 个人信息与链接规则
  english/
    words/*.json               # 词条（按主题分文件）
    grade-1/<courseId>/        # 按年级分目录：grade-1 … grade-6
      course.json              # 课程元数据 + 关卡文件顺序
      levels/<nn>.json         # 关卡：题目数组
  assets/
    images/…                   # 源图片（webp/png，构建时压缩并按哈希命名）
    images/sources.json        # 每张图片的来源 artSource：original:* | licensed:* | legacy-family:*
    audio-overrides/<wordId>.mp3   # 可选真人录音，覆盖 Piper
  legacy-source/               # 旧仓库导出的内容快照（只作转换来源，不进入构建产物）
```
### 7.2 JSON 结构概要（Zod 模式在 `packages/content-schema`）
```jsonc
// english/words/fruit.json
[{ "id": "en.apple", "text": "apple", "meaningZh": "苹果", "phonetic": "/ˈæp.əl/",
   "image": "images/fruit/apple.webp", "example": { "en": "I like apples.", "zh": "我喜欢苹果。" } }]

// english/grade-1/en-g1-u01/course.json
{ "id": "en-g1-u01", "subject": "english", "grade": 1, "title": "Unit 1 Fruits",
  "sortOrder": 101, "instructionLang": "zh", "cover": "images/covers/g1u1.webp",
  "levels": ["01.json", "02.json"], "retired": false }

// english/grade-1/en-g1-u01/levels/01.json
{ "id": "en-g1-u01-l01", "title": "认识水果", "questions": [
  { "id": "en-g1-u01-l01-q1", "type": "pick_image", "wordId": "en.apple",
    "options": ["en.apple", "en.pear", "en.banana"], "answer": "en.apple" },
  { "id": "en-g1-u01-l01-q2", "type": "listen_choose", "wordId": "en.pear",
    "options": ["en.apple", "en.pear", "en.peach"], "answer": "en.pear" },
  { "id": "en-g1-u01-l01-q3", "type": "spell", "wordId": "en.apple",
    "hintZh": "苹果", "answer": "apple", "accept": [] },
  { "id": "en-g1-u01-l01-q4", "type": "read_aloud", "wordId": "en.apple",
    "text": "I like apples." }
]}

// shop/shop.json
[{ "id": "outfit-leaf-hat", "kind": "outfit", "slot": "head", "name": "叶子帽",
   "price": 30, "image": "images/shop/leaf-hat.webp", "artSource": "original:xingya-2026",
   "sortOrder": 10, "retired": false }]
```
题目 `payload` 在导入时存为题型相关字段（options/answer/accept/hintZh/text）的 JSON；`audioOf` 默认等于 `wordId`，跟读短句的音频由 `text` 生成。

### 7.3 构建流程
1. **validate**（`tools/validate-content`）：Zod 结构校验 + 下列规则，任何错误使 CI 失败。
2. **gen-audio**（`tools/build-audio`）：收集所有需要发音的文本（词 `text`、跟读 `text`、例句）；对每段文本计算 `sha256(voiceId + voiceVersion + 规范化文本 + 合成参数)`；缓存未命中时用 Piper（英语女声模型，版本写在 `pack.json`）离线合成 WAV → ffmpeg 编码为单声道 48 kbps MP3 → `audio/<hash>.mp3`。存在 `audio-overrides/<wordId>.mp3` 时用真人录音替代。CI 用 Actions 缓存保存音频，只合成新增文本。
3. **build**（课程包组装，归入 `tools/validate-content`，校验通过后输出）：图片压缩为 webp 并按内容哈希命名；输出 `dist/pack-<packVersion>/{manifest.json, content.json, images/, audio/}`，`manifest.json` 记录每个文件的 sha256 与大小；更新 `ids.lock.json`。
4. **import（部署时，`apps/api` 提供的 `xingya content:import` 命令）**：migrator 账号在一个事务内 UPSERT 内容表；包中缺失但库中存在的 ID 标记 `retired=1`；写 `system_settings.content.pack_version`。服务启动时从库加载内容到内存。静态文件位于 `/opt/xingya/releases/<ts-version>/content/pack-<packVersion>/`；部署脚本把前两个发布中的 `pack-<packVersion>/` 以硬链接带入新发布的 `content/`，使最近 3 个课程包版本始终可访问。

### 7.4 校验规则
| # | 规则 |
| --- | --- |
| C1 | 所有 ID 符合格式（课程/关卡/题目 `^[a-z0-9]+(-[a-z0-9]+)*$`，词 `^[a-z]{2}\.[a-z0-9]+(-[a-z0-9]+)*$`）且全局唯一 |
| C2 | `ids.lock.json` 中已发布的 ID 不得消失（只能 `retired: true`），不得改变类型 |
| C3 | 每关 5–8 题，其中计分题（非 `read_aloud`）≥ 4 |
| C4 | 选择题 3–4 个不重复选项，`answer` 在选项中；所有引用的词存在且未退役 |
| C5 | 拼写答案只含字母、空格、撇号、连字符；1–2 年级课程不得含 `spell` |
| C6 | 已发布词的 `text` 修改必须列入 `pack.json.textCorrections`（视为勘误，保留 ID），否则报错要求“退役 + 新 ID” |
| C7 | 引用的图片文件存在，单张 ≤ 200 KB（压缩后）；`pick_image` 题目的词必须有图 |
| C8 | 每段需发音的文本都有生成音频或覆盖录音，单个 ≤ 100 KB |
| C9 | 商店：价格 1–1000 整数；`kind/slot` 一致；`artSource` 必填且为 `original:*` 或 `licensed:*`；名称与文件名不得命中第三方 IP 关键词表（mario、luigi、link、zelda、rosalina、pokemon、pikachu、kirby 等） |
| C10 | 课程 `sortOrder` 在同学科同年级内唯一；关卡文件列表与目录一致 |
| C11 | 预设短语 ≤ 20 字，不含数字、网址；表情键在白名单字体范围内 |
| C12 | 敏感词表每行一词，无重复；`patterns.json` 中的正则可编译 |
| C13 | 每张图片在 `images/sources.json` 中有 `artSource`；以 `--public` 模式运行时（切换开放注册前的上线检查）拒绝任何 `legacy-family:*` |

### 7.5 旧内容转换（一次性）
- 来源：旧仓库课程内容数据与美术/音频素材（只读取内容，不复用任何旧代码）。先把内容导出为 JSON 快照放入 `content/legacy-source/`，再由新的 `legacy-convert` 工具生成新格式草稿，人工检查后提交。
- 首发迁移范围：一年级英语 Unit 1–6、启思字母（以例词形式）、启思常见词、六年级英语 Unit 1–3 中能表达为 4 种题型的词汇内容。对话、故事排序、阅读、书虫与语文拼音不迁移。
- 旧美术中任何疑似教材扫描或第三方 IP 的图片不得进入商店；课程插图标注 `artSource`，未确认版权的标为 `legacy-family:*`，仅允许在 `registration.mode = invite` 期间使用；切换开放注册前必须替换并通过 `validate --public`（规则 C13，见 [§12](../02-solution/roadmap.md) R7）。
