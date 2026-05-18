# Workbench 前端控件与交互缺失分析 + 实施计划

> 对照 `workbench-ui-ux-spec.md` 检查当前 `src/components/workbench/` 实现。
> 本文档只关注纯 UI 层：组件结构、样式、交互骨架。不涉及数据绑定、store 对接或业务逻辑。

## 0. 指导原则

1. **纯前端先行** — 本阶段只搭建控件结构和交互骨架，留 prop callback 接口，不做数据绑定。
2. **接口用注释说明意图** — 每个 callback prop 用 JSDoc `@callback` 注释说明预期的调用时机和参数语义。
3. **四模式颜色统一** — Play=蓝 `#2563ff`、Problem=琥珀 `#d97706`、Recall=绿 `#169b55`、Analysis=紫 `#7c3aed`。
4. **棋盘占位** — MainBoardStage 保持占位符，Goban 集成属于后续阶段。

---

## 1. 当前已有组件

| 组件 | 路径 | 状态 |
|------|------|------|
| GlobalHeader | `workbench/shell/GlobalHeader.js` | 可用，缺交互 |
| ModeBar | `workbench/shell/ModeBar.js` | 可用，有 onModeChange |
| MainBoardStage | `workbench/shell/MainBoardStage.js` | 占位符 |
| RightModePanel | `workbench/shell/RightModePanel.js` | 外壳，无内容 |
| BottomActionBar | `workbench/shell/BottomActionBar.js` | 可用，未按模式区分 |
| TrainingTabBar | `workbench/shell/TrainingTabBar.js` | 可用 |
| PlayModePanel | `workbench/panels/PlayModePanel.js` | 可用 |
| ProblemModePanel | `workbench/panels/ProblemModePanel.js` | 可用 |
| RecallModePanel | `workbench/panels/RecallModePanel.js` | 骨架，缺关键交互 |
| RecallCheckpointPanel | `workbench/panels/RecallCheckpointPanel.js` | 可用，缺操作按钮 |
| AnalysisModePanel | `workbench/panels/AnalysisModePanel.js` | 可用，缺右栏面板 |
| 16 个 shared 组件 | `workbench/shared/*.js` | 可用 |
| workbench.css | `style/workbench.css` | 可用，颜色需修正 |

---

## 2. 缺失项总表

### 2.1 P0 — 阻塞性缺失

| # | 缺失项 | 影响范围 | 说明 |
|---|--------|---------|------|
| 1 | 四模式颜色对调 | 全局 | CSS 变量 `--ui-play`/`--ui-problem`/`--ui-recall-mode`/`--ui-analysis` 的色值与 spec 相反 |
| 2 | 右侧面板内容 | 四模式右栏 | RightModePanel 只有外壳，四个模式各自应有 3-5 张卡片 |
| 3 | AppChrome 独立组件 | §1.3 | GlobalHeader 覆盖部分，但缺 QuietStatusChips 独立化、窄窗口折叠 |

### 2.2 P1 — 核心交互缺失

| # | 缺失项 | 影响范围 | 说明 |
|---|--------|---------|------|
| 4 | 顶部右侧动作区按模式切换 | §2 | 当前无 ModeActions 组件，应按 activeMode 渲染不同按钮组 |
| 5 | 底部栏按模式切换内容 | §10 | BottomActionBar 未区分四模式，各模式按钮组不同 |
| 6 | Recall「先复现原线」开关 + 双模式 | §7 | 无 ModeToggle 组件，缺开/关两套左栏布局切换 |
| 7 | RightDrawer 抽屉组件 | §4.1 | 无右侧展开抽屉，AI 分析/变化树/快照对比需此容器 |
| 8 | Play 左栏「当前任务」操作按钮 | §5 | 缺「标记疑问手」「进入复盘」按钮 |
| 9 | Problem 左栏题面独立展示 | §6 | 缺 prompt/goal/passRule 摘要的独立卡片区 |
| 10 | Problem 作答操作「请求提示」 | §6 | 缺少提示请求按钮 |

### 2.3 P2 — 辅助交互缺失

| # | 缺失项 | 影响范围 | 说明 |
|---|--------|---------|------|
| 11 | AnnotationToolbar 标注工具栏 | §8 | Analysis 底部标注工具（黑白/X/△/□/○/线/箭头/A/1） |
| 12 | ProgressRing 环形进度 | §7 | Recall 进度展示用环形图，当前是线性 progress bar |
| 13 | EmptyStatePanel 空态卡片 | §4 | AI 分析/变化树等的统一空态展示 |
| 14 | ReferenceLineSummary 参考变化摘要 | §6 | Problem 提交前参考线数量/标签摘要 |
| 15 | MaterialLibraryDialog 材料库 | §1.4 | `文件 > 材料库...` 独立 dialog |
| 16 | OpponentControl 对方控制 | §6 | Problem 黑白双方「自己/AI」切换独立组件 |
| 17 | 状态覆盖 6 种变体 | §11 | 每个模式需空态/进行中/成功/错误/loading/disabled |
| 18 | 响应式折叠规则 | §1.2 | 窄窗口右栏→抽屉、左栏→抽屉逻辑 |

