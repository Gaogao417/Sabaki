# W8-P3 Task 5 接线契约 — Recall 操作按钮

Date: 2026-05-21
Status: pending-audit (v0.2 — 修订版)

## 0. 真源对齐

| 真源 | 章节 | 对本契约的约束 |
| --- | --- | --- |
| PRD v0.5 SS2.3 | Recall Mode: 回忆棋步、检查点、完成回忆 | Recall 操作按钮集合 |
| PRD v0.5 SS3.4 | 从 Recall 可进入 Analysis | Enter Analysis 调用 flowService.enterAnalysis |
| PRD v0.5 SS5.5 | Snapshot 完整流程 | Snapshot 走 flowService.snapshotFromCurrentContext |
| PRD v0.5 SS6.6 | Recall 顶部: [进入复盘] [结束] [Snapshot] | ModeActions recall 按钮集 |
| PRD v0.5 SS10 | Recall 底部: [标记检查点] [提示] [校对跳过] [进入复盘] | BottomActionBar recall 按钮集 |
| Arch v0.5 SS5.3 | MODE_TRANSITIONS: recall -> ['completeRecall','enterAnalysis','snapshot'] | flowService 声明合法转换 |
| Arch v0.5 SS5.3 | completeRecall(tabId) -> mode:'analysis' | completeRecall 后自动进入 analysis |
| Arch v0.5 SS5.3 | enterAnalysis(tabId) -> {mode:'analysis', previousMode, analysisContext} | 保存完整上下文 |

## 1. 用户故事

- **US-5.1 (End Recall):** 作为 Recall 用户，我想结束回忆，系统自动进入分析模式。
- **US-5.2 (Enter Analysis):** 作为 Recall 用户，我想直接进入分析模式（保留回忆状态）。
- **US-5.3 (Snapshot):** 作为 Recall 用户，我想对当前回忆局面拍照保存。
- **US-5.4 (Mark Checkpoint):** 作为 Recall 用户，我想手动标记检查点 — **deferred no-op**。
- **US-5.5 (Hint):** 作为 Recall 用户，我想获取提示。
- **US-5.6 (Verify Skip):** 作为 Recall 用户，我想校对跳过当前棋步。

## 2. 用户动作（基于实际 UI 组件回调名）

| ID | 动作 | UI 组件 | Callback prop | Container handler |
| --- | --- | --- | --- | --- |
| A-5.1 | 结束回忆(顶部) | ModeActions recall `onEnd` | `onEnd` | handleEndRecall (条件: activeTab.mode==='recall') |
| A-5.2 | 进入复盘(顶部) | ModeActions recall `onAnalysis` | `onAnalysis` | handleEnterAnalysis |
| A-5.3 | Snapshot(顶部) | ModeActions recall `onSnapshot` | `onSnapshot` | handleSnapshot |
| A-5.4 | 进入复盘(底部) | BottomActionBar recall `onEnterAnalysis` | `onEnterAnalysis` | handleEnterAnalysis |
| A-5.5 | 标记检查点(底部) | BottomActionBar recall `onMarkCheckpoint` | `onMarkCheckpoint` | no-op stub |
| A-5.6 | 提示(底部) | BottomActionBar recall `onHint` | `onHint` | legacyTrainingFlowController.showRecallHint() |
| A-5.7 | 校对跳过(底部) | BottomActionBar recall `onVerifySkip` | `onVerifySkip` | — **GAP: 未接线** |

**GAP 发现**: BottomActionBar recall 的 `onVerifySkip` 未出现在 `shellHandlers` 中。shellHandlers 有 `onSkip`（映射到 legacyTrainingFlowController.skipRecallMove()），但 BottomActionBar 使用的 callback 名是 `onVerifySkip`，两者不匹配。

**关键**: Container shellHandlers 第 244 行 `onEnd` 在 recall 模式下条件路由到 `handleEndRecall`:
```js
onEnd: (activeTab && activeTab.mode === 'recall') ? handleEndRecall : handleSubmit
```

## 3. 状态流

### 3.1 Complete Recall (End Recall)

```
ModeActions.js:66 -> callbacks['onEnd']()  (recall mode -> handleEndRecall)
Container.handleEndRecall() -> flowService.completeRecall(activeTab.id)
flowService.completeRecall(tabId):
  -> assertTransition(tab, 'completeRecall')
  -> recallService.completeRecall(recallSessionId) [fire-and-forget .catch]
  -> runtimeStore.setRecallView(null)
  -> runtimeStore.setActiveCheckpoint(undefined)
  -> workbenchStore.updateTab(tabId, { mode: 'analysis' })
subscriber -> Container.forceUpdate
projectFromWorkbench(ws) -> mode='analysis', panel 切换
```

