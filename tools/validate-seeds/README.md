# validate-seeds（原 validate-content）

校验 `seeds/`：模板结构（`seeds/course-templates/`）、示例课程（`seeds/samples/`，与后台发布使用同一套自动检查 K1–K13，见 `docs/03-design/course-model.md` §7.4）、探险徽章初始数据（`artSource` 必须原创或已授权）、种子宠物清单（`seeds/pets/pets.json`：24 项、键名格式、档位与价格范围、每项 SVG 存在；任天堂素材只允许出现在 `seeds/pets/` 与 `seeds/partners/`）、短语、头像、聊天词表与提示词禁止词表（无重复、正则可编译）、默认技能（`seeds/skills/`：SKILL.md 可解析、模式可编译、工具都在目录中、无发布类工具、无可执行文件）、默认角色挂载（`seeds/agents/defaults.json`：技能存在、受众一致、儿童角色挂载 `child-safety`）。模式来自 `packages/seed-schema` 与 `packages/skill-format`。任何错误使 CI 失败。

**是否上服务器**：否。
