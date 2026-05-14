# Gabaki / Sabaki Training UI Plan

> 文档类型：训练系统 UI 实施计划 / Agent 执行规格  
> 适用对象：Sabaki/Gabaki 训练系统 UI 迁移  
> 前置目标：把训练 UI 从 `sabaki.state.mode` 驱动，迁移到 `TrainingTask + WorkbenchTab + tab.phase` 驱动  
> 技术栈：Preact class components + 现有 CSS / CSS variables  
> 核心原则：每个 UI phase 完成后应用必须可启动；每个小切片都能 `npm run start` 手测；新旧路径双轨并行，直到新路径稳定后再清理 legacy UI。

---

## 0. 本计划解决什么问题

当前训练系统的后端 service / store / repository 已经逐步成型，但 UI 仍然容易被旧 Sabaki 的全局 `mode` 和 `sabaki.state.problem* / recall*` 牵着走。

这份计划要解决五个问题：

1. **入口问题**：训练 tab 存在时，不能再被 `mode === 'play'` 分流到旧 `TripleSplitContainer`，否则新训练 UI 根本渲染不出来。
2. **新旧双轨问题**：旧 ProblemBar / RecallBar 可以保留，但新训练 tab 只能由 `tab.phase` 驱动，不能两套逻辑同时改同一个训练状态。
3. **可手测问题**：UI-1 就要有最薄的 Dev Panel，可以 `Open Test Problem → Submit → Recall → Analysis`，而不是等到完整 UI 才启动验证。
4. **切片过大问题**：RecallCheckpoint、Analysis、Snapshot、Review 必须拆成多个小验收点，避免 agent 一次性生成一堆不可用半成品。
5. **清理顺序问题**：先跑通新路径，再清理 legacy mode /旧 Bar，不要边迁移边删除旧功能。

---

## 1. UI 迁移总路线

```text
UI-0  接入前置检查 + feature flag
UI-1  TrainingWorkbenchContainer + TabBar + PhasePanel + DevPanel
UI-2  PlayPanel + PlayPhaseController：能真实提交 Play
UI-3  RecallPanel + RecallCheckpointPanel：能回忆、纠错、comment、resume
UI-4  AnalysisPanel + BadMoveList + SnapshotDialog：能复盘并派生新题
UI-5  ReviewQueueContainer + Dashboard：能打开到期题、更新 schedule
UI-6  Legacy cleanup：移除训练流程对 legacy mode /旧 Bar 的依赖
UI-7  持续优化：统计、热力图、Tab 恢复、Branch 可视化、坏棋反馈增强
```

最重要的节奏：

```text
UI-1 开始就必须 npm run start 手测。
UI-2 开始有训练数据链条。
UI-3 开始像训练产品。
UI-4 开始可以认真自用。
UI-5 补长期复习闭环。
UI-6 只在 UI-1~UI-5 稳定后做。
```

---

## 2. 架构红线

### 2.1 新训练 UI 的唯一事实源

```text
TrainingTask = 训练任务实体
WorkbenchTab = UI 承载容器
tab.phase = 当前 UI 阶段：play / recall / analysis
TrainingAttempt = 一次作答事实
RecallSession = 回忆流程
RecallCheckpoint = 问题手纠错子流程
ReviewSchedule = 长期复习调度
```

新训练 UI 禁止把以下 legacy 字段作为业务事实源：

```text
sabaki.state.mode
sabaki.state.problemSession
sabaki.state.problemAttempt
sabaki.state.problemBadMoves
sabaki.state.problemSubmitted
sabaki.state.recallSession
sabaki.state.recallMoveIndex
sabaki.state.reviewQueue
```

这些字段可以在过渡期用于旧 UI 兼容，但不能驱动新训练 tab。

### 2.2 App.js 入口优先级

必须新增一个明确的入口判断：

```text
只要 training feature enabled 且存在 activeTrainingTab，
就优先渲染 WorkbenchShell + TrainingWorkbenchContainer。
legacy mode='play' 不再把训练 UI 分流回 TripleSplitContainer。
```

建议伪代码：

```js
const trainingEnabled = setting.get('training.ui.enabled')
const hasActiveTrainingTab = workbenchStore.getState().activeTabId != null

if (trainingEnabled && hasActiveTrainingTab) {
  return <WorkbenchShell trainingMode="tabbed" />
}

if (mode === 'play') {
  return <TripleSplitContainer />
}

return <WorkbenchShell />
```

