# W8-P3 Task 4 接线契约 — Play/Problem 操作按钮

Date: 2026-05-21
Status: pending-audit (v0.2 — 修订版)

## 0. 真源对齐

| 真源 | 章节 | 对本契约的约束 |
| --- | --- | --- |
| PRD v0.5 SS2.2 | Play Mode: Submit 结束当前对局 | Submit 调用 flowService.submit(tabId) |
| PRD v0.5 SS2.4 | Problem Mode: Submit 提交答案 | Submit 走同一 flowService.submit(tabId) |
| PRD v0.5 SS3.4 | Analysis Mode: 从 Play/Problem 可进入 Analysis | Enter Analysis 调用 flowService.enterAnalysis(tabId) |
| PRD v0.5 SS5.5 | Snapshot: captureSnapshotInput -> createTask -> openTask | Snapshot 走 flowService.snapshotFromCurrentContext(tabId) |
| PRD v0.5 SS6.6 | Play 顶部: [新对局] [对局设置] [结束] [认输] | ModeActions play 按钮集 |
| PRD v0.5 SS6.6 | Problem 顶部: [提交答案] [放弃作答] [做题设置] [进入复盘] | ModeActions problem 按钮集 |
| PRD v0.5 SS10 | Play 底部: [悔棋] [弃权] [认输] [结束] [标记疑问手] | BottomActionBar play 按钮集 |
| PRD v0.5 SS10 | Problem 底部: [悔棋] [重做] [弃权] [提示] [提交答案] [放弃] | BottomActionBar problem 按钮集 |
| Arch v0.5 SS5.3 | MODE_TRANSITIONS: play/problem -> ['submit','enterAnalysis'] | flowService 声明合法转换 |
| Arch v0.5 SS9.4 | submit: freezeAttempt -> evaluate -> finalize -> createRecallSession -> updateTab({mode:'recall'}) | submit 后 mode 变为 'recall' |
| Arch v0.5 SS9.6 | enterAnalysis -> store.updateTab({mode:'analysis', previousMode, analysisContext}) | enterAnalysis 保存 previousMode 和 analysisContext |
| Arch v0.5 SS9.7 | Snapshot: snapshotService.capture -> createTask -> tabService.openTask | flowService 编排完整流程，snapshotService 不直接开 Tab |

## 1. 用户故事

- **US-4.1 (Submit):** 作为 Play/Problem 用户，我想提交当前对局/题目答案，以便系统评估并进入回忆模式。
- **US-4.2 (Enter Analysis):** 作为 Problem 用户，我想进入分析模式，以便自由研究当前局面。
- **US-4.3 (Snapshot):** 作为用户，我想对当前局面拍照，以便将关键局面保存为新训练材料。
- **US-4.4 (Resign GAP-01):** Play 模式认输按钮 — 当前 no-op，product 待定义。
- **US-4.5 (Abandon GAP-02):** Problem 模式放弃按钮 — 当前 no-op，product 待定义。

## 2. 用户动作

| ID | 动作 | UI 组件 | Callback prop | Container handler |
| --- | --- | --- | --- | --- |
| A-4.1a | Play: 点击结束 | ModeActions play `onEnd` | `onEnd` | handleSubmit |
| A-4.1b | Play: 点击结束(底部) | BottomActionBar play `onEndAttempt` | `onEndAttempt` | handleSubmit |
| A-4.1c | Problem: 点击提交(顶部) | ModeActions problem `onSubmit` | `onSubmit` | handleSubmit |
| A-4.1d | Problem: 点击提交(底部) | BottomActionBar problem `onSubmitAnswer` | `onSubmitAnswer` | handleSubmit |
| A-4.2 | Problem: 点击进入复盘(顶部) | ModeActions problem `onAnalysis` | `onAnalysis` | handleEnterAnalysis |
| A-4.3a | Snapshot(顶部) | ModeActions recall/analysis `onSnapshot` | `onSnapshot` | handleSnapshot |
| A-4.3b | Snapshot(底部) | BottomActionBar analysis `onSnapshot` | `onSnapshot` | handleSnapshot |
| A-4.4 | Play: 认输(顶部+底部) | ModeActions `onResign` + BottomActionBar `onResign` | `onResign` | handleResign (no-op) |
| A-4.5a | Problem: 放弃(顶部) | ModeActions problem `onAbandon` | `onAbandon` | handleAbandon (no-op) |
| A-4.5b | Problem: 放弃(底部) | BottomActionBar problem `onAbandonAnswer` | `onAbandonAnswer` | — **GAP: 未接线** |

**GAP 发现**: BottomActionBar problem 的 `onAbandonAnswer` 未出现在 `shellHandlers` 中。当底部"放弃"按钮被点击时，callback 为 undefined，按钮无响应。需在实施中补充接线。

## 3. 状态流

### 3.1 Submit (Play/Problem) — 修正版

