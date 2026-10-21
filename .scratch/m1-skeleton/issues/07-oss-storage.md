# 07: 对象存储接入

**What to build:** 服务端可以把素材写入阿里云 OSS、为草稿素材签发短期签名 URL、把已发布素材复制到经 CDN 提供的公开前缀；孩子端永远只拿到 `pub/` 的 CDN 地址。OSS 私有桶、CDN 与两个 RAM 子账号的配置有可照着执行的说明（或脚本），权限最小化。开发与测试环境使用同一接口的本地目录实现，不需要真实云账号。

开通 OSS/CDN、创建 RAM 子账号需要项目负责人的阿里云账号，属于本人步骤；CDN 子域名需要 ICP 备案（尚未完成），备案前素材临时用 OSS 签名 URL（路线图风险 R1）。

依据：[deployment §9.2a](../../../docs/02-solution/deployment.md)、[ADR 0010](../../../docs/adr/0010-oss-cdn-publish-time-piper.md)、[nfr §8.1](../../../docs/01-requirements/nfr.md)“素材与 OSS”、开放问题 Q14。

**人工步骤说明：** agent 可以编写 OSS 客户端、本地目录实现、权限策略文件与配置说明；开通 OSS 桶与 CDN、创建 RAM 子账号与 AccessKey、CDN 域名的 ICP 备案由项目负责人本人在阿里云账号中完成。

**Blocked by:** [02 平台层和初始迁移](02-platform-layer.md)

**Status:** ready-for-human

- [ ] 配置说明（或脚本）覆盖：一个与 ECS 同地域的私有桶，前缀 `draft/`、`materials/`、`pub/`、`xingya/db/`；`pub/` 经 CDN 提供并使用 OSS 私有桶回源鉴权；按内容哈希命名的文件 `Cache-Control: public, max-age=31536000, immutable`；CORS 只允许主站源与后台源；开启 Referer 防盗链；`xingya/db/` 生命周期 14 天删除。
- [ ] RAM 子账号：api 用的子账号只能读写与复制本桶 `draft/`、`materials/`、`pub/`，不能删除桶、改策略或访问 `xingya/db/`；备份用的子账号只能写 `xingya/db/`。策略文档以文件形式提交，不含任何 AccessKey。
- [ ] 服务端 OSS 客户端（平台层）提供：按内容哈希命名写入、签发 10 分钟有效的签名 URL、从 `draft/` 复制到 `pub/`、生成 `pub/` 的 CDN 地址；没有删除操作（素材从不物理删除）。
- [ ] 凭据只从 `/etc/xingya/secrets.env` 对应的环境变量读取，日志中不出现 AccessKey 与签名。
- [ ] 本地目录实现与 OSS 实现满足同一接口；同一组契约测试对本地实现在 CI 中运行，对真实 OSS 可手动运行。
- [ ] CDN 域名未就绪时，配置可切换为返回签名 URL（备案前的临时方案），切换不需要改代码。
