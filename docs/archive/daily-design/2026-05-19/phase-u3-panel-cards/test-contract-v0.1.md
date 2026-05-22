# Phase U3: 面板内容卡片化 — 测试契约 v0.1

## 变更范围

8 个面板组件（4左+4右）从平铺 div 改为 `.wb-card` 卡片结构。

## 卡片化规范

### Play 左栏（3 卡片）
1. 对局模式 — 模式描述 + 当前行棋方
2. 黑白控制 — OpponentControl
3. 当前任务 — 任务信息 + 操作按钮

### Problem 左栏（4 卡片）
1. 做题模式 — 模式描述
2. 题面与目标 — prompt + goal + rules + referenceLines
3. 对方控制 — OpponentControl
4. 作答操作 — 请求提示

### Recall 左栏（2-3 卡片）
1. 回忆模式 — ModeToggle + 进度
2. 复现进度 / 检查点队列（取决于 toggle）

### Analysis 左栏（3 卡片）
1. 复盘模式 — 模式描述
2. 局面信息 — 手数 + 提子 + 评价
3. 操作 — Snapshot 按钮

### 右面板（通用）
每个 section 用 `.wb-card` + `.wb-panel-title` 包裹。

## 验收标准
- `.wb-card` 包裹每个内容区
- `.wb-panel-title` 作为卡片标题
- state overlay 不受影响
- callback props 保留
- data-testid 保留
