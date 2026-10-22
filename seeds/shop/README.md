# shop —— 探险徽章初始数据

`shop.json`：探险徽章（旧系统星星小铺“探险徽章”卡，同时只佩戴一枚，ADR 0020）的 ID、名称、价格（1–1000）、图片文件与 `artSource`（必须 `original:*` 或 `licensed:*`，禁止第三方 IP）。部署步骤 `xingya seeds:apply` 只插入缺失的徽章到 `shop_items` 与素材库（不覆盖后台修改），之后在后台维护。伙伴不在商店，由 AI 工作室设计。