### 3.2 Enter Analysis (from Recall)

```
ModeActions.js:66 -> callbacks['onAnalysis']() 或 BottomActionBar callbacks['onEnterAnalysis']()
Container.handleEnterAnalysis() -> flowService.enterAnalysis(activeTab.id)
flowService.enterAnalysis(tabId):
  -> assertTransition(tab, 'enterAnalysis')
  -> workbenchStore.updateTab(tabId, {
       mode: 'analysis',
       previousMode: tab.mode,  // 'recall'
       analysisContext: { taskId, source: 'recall', attemptId }
     })
subscriber -> Container.forceUpdate
```

### 3.3 Snapshot (from Recall)

同 Task 4 Snapshot 链路。flowService.snapshotFromCurrentContext 编排完整流程。

### 3.4 Hint (via legacy controller)

```
BottomActionBar.js:117 -> callbacks['onHint']()
Container shellHandlers.onHint -> legacyTrainingFlowController.showRecallHint()
[注: 走 legacy 路径，非 flowService]
```

### 3.5 Verify Skip (GAP - 未接线)

```
BottomActionBar.js:117 -> callbacks['onVerifySkip']()
shellHandlers 中无 onVerifySkip 键 -> handler 为 undefined -> 按钮无响应
```

## 4. Deferred Handler

| Handler | 行为 | 退出条件 | 补齐 Task |
| --- | --- | --- | --- |
| onMarkCheckpoint | no-op stub | Product 确认 manual checkpoint feature | TBD |

## 5. 继承的 W4 测试（不重复）

- Submit correction (handleSubmitCorrection), Reveal AI (handleRevealAI), Skip checkpoint (handleSkipCheckpoint), Save comment (handleSaveCheckpointComment) 已在 W4-T05~T08 覆盖。

## 6. 测试/验收契约表（含分层）