注意：这不是要删除旧 play mode，而是让“训练 tab”优先进入新工作台。

### 2.3 新旧双轨规则

```text
旧路径：继续由 sabaki.state.mode + 旧 Bar 驱动。
新路径：只由 workbenchStore.activeTab.phase 驱动。
```

禁止：

```text
同一个训练入口同时触发旧 ProblemBar.submit 和新 PlayPanel.submit。
Recall 进度一半来自 sabaki.state，一半来自 trainingRuntimeStore。
新 Panel 直接调用 sabaki.submitProblemAttempt()。
新 Panel 直接写 workbenchStore / trainingRuntimeStore。
```

允许：

```text
旧入口暂时存在。
旧 Bar 暂时显示。
旧 sabaki.startProblem 可以薄代理到 workbenchTabService.openProblemTab。
新 UI 通过 feature flag 开关控制。
```

### 2.4 分层职责

```text
UI Component
  只展示 props，不读业务 store，不调 db，不调 sabaki 全局业务方法。

Phase Controller
  接收 UI 事件，调用 service，做少量 UI glue。

TrainingWorkbenchContainer
  订阅 store，组装 props，选择当前 phase 的 controller/panel。

Service
  负责业务动作和状态转换。

Repository
  负责训练实体持久化。

Adapter
  隔离旧 Sabaki/document/analysis/engine 能力。
```

命令路径：

```text
Panel.onClick
→ PhaseController.handleXxx
→ workbenchPhaseService / attemptService / recallService / snapshotService / reviewService
→ Store / Repository / Adapter
→ Container re-render
```

渲染路径：

```text
workbenchStore + trainingRuntimeStore
→ TrainingWorkbenchContainer
→ PhaseController
→ Panel
```

---

## 3. 目录结构

```text
src/components/training/
  TrainingWorkbenchContainer.js
  TrainingDevPanel.js
  TabBar.js
  PhasePanel.js

  PlayPhaseController.js
  RecallPhaseController.js
  AnalysisPhaseController.js
  ReviewQueueContainer.js
  TrainingOverlayViewModel.js

  panels/
    PlayPanel.js
    RecallPanel.js
    RecallCheckpointPanel.js
    AnalysisPanel.js

  BadMoveList.js
  SnapshotDialog.js

  TrainingStatsView.js              # UI-7
  ReviewHeatmapCalendar.js          # UI-7
  BranchNavigator.js                # UI-7
  TabRestorePrompt.js               # UI-7
  BadMoveFeedbackPanel.js           # UI-7

style/training/
  training-workbench.css
  tab-bar.css
  phase-panel.css
  dev-panel.css
  play-panel.css
  recall-panel.css
  recall-checkpoint-panel.css
  analysis-panel.css
  bad-move-list.css
  snapshot-dialog.css
  review-queue.css
  training-dashboard.css
  training-stats.css                # UI-7
  heatmap-calendar.css              # UI-7
  branch-navigator.css              # UI-7
  tab-restore.css                   # UI-7
  bad-move-feedback.css             # UI-7
```

旧文件改造点：

```text
src/components/App.js
src/components/WorkbenchShell.js
src/components/drawers/TrainingDashboardDrawer.js
src/components/drawers/ProblemEditorDrawer.js
src/components/bars/ProblemBar.js       # UI-6 前不急删
src/components/bars/RecallBar.js        # UI-6 前不急删
```

---

## 4. UI-0：接入前置检查与 feature flag

### 4.1 目标

在不改变可见行为的前提下，为新训练 UI 开一个安全入口。

### 4.2 必做任务

1. 增加 feature flag：

```text
training.ui.enabled = false by default
```

2. 给 `App.js` 增加训练 tab 优先渲染规则，但只有 feature flag 打开时生效。
3. 确认以下对象能在 renderer 侧 import / inject：

```text
workbenchStore
trainingRuntimeStore
workbenchTabService
workbenchPhaseService
attemptService
recallService
recallCheckpointService
snapshotService
reviewService
trainingRepository
```

4. 增加空的 `TrainingWorkbenchContainer`，暂时只显示：

```text
Training UI enabled
activeTabId: xxx / none
```

### 4.3 验收

