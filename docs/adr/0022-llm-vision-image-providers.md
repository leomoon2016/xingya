# ADR 0022：聊天、视觉、图像三类大模型分别可配置（默认阿里云百炼），不用专门的 OCR 服务；邮件默认阿里云 DirectMail

- 状态：已接受（关闭 Q2、Q3、Q15；修订 [studio 设计](../03-design/modules/studio.md) 适配器与 [nfr](../01-requirements/nfr.md) 密钥规则）
- 日期：2026-10-22
- 依据：用户决定（2026-10-22）：“图像生成和 OCR 都由大模型完成（视觉模型识字、图像模型生成），不用专门的 OCR 服务；聊天 / 视觉 / 图像各自的厂商、接口地址、模型与 API Key 可在后台分别配置，默认阿里云百炼（通义千问 / 通义万相）；邮件默认阿里云 DirectMail；Key 作为密钥保存，绝不出现在文档里”。旧系统的模型配置（≤ 20 个、测试连接、孩子可切换）按 [ADR 0020](0020-revert-to-old-system.md) 一并恢复

## 决策

### 1. 三种用途，一张配置表
表 `ai_providers`（[数据模型](../03-design/data-model.md)）：

| 列 | 说明 |
| --- | --- |
| `purpose` | `chat`（呀哈哈队长、课程设计、规则填写等全部文本任务）/ `vision`（资料识字、图片理解）/ `image`（伙伴、呀哈哈、课程插图生成） |
| `name`、`vendor` | 显示名（唯一）与厂商名 |
| `base_url`、`model` | 接口地址（必须 https，CHECK）与模型名 |
| `api_key_enc` | API Key 的密文（见 §3）；界面只显示“已设置 / 未设置”与末 4 位 |
| token 上限、`supports_tools` | 输入 / 输出 token 上限；是否支持工具调用 |
| `child_selectable` | 只对 `chat`：孩子可以在呀哈哈队长里切换到这个模型（旧系统规则；CHECK 只允许 chat） |
| `is_default` | 每种用途恰好一个有效默认（生成列 + 唯一键） |
| `status`、最近测试结果 | 停用而不删除；“测试连接”记录时间与成败 |

- 迁移写入 3 条默认（Key 留空，由系统管理员在后台填写）：

| 用途 | 厂商 | 接口地址 | 模型 |
| --- | --- | --- | --- |
| chat | 阿里云百炼（通义千问） | `https://dashscope.aliyuncs.com/compatible-mode/v1`（OpenAI 兼容） | `qwen-plus` |
| vision | 阿里云百炼（通义千问 VL） | 同上 | `qwen-vl-max` |
| image | 阿里云百炼（通义万相） | `https://dashscope.aliyuncs.com/api/v1` | `wanx2.1-t2i-turbo` |

- 最多 20 条配置（旧系统上限，服务端检查）。AI 角色的 `preferred_model` / `agent_versions.model` 指向 `ai_providers.name`；未指定时用该用途的默认。
- 删除 `ai.model` 系统设置；`ai.enabled` 仍是全站总开关。

### 2. 适配器
studio 的 `AiClient` 按用途分三个接口：`chat(messages, tools?)`、`vision(images, prompt)`、`image(prompt, size)`。实现两种协议：OpenAI 兼容（chat / vision）与百炼原生异步任务（image：提交 → 轮询 → 取结果，结果先下载再上传到 OSS 草稿前缀）。换厂商 = 在后台新增一条配置并设为默认，不改代码；不兼容这两种协议的厂商需要新增适配器（改代码）。

### 3. 没有 OCR 服务：视觉模型识字
- 资料抽取：PDF 有文字层的直接抽文字；docx / pptx 解析 XML；**图片与扫描页**交给 `vision` 模型，提示词要求“逐字转写，不总结”，按页计费（`studio.unit_prices.vision_page_fen`，默认 2 分 / 页）。
- 因此 Q14 中“扫描版 PDF 首发不支持”取消：扫描页逐页转成图片后走视觉模型（单个资料仍 ≤ 20 MB）。
- 视觉模型输出与其他 AI 输出一样只进草稿，经检查与审核才发布。

### 4. 密钥
- API Key **只在后台录入**，用主密钥加密（AES-256-GCM）后存入 `api_key_enc`；主密钥 `XINGYA_MASTER_KEY` 只在服务器 `/etc/xingya/secrets.env`（root 600，[nfr](../01-requirements/nfr.md)）。仓库、文档、日志、审计、备份导出中都不出现明文 Key；审计只记“修改了某配置的 Key”。
- 只有 api 进程能解密；后台“测试连接”在服务端发起，结果不回显 Key。
- 轮换主密钥：运维命令 `xingya secrets:rotate-master` 用新主密钥重新加密全部 `api_key_enc`。

### 5. 孩子切换模型（旧系统，⚠ 隐私边界）
孩子可在呀哈哈队长里从 `child_selectable = 1` 的聊天模型中选一个（家长可关闭“允许切换”）。**不恢复**孩子自带模型地址与 Key（ADR 0020 R5）。所有可选模型仍走呀哈哈队长的输入输出过滤、预算与每日条数。

### 6. 邮件：阿里云 DirectMail
- 默认用阿里云邮件推送（DirectMail）SMTP（`smtpdm.aliyun.com:465`，TLS）；发信地址形如 `noreply@<备案域名>`，配置 SPF / DKIM / DMARC。SMTP 用户名与密码放 `secrets.env`，不入库、不进文档。
- **DirectMail 需要已备案的域名**：域名推迟到上线前选定（用户 2026-10-22），因此在上线清单中列为前置条件（[deployment](../02-solution/deployment.md)）。开发与预发环境用本地 SMTP 捕获器，不真正发信。

## 后果
- Q2、Q3、Q15 关闭；不再有“阿里云文字识别 OCR”这一外部依赖。
- 数据库新增 `ai_providers` 1 张表；系统设置删除 `ai.model`，`studio.unit_prices.ocr_page_fen` 改名为 `vision_page_fen`。
- 后台增加“模型配置”页（[admin flows](../04-ui-design/README.md)）。

## 未采用的方案
- 专门的 OCR 服务：用户决定不用；视觉模型对课本照片的版面理解更好，少一个依赖。
- Key 写在 `secrets.env` 而不是数据库：用户要求后台可配置；数据库只存密文，主密钥仍在 secrets 中。
