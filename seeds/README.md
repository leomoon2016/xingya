# seeds —— 内置数据（原 content/）

随代码一起版本化、**随发布包部署**的内置数据（发布目录 `/opt/xingya/releases/<ts-version>/seeds/`）。分两类（ADR 0015）：

| 目录 | 内容 | 如何进入系统 |
| --- | --- | --- |
| `course-templates/` | 课程模板定义（4 个） | api 启动时从发布目录读取（只读，**不入库**；调整模板 = 改仓库并发版，Q16） |
| `safety/` | 聊天过滤词表与规则、提示词禁止词表、AI 角色系统守则 `agent-guard.md`、儿童安全测试集 | api 启动时读取（**不入库**，守则不可关闭） |
| `phrases/` | 跨家庭预设短语与表情白名单 | api 启动时读取（不入库） |
| `avatars/` | 孩子可选的原创头像清单 | api 启动时读取（不入库；图片在 OSS/CDN） |
| `partners/` | 游戏搭档（马里奥、林克）复用的旧素材与主题清单 `partners.json`（ADR 0018，第三方 IP 的具名例外之一） | api 启动时读取清单（不入库）；图片由 `xingya seeds:apply` 上传到 OSS `pub/partners/` |
| `shop/` | 探险徽章初始数据 | 部署步骤 `xingya seeds:apply` 写入数据库（只插入缺失项，不覆盖后台修改） |
| `pets/` | 旧系统 24 种宠物（含任天堂角色，ADR 0021，第三方 IP 的具名例外之一）：`pets.json` 与每种一张 SVG | `xingya seeds:apply` 上传图片到 OSS `pub/pets/` 并插入缺失的 `pet_species`（`origin = seed`）；已存在的种子行只更新名称、描述与图片，不覆盖后台改过的价格与开关 |
| `skills/` | 18 个默认技能（SKILL.md 文件夹格式，无可执行代码） | `xingya seeds:apply` 导入为 v1 草稿（只插入缺失项） |
| `agents/` | 7 个默认角色的技能挂载 `defaults.json` | `xingya seeds:apply` 写入白名单与 v1 草稿的挂载（只插入缺失项） |
| `samples/` | 示例课程（仅作示例） | **不自动导入**；需要时运维执行 `xingya course:import`，结果为草稿 |

- `xingya seeds:apply` 每次部署都执行（在 `xingya migrate` 与 `roles.sql` 之后），幂等；它从不删除已有行，也不修改后台改过的内容（唯一例外：`origin = seed` 的种子宠物会更新名称、描述与图片，便于整体替换素材），因此后台对徽章、技能、角色、价格的修改不会被部署覆盖。
- 与 `db/dev-fixtures/` 的区别：`db/dev-fixtures/` 是**只用于本地开发与 e2e 的 SQL 示例行**，从不上服务器；`db/migrations/0001_init.sql` 中的少量 INSERT（系统设置、伙伴档位、默认角色与 `child-safety` 技能行）是结构的一部分，随迁移执行。
- 全部由 `tools/validate-seeds` 在 CI 中校验；儿童技能另由 `tools/safety-eval` 评测。

**是否上服务器**：是（发布目录中的 `seeds/`；`samples/` 也随包携带但只在手动导入时使用）。