```
ModeActions.js:66 -> callbacks['onEnd']() 或 callbacks['onSubmit']()
BottomActionBar.js:117 -> callbacks['onEndAttempt']() 或 callbacks['onSubmitAnswer']()
Container.handleSubmit() -> flowService.submit(activeTab.id)
flowService.submit(tabId):
  -> assertTransition(tab, 'submit')
  -> 如无 activeAttemptId: workbenchStore.updateTab(tabId, { mode: 'recall' })
  -> 如有 activeAttemptId:
     -> attemptService.freezeAttempt(activeAttemptId)
     -> evaluationRules.evaluateAttempt + finalizeAttemptResult
     -> recallService.createRecallSession({taskId, tabId, attemptId})
     -> workbenchStore.updateTab(tabId, { mode: 'recall', activeRecallSessionId: session.id })
     -> runtimeStore.setProblemView(null)
     -> runtimeStore.setActiveRecallSession(session.id)
subscriber -> Container.forceUpdate
projectFromWorkbench(ws) -> mode='recall', panel 切换
```

### 3.2 Enter Analysis (Problem)

```
ModeActions.js:66 -> callbacks['onAnalysis']()
Container.handleEnterAnalysis() -> flowService.enterAnalysis(activeTab.id)
flowService.enterAnalysis(tabId):
  -> assertTransition(tab, 'enterAnalysis')
  -> workbenchStore.updateTab(tabId, {
       mode: 'analysis',
       previousMode: tab.mode,
       analysisContext: { taskId, source: tab.mode, attemptId }
     })
subscriber -> Container.forceUpdate
projectFromWorkbench(ws) -> mode='analysis', panel 切换
```

### 3.3 Snapshot

```
ModeActions.js:66 -> callbacks['onSnapshot']()
Container.handleSnapshot() -> flowService.snapshotFromCurrentContext(activeTab.id)
flowService.snapshotFromCurrentContext(tabId):
  -> snapshotService.captureSnapshotInput({tabId, sourceTaskId, sourceAttemptId})
  -> repository.createTask(snapshotTask)
  -> tabService.openTask({taskId, mode:'problem', parentTabId})
  [注: snapshotService 只做 capture；Tab 创建由 flowService 通过 tabService 编排]
workbenchStore.addTab + setActiveTab
subscriber -> Container.forceUpdate
```

## 4. GAP Handler (no-op)

| Handler | 行为 | 退出条件 |
| --- | --- | --- |
| handleResign (GAP-01) | no-op stub (console.warn) | Product 定义 resign 流程 |
| handleAbandon (GAP-02) | no-op stub (console.warn) | Product 定义 abandon 流程 |
| onAbandonAnswer | 未接线 (GAP) | W8-P3 实施中补充接线至 handleAbandon |

## 5. 测试/验收契约表（含分层）

