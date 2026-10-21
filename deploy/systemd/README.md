# systemd

`xingya.service`（`User=xingya`、`Restart=always`、`MemoryMax=600M`、`EnvironmentFile=/etc/xingya/secrets.env`；允许通过 `systemd-run --user --scope -p MemoryMax=350M` 启动一次性 Piper/ffmpeg 进程）、`xingya-backup.service/.timer`（每日 03:30）、`xingya-alerts.service/.timer`（每 5 分钟）。没有常驻语音服务。

**是否上服务器**：是（`/etc/systemd/system/`）。
