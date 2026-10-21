# runner —— 角色执行器

提示词组装（系统守则 `seeds/safety/agent-guard.md` 永远在最前）、工具循环（≤ 20 步，儿童 3 步）、超时、输出模式校验与一次修正、费用上限、流水线逐步入队、呀哈哈队长的同步执行路径（`reserveChildAgentInTx` / `runChildAgent` / `settleChildAgentInTx`）。拥有的表：agent_runs、agent_run_steps。设计：`docs/03-design/modules/agents.md`。

**是否上服务器**：是（编译进 api）。