```text
training.ui.enabled=false：旧 UI 完全不变。
training.ui.enabled=true 且无 active tab：WorkbenchShell 显示训练空状态，不黑屏。
training.ui.enabled=true 且有 active tab：进入 TrainingWorkbenchContainer。
npm run start 无启动错误。
DevTools console 无 training import error。
```

---

## 5. UI-1：Container + TabBar + PhasePanel + DevPanel

### 5.1 目标

先做最薄的可手测训练工作台。不要追求完整体验，只验证：

```text
Open Test Problem → tab.phase=play
Dev Submit → tab.phase=recall
Dev Complete Recall → tab.phase=analysis
Dev Restart → tab.phase=play
```

### 5.2 新增组件

```text
TrainingWorkbenchContainer.js
TrainingDevPanel.js
TabBar.js
PhasePanel.js
```

### 5.3 TrainingWorkbenchContainer 职责

订阅：

```text
workbenchStore.subscribe
trainingRuntimeStore.subscribe
```

本地 state：

```js
{
  workbench: workbenchStore.getState(),
  runtime: trainingRuntimeStore.getState(),
  loading: false,
  error: null,
}
```

分发逻辑：

```js
const activeTab = tabs.find(t => t.id === activeTabId)

if (!activeTab) {
  return <TrainingEmptyState />
}

return (
  <div className="training-workbench">
    <TabBar ... />
    <PhasePanel phase={activeTab.phase} ... />
    <TrainingDevPanel ... />  // UI-1 only, UI-2 后可隐藏
    {renderPhase(activeTab)}
  </div>
)
```

UI-1 里 `renderPhase` 可以先显示占位：

```text
phase=play     → “Play phase placeholder”
phase=recall   → “Recall phase placeholder”
phase=analysis → “Analysis phase placeholder”
```

### 5.4 TrainingDevPanel 职责

开发者面板只用于早期手测，不作为最终产品 UI。

按钮：

```text
Open Test Problem
Open Test Game
Submit Play
Complete Recall
Enter Analysis
Restart Play
Snapshot Placeholder
Print Store State
```

按钮调用：

```text
Open Test Problem → workbenchTabService.openProblemTab(testProblemId)
Submit Play → workbenchPhaseService.submitPlay(activeTabId)
Complete Recall → workbenchPhaseService.completeRecall(activeTabId, activeRecallSessionId)
Enter Analysis → workbenchPhaseService.enterAnalysis(activeTabId)
Restart Play → workbenchPhaseService.restartPlay(activeTabId)
```

如果后端 service 还没完全准备好，允许 DevPanel 先用明确命名的 mock/dev service，但必须标注：

```text
DEV ONLY，不进入正式路径。
```

### 5.5 TabBar 规格

Props：

```js
{
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onNewTab,
}
```

每个 tab 显示：

```text
Task kind icon
phase badge
标题
关闭按钮
active 高亮
```

交互：

```text
点击 tab → workbenchTabService.switchTab(tabId)
点击关闭 → workbenchTabService.closeTab(tabId)
点击 + → 打开任务选择入口；UI-1 可先连到 TrainingDevPanel
```

### 5.6 PhasePanel 规格

显示三步：

```text
Play → Recall → Analysis
```

规则：

```text
当前 phase 高亮。
已完成 phase 打勾。
非法跳转不在 UI 上开放。
所有 phase 转换通过 workbenchPhaseService。
```

### 5.7 UI-1 验收

```text
1. npm run start 能启动。
2. 打开 feature flag 后能看到 TrainingWorkbenchContainer。
3. 点击 Open Test Problem 后 TabBar 出现一个 tab。
4. PhasePanel 显示 Play。
5. 点击 Dev Submit 后 PhasePanel 显示 Recall。
6. 点击 Dev Complete Recall 后 PhasePanel 显示 Analysis。
7. 点击 Restart 后 PhasePanel 回到 Play，并创建/激活新的 attempt。
8. 关闭 active tab 后显示空状态。
9. 旧 UI 在 feature flag 关闭时完全不变。
```

### 5.8 UI-1 禁止事项

```text
禁止用旧 ProblemBar 的 Submit 驱动新 tab phase。
禁止为了手测直接改 store phase。
禁止 Play → Analysis 静默跳转。
禁止删除旧 Bar。
```

---

