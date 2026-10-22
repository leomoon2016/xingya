# pets —— 旧系统种子宠物（ADR 0021）

用户决定（2026-10-22）：回归老系统总规则包括恢复旧系统的 24 种可领养宠物（其中 22 种是任天堂角色）。这里与 `seeds/partners/` 是**第三方 IP 仅有的两项具名例外**，只放从旧系统复用或一次性导出的固定素材。

计划内容（尚未创建）：

| 文件 | 用途 |
| --- | --- |
| `pets.json` | 24 条 `{speciesKey, name, description, tier, starPrice?, fragmentPrice?, starEnabled, fragmentEnabled, giftEnabled, image, greetings{zh,en}}`，名称、描述、档位、单独价格与开关照旧系统 `code/content/pet-rules.mjs` |
| `<speciesKey>.svg` | 每种一张基础形象图：9 种从旧系统 `public/assets/companions/` 复制（`king_hyrule.svg`、`monster_chief.svg` 复制时改名为连字符），15 种由 `src/MarioCharacters.jsx` 一次性导出（导出脚本放 `tools/`，不进运行时） |
| `original/`（可选） | 上线前准备的原创替换图，供投诉或备案要求时整体替换 |

档位与种类（星星 / 碎片；括号内是该种类单独的价格）：

| 档位 | 种类（`speciesKey`） |
| --- | --- |
| 初级 20 / 80 | `sprout`（30 / 100）、`panda`（50 / 100）、`toad`、`goomba`、`koopa`、`shy-guy` |
| 中级 50 / 160 | `mario`（50 / 100）、`yoshi`（40 / 100）、`luigi`、`toadette`、`boo`、`piranha-plant` |
| 高级 100 / 320 | `link`（70 / 100）、`monster-chief`（60 / 100）、`daisy`、`bowser-jr`、`wario`、`waluigi` |
| 稀有 250 / 800 | `bowser`（60 / 100）、`king-hyrule`（70 / 100）、`zelda`（80 / 100）、`peach`、`donkey-kong` |
| 唯一 600 / 2000（全站同时一人） | `rosalina` |

规则：
- `xingya seeds:apply` 把图片上传到 OSS 公开前缀 `pub/pets/`（只传缺失或内容变化的文件），按 `speciesKey` 插入缺失的 `pet_species` 行（`origin = seed`、已上架）；从不覆盖后台改过的价格与上下架。唯一的覆盖例外：`origin = seed` 的行会更新名称、描述与图片（写审计），便于整体替换素材。
- `speciesKey` 只用小写字母、数字与连字符（与数据库 CHECK 一致）。
- 成长阶段 = 基础图 + 客户端叠加层（20 级围巾、50 级徽章、100 级光环），与旧系统一致。
- AI 工作室**不得**生成、修改或参考这些素材；提示词禁止词表照常拦截任天堂角色名；美术设计师不能编辑 `origin = seed` 的种类。
- 这些素材不得用于头像、徽章、呀哈哈家族、AI 角色头像或课程插图。

**是否上服务器**：是（随发布包；图片由 `xingya seeds:apply` 上传到 OSS `pub/pets/`）。
