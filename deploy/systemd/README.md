# systemd

`xingya.service`（`User=xingya`、`Restart=always`、`MemoryMax=600M`、`EnvironmentFile=/etc/xingya/secrets.env`）、`xingya-backup.service/.timer`（每日 03:30）、`xingya-alerts.service/.timer`（每 5 分钟）。

**是否上服务器**：是（`/etc/systemd/system/`）。
