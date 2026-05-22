# Phase 1 Contract: Workbench Mode + openTask Skeleton

## 1. User Stories

**US-1:** 作为学习者，我希望根据任务特征自动在正确模式的工作台标签页中打开任务（包含 prompt/goal/passRule/referenceLines 的任务为 problem 模式，否则为 play 模式）。

**US-2:** 作为学习者，我希望可以显式指定模式来覆盖自动推导。

**US-3:** 作为学习者，我希望 play/problem 模式的 submit 操作能切换到 recall 模式，冻结 attempt 并创建 recall session。

**US-4:** 作为学习者，我希望可以从任何模式（play/problem/recall）进入 analysis 模式。

**US-5:** 作为学习者，我希望在 analysis 完成后能返回到之前的模式。

**US-6:** 作为学习者，我希望从当前上下文捕获 snapshot，创建派生 task 并在新 tab 中打开，原始 tab 不受干扰。

**US-7:** 作为学习者，我希望可以重新开始一次 attempt，从 recall/analysis 返回 play/problem。

**US-8:** 作为学习者，我希望旧入口 `openGameTab` 和 `openProblemTab` 仍然可用，内部走 `openTask`。

**US-9:** 作为学习者，我希望每个 tab 有 playerConfig（play 模式：黑/白可为 human 或 ai；problem 模式：对方可为 self 或 ai）。

**US-10:** 作为学习者，我希望工作台 container 根据活动 tab 的 `tab.mode` 渲染正确的面板。

## 2. State Flows

### 2.1 Mode Auto-Inference

```
task has prompt | goal | passRule | referenceLines
  --> mode = 'problem'

task has none of these
  --> mode = 'play'

explicit mode provided
  --> mode = explicit value (overrides inference)
```

### 2.2 Main Lifecycle

```
openTask({taskId: 't1'})
  --> store: tabs=[{id, taskId:'t1', mode:'problem'|'play'}]
  --> store: activeTabId = new tab id

startAttempt(tabId)
  --> store: tab.activeAttemptId = 'attempt_1'
  --> DB: create attempt

submit(tabId)
  --> DB: freeze attempt
  --> DB: create recall session
  --> store: tab.mode = 'recall'
  --> store: tab.activeRecallSessionId = 'rs_1'

completeRecall(tabId)
  --> store: tab.mode = 'analysis' (or tab finished)

enterAnalysis(tabId)
  --> store: tab.mode = 'analysis'
  --> store: tab.analysisContext = context

returnFromAnalysis(tabId, toMode)
  --> store: tab.mode = toMode
  --> store: tab.analysisContext = undefined
```

### 2.3 Snapshot Flow

```
[any mode] snapshotFromCurrentContext(tabId)
  --> DB: create snapshot task (origin.provider='snapshot')
  --> store: add new tab as child
  --> store: original tab.mode unchanged
```

### 2.4 Invalid Transition Rejection

```
recall --submit--> REJECTED
analysis --submit--> REJECTED
analysis --complete--> REJECTED
play --returnFromAnalysis--> REJECTED
problem --returnFromAnalysis--> REJECTED
recall --returnFromAnalysis--> REJECTED
analysis --enterAnalysis--> REJECTED
```

## 3. Change Contracts

| Operation | Change Type | What Changes |
|-----------|-------------|--------------|
| `openTask` | **new tab** | WorkbenchTab added to store, mode inferred or explicit, optional playerConfig |
| `submit` | **mode transition** | tab mode: play/problem -> recall; freeze attempt; create recall session |
| `enterAnalysis` | **mode transition** | tab mode: any -> analysis; set analysisContext |
| `returnFromAnalysis` | **mode transition** | tab mode: analysis -> toMode; clear analysisContext |
| `completeRecall` | **mode transition** | tab mode: recall -> analysis or end |
| `restartAttempt` | **reset** | reset attempt, mode -> play/problem |
| `snapshotFromCurrentContext` | **new tab + new task** | create derived task + tab as child; original tab unchanged |
| `startAttempt` | **new attempt** | create attempt, set tab.activeAttemptId |
| `updatePlayerConfig` | **tab patch** | update tab.playerConfig |
| `closeTab` | **tab removal** | remove from store, unlink parent, recursively remove children |

## 4. Test Contracts

### 4.1 MUST_AUTOMATE