## 6. UI-2：PlayPanel + PlayPhaseController

### 6.1 目标

让 Play 阶段从占位变成真实可用：

```text
显示任务信息 → 用户落子 → 记录 attempt → 显示统计 → Submit → Recall
```

### 6.2 新增组件

```text
PlayPhaseController.js
panels/PlayPanel.js
```

### 6.3 PlayPhaseController 职责

读：

```text
activeTab
activeAttemptId
pendingMoveEvaluations
problem/task brief
bad move count
move count
```

调：

```text
attemptService.appendMove
workbenchPhaseService.submitPlay
workbenchPhaseService.restartPlay
```

它不做：

```text
不计算 result
不直接写 store
不直接 db
不直接调用 sabaki.submitProblemAttempt
```

### 6.4 PlayPanel 规格

Props：

```js
{
  taskKind,
  phase: 'play',
  problemBrief,
  attemptId,
  moveCount,
  pendingEvaluationCount,
  badMoveCount,
  hintLevelUsed,
  result,
  canSubmit,
  submitting,
  onSubmit,
  onUndo,
  onHint,
  onExit,
}
```

布局：

```text
Problem / Snapshot Task:
  题目标题
  局面说明
  任务目标
  执黑/执白

Game Task:
  隐藏题目信息，只显示训练状态

通用区:
  已下 N 手
  pending evaluation N
  bad move N
  hint used N
  [撤销] [提示] [退出] [提交答案]
```

### 6.5 Board 落子接入

UI-2 需要明确棋盘事件如何进入新训练流程：

```text
MainView / Board onPlayMove(move)
→ 当前 activeTrainingTab.phase === 'play'
→ PlayPhaseController.handlePlayMove(move)
→ existing board play executor / documentStore append
→ attemptService.appendMove(activeAttemptId, move)
→ playTrainingMonitor.onUserMove(...)
```

过渡期允许棋盘落子仍走旧 executor，但必须在落子成功后同步调用 `attemptService.appendMove`。

### 6.6 UI-2 验收

```text
1. Problem Task 打开后显示题目信息。
2. Game Task 打开后不显示题目信息。
3. 用户落子后 moveCount 增加。
4. pending evaluation 数量能显示。
5. badMoveCount 能显示。
6. Submit 调用 workbenchPhaseService.submitPlay。
7. Submit 成功后 phase=recall。
8. Submit 失败时 UI 显示错误，不静默卡住。
9. PlayPanel 不读取 sabaki.state.problem*。
```

---

## 7. UI-3：RecallPanel + RecallCheckpointPanel

UI-3 必须拆小，不要一次性把 checkpoint 全做完。

### 7.1 UI-3a：RecallPanel 基础

目标：Submit 后能显示 Recall 进度，并能完成 Recall 进入 Analysis。

新增：

```text
RecallPhaseController.js
panels/RecallPanel.js
```

RecallPanel props：

```js
{
  currentMoveIndex,
  totalMoves,
  correctCount,
  wrongCount,
  lastAttempt,
  completed,
  activeCheckpointId,
  onHint,
  onSkip,
  onComplete,
}
```

验收：

```text
Submit 后进入 RecallPanel。
RecallPanel 显示 currentMoveIndex / totalMoves。
点击 Complete Recall → workbenchPhaseService.completeRecall → phase=analysis。
```

### 7.2 UI-3b：Recall 落子与进度更新

目标：用户在 Recall 阶段落子后，进度能真实更新。

流程：

```text
Board onPlayMove(move)
→ activeTab.phase === 'recall'
→ RecallPhaseController.handleRecallMove(move)
→ recallService.submitRecallMove({recallSessionId, userMove})
→ repository createRecallAttempt
→ runtime/currentMoveIndex 更新
→ RecallPanel re-render
```

验收：

```text
Recall 落子后 currentMoveIndex 前进。
正确/错误统计更新。
错误不导致应用崩溃。
```

### 7.3 UI-3c：Checkpoint 触发

目标：命中 major/severe BadMove 时，Recall 暂停，显示 CheckpointPanel。

流程：

```text
RecallPhaseController.handleRecallMove
→ recallCheckpointService.shouldTriggerCheckpoint
→ if badMove severity major/severe:
     recallCheckpointService.startCheckpoint
     trainingRuntimeStore.setActiveCheckpoint(checkpointId)
→ TrainingWorkbenchContainer 切换到 RecallCheckpointPanel
```