| ID | 类型 | 契约 | Production Subject | Real Deps | Mock Deps | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T5-01 | CONTAINER_DELEGATION | handleEndRecall 调用 flowService.completeRecall(activeTab.id) | Container.handleEndRecall | Container render | flowService.completeRecall (spy) | workbenchStore | flowService.completeRecall 被调用一次，参数为 activeTab.id | T5-04 |
| T5-02 | CONTAINER_DELEGATION | handleEnterAnalysis 调用 flowService.enterAnalysis(activeTab.id) | Container.handleEnterAnalysis | Container render | flowService.enterAnalysis (spy) | workbenchStore | flowService.enterAnalysis 被调用一次 | T5-05 |
| T5-03 | CONTAINER_DELEGATION | handleSnapshot 调用 flowService.snapshotFromCurrentContext(activeTab.id) | Container.handleSnapshot | Container render | flowService.snapshotFromCurrentContext (spy) | workbenchStore | flowService.snapshotFromCurrentContext 被调用一次 | T5-06 |
| T5-04 | CONTROLLER_STATE_TRANSITION | completeRecall 后 tab.mode 变为 'analysis' | flowService.completeRecall | 真实 workbenchStore, 真实 flowService | recallService.completeRecall (stub, fire-and-forget) | workbenchStore, flowService | workbenchStore.getState().tabs[idx].mode === 'analysis' | T5-10 |
| T5-05 | CONTROLLER_STATE_TRANSITION | enterAnalysis 后 tab.mode='analysis', previousMode='recall', analysisContext.source='recall' | flowService.enterAnalysis | 真实 workbenchStore, 真实 flowService | 无 | workbenchStore, flowService | tab.mode==='analysis' && tab.previousMode==='recall' && tab.analysisContext.source==='recall' | T5-10 |
| T5-06 | CONTROLLER_STATE_TRANSITION | snapshot 后 workbenchStore 包含新 Tab (mode=problem, parentTabId=原tabId) | flowService.snapshotFromCurrentContext | 真实 workbenchStore, 真实 flowService | snapshotService, repository, tabService | workbenchStore, flowService | 新 tab 存在且 mode='problem' | T5-11 |
| T5-07 | CONTROLLER_STATE_TRANSITION | snapshot 后当前 Tab mode 仍为 'recall' | flowService.snapshotFromCurrentContext | 真实 workbenchStore | snapshotService, repository, tabService | workbenchStore | 原 tab.mode === 'recall' | — |
| T5-08 | CONTROLLER_STATE_TRANSITION | completeRecall 后 runtimeStore recallView 被清除 | flowService.completeRecall + runtimeStore | 真实 workbenchStore, 真实 runtimeStore | recallService (stub) | workbenchStore, runtimeStore | runtimeStore.getState().recallView === null | — |
| T5-09 | PROJECTION_RETURN | completeRecall 后 projectFromWorkbench 返回 mode='analysis' | projectFromWorkbench | 真实 projection 函数 | 无 | — | 返回对象.mode === 'analysis' | — |
| T5-10 | PROJECTION_RETURN | enterAnalysis 后 projectFromWorkbench 返回 mode='analysis' | projectFromWorkbench | 真实 projection 函数 | 无 | — | 返回对象.mode === 'analysis' | — |
| T5-11 | STORE_SUBSCRIPTION | completeRecall/enterAnalysis/snapshot 后 subscriber 收到通知 | workbenchStore.subscribe | 真实 workbenchStore | 无 | — | subscriber callback 被调用 | — |
| T5-12 | UI_COMMAND_MAPPING | ModeActions recall 渲染 onAnalysis+onEnd+onSnapshot 按钮 | ModeActions (mode='recall') | preact render | 无 | — | 存在 button[data-testid="mode-action-analysis"], [mode-action-end], [mode-action-snapshot] | T5-01, T5-02, T5-03 |
| T5-13 | UI_COMMAND_MAPPING | BottomActionBar recall 渲染 onMarkCheckpoint+onHint+onVerifySkip+onEnterAnalysis 按钮 | BottomActionBar (mode='recall') | preact render | 无 | — | 存在对应 testid 的 button | T5-01, T5-02 |
| T5-14 | CONTAINER_DELEGATION | onHint 调用 legacyTrainingFlowController.showRecallHint() | Container shellHandlers.onHint | Container render | legacyTrainingFlowController.showRecallHint (spy) | — | legacyTrainingFlowController.showRecallHint 被调用 | — |
| T5-15 | ARCHITECTURE_BOUNDARY | Container 不直接写 workbenchStore | Container handlers | Container render | flowService (spy) | — | workbenchStore.updateTab 未被 Container 直接调用 | — |
| T5-16 | CONTAINER_DELEGATION | onMarkCheckpoint 为 no-op，不调用 flowService | Container shellHandlers | Container render | flowService (spy) | — | flowService 方法未被调用 | — |
| T5-17 | CONTAINER_DELEGATION | handler 在 activeTab null 时不调用 flowService | Container handlers | Container render (无 activeTab) | flowService (spy) | — | flowService 所有方法未被调用 | — |
| T5-18 | PROJECTION_RETURN | completeRecall 后 recall 进度不再投影（runtimeStore recallView=null） | projectFromWorkbench + runtimeStore | 真实 projection, 真实 runtimeStore | 无 | — | 返回对象不含 recall 进度数据 | — |
| T5-19 | SIDE_EFFECT_BOUNDARY | recallService.completeRecall 以 fire-and-forget 方式调用，失败不阻塞 mode 转换 | flowService.completeRecall | 真实 flowService, 真实 workbenchStore | recallService.completeRecall (stub, 返回 rejected promise) | workbenchStore | tab.mode 仍变为 'analysis'（异步失败不影响同步 mode 转换） | — |
| T5-GAP | CONTAINER_DELEGATION | BottomActionBar onVerifySkip 未接线（确认 GAP） | Container shellHandlers | Container render | 无 | — | shellHandlers 中无 onVerifySkip 键 | — |

## 7. 不测试（超出范围）

| 项目 | 原因 |
| --- | --- |
| Submit correction, Reveal AI, Skip checkpoint, Save comment | 已在 W4 覆盖 |
| recallService.completeRecall 的内部逻辑 | recallService 单元测试覆盖 |
| BottomActionBar recall 进度显示 (recallProgress/recallTotal) | 状态显示，非操作接线 |

## 8. v0.5 冲突检查

| 检查项 | 结论 |
| --- | --- |
| completeRecall 后 mode='analysis' vs Arch v0.5 SS5.3 | 一致 |
| enterAnalysis 保存 previousMode + analysisContext vs Arch v0.5 SS9.6 | 一致 |
| recallService.completeRecall fire-and-forget vs 同步 mode 转换 | 生产代码行为，通过 |
| origin.provider 分支 | 未使用，通过 |
| Container 不直接写 store | 通过 |
| UI component 不直接依赖 service/store | 通过 |
