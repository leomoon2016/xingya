# ADR 0021：旧系统宠物（含任天堂角色）作为 `seeds/pets/` 种子集恢复，素材可替换

- 状态：已接受（扩大 ADR 0018 的第三方 IP 具名例外；修订 [companion 需求](../01-requirements/modules/companion.md)“伙伴全部原创”）
- 日期：2026-10-22
- 依据：用户决定（2026-10-22）：回归老系统总规则（[ADR 0020](0020-revert-to-old-system.md)）包括盘点 S-2“任天堂宠物”——恢复旧宠物集，素材按 ADR 0018 的方式放在 `seeds/` 下、可整体替换；AI 工作室仍然**不得**生成任天堂角色

## 背景
旧系统（只读核对 `code/content/pet-rules.mjs`、`src/MarioCharacters.jsx`、`src/PetAvatar.jsx`、`public/assets/companions/`）有 24 种可领养宠物，分 5 档：

| 档位（星 / 碎片） | 种类（`species_key` 名称） |
| --- | --- |
| 初级 20 / 80 | `sprout` 星芽小龙（30 / 100）、`panda` 熊猫（50 / 100）、`toad` 奇诺比奥、`goomba` 栗宝宝、`koopa` 慢慢龟、`shy-guy` 嘿呵 |
| 中级 50 / 160 | `mario` 马里奥（50 / 100）、`yoshi` 耀西（40 / 100）、`luigi` 路易吉、`toadette` 奇诺比珂、`boo` 害羞幽灵、`piranha-plant` 吞食花 |
| 高级 100 / 320 | `link` 林克（70 / 100）、`monster-chief` 怪物首领（60 / 100）、`daisy` 黛菊、`bowser-jr` 酷霸王Jr.、`wario` 瓦力欧、`waluigi` 瓦路易吉 |
| 稀有 250 / 800 | `bowser` 酷霸王（60 / 100）、`king-hyrule` 海拉鲁国王（70 / 100）、`zelda` 塞尔达公主（80 / 100）、`peach` 碧姬、`donkey-kong` 咚奇刚 |
| 唯一 600 / 2000（全站同时一人） | `rosalina` 罗莎塔 |

括号里是旧系统给该种类单独设的价格（其余跟随档位）。旧系统的键 `shy_guy`、`piranha_plant`、`monster_chief`、`bowser_jr`、`king_hyrule`、`donkey_kong` 在新系统中改用连字符（数据库 `species_key` 只允许小写字母、数字与连字符），复制旧 SVG 时同时改名。24 种中 22 种是任天堂角色，`sprout`、`panda` 是原创。旧素材：9 种是 SVG 文件（`public/assets/companions/` 下的 bowser、king_hyrule、link、mario、monster_chief、panda、sprout、yoshi、zelda），其余 15 种是 `MarioCharacters.jsx` 里的内联 JSX 图形；成长装扮叠加层在 `PetAvatar.jsx`（20 级围巾、50 级徽章、100 级光环）。

## 决策
1. **恢复旧宠物集**，名称、描述、档位、单独价格与开关照旧，与 AI 工作室设计的原创伙伴并存（同一张 `pet_species` 表，`origin = 'seed'` / `'studio'`）。
2. **素材放 `seeds/pets/`**（与 ADR 0018 的 `seeds/partners/` 同一机制）：
   - `seeds/pets/pets.json`：24 条 `{speciesKey, name, description, tier, starPrice?, fragmentPrice?, starEnabled, fragmentEnabled, giftEnabled, image, greetings{zh,en}}`；
   - `seeds/pets/<speciesKey>.svg`：每种一张形象图。9 种直接复制旧 SVG，15 种由内联 JSX **一次性导出**为 SVG（导出脚本放 `tools/`，只运行一次，不进运行时）；
   - `xingya seeds:apply` 把图片上传到 OSS 公开前缀 `pub/pets/`（只传缺失或内容变化的文件），并按 `species_key` 插入缺失的 `pet_species` 行（`origin = seed`、已上架、无创建人与审核人）。从不覆盖后台修改的价格与上下架。
3. **代码只认 `species_key`**，不写死角色名或文件名；成长阶段形象 = 基础图 + 客户端叠加层（围巾 / 徽章 / 光环），与旧系统一致；动作沿用 ADR 0013 的动效模板。
4. **替换路径（投诉或下架时）**：运维把 OSS `pub/pets/` 下同名文件换成原创图并刷新 CDN，立即生效；随后在 `seeds/pets/` 中替换图片与 `pets.json` 的名称和描述，随下一次部署固化（`seeds:apply` 对 `origin = seed` 的行允许更新 `name`、`description` 与 `design.image`，这是唯一的覆盖例外，写审计）。也可以在后台把某个种类下架：已领养的孩子保留，不再出现在领养列表。
5. **AI 工作室仍然不得生成任天堂角色**：提示词禁止词表（`seeds/safety/prompt-blocklist`）与“不得模仿现有角色”规则不变；美术设计师不能编辑 `origin = seed` 的种类形象；质检员的原创性检查只适用于 `origin = studio`。
6. **声音**：旧问候文本放在 `pets.json`，按 `studio.voices` 在 `seeds:apply` 时一次性生成音频（与 ADR 0010 一致）。

## 风险
| 风险 | 缓解 |
| --- | --- |
| 著作权与商标：任天堂角色进入可领养、经验、营地与赠送，影响面比 ADR 0018 大 | 用户已知情；只用固定素材、不做商业宣传、不出现在名称或域名中；替换路径见决策 4，不改代码与数据 |
| ICP 备案审核或巡检要求移除 | 上线前准备一套原创替换图（`seeds/pets/original/`，可选），按决策 4 一次替换 |
| 15 种素材需要从 JSX 导出 | 导出是一次性工作，计入里程碑“伙伴”（W17 下半周–W20 上半周，[roadmap §11.1](../02-solution/roadmap.md#111-2026-10-22-重新估算增量)） |

## 后果
- 第三方 IP 例外从“马里奥、林克游戏搭档”扩大为“游戏搭档 + `seeds/pets/` 种子宠物”；其他地方（头像、探险徽章、呀哈哈、AI 角色头像、课程插图）仍必须原创。
- 上线当天孩子就有 24 种熟悉的宠物可领养，不必等 AI 工作室设计。

## 未采用的方案
- 只用 AI 设计的原创伙伴（原规格）：与总规则不符。
- 由 AI 工作室生成“近似任天堂”的形象：违反提示词规则，且仍有近似侵权风险。
