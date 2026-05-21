# W8-P3 Task 6 接线契约 — Analysis 操作按钮

Date: 2026-05-21
Status: pending-audit (v0.2 — 修订版)

## 0. 真源对齐

| 真源 | 章节 | 对本契约的约束 |
| --- | --- | --- |
| PRD v0.5 SS2.6 | Analysis 是低阻碍自由研究空间 | Snapshot 不是 Analysis 独占能力 |
| PRD v0.5 SS3.4 | Analysis Mode: Snapshot 当前局面，创建新 TrainingTask + 新 Tab | Snapshot 走 flowService.snapshotFromCurrentContext |
| PRD v0.5 SS5.5 | Snapshot: captureSnapshotInput -> createTask -> openTask | snapshotService 只做 capture，Tab 由 flowService 编排 |
| PRD v0.5 SS6.6 | Analysis 顶部: [Snapshot] [设置] [返回] | ModeActions analysis 按钮 |
| PRD v0.5 SS9.1 | Analysis 从 Play/Problem/Recall 进入，返回恢复 previousMode | Return 使用 previousMode |
| PRD v0.5 SS10 | Analysis 底部: [悔棋] [重做] [清除] [编辑局面] [快照] | BottomActionBar analysis 按钮 |
| Arch v0.5 SS5.3 | returnFromAnalysis(tabId, toMode) | Return 调用此 API |
| Arch v0.5 SS5.3 | snapshotFromCurrentContext(tabId) | Snapshot 调用此 API |
| Arch v0.5 SS5.10 | snapshotService 不创建 Tab | snapshotService 仅 capture |
| Arch v0.5 SS9.7 | Snapshot: snapshotService.capture -> createTask -> openTask | flowService 编排完整流程 |

## 1. 用户故事

- **US-6.1 (Snapshot):** 作为 Analysis 用户，我想对当前分析局面拍照保存为新训练材料。
- **US-6.2 (Return):** 作为从 Play/Problem/Recall 进入 Analysis 的用户，我想一键返回之前模式。

## 2. 用户动作（基于实际 UI 组件回调名）

| ID | 动作 | UI 组件 | Callback prop | Container handler |
| --- | --- | --- | --- | --- |
| A-6.1a | Snapshot(顶部) | ModeActions analysis `onSnapshot` | `onSnapshot` | handleSnapshot |
| A-6.1b | Snapshot(底部) | BottomActionBar analysis `onSnapshot` | `onSnapshot` | handleSnapshot |
| A-6.2 | Return(顶部) | ModeActions analysis `onReturn` | `onReturn` | handleReturnFromAnalysis |

## 3. 状态流

### 3.1 Snapshot

```
ModeActions.js:66 或 BottomActionBar.js:117 -> callbacks['onSnapshot']()
Container.handleSnapshot() -> flowService.snapshotFromCurrentContext(activeTab.id)
flowService.snapshotFromCurrentContext(tabId):
  -> snapshotService.captureSnapshotInput({tabId, sourceTaskId, sourceAttemptId})
  -> repository.createTask(snapshotTask)
  -> tabService.openTask({taskId, mode:'problem', parentTabId})
  [注: snapshotService 只做 capture；Tab 创建由 flowService 通过 tabService 编排]
workbenchStore.addTab + setActiveTab
subscriber -> Container.forceUpdate
```

### 3.2 Return

```
ModeActions.js:66 -> callbacks['onReturn']()
Container.handleReturnFromAnalysis() -> flowService.returnFromAnalysis(activeTab.id, activeTab.previousMode || 'play')
flowService.returnFromAnalysis(tabId, toMode):
  -> assertTransition(tab, 'returnFromAnalysis')
  -> workbenchStore.updateTab(tabId, { mode: toMode, previousMode: undefined })
subscriber -> Container.forceUpdate
```

## 4. 不在范围内的按钮（声明排除）

| 按钮 | 位置 | 排除理由 |
| --- | --- | --- |
| onSettings | ModeActions analysis | deferred no-op，非核心流程 |
| onUndo / onRedo / onClear / onEditPosition | BottomActionBar analysis | 棋盘操作，非 Task 6 范围 |

## 5. 测试/验收契约表（含分层）