验收：

```text
命中 major/severe BadMove → RecallCheckpointPanel 显示。
minor BadMove 不触发 checkpoint。
activeCheckpointId 清空前不能继续普通 Recall。
```

### 7.4 UI-3d：用户修正图

目标：用户先摆 correction line，不看 AI。

RecallCheckpointPanel Step 1：

```text
显示问题手信息：moveIndex / severity / original move
提示用户在棋盘上摆更好变化
显示 correctionDraft moves
按钮：[撤销修正] [完成修正图] [暂时跳过]
```

流程：

```text
Board onPlayMove(move)
→ activeCheckpointId exists
→ append to correctionDraft
→ trainingRuntimeStore.setCorrectionDraft

完成修正图
→ recallCheckpointService.submitUserCorrectionLine({checkpointId, moves})
```

验收：

```text
checkpoint 状态 pending_correction 时，棋盘落子进入 correctionDraft，不写入 RecallAttempt。
提交 correction 后 checkpoint 保存 userCorrectionLine。
```

### 7.5 UI-3e：AI 对比 + comment + resume

RecallCheckpointPanel Step 2：

```text
展示三组线：
- 用户原变化
- 用户修正图
- AI candidate lines
```

Step 3：

```text
Comment 模板：
1. 我原来的图坏在哪里？
2. 我的修正图比原图好在哪里？
3. 我的修正图和 AI 推荐图差在哪里？
4. 这个局面的核心矛盾是什么？
5. 下次要记住什么？
```

流程：

```text
onRevealAi
→ recallCheckpointService.revealAiCandidateLines(checkpointId)

onSaveComment
→ recallCheckpointService.saveComment(...)
→ recallCheckpointService.resumeRecall(checkpointId)
→ activeCheckpointId cleared
→ 回到 RecallPanel
```

验收：

```text
reveal 后能看到 AI candidate lines。
保存 comment 后 checkpoint 状态变为 commented。
activeCheckpointId 清空。
回到 RecallPanel，Recall 可继续。
```

---

## 8. UI-4：AnalysisPanel + BadMoveList + SnapshotDialog + Overlay

UI-4 是第一次可以认真自用的节点，也要拆小。

### 8.1 UI-4a：AnalysisPanel 基础

新增：

```text
AnalysisPhaseController.js
panels/AnalysisPanel.js
BadMoveList.js
```

AnalysisPanel props：

```js
{
  tabId,
  attemptId,
  badMoves,
  moveEvaluations,
  comments,
  selectedBadMoveId,
  loading,
  error,
  onSelectBadMove,
  onNavigateToMove,
  onSnapshot,
  onRestartPlay,
}
```

验收：

```text
Recall complete 后进入 AnalysisPanel。
AnalysisPanel 能加载 badMoves / moveEvaluations。
BadMoveList 展示 moveIndex / move / severity / scoreDrop / engineSuggestedMove。
```

### 8.2 UI-4b：BadMove 导航与反馈

功能：

```text
点击 BadMove → 棋盘跳到对应 moveIndex / treePosition。
支持 “这不是坏棋” 标记。
被标记的 BadMove 置灰，不删除。
```

验收：

```text
点击 BadMove 能导航到对应局面。
Mark as not bad 后列表状态更新。
不会影响原 MoveEvaluation 事实。
```

### 8.3 UI-4c：SnapshotDialog

目标：Analysis 中当前局面可以变成新 Problem。

Dialog 字段：

```text
自动填充：
- sourceTaskId
- sourceAttemptId
- sourceMoveIndex
- positionSgf
- sideToMove

用户填写：
- type
- title
- positionDescription
- taskGoal
- difficulty
- tags
- snapshotReason
```

按钮：

```text
取消
保存到 Inbox
保存并开始做
```

流程：

```text
保存到 Inbox
→ snapshotService.createProblemFromCurrentAnalysisPosition
→ 不打开新 tab

保存并开始做
→ snapshotService.createProblemFromCurrentAnalysisPosition
→ workbenchTabService.openSnapshotProblemTab(problem.id, {parentTabId})
→ 新 tab phase=play
→ 原 tab 保持 analysis
```

验收：