---

## 3. 实施计划

### Phase 1：基础修正（影响全局，必须先做）

#### 1.1 修正 CSS 颜色变量

文件：`style/workbench.css`

```css
/* 修正前 → 修正后 */
--ui-play: #16a34a       → --ui-play: #2563ff
--ui-play-soft: #f0fdf4  → --ui-play-soft: #eef4ff
--ui-problem: #2563eb    → --ui-problem: #d97706
--ui-problem-soft: #eff6ff → --ui-problem-soft: #fff7ed
--ui-recall-mode: #7c3aed → --ui-recall-mode: #169b55
--ui-recall-mode-soft: #f5f3ff → --ui-recall-mode-soft: #eaf8f0
--ui-analysis: #f59e0b   → --ui-analysis: #7c3aed
--ui-analysis-soft: #fffbeb → --ui-analysis-soft: #f2edff
```

同步更新 `style/app.css` 中 `--ui-blue`/`--ui-recall`/`--ui-review` 的语义注释。

#### 1.2 拆出 QuietStatusChips 组件

从 GlobalHeader 中提取状态 chips 为独立组件，增加窄窗口折叠：

```
QuietStatusChips
  props:
    saveStatus: 'saved' | 'saving' | 'failed'
    engineStatus: 'disconnected' | 'connecting' | 'idle' | 'thinking'
    attemptStatus: 'active' | 'frozen' | 'recall'
    syncStatus: 'ok' | 'pending:N' | 'offline'
```

---

### Phase 2：缺失共享组件

以下组件均为纯 UI，通过 props 接收数据，通过 callback 向外通信。

#### 2.1 EmptyStatePanel

```
props:
  icon: string          // 图标名
  title: string         // 空态标题
  description: string   // 说明文案
  action?: { label, onClick }  // 可选操作按钮
```

#### 2.2 ProgressRing

```
props:
  progress: number      // 0-100
  size?: number         // 默认 80
  label?: string        // 中心文字
  color?: string        // 进度色
```

#### 2.3 ModeToggle

```
props:
  label: string         // 如「先复现原线」
  checked: boolean
  onChange: (checked: boolean) => void
```

#### 2.4 OpponentControl

```
props:
  label: string         // 「黑方」或「白方」
  value: 'self' | 'ai'
  onChange: (value) => void
  disabled?: boolean
  disabledReason?: string  // tooltip 文案
```

#### 2.5 ReferenceLineSummary

```
props:
  lines: Array<{ label: string, length: number }>
  totalCount: number
```

#### 2.6 RightDrawer

```
props:
  open: boolean
  title: string
  onClose: () => void
  width?: number        // 默认 480
  children: ReactNode
```

行为：fixed 定位，从右侧滑出，Esc 关闭，不影响三栏布局。

#### 2.7 AnnotationToolbar

```
props:
  activeTool: string    // 'stone-b' | 'stone-w' | 'x' | 'triangle' | 'square' | 'circle' | 'line' | 'arrow' | 'label-a' | 'label-1'
  onToolChange: (tool) => void
  disabled?: boolean
```

#### 2.8 MaterialLibraryDialog

```
props:
  open: boolean
  onClose: () => void
  onOpenTask: (taskId: string) => void  // 打开材料后回调
```

UI：modal dialog，内部结构待定，本阶段只搭壳。

---

### Phase 3：顶部右侧 ModeActions 组件

新建 `workbench/shell/ModeActions.js`，按 activeMode 渲染不同按钮组：

```
props:
  mode: 'play' | 'problem' | 'recall' | 'analysis'
  onNewGame: () => void
  onGameSettings: () => void
  onEndAttempt: () => void
  onResign: () => void          // 红色旗帜按钮
  onSubmitAnswer: () => void
  onAbandonAnswer: () => void
  onProblemSettings: () => void
  onEnterAnalysis: () => void
  onEndRecall: () => void
  onSnapshot: () => void
  onAnalysisSettings: () => void
  onReturnToPreviousMode: () => void
```

各模式渲染逻辑：

| Play | Problem | Recall | Analysis |
|------|---------|--------|----------|
| + 新对局 | 提交答案 | 进入复盘 | Snapshot / 派生新 Task |
| 对局设置 | 放弃作答 | 结束回忆 | 复盘设置 |
| 结束当前 attempt | 做题设置 | Snapshot | 返回上一个模式 |
| 认输(红色) | 进入复盘 | | |