| ID | 类型 | 契约 | Production Subject | Real Deps | Mock Deps | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T4-01 | CONTAINER_DELEGATION | handleSubmit 调用 flowService.submit(activeTab.id) | Container.handleSubmit | Container render | flowService.submit (spy) | workbenchStore | flowService.submit 被调用一次，参数为 activeTab.id | T4-04 |
| T4-02 | CONTAINER_DELEGATION | handleEnterAnalysis 调用 flowService.enterAnalysis(activeTab.id) | Container.handleEnterAnalysis | Container render | flowService.enterAnalysis (spy) | workbenchStore | flowService.enterAnalysis 被调用一次 | T4-05 |
| T4-03 | CONTAINER_DELEGATION | handleSnapshot 调用 flowService.snapshotFromCurrentContext(activeTab.id) | Container.handleSnapshot | Container render | flowService.snapshotFromCurrentContext (spy) | workbenchStore | flowService.snapshotFromCurrentContext 被调用一次 | T4-06 |
| T4-04 | CONTROLLER_STATE_TRANSITION | submit 后 tab.mode 变为 'recall' | flowService.submit | 真实 workbenchStore, 真实 flowService | attemptService, recallService, repository (stubs) | workbenchStore, flowService | workbenchStore.getState().tabs[idx].mode === 'recall' | T4-10 |
| T4-05 | CONTROLLER_STATE_TRANSITION | enterAnalysis 后 tab.mode='analysis', previousMode=原mode, analysisContext 正确设置 | flowService.enterAnalysis | 真实 workbenchStore, 真实 flowService | 无 | workbenchStore, flowService | tab.mode === 'analysis' && tab.previousMode === 'problem' && tab.analysisContext.source === 'problem' | T4-10 |
| T4-06 | CONTROLLER_STATE_TRANSITION | snapshot 后 workbenchStore 包含新 Tab (mode=problem, parentTabId=原tabId) | flowService.snapshotFromCurrentContext | 真实 workbenchStore, 真实 flowService | snapshotService (返回 mock input), repository (fake), tabService (真实) | workbenchStore, flowService | store.tabs 包含新 tab 且 mode='problem' && parentTabId=原tabId | T4-10 |
| T4-07 | CONTROLLER_STATE_TRANSITION | snapshot 后当前 Tab mode 不变 | flowService.snapshotFromCurrentContext | 真实 workbenchStore | snapshotService, repository, tabService | workbenchStore | 原 tab.mode 未改变 | — |
| T4-08 | PROJECTION_RETURN | projectFromWorkbench 在 submit 后返回 mode='recall' | projectFromWorkbench | 真实 projection 函数 | 无 | — | 返回对象.mode === 'recall' | — |
| T4-09 | PROJECTION_RETURN | projectFromWorkbench 在 enterAnalysis 后返回 mode='analysis' | projectFromWorkbench | 真实 projection 函数 | 无 | — | 返回对象.mode === 'analysis' | — |
| T4-10 | STORE_SUBSCRIPTION | submit/enterAnalysis/snapshot 后 subscriber 收到通知 | workbenchStore.subscribe | 真实 workbenchStore | 无 | — | subscriber callback 被调用 | — |
| T4-11 | UI_COMMAND_MAPPING | ModeActions play 渲染 onEnd 按钮，点击触发 callback | ModeActions (mode='play') | preact render | 无 | — | 存在 button[data-testid="mode-action-end"]，点击后 callback 被调用 | T4-01 |
| T4-12 | UI_COMMAND_MAPPING | ModeActions problem 渲染 onSubmit+onAnalysis 按钮 | ModeActions (mode='problem') | preact render | 无 | — | 存在 button[data-testid="mode-action-submit"] 和 button[data-testid="mode-action-analysis"] | T4-01, T4-02 |
| T4-13 | UI_COMMAND_MAPPING | BottomActionBar play 渲染 onResign+onEndAttempt 按钮 | BottomActionBar (mode='play') | preact render | 无 | — | 存在 button[data-testid="action-resign"] 和 button[data-testid="action-end-attempt"] | T4-01 |
| T4-14 | UI_COMMAND_MAPPING | BottomActionBar problem 渲染 onSubmitAnswer 按钮 | BottomActionBar (mode='problem') | preact render | 无 | — | 存在 button[data-testid="action-submit-answer"] | T4-01 |
| T4-15 | ARCHITECTURE_BOUNDARY | Container handler 不直接调用 workbenchStore.updateTab | Container handlers | Container render | flowService (spy) | — | workbenchStore.updateTab 未被 Container 直接调用 | — |
| T4-16 | ARCHITECTURE_BOUNDARY | flowService.submit 无 active attempt 时不崩溃，直接 mode->recall | flowService.submit | 真实 workbenchStore, 真实 flowService | attemptService (stub) | — | 不抛异常，tab.mode === 'recall' | — |
| T4-17 | CONTAINER_DELEGATION | handleResign/handleAbandon 为 no-op | Container handlers | Container render | flowService (spy) | — | flowService.submit/enterAnalysis 未被调用 | — |
| T4-18 | CONTAINER_DELEGATION | handler 在 activeTab null 时不调用 flowService | Container handlers | Container render (无 activeTab) | flowService (spy) | — | flowService 所有方法未被调用 | — |
| T4-19 | STORE_SUBSCRIPTION | enterAnalysis 保存 previousMode，subscriber 通知后投影正确 | workbenchStore + projection | 真实 workbenchStore | 无 | — | subscriber 触发后 projectFromWorkbench 返回 mode='analysis' | — |
| T4-20 | SIDE_EFFECT_BOUNDARY | snapshotService 不直接调用 tabService.openTask；Tab 由 flowService 编排创建 | snapshotService | 真实 snapshotService | repository (mock), positionSnapshotAdapter (mock) | — | snapshotService.captureSnapshotInput 返回值后不触发 tabService | T4-06 |
| T4-GAP | CONTAINER_DELEGATION | BottomActionBar onAbandonAnswer 未接线（确认 GAP） | Container shellHandlers | Container render | 无 | — | shellHandlers 中无 onAbandonAnswer 键（或其值为 undefined） | — |

## 6. 不测试（超出范围）

| 项目 | 原因 |
| --- | --- |
| ModeActions play onNewGame / onSettings | 本 Task 不覆盖，非核心流程按钮 |
| BottomActionBar play onUndo / onPass / onMarkDoubtful | 棋盘操作，非 Task 4 范围 |
| BottomActionBar problem onUndo / onRedo / onPass / onRequestHint | 棋盘操作，非 Task 4 范围 |
| Submit 的 freezeAttempt/evaluate/finalize 内部细节 | 内部 service 步骤，由 attemptService/recallService 单元测试覆盖 |
| Play 模式顶部无"进入复盘"按钮 | ModeActions play 按钮集确实无 onAnalysis；当前 product 未要求 Play 顶部有此按钮，如未来需要应标 DEFERRED |

## 7. v0.5 冲突检查

| 检查项 | 结论 |
| --- | --- |
| submit 后 mode='recall' vs Arch v0.5 SS9.4 | 一致 — submit 流程最终 updateTab({mode:'recall'}) |
| enterAnalysis 保存 previousMode + analysisContext vs Arch v0.5 SS9.6 | 一致 |
| snapshotService 不直接开 Tab vs Arch v0.5 SS5.10 | 一致 — flowService 编排 tabService.openTask |
| Container 不直接写 store | 通过 |
| UI component 不直接依赖 service/store | 通过 |
| origin.provider 分支 | 未使用，通过 |
