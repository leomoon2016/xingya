# wireframes/child —— 孩子端线框图

画框：主 **1024×768** 横屏，另注 **360×800** 手机竖屏。外壳与色板依据原型 D + [ADR 0020](../../../adr/0020-revert-to-old-system.md)。令牌见 [`tokens/design-tokens.json`](../../tokens/design-tokens.json)。

**尚未绘制**：家长中心、后台线框；高保真 mockups；种子 SVG 素材。

## 外壳

| 文件 | 说明 |
| --- | --- |
| [shell.md](shell.md) | 顶栏（课程、呀哈哈 N/1000、星星、信箱、头像徽章）+ 六项导航 + 头像菜单 + 队长 FAB；手机底 Tab |

## 按功能

| 目录 | 线框 | 对应功能 |
| --- | --- | --- |
| [login/](login/) | [avatar-wall.md](login/avatar-wall.md)、[pin.md](login/pin.md) | 头像墙 / PIN |
| [learn/](learn/) | [home.md](learn/home.md)、[unit-map.md](learn/unit-map.md)、[overview.md](learn/overview.md)、[learning-card.md](learn/learning-card.md)、[quiz.md](learn/quiz.md)、[settlement.md](learn/settlement.md)、[secret-route.md](learn/secret-route.md)、[hidden-reward.md](learn/hidden-reward.md) | 我的学习、闯关地图、启思大陆、学习卡、作答、结算、秘密路线、隐藏奖励 |
| [review/](review/) | [station.md](review/station.md) | 复习小站 |
| [wordbook/](wordbook/) | [home.md](wordbook/home.md)、[edit.md](wordbook/edit.md)、[study.md](wordbook/study.md)、[challenge.md](wordbook/challenge.md)、[exam.md](wordbook/exam.md)、[settlement.md](wordbook/settlement.md) | 我的单词（对齐 flows） |
| [shop/](shop/) | [home.md](shop/home.md)、[badges.md](shop/badges.md)、[rewards.md](shop/rewards.md) | 星星小铺四卡 |
| [companion/](companion/) | [den.md](companion/den.md)、[pet-detail.md](companion/pet-detail.md)、[adopt.md](companion/adopt.md) | 宠物家园 |
| [social/](social/) | [partners.md](social/partners.md)、[gift-stars.md](social/gift-stars.md) | 星星伙伴 |
| [discovery/](discovery/) | [hideouts.md](discovery/hideouts.md) | 藏匿点情境 |
| [album/](album/) | [album.md](album/album.md) | 图鉴集齐进度 |
| [chat/](chat/) | [captain.md](chat/captain.md) | 呀哈哈队长 |
| [inbox/](inbox/) | [inbox.md](inbox/inbox.md) | 信箱（头像旁入口） |
| [footprint/](footprint/) | [footprint.md](footprint/footprint.md) | 学习足迹（头像菜单） |
| [settings/](settings/) | [settings.md](settings/settings.md) | 我的设置（头像菜单） |

六项导航：**我的学习 / 闯关地图 / 星星小铺 / 星星伙伴 / 宠物家园 / 我的单词**。设置与足迹不进 Tab。