| ID | 类型 | 契约 | Production Subject | Real Deps | Mock Deps | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T6-01 | ARCHITECTURE_BOUNDARY | Snapshot 不修改当前 Tab 的 activeAttemptId 或 Attempt.userLine | flowService.snapshotFromCurrentContext | 真实 workbenchStore, 真实 flowService | snapshotService (返回 mock input), repository (fake), tabService (spy) | workbenchStore, flowService | snapshot 后原 tab.activeAttemptId 未改变 | — |
| T6-02 | CONTROLLER_STATE_TRANSITION | Snapshot 后 workbenchStore 包含新 Tab (mode=problem, parentTabId=原tabId) | flowService.snapshotFromCurrentContext | 真实 workbenchStore, 真实 flowService | snapshotService, repository, tabService | workbenchStore, flowService | store.tabs 包含新 tab 且 mode='problem' && parentTabId=原tabId | T6-13 |
| T6-03 | CONTROLLER_STATE_TRANSITION | Snapshot 后当前 Tab mode 仍为 'analysis' | flowService.snapshotFromCurrentContext | 真实 workbenchStore | snapshotService, repository, tabService | workbenchStore | 原 tab.mode === 'analysis' | — |
| T6-04 | CONTROLLER_STATE_TRANSITION | returnFromAnalysis 后 tab.mode 变为 previousMode | flowService.returnFromAnalysis | 真实 workbenchStore, 真实 flowService | 无 | workbenchStore, flowService | tab.mode === previousMode 值 | T6-12 |
| T6-05 | CONTROLLER_STATE_TRANSITION | returnFromAnalysis 后 tab.previousMode 变为 undefined | flowService.returnFromAnalysis | 真实 workbenchStore, 真实 flowService | 无 | workbenchStore | tab.previousMode === undefined | — |
| T6-06 | CONTROLLER_STATE_TRANSITION | previousMode 未设置时 Container 传 'play' 作为 toMode | Container.handleReturnFromAnalysis | Container render (activeTab.previousMode=undefined) | flowService.returnFromAnalysis (spy) | — | flowService.returnFromAnalysis 被调用，第二个参数为 'play' | — |
| T6-07 | UI_COMMAND_MAPPING | ModeActions analysis 渲染 Snapshot 按钮，点击触发 onSnapshot | ModeActions (mode='analysis') | preact render | 无 | — | 存在 button[data-testid="mode-action-snapshot"]，点击后 callback 被调用 | T6-10 |
| T6-08 | UI_COMMAND_MAPPING | ModeActions analysis 渲染 Return 按钮，点击触发 onReturn | ModeActions (mode='analysis') | preact render | 无 | — | 存在 button[data-testid="mode-action-return"]，点击后 callback 被调用 | T6-11 |
| T6-09 | UI_COMMAND_MAPPING | BottomActionBar analysis 渲染 Snapshot 按钮 | BottomActionBar (mode='analysis') | preact render | 无 | — | 存在 button[data-testid="action-snapshot"]，点击后 callback 被调用 | T6-10 |
| T6-10 | CONTAINER_DELEGATION | handleSnapshot 调用 flowService.snapshotFromCurrentContext(activeTab.id) | Container.handleSnapshot | Container render | flowService.snapshotFromCurrentContext (spy) | workbenchStore | flowService.snapshotFromCurrentContext 被调用一次，参数为 activeTab.id | T6-02 |
| T6-11 | CONTAINER_DELEGATION | handleReturnFromAnalysis 调用 flowService.returnFromAnalysis(activeTab.id, previousMode\|\|'play') | Container.handleReturnFromAnalysis | Container render | flowService.returnFromAnalysis (spy) | workbenchStore | flowService.returnFromAnalysis 被调用，参数正确 | T6-04 |
| T6-12 | STORE_SUBSCRIPTION | returnFromAnalysis 后 subscriber 收到通知 | workbenchStore.subscribe | 真实 workbenchStore | 无 | — | subscriber callback 被调用 | — |
| T6-13 | STORE_SUBSCRIPTION | snapshot 后 subscriber 收到通知（因新 Tab 添加） | workbenchStore.subscribe | 真实 workbenchStore | 无 | — | subscriber callback 被调用 | — |
| T6-14 | PROJECTION_RETURN | returnFromAnalysis 后 projectFromWorkbench 返回 mode=previousMode | projectFromWorkbench | 真实 projection 函数 | 无 | — | 返回对象.mode === previousMode 值 | — |
| T6-15 | SIDE_EFFECT_BOUNDARY | snapshotService.captureSnapshotInput 不调用 tabService.openTask；Tab 由 flowService 编排 | snapshotService | 真实 snapshotService | repository (mock), positionSnapshotAdapter (mock), tabService (spy) | — | snapshotService.captureSnapshotInput 执行期间 tabService.openTask 未被调用 | T6-02 |
| T6-16 | CONTAINER_DELEGATION | handleSnapshot 在 activeTab null 时不调用 flowService | Container.handleSnapshot | Container render (无 activeTab) | flowService (spy) | — | flowService 方法未被调用 | — |
| T6-17 | CONTAINER_DELEGATION | handleReturnFromAnalysis 在 activeTab null 时不调用 flowService | Container.handleReturnFromAnalysis | Container render (无 activeTab) | flowService (spy) | — | flowService 方法未被调用 | — |

## 6. v0.5 冲突检查

| 检查项 | 结论 |
| --- | --- |
| origin.provider 分支 | 未使用，通过 |
| source-specific API | 未引入，通过 |
| snapshotService 不创建 Tab | 通过 — flowService 编排 tabService.openTask |
| Container 不直接写 store | 通过 |
| UI component 不直接依赖 service/store | 通过 |
| Return 使用 previousMode 而非硬编码 | 通过 |
| 顶部和底部 Snapshot 走同一 command path | 通过 — 都走 handleSnapshot |