```text
SnapshotDialog 能弹出。
保存后 Problem 入库。
保存并开始做后新 Tab 打开，新 Tab phase=play。
原 Analysis Tab 不被覆盖。
```

### 8.4 UI-4d：TrainingOverlayViewModel

职责：

```text
play phase：analysis overlay 默认隐藏。
recall phase：analysis overlay 默认隐藏。
analysis phase：analysis overlay 可见。
activeCheckpointId 存在时：显示 checkpoint 相关标记。
visibleBadMoveIds：在棋盘上标记问题手位置。
```

注意：

```text
TrainingOverlayViewModel 不承载业务规则。
overlayStore 不知道 BadMove 业务。
```

验收：

```text
Play/Recall 不显示 AI overlay。
Analysis 显示 AI overlay。
BadMove 选中时棋盘有明确标记。
```

---

## 9. UI-5：ReviewQueueContainer + Dashboard 增强

### 9.1 目标

把长期复习入口做出来：

```text
Review queue 展示到期题
点击到期题 → 普通 Problem Task → Play → Recall → Analysis
完成后更新 ReviewSchedule
```

### 9.2 ReviewQueueContainer

Props：

```js
{
  dueItems,
  filters,
  loading,
  error,
  onOpenItem,
  onFilterChange,
  onRefresh,
}
```

列表 item 显示：

```text
problem title
problem type / punishment badge
lastResult
consecutivePassCount
totalFailCount
dueAt
intervalDays
[开始做题]
```

流程：

```text
onOpenItem(scheduleId)
→ reviewService.openDueItem(scheduleId)
→ workbenchTabService.openProblemTab(problemId)
→ new tab phase=play
```

### 9.3 TrainingDashboardDrawer 增强

现有 dashboard 增强为：

```text
今日训练摘要
Review Queue 预览
Problem Inbox
Recent Punishment Problems
Incomplete Attempt / Recall 入口
Recent Attempts
```

所有训练入口改为：

```text
Problem Inbox item → workbenchTabService.openProblemTab(problemId)
Review Queue item → reviewService.openDueItem(scheduleId)
Game item → workbenchTabService.openGameTab(gameId)
Incomplete item → 对应恢复 service
```

### 9.4 UI-5 验收

```text
Dashboard 能显示 due items。
点击 due problem 后打开新 tab，phase=play。
完成一次 Review 后 updateScheduleAfterResult 被调用。
Punishment Problem 显示 punishment 标识。
Review 不依赖 mode='review'。
```

---

## 10. UI-6：Legacy Cleanup

### 10.1 进入 UI-6 的前置条件

必须全部满足：

```text
UI-1~UI-5 手测通过。
新路径能打开 problem/game/review。
Play → Recall → Analysis 能跑。
Snapshot 能打开新 tab。
Dashboard 能打开 review item。
feature flag 打开时新路径稳定。
feature flag 关闭时旧路径仍可用。
```

### 10.2 清理目标

```text
训练 UI 不再依赖 sabaki.state.mode。
训练入口不再调用 legacy problem/review/recall methods。
旧 ProblemBar / RecallBar 的训练功能被 PlayPanel / RecallPanel 替代。
```

### 10.3 清理任务

1. `ProblemBar.js`
   - 删除或停用训练 submit / hint / result 展示逻辑。
   - 如有非训练用途，保留为普通 Bar。

2. `RecallBar.js`
   - 删除训练 recall 逻辑。
   - 保留 legacy shim 直到旧入口完全移除。

3. `WorkbenchShell.js`
   - 训练区域完全由 `TrainingWorkbenchContainer` 渲染。
   - `WorkspaceDock` 不再根据 `mode='problem' / mode='recall' / mode='review'` 展示训练 UI。

4. `App.js`
   - 训练路径判断优先 activeTrainingTab。
   - 减少 training 相关 `sabaki.state` 传递。

5. `sabaki.js`
   - `startProblem` / `submitProblemAttempt` / `startReviewSession` 等改为薄代理或标记 deprecated。

### 10.4 UI-6 验收

```text
新训练流程完全由 TrainingWorkbenchContainer 驱动。
ProblemBar / RecallBar 不参与新训练业务。
mode='review' 不再作为 Review 棋盘模式。
mode='problem' 不再作为 Problem 棋盘模式。
旧数据仍可通过 repository mapper 读取。
```

---

## 11. UI-7：持续优化

