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

### 已实现（Phase 1-3）

| 组件 | 路径 | 状态 |
|------|------|------|
| GlobalHeader | `workbench/shell/GlobalHeader.js` | 可用，QuietStatusChips 已提取为独立组件 |
| ModeBar | `workbench/shell/ModeBar.js` | 可用，已集成 ModeActions |
| ModeActions | `workbench/shell/ModeActions.js` | 可用，四模式按钮组 |
| QuietStatusChips | `workbench/shared/QuietStatusChips.js` | 可用 |
| EmptyStatePanel | `workbench/shared/EmptyStatePanel.js` | 可用 |
| ProgressRing | `workbench/shared/ProgressRing.js` | 可用 |
| ModeToggle | `workbench/shared/ModeToggle.js` | 可用 |
| OpponentControl | `workbench/shared/OpponentControl.js` | 可用 |
| ReferenceLineSummary | `workbench/shared/ReferenceLineSummary.js` | 可用 |
| RightDrawer | `workbench/shared/RightDrawer.js` | 可用 |
| AnnotationToolbar | `workbench/shared/AnnotationToolbar.js` | 可用 |
| MaterialLibraryDialog | `workbench/shared/MaterialLibraryDialog.js` | 壳可用 |
| workbench.css | `style/workbench.css` | 颜色已修正，752 行 |

### 已移除（revert a68a8345）— 需重建

以下组件在 Phase 1-3 实现后被清理，因为原始版本是占位实现或与新模式不符。它们将在 Phase 4-6 中按新模式重新创建。

| 组件 | 原路径 | 说明 |
|------|--------|------|
| MainBoardStage | `workbench/shell/MainBoardStage.js` | 需重建为占位符 |
| BottomActionBar | `workbench/shell/BottomActionBar.js` | 需重建为模式化底部栏 |
| RightModePanel | `workbench/shell/RightModePanel.js` | 需重建为右栏容器 |
| TrainingTabBar | `workbench/shell/TrainingTabBar.js` | 需重建 |
| PlayModePanel | `workbench/panels/PlayModePanel.js` | 需重建 |
| ProblemModePanel | `workbench/panels/ProblemModePanel.js` | 需重建 |
| RecallModePanel | `workbench/panels/RecallModePanel.js` | 需重建 |
| RecallCheckpointPanel | `workbench/panels/RecallCheckpointPanel.js` | 需重建 |
| AnalysisModePanel | `workbench/panels/AnalysisModePanel.js` | 需重建 |

---

## 2. 缺失项总表

### 2.1 ~~P0 — 阻塞性缺失~~ ✅ 已完成（Phase 1）

| # | 缺失项 | 状态 |
|---|--------|------|
| 1 | 四模式颜色对调 | ✅ Phase 1 已修正 |
| 2 | QuietStatusChips 独立化 | ✅ Phase 1 已提取 |
| 3 | CSS 变量 `--ui-play-soft` 等配套色值 | ⚠️ 已定义但 soft 色值仍需微调（见下方） |

> **遗留问题**：CSS 中 `--ui-play-soft: #f0fdf4`（绿底）而非蓝系软色 `#eef4ff`，其他三模式同理。soft 色未严格对齐主色色系，视觉上可能不协调。列为 P2 低优。

### 2.2 P1 — 核心交互缺失

| # | 缺失项 | 影响范围 | 说明 |
|---|--------|---------|------|
| 4 | ~~顶部右侧动作区按模式切换~~ | — | ✅ Phase 3 已实现 ModeActions |
| 5 | 底部栏按模式切换内容 | §10 | BottomActionBar 已移除，需重建为模式化 |
| 6 | MainBoardStage 占位符 | §1.3 | 已移除，需重建 |
| 7 | 右侧面板容器 + 四模式面板 | §4.1 | RightModePanel 已移除，需重建 + 四模式右栏面板 |
| 8 | 左侧四模式面板 | §5-8 | 所有 panels 已移除，需重建 |
| 9 | Recall「先复现原线」双模式 | §7 | ModeToggle 组件已有，需在 RecallModePanel 中使用 |
| 10 | TrainingTabBar | §1.2 | 已移除，需重建 |

