# Phase U2: 结构级高优修正 — 测试契约 v0.1

## 修正清单

| ID | 修正项 | 涉及组件 |
|----|--------|---------|
| U2-1 | StoneStatus 黑白提子状态区 | StoneStatus.js (新增), GlobalHeader.js |
| U2-2 | ModeBar 改 segmented control + 中文 | ModeBar.js |
| U2-3 | BottomActionBar 左侧状态文案 | BottomActionBar.js |
| U2-4 | ModeActions 中文化 | ModeActions.js |
| U2-5 | 移除 GlobalHeader 头像 | GlobalHeader.js |
| U2-6 | GlobalHeader 中文化 | GlobalHeader.js |

## 验收标准

### U2-1: StoneStatus
- 渲染 .wb-stone-indicator--black 和 .wb-stone-indicator--white
- 显示提子数文本
- 当前轮次有激活标记
- GlobalHeader 在 taskTitle 之前渲染 StoneStatus

### U2-2: ModeBar segmented control
- 使用 .wb-segmented-control 容器类
- 标签使用 .wb-segmented-control__item
- 激活项使用 .wb-segmented-control__item--active
- 中文标签：对局/做题/回忆/复盘
- 不再使用 .wb-mode-bar__tab-indicator
- 点击触发 onModeChange

### U2-3: BottomActionBar 状态文案
- 存在 .wb-status-text 区域
- 包含 workspaceLabel, moveNumber, engineStatus
- 不同 mode 不同 workspaceLabel

### U2-4: ModeActions 中文化
- Play: 新对局/对局设置/结束/认输
- Problem: 提交答案/放弃作答/做题设置/进入复盘
- Recall: 标记/提示/校对/进入复盘
- Analysis: Snapshot/返回

### U2-5: 移除头像
- 无 .wb-global-header__avatar 元素
- 无 GC initials

### U2-6: 中文化
- mode chip 中文标签

## 架构边界
- 组件不 import sabaki.js
- 所有数据通过 props，动作通过 callback props