UI-7 不要提前做。只有在 UI-4/5 真正自用后，根据痛点排序。

### 11.1 TrainingStatsView

目标：训练统计与能力画像。

显示：

```text
totalAttempts
totalProblems
totalRecallSessions
passRate
averageBadMovesPerAttempt
reviewAdherenceRate
streakDays
byProblemType
weakAreas
```

### 11.2 ReviewHeatmapCalendar

目标：展示每日训练量和复习完成情况。

显示：

```text
date
attemptCount
reviewCount
badMoveCount
passCount
failCount
```

### 11.3 TabRestorePrompt

目标：应用重启后恢复未关闭 tab / incomplete attempt / incomplete recall。

前置：

```text
workbench_tabs 持久化
trainingRepository.listIncompleteAttempts
trainingRepository.listIncompleteRecallSessions
```

### 11.4 BranchNavigator

目标：Analysis 中统一展示：

```text
用户原变化
AI 推荐线
用户修正图
AI 次选
参考变化
```

前置：

```text
training_branches 表或稳定的 branch view model。
```

### 11.5 BadMoveFeedbackPanel

目标：让用户标记“这不是坏棋”“重点复习”，并查看增强分析。

显示：

```text
scoreDrop
winrateDrop
ownershipChange
phaseOfGame
groupStatus
confidenceLevel
```

### 11.6 SM-2 Review 策略增强

目标：从固定间隔升级到动态 easeFactor。

注意：这属于 reviewService 规则增强，不是 UI 的第一优先级。

---

## 12. 样式原则

### 12.1 设计方向

```text
低噪音
面板轻量
信息分层清晰
棋盘仍然是主视觉中心
训练 UI 是辅助，不抢棋盘
```

### 12.2 CSS 规则

```text
使用现有 CSS variables。
不要引入 CSS-in-JS。
不要引入新 UI 组件库。
新增样式放入 style/training/。
每个组件有独立 class namespace：training-xxx。
```

### 12.3 推荐 tokens

```css
:root {
  --training-phase-play: #2196f3;
  --training-phase-recall: #ff9800;
  --training-phase-analysis: #4caf50;

  --training-severity-minor: #ffc107;
  --training-severity-major: #ff5722;
  --training-severity-severe: #d32f2f;

  --training-result-pass: #4caf50;
  --training-result-soft-pass: #ff9800;
  --training-result-fail: #f44336;

  --training-panel-radius: 10px;
  --training-panel-padding: 12px;
  --training-tab-height: 36px;
}
```

### 12.4 布局规则

```text
TabBar：顶部横向区域，高度 32~40px。
PhasePanel：靠近底部工作区或顶部次级区域，不能压缩棋盘主区域。
Play/Recall/Analysis Panel：优先放 WorkspaceDock，不要侵入棋盘。
CheckpointPanel：可以更高，但必须可折叠或分步展示。
Review/Dashboard：drawer 或 dashboard 页面，不做棋盘 mode。
```

---

## 13. 测试策略

### 13.1 每个 UI phase 都必须跑

```text
npm test
npm run start
手测 checklist
DevTools console check
```

### 13.2 UI-1 手测 checklist

```text
[ ] feature flag off：旧 UI 不变
[ ] feature flag on：训练空状态显示
[ ] Open Test Problem：TabBar 出现 tab
[ ] Submit：Play → Recall
[ ] Complete Recall：Recall → Analysis
[ ] Restart：Analysis → Play
[ ] Close tab：空状态显示
[ ] DevTools 无错误
```

### 13.3 UI-2 手测 checklist

```text
[ ] Problem Task 显示题目 brief
[ ] Game Task 不显示题目 brief
[ ] 落子后 moveCount 更新
[ ] pending evaluation count 更新
[ ] badMove count 更新
[ ] Submit 成功进入 Recall
[ ] Submit 失败显示错误
```

### 13.4 UI-3 手测 checklist

```text
[ ] RecallPanel 显示进度
[ ] Recall 落子后进度更新
[ ] major/severe BadMove 触发 checkpoint
[ ] correctionDraft 接收棋盘落子
[ ] reveal AI 后显示候选图
[ ] 保存 comment 后回到 Recall
[ ] Recall 完成进入 Analysis
```

### 13.5 UI-4 手测 checklist