### 2.3 P2 — 辅助交互缺失

| # | 缺失项 | 影响范围 | 说明 |
|---|--------|---------|------|
| 11 | AnnotationToolbar 集成到 Analysis 底部栏 | §8 | 组件已有，需在 BottomActionBar Analysis 模式中集成 |
| 12 | ProgressRing 集成到 Recall 面板 | §7 | 组件已有，需在 RecallModePanel 中使用 |
| 13 | EmptyStatePanel 集成到右栏 | §4 | 组件已有，需在右栏面板中使用 |
| 14 | ReferenceLineSummary 集成到 Problem 面板 | §6 | 组件已有，需在 ProblemModePanel 中使用 |
| 15 | MaterialLibraryDialog 集成 | §1.4 | 壳已有，需接入文件菜单 |
| 16 | OpponentControl 集成到 Problem 面板 | §6 | 组件已有，需在 ProblemModePanel 中使用 |
| 17 | 状态覆盖 6 种变体 | §11 | 各面板需支持 empty/active/success/error/loading/disabled |
| 18 | 响应式折叠规则 | §1.2 | 窄窗口右栏→抽屉、左栏→抽屉逻辑 |
| 19 | CSS soft 色值对齐主色色系 | 全局 | 当前 soft 色未严格匹配对应主色 |

---

## 3. 实施计划

### ~~Phase 1：基础修正~~ ✅ 已完成

CSS 颜色变量已修正，QuietStatusChips 已从 GlobalHeader 提取为独立组件。

---

### ~~Phase 2：缺失共享组件~~ ✅ 已完成

8 个共享组件 + QuietStatusChips 已全部实现：
- EmptyStatePanel、ProgressRing、ModeToggle、OpponentControl
- ReferenceLineSummary、RightDrawer、AnnotationToolbar、MaterialLibraryDialog

---

### ~~Phase 3：顶部右侧 ModeActions~~ ✅ 已完成

ModeActions 组件已创建并集成到 ModeBar，按 activeMode 渲染不同按钮组。

---

### Phase 4：Shell 骨架重建

重建被 revert 移除的 shell 组件，使其与 Phase 1-3 新组件协作。

#### 4.1 MainBoardStage（占位符）

```
props:
  mode: 'play' | 'problem' | 'recall' | 'analysis'
  children?: ReactNode     // 预留棋盘挂载点
```

简单的占位区域，显示模式标签和「棋盘区域」提示文字。

#### 4.2 TrainingTabBar

```
props:
  activeTab: 'play' | 'problem' | 'recall' | 'analysis'
  onTabChange: (tab) => void
  badgeCounts?: { play?: number, problem?: number, recall?: number, analysis?: number }
```

#### 4.3 BottomActionBar（模式化）

改造为按 mode prop 切换按钮组：

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

各模式渲染逻辑：

| Play | Problem | Recall | Analysis |
|------|---------|--------|----------|
| 悔棋 | 悔棋 | 标记 checkpoint | 标注工具组: 黑 白 X △ □ ○ 线 箭头 A 1 |
| Pass | 重做 | 提示 | 撤销 重做 清空 |
| 认输 | Pass | 校对/跳过 | Edit position |
| 结束 attempt | 请求提示 | 进入复盘 | Snapshot |
| 标记疑问手 | 提交答案 | | 100% |
| | 放弃作答 | | |
| 通用: 选择 手型 - + 全屏 | 同左 | 同左 | |

#### 4.4 RightModePanel（容器）

```
props:
  mode: 'play' | 'problem' | 'recall' | 'analysis'
  // 透传各模式面板所需 props
```

根据 mode 渲染对应的 RightPanel 组件。

---

### Phase 5：左侧面板重建

#### 5.1 PlayModePanel

```
props:
  taskTitle: string
  taskDescription: string
  moveCount: number
  captures: { black: number, white: number }
  onMarkDoubtful: () => void
  onEnterAnalysis: () => void
```

