# components —— 组件规范

共享基础组件落在 `packages/ui`（由 [`tokens/design-tokens.json`](../tokens/design-tokens.json) 生成主题）。孩子/家长扩展在 `apps/web/src/components`，后台在 `apps/admin/src/components`。

令牌引用写法：`color.child.teal`、`touch.minTarget`、`radius.4xl` 等。

## 通用（packages/ui）

| 组件 | 用途 | 关键令牌 |
| --- | --- | --- |
| Button / ButtonLine | 主按钮 / 线框按钮 | `color.child.teal`、`shadow.btnPrimary`、`touch.primaryButtonMinHeight`；家长/后台用 `color.neutral` + 较小高度 |
| IconButton | 返回、关闭、喇叭 | ≥ `touch.minTarget` 44 |
| Card | 内容容器 | 孩子 `radius.4xl` + `color.child.line`；家长/后台 `radius.md` + `color.neutral.border` |
| FocusRing | `:focus-visible` | `color.neutral.focus` |
| Badge | 未读数、考试中 | `color.child.danger` |
| EmptyState | 空列表插画+CTA | — |
| Toast | 短时反馈 | 顶中，不挡主按钮 |
| Modal / Sheet | 确认、核销、入场费 | 焦点陷阱；手机 Sheet |
| TextField / Select / TextArea | 表单 | 标签可见；错误文案 `color.semantic.error` |
| Switch | 偏好、跨家庭、启用 | 可读名称 |
| Tabs / Segmented | 分段 | 孩子木牌黄指示或 teal 底条 |

## 孩子端

| 组件 | 说明 | 令牌 |
| --- | --- | --- |
| ChildTopBar | 课程下拉、呀哈哈 N/1000、星星、信箱、头像 | `color.child.*` |
| ChildNav / BottomTabBar | 六项导航；手机底栏 | `color.child.wood` 当前短线 |
| AvatarMenu | 足迹、设置、换人 | — |
| PinPad + PinDots | PIN 键盘 | `touch.keypadKey`、shake 受 reduce-motion |
| KidCard | 头像墙卡片 | 金环 `gold` / 锁定 `stone` |
| StarPlate | 1–3 星级 | `color.child.star` |
| AdventureMap / LevelNode | 单元地图节点 | currentGlow、medal |
| QuizOption / ChipOrder | 选项与词块 | 学习字体 `typography.fontFamily.latinLearning` |
| ProgressTrail | 闯关进度轨道 | `trailFill` / `trailRail` |
| SettlementGains | 星星/碎片/积分收益条 | — |
| HideoutSpot | 藏匿点三选 | — |
| ShopQuadCard | 小铺四卡 | — |
| DenSlot | 营地格 | — |
| CaptainFab + ChatPanel | 呀哈哈队长 | zIndex.captainFab |

## 家长中心

| 组件 | 说明 |
| --- | --- |
| ParentShell | 侧栏 / 手机底栏 |
| ChildChipSwitcher | 多孩切换 |
| ApprovalCard | 兑换/好友请求批准拒绝 |
| TimeGrantButton | 再玩 15 分钟 |
| RewardWriteoffForm | 核销数量+原因 |
| StarAdjustForm | 加星/扣星（扣星原因必填） |
| ReportChart | 图表+数值表后备 |

## 后台

| 组件 | 说明 |
| --- | --- |
| AdminShell | 深色侧栏 dense |
| DataTable | 排序、行操作 |
| ProviderKeyField | Key 只写不读，显示末 4 位 |
| RunStepper | ≤20 步时间线 |
| BudgetMeter | 月度预算 |
| AuditDetail | 折叠 JSON（无密钥） |

## 无障碍基线

对比度 ≥ 4.5:1；触控 ≥ 44（孩子/家长）；`prefers-reduced-motion`；状态不只靠颜色；axe 关键页无严重违规（nfr §8.3）。