```text
[ ] AnalysisPanel 显示 BadMoveList
[ ] 点击 BadMove 能导航
[ ] Mark not bad 后置灰
[ ] SnapshotDialog 能弹出
[ ] 保存到 Inbox 成功
[ ] 保存并开始做打开新 tab
[ ] 原 tab 保持 analysis
[ ] play/recall overlay 隐藏，analysis overlay 显示
```

### 13.6 UI-5 手测 checklist

```text
[ ] Dashboard 显示 due items
[ ] Punishment Problem 有标识
[ ] 点击 due item 打开新 Problem Task
[ ] Review 完成后 schedule 更新
[ ] Review 不进入 mode='review'
```

---

## 14. Agent 执行切片

### Task A：UI-0 + UI-1 最小训练工作台

范围：

```text
App.js 入口规则
WorkbenchShell 接入 TrainingWorkbenchContainer
TrainingWorkbenchContainer
TrainingDevPanel
TabBar
PhasePanel
基础 CSS
```

验收：

```text
Open Test Problem → Play
Submit → Recall
Complete Recall → Analysis
Restart → Play
npm run start 可手测
```

明确禁止：

```text
不要做 PlayPanel 完整 UI。
不要接 RecallCheckpoint。
不要删旧 Bar。
不要改 evaluationRules。
```

### Task B：UI-2 PlayPanel

范围：

```text
PlayPhaseController
PlayPanel
落子后 attempt append 接入
Submit 接入 workbenchPhaseService
PlayPanel CSS
```

验收：

```text
Problem/Game Task 均可显示 PlayPanel。
落子统计更新。
Submit 进入 Recall。
```

### Task C：UI-3a/b Recall 基础

范围：

```text
RecallPhaseController
RecallPanel
Recall 落子进度更新
Complete Recall 进入 Analysis
```

不做 checkpoint。

### Task D：UI-3c/d/e Checkpoint

范围：

```text
Checkpoint trigger
RecallCheckpointPanel Step 1 correction
Step 2 AI reveal
Step 3 comment/resume
```

### Task E：UI-4 Analysis + Snapshot

范围：

```text
AnalysisPhaseController
AnalysisPanel
BadMoveList
SnapshotDialog
TrainingOverlayViewModel
```

### Task F：UI-5 Review Dashboard

范围：

```text
ReviewQueueContainer
TrainingDashboardDrawer 增强
reviewService.openDueItem 接 UI
updateScheduleAfterResult 接 UI
```

### Task G：UI-6 Cleanup

范围：

```text
ProblemBar / RecallBar 训练逻辑清理
mode='problem' / mode='review' 训练判断移除
legacy methods deprecated
```

---

## 15. 最终验收标准

### 15.1 最短训练闭环

```text
Problem Task
→ PlayPanel 作答
→ Submit
→ RecallPanel 回忆
→ BadMove 触发 Checkpoint
→ 用户摆 correction line
→ reveal AI candidate lines
→ 写 comment
→ resume Recall
→ complete Recall
→ AnalysisPanel 复盘
→ SnapshotDialog 出题
→ 新 Problem Task / 新 Tab / phase=play
```

### 15.2 Review 闭环

```text
BadMove
→ Punishment Problem
→ ReviewSchedule
→ Dashboard due item
→ Open due item
→ 普通 Problem Task
→ Play → Recall → Analysis
→ updateScheduleAfterResult
```

### 15.3 架构验收

```text
新训练 UI 不读 sabaki.state.problem* / recall*。
新训练 UI 不依赖 mode='problem' / mode='review'。
Phase 切换只走 workbenchPhaseService。
Panel 只收 props。
Controller 调 service。
Container 读 store、分发 props。
旧路径可 feature flag 回退。
```

---

## 16. 结论

这套 UI 迁移不要以“把所有面板一次性做漂亮”为目标，而要以“每一步都能启动、能手测、能验证数据流”为目标。

正确顺序是：

```text
先让训练 tab 渲染出来，
再让 phase 流转跑起来，
再让 Play 接入真实 attempt，
再让 Recall/Checkpoint 成为训练体验，
再让 Analysis/Snapshot 成为自用闭环，
最后补 Review/Dashboard 和 legacy cleanup。
```

第一轮最小任务只做 UI-0 + UI-1。做到这里，你就可以真正用 `npm run start` 验证训练 UI 是否进入正确轨道。