| ID | Category | Contract |
|----|----------|----------|
| T01 | PURE_LOGIC | `inferDefaultMode` returns `'problem'` for task with `prompt` |
| T02 | PURE_LOGIC | `inferDefaultMode` returns `'problem'` for task with `goal` only |
| T03 | PURE_LOGIC | `inferDefaultMode` returns `'problem'` for task with `passRule` only |
| T04 | PURE_LOGIC | `inferDefaultMode` returns `'problem'` for task with `referenceLines` only |
| T05 | PURE_LOGIC | `inferDefaultMode` returns `'play'` for task with no problem-indicator fields |
| T06 | PURE_LOGIC | `openTask` with explicit mode overrides inference |
| T07 | STATE | `openTask` adds tab to store and sets it active |
| T08 | STATE | `openTask` with `parentTabId` links child tab id to parent's `childTabIds` |
| T09 | STATE | `openTask` throws when `parentTabId` does not exist |
| T10 | STATE | `openTask` throws when task does not exist |
| T11 | STATE | `openTask` creates tab with `mode` field, not `phase` |
| T12 | STATE | `closeTab` removes tab from store, clears active if needed |
| T13 | STATE | `closeTab` recursively closes child tabs |
| T14 | STATE | `closeTab` unlinks child from parent `childTabIds` |
| T15 | STATE | `closeTab` is no-op when tab does not exist |
| T16 | STATE | `submit` transitions play mode tab to recall |
| T17 | STATE | `submit` transitions problem mode tab to recall |
| T18 | SIDE_EFFECT | `submit` freezes attempt before creating recall session |
| T19 | STATE | `submit` sets `activeRecallSessionId` on tab |
| T20 | STATE | `enterAnalysis` transitions from play to analysis |
| T21 | STATE | `enterAnalysis` transitions from problem to analysis |
| T22 | STATE | `enterAnalysis` transitions from recall to analysis |
| T23 | STATE | `enterAnalysis` sets analysisContext on tab |
| T24 | STATE | `returnFromAnalysis` restores mode to `toMode` parameter |
| T25 | STATE | `returnFromAnalysis` clears analysisContext |
| T26 | STATE | `completeRecall` transitions from recall to analysis or end |
| T27 | STATE | `restartAttempt` resets mode to play/problem |
| T28 | STATE | `snapshotFromCurrentContext` creates new tab, original tab mode unchanged |
| T29 | STATE | `snapshotFromCurrentContext` links snapshot tab as child |
| T30 | STATE | `snapshotFromCurrentContext` works from any mode (play/problem/recall/analysis) |
| T31 | PURE_LOGIC | Invalid mode transitions throw error and do not modify tab mode |
| T32 | PURE_LOGIC | Mode transition table is exhaustive |
| T33 | STATE | Play and problem share the same valid transitions (submit, enterAnalysis, snapshot) |
| T34 | STATE | Legacy `openProblemTab` produces tab with `mode` (not `phase`) |
| T35 | STATE | Legacy `openGameTab` produces tab with `mode='play'` |
| T36 | STATE | `playerConfig` stored on tab, round-trips through store |
| T37 | STATE | `playerConfig` updatable after creation |
| T38 | ARCHITECTURE_BOUNDARY | `workbenchStore.normalizeTab` still maps legacy `phase` to `mode` |
| T39 | STATE | Tab `updatedAt` changes after any mode transition |
| T40 | SIDE_EFFECT | Rejected transitions log to logger when provided |

### 4.2 MANUAL_ACCEPTANCE

| ID | Contract |
|----|----------|
| T41 | TrainingWorkbenchContainer renders correct panel based on active tab's `tab.mode` |
| T42 | Legacy workbenchPhaseService API still works through wrappers (migration period) |
| T43 | Mode indicator displays current tab's mode in tab bar |

### 4.3 DEFERRED (not blocking Phase 1)

- `playerConfig.ai` field validation (Phase 3)
- Problem opponent mapping to black/white config (Phase 3)
- `startAttempt` full lifecycle with attemptService (Phase 3)
- Container rendering specific component names (implementation detail)
- `snapshotService` internal logic (covered separately)

## 5. Fragility Warnings

1. **T18 (submit order)**: Test observable state (attempt status + recall session exists) rather than call order.
2. **T34-T35 (legacy wrappers)**: Test observable state (tab created, mode correct) rather than that `openTask` is called internally.
3. **T23/T25 (analysisContext)**: Test minimal required fields, not full structure.
4. **T37 (playerConfig update)**: Frame as "config can change after creation", not specific method name.

## 6. Out of Scope

- taskImportService (Phase 2)
- aiMoveService and actual AI moves (Phase 3)
- attemptService.appendMove with actor (Phase 3)
- playTrainingMonitor with mode integration (Phase 4)
- recallCheckpointService (Phase 5)
- Analysis mode free placement (Phase 6)
- reviewService scheduling (Phase 7)
- Legacy cleanup (Phase 9)
