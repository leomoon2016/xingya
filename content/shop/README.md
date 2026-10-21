# shop —— 装扮初始数据

`shop.json`：装扮（head/body/accessory）的 ID、名称、价格（1–1000）、图片文件与 `artSource`（必须 `original:*` 或 `licensed:*`，禁止第三方 IP）。首次部署时由 `xingya shop:import` 写入 `shop_items` 与素材库，之后在后台维护。学习伙伴不在商店，由 AI 工作室设计。
