# shop —— 装扮初始数据

`shop.json`：装扮（head/body/accessory）的 ID、名称、价格（1–1000）、图片文件与 `artSource`（必须 `original:*` 或 `licensed:*`，禁止第三方 IP）。部署步骤 `xingya seeds:apply` 只插入缺失的装扮到 `shop_items` 与素材库（不覆盖后台修改），之后在后台维护。学习伙伴不在商店，由 AI 工作室设计。