---

### Phase 4：底部栏模式化

改造 `BottomActionBar.js`，增加 mode prop，按模式切换：

#### Play 底部

```
[悔棋] [Pass] [认输] [结束当前 attempt] [标记疑问手]   [选择] [手型] [-] [+] [全屏]
```

#### Problem 底部

```
[悔棋] [重做] [Pass] [请求提示] [提交答案] [放弃作答]   [选择] [手型] [-] [+] [全屏]
```

#### Recall 底部

```
[标记 checkpoint] [提示] [校对/跳过] [进入复盘]          [选择] [手型] [-] [+] [全屏]
```

#### Analysis 底部

```
标注工具组: [黑] [白] [X] [△] [□] [○] [线] [箭头] [A] [1]   [撤销] [重做] [清空] [Edit position] [Snapshot] [100%]
```

新增 props：

```
props:
  mode: 'play' | 'problem' | 'recall' | 'analysis'
  // Play
  onUndo, onPass, onResign, onEndAttempt, onMarkDoubtful
  // Problem
  onUndo, onRedo, onPass, onRequestHint, onSubmitAnswer, onAbandonAnswer
  // Recall
  onMarkCheckpoint, onHint, onVerifyOrSkip, onEnterAnalysis
  // Analysis
  activeAnnotationTool, onAnnotationToolChange
  onUndo, onRedo, onClear, onEditPosition, onSnapshot
  // 通用
  onToolSelect, onShapeSelect, onZoomIn, onZoomOut, onFullscreen
```

---

### Phase 5：左侧面板补全

#### 5.1 Play — 当前任务操作

在 PlayModePanel 底部增加操作区：

```
props 新增:
  onMarkDoubtful: () => void
  onEnterAnalysis: () => void
```

渲染「标记疑问手」「进入复盘」按钮。

#### 5.2 Problem — 题面与目标独立卡片

在 ProblemModePanel 增加独立展示区：

```
props 新增:
  prompt: string
  goal: string
  passRuleSummary: string
  referenceLines: Array<{ label, length }>
  onRequestHint: () => void
```

使用 ReferenceLineSummary 组件渲染参考线摘要。

#### 5.3 Recall — 双模式切换

RecallModePanel 根据「先复现原线」开关渲染两套布局：

**开启模式（默认）：**
- ProgressRing 环形进度
- 进度/正确/状态统计
- 操作按钮：标记 checkpoint / 校对跳过 / 提示 / 结束回忆

**关闭模式：**
- Checkpoint 队列列表
- 当前 checkpoint 面板
- 操作按钮：提交修正图 / 查看 AI / 跳过 checkpoint

```
props:
  recallOriginalLine: boolean     // 先复现原线 开关
  onRecallToggle: (checked) => void
  // 开启模式
  progress: number                // 0-100
  currentMove: number
  totalMoves: number
  correctCount: number
  wrongCount: number
  status: 'waiting' | 'correct' | 'wrong' | 'complete'
  onMarkCheckpoint: () => void
  onVerify: () => void
  onSkip: () => void
  onHint: () => void
  onEndRecall: () => void
  // 关闭模式
  checkpoints: Array<{ id, moveNumber, source: 'system' | 'manual', summary }>
  activeCheckpointId: string | null
  onSubmitCorrection: () => void
  onRevealAI: () => void
  onSkipCheckpoint: () => void
```

---

### Phase 6：右侧面板内容

新建四个模式的右栏面板组件。

#### 6.1 PlayRightPanel

```
┌─ 局面信息 ──────────────────┐
│ 手数: N   提子: 黑 X / 白 Y │
│ pending 评价: N  坏棋记录: N │
└─────────────────────────────┘
┌─ AI 分析 ───────────────────┐
│ EmptyStatePanel              │
│ "连接引擎后可查看分析结果"   │
│ [展开] → RightDrawer         │
└─────────────────────────────┘
┌─ 变化树 ────────────────────┐
│ EmptyStatePanel              │
│ "对局过程中将自动记录变化"   │
│ [展开] → RightDrawer         │
└─────────────────────────────┘
```

#### 6.2 ProblemRightPanel

```
┌─ 答案草稿 ─────────────────┐
│ 当前变化 N 手               │
│ 对方：自己控制 / AI 应手    │
└─────────────────────────────┘
┌─ Hint ──────────────────────┐
│ HintCard (已有)             │
└─────────────────────────────┘
┌─ AI 分析 ───────────────────┐
│ "AI 答案默认隐藏"           │
│ [展开] → RightDrawer         │
└─────────────────────────────┘
┌─ 参考变化摘要 ──────────────┐
│ ReferenceLineSummary         │
│ "提交后可在 Recall 展开对比" │
└─────────────────────────────┘
```