卡片：当前任务信息 + 操作按钮（标记疑问手、进入复盘）。

#### 5.2 ProblemModePanel

```
props:
  prompt: string
  goal: string
  passRuleSummary: string
  referenceLines: Array<{ label, length }>
  blackPlayer: 'self' | 'ai'
  whitePlayer: 'self' | 'ai'
  onOpponentChange: (color: 'black' | 'white', value: 'self' | 'ai') => void
  onRequestHint: () => void
```

使用 OpponentControl 和 ReferenceLineSummary 组件。

#### 5.3 RecallModePanel

根据 ModeToggle 「先复现原线」开关渲染两套布局：

**开启模式（默认）：**
- ProgressRing 环形进度
- 进度/正确/状态统计
- 操作按钮

**关闭模式：**
- Checkpoint 队列列表
- 当前 checkpoint 面板
- 操作按钮

```
props:
  recallOriginalLine: boolean
  onRecallToggle: (checked) => void
  progress: number
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
  checkpoints: Array<{ id, moveNumber, source, summary }>
  activeCheckpointId: string | null
  onSubmitCorrection: () => void
  onRevealAI: () => void
  onSkipCheckpoint: () => void
```

#### 5.4 RecallCheckpointPanel

```
props:
  checkpoint: { id, moveNumber, source, summary }
  isActive: boolean
  onSelect: () => void
```

#### 5.5 AnalysisModePanel

```
props:
  moveCount: number
  captures: { black: number, white: number }
  evaluation: string | null
  onSnapshot: () => void
```

---

### Phase 6：右侧面板内容

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
│ HintCard                    │
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
└─────────────────────────────┘
┌─ Checkpoint 摘要 ───────────┐
│ 系统触发: N  手动标记: N     │
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

#### 7.3 CSS soft 色值对齐

```css
/* 当前 → 应修正为 */
--ui-play-soft: #f0fdf4   → #eef4ff
--ui-problem-soft: #eff6ff → #fff7ed
--ui-recall-mode-soft: #f5f3ff → #eaf8f0
--ui-analysis-soft: #fffbeb → #f2edff
```

---

## 4. 文件变更清单

| Phase | 新建文件 | 修改文件 |
|-------|---------|---------|
| ~~1~~ ✅ | ~~QuietStatusChips.js~~ | ~~workbench.css, GlobalHeader.js~~ |
| ~~2~~ ✅ | ~~8 个 shared 组件~~ | — |
| ~~3~~ ✅ | ~~ModeActions.js~~ | ~~ModeBar.js, index.js~~ |
| 4 | — | — (重建已移除文件) |
| 5 | — | — (重建已移除文件) |
| 6 | `panels/PlayRightPanel.js`, `panels/ProblemRightPanel.js`, `panels/RecallRightPanel.js`, `panels/AnalysisRightPanel.js` | `shell/RightModePanel.js`（按 mode 切换） |
| 7 | — | `style/workbench.css` |

---

## 5. 实施进度

| Phase | 描述 | 提交 | 状态 |
|-------|------|------|------|
| 1 | 基础修正（CSS 颜色 + QuietStatusChips） | `3e025629` (test) + `051a8712` (impl) | ✅ 完成 |
| 2 | 8 个共享组件 | `3e025629` (test) + `051a8712` (impl) | ✅ 完成 |
| 3 | ModeActions + ModeBar 集成 | `3e025629` (test) + `051a8712` (impl) | ✅ 完成 |
| 4 | Shell 骨架重建 | `5057531b` (test) + `b3f8fa55` (impl) | ✅ 完成 |
| 5 | 左侧面板重建 | `ab9da009` (test) + `5d94484e` (impl) | ✅ 完成 |
| 6 | 右侧面板内容 | `e289d4bc` (test) + `fa514e4a` (impl) | ✅ 完成 |
| 7 | 响应式 + 状态覆盖 | `dc966b37` (test) + `202ca79c` (impl) | ✅ 完成 |

---

## 6. 接口约定

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
