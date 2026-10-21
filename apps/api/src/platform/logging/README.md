# logging —— 日志与错误

pino JSON 日志与脱敏规则（不记录对话、口令、令牌）、统一错误体 `{error:{code,message,details,traceId}}` 与错误码映射、进程内 5xx 计数（供异常页）。