#### 6.3 RecallRightPanel

```
┌─ 回忆提示 ──────────────────┐
│ "下一手：保持回忆"           │
│ "尚未 reveal AI candidates"  │
└─────────────────────────────┘
┌─ Checkpoint 摘要 ───────────┐
│ 系统触发: N  手动标记: N     │
│ 当前状态: ...                │
└─────────────────────────────┘
┌─ 结果反馈 ──────────────────┐
│ 正确: N   错误: N            │
│ 总进度: X / Y [progress]     │
└─────────────────────────────┘
┌─ 轻量变化树 ────────────────┐
│ EmptyStatePanel              │
│ [展开] → RightDrawer         │
└─────────────────────────────┘
```

#### 6.4 AnalysisRightPanel

```
┌─ AI 分析 ───────────────────┐
│ EmptyStatePanel              │
│ [展开] → RightDrawer         │
└─────────────────────────────┘
┌─ 局面点评 ──────────────────┐
│ 手数: N  提子: 黑 X / 白 Y  │
│ 综合评价: --                 │
└─────────────────────────────┘
┌─ 变化树 ────────────────────┐
│ EmptyStatePanel              │
│ [展开] → RightDrawer         │
└─────────────────────────────┘
┌─ 对比 ──────────────────────┐
│ 用户原线: --  用户修正: --   │
│ AI candidates: --            │
└─────────────────────────────┘
┌─ 快照对比 ──────────────────┐
│ "捕捉参考局面后可快照对比"   │
│ [添加快照] [展开] → Drawer   │
└─────────────────────────────┘
```

---

### Phase 7：响应式与状态覆盖

#### 7.1 响应式折叠

在 workbench.css 中补充媒体查询：

```css
/* >= 1280px: 三栏 */
/* 1000-1279: 右栏变抽屉，左栏收窄 */
@media (max-width: 1279px) { ... }
/* < 1000px: 左栏也变抽屉 */
@media (max-width: 999px) { ... }
```

#### 7.2 状态覆盖

每个面板组件通过 props 接收 state 变量，渲染对应 UI 变体：

```
state: 'empty' | 'active' | 'success' | 'error' | 'loading' | 'disabled'
```

六个状态对应 UI 差异：
- empty → EmptyStatePanel
- active → 正常内容
- success → 绿色状态标记
- error → 红色提示 + 重试
- loading → spinner / 骨架屏
- disabled → 灰色 + tooltip 说明原因

---

## 4. 文件变更清单

| Phase | 新建文件 | 修改文件 |
|-------|---------|---------|
| 1 | — | `style/workbench.css`, `style/app.css`, `workbench/shell/GlobalHeader.js` |
| 2 | `shared/EmptyStatePanel.js`, `shared/ProgressRing.js`, `shared/ModeToggle.js`, `shared/OpponentControl.js`, `shared/ReferenceLineSummary.js`, `shared/RightDrawer.js`, `shared/AnnotationToolbar.js`, `shared/MaterialLibraryDialog.js` | — |
| 3 | `shell/ModeActions.js` | `shell/ModeBar.js`（集成 ModeActions） |
| 4 | — | `shell/BottomActionBar.js` |
| 5 | — | `panels/PlayModePanel.js`, `panels/ProblemModePanel.js`, `panels/RecallModePanel.js`, `panels/RecallCheckpointPanel.js` |
| 6 | `panels/PlayRightPanel.js`, `panels/ProblemRightPanel.js`, `panels/RecallRightPanel.js`, `panels/AnalysisRightPanel.js` | `shell/RightModePanel.js`（按 mode 切换） |
| 7 | — | `style/workbench.css` |

---

## 5. 接口约定

所有新增组件遵循以下约定：

1. **Props 驱动** — 不读取全局 store，所有数据通过 props 传入。
2. **Callback 外传** — 所有交互通过 `onXxx` 回调上抛，组件内部不执行副作用。
3. **JSDoc 注释** — 每个 callback prop 用 `@callback` 注释说明调用时机和参数语义。
4. **Mode prop** — 需要模式感知的组件接收 `mode: 'play' | 'problem' | 'recall' | 'analysis'`。
5. **State prop** — 需要多状态的面板接收 `state: 'empty' | 'active' | 'success' | 'error' | 'loading' | 'disabled'`。

示例：

```js
/**
 * @callback onSubmitAnswer
 * 用户点击「提交答案」后触发。
 * 期望：冻结当前 Attempt，执行 passRule 评价，创建 RecallSession，切换到 Recall 模式。
 */

/**
 * @callback onResign
 * 用户点击「认输」后触发。
 * 期望：冻结当前 Attempt，创建 RecallSession，切换到 Recall 模式。
 */
```
