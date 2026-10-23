# wireframes —— 线框图

按使用者分组，再按功能分目录（与前端功能目录一一对应）。孩子端线框已按原型 D + ADR 0020 填写；家长与后台目录仍为占位，待下一阶段。

- `child/`：login、learn、review、wordbook、companion、discovery、album、shop、social、chat、footprint、inbox、settings；另含共享 [shell.md](child/shell.md)。见 [child/README.md](child/README.md)。对应 `apps/web/src/features/child/`。
- `parent/`：dashboard、reports、controls、approvals（以及 overview、rewards 规划中）——**尚未填线框**。对应 `apps/web/src/features/parent/`。
- `admin/`：studio、skills、agents、runs、courses、pets、yahaha、rules、families、settings、audit 等——**尚未填线框**。对应 `apps/admin/src/features/`。

画框约定见 [04-ui-design/README.md](../README.md) 与 [nfr §8.4](../../01-requirements/nfr.md#84-设备与屏幕)。
