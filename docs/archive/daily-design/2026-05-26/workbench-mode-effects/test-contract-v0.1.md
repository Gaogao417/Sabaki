Date: 2026-05-26
Status: pending-confirmation

# 契约草案

## 0. 真源对齐

本契约只从 `docs/product/`、`docs/architecture/`、`docs/ui_ux/` 派生。`step2` audit 和当前代码只作为缺口定位输入，不覆盖真源。

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | §5.2, lines 235-269 | 运行态 workbench mode 只有 Play / Problem / Recall / Analysis。Snapshot 可全局发现，但创建 Problem 前必须先进入 Analysis scratch/current，不能从 Play / Problem / Recall live mutable context 直接创建 Problem。 |
| `docs/product/sabaki-training-prd.md` | §6.3.6, lines 560-574 | Play / Problem / Recall 点击 Snapshot 的产品流必须是先进入 Analysis 并创建 scratch projection，然后再 Snapshot。Snapshot service 只能从 Analysis scratch/current 派生。 |
| `docs/product/sabaki-training-prd.md` | §6.3.7, lines 591-614; §12.9, lines 1558-1564 | Analysis edit bar 写入 scratch/current working position；不得改写 source `TrainingAttempt.userLine` 或 source game tree；底部 Snapshot 与顶部 Snapshot 必须走同一 command path。 |
| `docs/product/sabaki-training-prd.md` | §12.3-§12.5, lines 1511-1533 | Recall 可进入 Analysis；Analysis 创建 Problem 前必须先投影到 scratch/current；Problem Attempt 提交后冻结并可进入 Recall，进入 Analysis 不等同于提交。 |
| `docs/product/sabaki-training-prd.md` | §12.10, lines 1568-1574 | E2E 不能只检查元素存在，必须验证 UI command 到 service/store/projection 的真实结果。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §0.3, lines 89-109; §1.3, lines 201-209 | UI 只展示；Container/Controller 读 Store、调 Service；Service 编排业务动作；Store 不调 Service；禁止 `snapshotService` 打开 Tab，禁止按 `origin.provider` 分叉主流程。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §0.4, lines 112-158 | mode guard/effect 规则必须收敛到可测试状态机和 service 编排，不散落在 UI callback。`enterAnalysis` 保存 `AnalysisReturnTarget`，`return` 恢复 previous mode、recall substate、tree position、moveIndex。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §1.1-§1.2, lines 168-198 | 读路径为 store -> Container/ViewModel -> UI；写路径为 UI -> Controller/Container -> Service -> Store/Repository/Adapter -> Sabaki core。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §4.2, lines 473-523; §4.3, lines 564-628 | `workbenchStore` owns tabs, mode, `analysisContext`, `analysisReturnTarget`; `trainingRuntimeStore` owns active attempt/recall/checkpoint runtime projections. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §5.3, lines 728-802 | `workbenchFlowService` is the mode/workflow orchestrator. `enterAnalysis`, `returnFromAnalysis`, `snapshotFromCurrentContext` are service commands. `Snapshot` must not reuse current tab; null `taskId` snapshot source is allowed only through the same command path. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §5.10, lines 1110-1187 | `snapshotService` captures input only and does not create tabs. `sourceTaskId` is optional; no `repository.loadTask(null/undefined)`. Mode-specific current-position capture rules must be explicit. Analysis capture uses active `ExplorationBranch`, not `Attempt.userLine` tail unless context explicitly points there. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §9.6-§9.7, lines 1871-1891 | Enter Analysis command path goes through `workbenchFlowService.enterAnalysis` and updates `workbenchStore`; Snapshot command path captures, creates snapshot task, then opens a new task tab. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §14, lines 2164-2198 | Red lines: source is not core modeling dimension; origin is trace only; Checkpoint is Recall substate; Analysis Return restores `AnalysisReturnTarget`; Analysis does not pollute Attempt; Snapshot creates new Task and does not reuse current tab; source-specific legacy APIs must not return. |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §2, lines 143-172 | Top mode segmented control and mode actions define the visible entry points: Problem/Recall enter Analysis; Analysis Snapshot and Return; Snapshot is globally discoverable. |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §8, lines 677-742, 803-830 | Analysis UI shows context, Snapshot card/action, edit bar, scratch behavior, and snapshot success state. |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §9, lines 832-884 | Manual mode switching must preserve internal state; Analysis can be temporary from Play/Problem/Recall; Return must restore saved target; Snapshot opens a new task/tab and leaves current tab mode/substate unchanged. |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §10-§11, lines 888-953 | Keyboard shortcuts and bottom actions must share the same command path as buttons; disabled main actions must not perform side effects; bottom Snapshot must use top Snapshot command path. |
| `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md` | lines 6-15, 44-63, 64-79 | Components render projected view models, do not mutate stores directly, Snapshot persists only through Analysis scratch/current, and every visible command needs explicit owner, disabled reason, and acceptance evidence. |

Derived audit context:

- `docs/archive/daily-design/2026-05-26/workbench-step2-test-audit/test-audit-v0.1.md` approved the current REDs as implementation gaps, especially: non-analysis Snapshot must first `enterAnalysis`, `snapshotService` must reject direct non-analysis capture, and null-task guard must avoid direct persistence.
- Current implementation evidence, not truth: `TrainingWorkbenchContainer.js:109-136` owns `ensureAnalysisWorkspace`/`exitAnalysisWorkspace`; `TrainingWorkbenchContainer.js:150-156`, `177-186`, `189-197` calls flow service and then mutates legacy analysis workspace. This is the migration seam this contract moves behind service effect ports.

## 1. 用户故事

作为训练工作台用户，我可以从 Play、Problem、Recall 或 Recall checkpoint 临时进入 Analysis，自由研究当前可见局面、整理 scratch/current 和 Snapshot 素材；返回时恢复原来的 mode/substate/tree position/moveIndex。Snapshot 在任意 mode 可发现，但只有 Analysis scratch/current 成为当前 source 后，才允许创建新的 TrainingTask/child tab。整个过程不得污染 source Attempt、Recall session、Problem attempt 或正式 game tree。

## 2. 用户动作

1. 用户点击顶部 mode segmented control 的 `复盘模式`。
2. 用户在 Problem 或 Recall 顶部动作点击 `进入复盘`。
3. 用户在 Recall checkpoint 点击 `进入 Analysis` 或完成 Recall 后进入 Analysis。
4. 用户在非 Analysis mode 点击 `Snapshot`，系统先进入 Analysis scratch/current，而不是直接创建 task。
5. 用户在 Analysis 顶部、左栏卡片或底部点击 `Snapshot / 派生新 Task`。
6. 用户在 Analysis 点击 `返回上一个模式`。
7. 用户在非 Analysis mode 点击底部 `Edit position`，系统进入 Analysis 并选择编辑工具。
8. 键盘 `A` 和 `S` 若已接线，必须与上述按钮走同一 command path。

上游真实调用签名必须锁定：

| 调用方 | 真实调用签名 | 证据 | 契约约束 |
| --- | --- | --- | --- |
| `ModeBar` segmented control | `onModeChange(key)`，其中 `key` 是 mode string | `src/components/workbench/shell/ModeBar.js:41-59` | Container handler 不应期望 DOM event 或额外 payload。测试若按 `(mode, event)` 调用必须标记为假绿风险。 |
| `ModeBar` top actions | `onAnalysis()`, `onSnapshot()`, `onReturn()` 由 `ActionButton` 的 `onClick` 直接触发 | `src/components/workbench/shell/ModeBar.js:27-38`, `150-175` | Handler 必须从 active tab projection 读 tabId，不能依赖按钮传 tabId。 |
| `ModeActions` buttons | `handler()` 零参数 | `src/components/workbench/shell/ModeActions.js:61-67` | 测试不得通过传入 tabId 让 handler 通过。 |
| `BottomActionBar.actionBtn` | `handler()` 零参数 | `src/components/workbench/shell/BottomActionBar.js:106-112` | 底部 compat button 与顶部动作共享 Container command。 |
| `BottomActionBar.visualButton` | callback 被直接赋给 `onClick`，可能收到 Preact MouseEvent | `src/components/workbench/shell/BottomActionBar.js:155-164`, `196-207` | Container handler 必须忽略可选 event；测试不能把 event 当业务 payload。 |
| `AnalysisModePanel` Snapshot card | `onSnapshot` 直接作为 `onClick` callback | `src/components/workbench/panels/AnalysisModePanel.js:119-122` | Snapshot handler 从 active tab 和 store state 派生 context。 |

## 3. 当前阶段

当前阶段是 Workbench wiring workflow `step3.2.contract`。本契约为后续 `step3.2.tests` 和 `step3.2.impl` 定义 `ModeEnterEffect` / `ModeExitEffect` orchestration boundary。不得写测试和生产代码。

与并行 step 的关系：

- `step3.1` 同时实现 `src/modules/training/workbench/modeStateResolver.ts`。本契约不修改该文件，也不要求 resolver 产生副作用。
- `step3.2.impl` 后续会修改 `workbenchFlowService.ts`。本契约只定义行为与边界。
- `step4` 后续把 Container 中的 legacy analysis workspace 决策移入 flow service effect port。当前 Container 直接调用 legacy Sabaki workspace 的代码只允许作为临时迁移接缝。

## 4. 位置源

| 场景 | 进入前 source | 进入 Analysis 后 source | Snapshot source | 约束 |
| --- | --- | --- | --- | --- |
| Play -> Analysis | `game-tree` / documentStore current position | `scratch/current` projection from visible position | active Analysis scratch/current / `ExplorationBranch` | Enter effect 不执行 `playMove`，不 freeze attempt。 |
| Problem -> Analysis | `problem-attempt` current answer-line position | `scratch/current` projection from current answer-line | active Analysis scratch/current | 不写 `Attempt.userLine`，不执行 submit/passRule，不创建 Recall。 |
| Recall normal -> Analysis | recall expected/current replay position, plus frozen Attempt reference | `scratch/current` projection from recall visible position | active Analysis scratch/current | 不推进 `RecallSession.currentMoveIndex`，不写 frozen Attempt。 |
| Recall checkpoint -> Analysis | correctionDraft current position and checkpoint context | `scratch/current` projection from correction draft/current visible position | active Analysis scratch/current, with checkpoint trace if later Snapshot | checkpoint remains Recall substate, not mode。 |
| Analysis -> Return | `scratch/current` active workspace plus saved return target | restored source mode/context | none | Return restores saved target only，不猜测目标。 |
| Analysis -> Snapshot | active `ExplorationBranch` / scratch/current | current tab remains Analysis | new Task and child tab | Snapshot 不复用当前 tab，不修改 source tab mode/substate。 |
| Null-task/free-play -> Analysis for Snapshot guard | documentStore/Sabaki current visible position, no `taskId` | `scratch/current` without `sourceTaskId` | active Analysis scratch/current | 不调用 `repository.loadTask(null/undefined)`；不直接 Snapshot。 |

## 5. 变更契约

Mode transition itself is **无变更** for formal棋谱、Attempt、Recall facts:

- `enterAnalysis`: writes Workbench/Sabaki UI state and initializes Analysis scratch/current only. It is not `playMove`, `problemAttemptMove`, `recallAnswer`, or `variationMove`.
- `returnFromAnalysis`: restores Workbench/Sabaki UI state from `AnalysisReturnTarget`. It is not a source mutation.
- Analysis edit bar after entry uses `scratchEdit`, but the edit commands are out of this step except for the requirement that ModeEnterEffect creates/points at scratch/current.
- Snapshot from Analysis is **其他: snapshot task creation**. It creates a new TrainingTask and child tab while preserving current tab mode/substate. It is not a source position mutation.
- Snapshot outside Analysis is **无变更 plus enterAnalysis guard**. It must enter Analysis first and must not call snapshot persistence from Play/Problem/Recall.

Contract sketch for the orchestration port, for tests and implementation alignment:

```ts
type ModeEnterEffectInput = {
  tabId: string
  fromMode: 'play' | 'problem' | 'recall'
  toMode: 'analysis'
  beforeTab: WorkbenchTab
  afterTab: WorkbenchTab
  analysisReturnTarget: AnalysisReturnTarget
  analysisContext: Partial<AnalysisContext>
  reason?: 'manual' | 'snapshot' | 'edit-position' | 'recall-complete'
  selectedTool?: string
}

type ModeExitEffectInput = {
  tabId: string
  fromMode: 'analysis'
  toMode: 'play' | 'problem' | 'recall'
  beforeTab: WorkbenchTab
  afterTab: WorkbenchTab
  analysisReturnTarget: AnalysisReturnTarget
  reason?: 'return' | 'restart-attempt'
}

type WorkbenchModeEffects = {
  enterAnalysis(input: ModeEnterEffectInput): void | Promise<void>
  exitAnalysis(input: ModeExitEffectInput): void | Promise<void>
}
```

Implementation may choose exact type names, but tests must prove this contract:

- `workbenchFlowService` owns when these effects are invoked.
- Mode effects are injected ports/adapters, not UI component imports.
- Effects may update existing Sabaki analysis workspace through an adapter seam; they may not decide mode guard, task kind, source branch, snapshot persistence, or training DB writes.
- Resolver functions remain pure and never call these effects.

## 6. 预期状态流

### 6.1 Enter Analysis

```text
UI control event
-> WorkbenchShell / ModeBar / ModeActions / BottomActionBar callback prop
-> TrainingWorkbenchContainer handler
-> controller command
-> workbenchFlowService.enterAnalysis
-> resolveTransition guard
-> ModeEnterEffect adapter and workbenchStore update
-> runtimeStore / workbenchStore / Sabaki state
-> workbenchStore and Sabaki adapter subscriptions
-> projectFromWorkbench + projectFromRuntime + projectGobanProps
-> WorkbenchShell props
-> UI update
```

Concrete chain:

1. `ModeBar` segmented `onModeChange('analysis')`, top `onAnalysis()`, or bottom `onEditPosition()` fires.
2. `TrainingWorkbenchContainer.handleModeChange`, `handleEnterAnalysis`, or `handleEditPosition` reads active tab from `workbenchStore`.
3. Controller command is the semantic `enterAnalysis(tabId, {reason, selectedTool})`. Current code has no separate controller; Container directly calls service as a temporary migration seam. Exit condition: step4 removes Container-owned analysis workspace decisions and the service/effect port owns them.
4. `workbenchFlowService.enterAnalysis` loads current tab from `workbenchStore`, calls the pure transition guard, computes `analysisReturnTarget` and `analysisContext`, and orchestrates `ModeEnterEffect`.
5. Store before/after:
   - Before: active tab `mode` is `play` / `problem` / `recall`; `analysisReturnTarget` absent; `activeAttemptId`, `activeRecallSessionId`, `recallSubstate`, `currentTreePosition`, and current move index represent source context.
   - After: active tab `mode='analysis'`; `previousMode` is the source mode; `analysisReturnTarget` contains `mode`, `recallSubstate`, `treePosition`, and `moveIndex` when known; `analysisContext` identifies the analysis source without using `origin.provider` as flow branch.
   - Runtime facts such as `activeAttemptId`, `activeRecallSessionId`, `activeCheckpointId`, `problemView`, `recallView`, and correction draft are preserved unless another explicit service command owns the change.
6. Allowed Sabaki adapter state after effect: legacy analysis mode/workspace visible, `editWorkspace` or equivalent scratch/current initialized, analysis display enabled, optional selected tool set for edit-position, scratch analysis scheduled if workspace exists.
7. Store subscriptions trigger Container `forceUpdate`; adapter subscriptions trigger board projection refresh.
8. UI shows `analysis` as active, Analysis panels, Snapshot/Return actions, and Analysis bottom toolbar. Source Problem/Recall/Play facts remain unchanged.

### 6.2 Return From Analysis

```text
UI control event
-> WorkbenchShell / ModeBar / ModeActions callback prop
-> TrainingWorkbenchContainer handler
-> controller command
-> workbenchFlowService.returnFromAnalysis
-> resolveTransition guard
-> ModeExitEffect adapter and workbenchStore update
-> runtimeStore / workbenchStore / Sabaki state
-> subscriptions
-> projection
-> previous-mode UI update
```

Concrete chain:

1. Analysis top action `onReturn()` or mode segmented control to the saved previous mode fires.
2. Container handler reads active tab only; it must not infer return target from button label.
3. `workbenchFlowService.returnFromAnalysis({tabId})` rejects if active tab has no `analysisReturnTarget`.
4. Store before/after:
   - Before: active tab `mode='analysis'`, `analysisReturnTarget` exists.
   - After: active tab mode, recall substate, tree position, and moveIndex are restored from `analysisReturnTarget`; `previousMode` and `analysisReturnTarget` are cleared.
   - `analysisContext` may remain only as inert history; non-analysis projections must ignore it. Preferred implementation clears or namespaces it so stale analysis data cannot drive Play/Problem/Recall UI.
5. `ModeExitEffect` restores or hides legacy analysis workspace as needed through adapter seam. It must not submit, freeze, undo, write game tree, clear Recall checkpoint, or clear Problem attempt.
6. Subscriptions re-render previous mode panels/actions/bottom bar.

### 6.3 Snapshot From Analysis

```text
UI Snapshot event
-> WorkbenchShell / Analysis panel / BottomActionBar callback
-> TrainingWorkbenchContainer.handleSnapshot
-> controller command
-> workbenchFlowService.snapshotFromCurrentContext
-> snapshotService.captureSnapshotInput(analysis scratch/current)
-> taskImportService.createTaskFromSnapshot or repository createTask boundary
-> workbenchTabService.openTask
-> workbenchStore/Sabaki tab state
-> subscriptions
-> projection
-> current tab remains Analysis, child Problem/Play tab opens
```

Store before/after:

- Before: active tab `mode='analysis'` and has capturable scratch/current.
- After: source tab remains `mode='analysis'` and keeps substate/return target; a new standard TrainingTask is created with snapshot origin metadata; a child tab opens via `workbenchTabService.openTask`. `snapshotService` itself does not open tabs.

### 6.4 Snapshot Outside Analysis And Null-Task Guard

```text
UI Snapshot event from Play / Problem / Recall
-> WorkbenchShell / ModeActions / shortcut callback
-> TrainingWorkbenchContainer handler
-> controller command
-> workbenchFlowService.enterAnalysis({reason:'snapshot'})
-> ModeEnterEffect creates scratch/current projection
-> workbenchStore/Sabaki state
-> subscriptions/projection
-> UI shows Analysis for user confirmation
```

Forbidden in this chain:

- no `workbenchFlowService.snapshotFromCurrentContext` call before active tab is in Analysis;
- no `snapshotService.captureSnapshotInput` call from Play / Problem / Recall;
- no `repository.loadTask(null)` for free-play/null-task tabs;
- no child task/tab creation until the user executes Snapshot from Analysis scratch/current.

## 7. 允许的副作用

| 副作用 | Owner | 条件 |
| --- | --- | --- |
| `workbenchStore.updateTab` sets `mode='analysis'`, `previousMode`, `analysisReturnTarget`, `analysisContext` | `workbenchFlowService.enterAnalysis` | Transition guard passes. |
| `workbenchStore.updateTab` restores saved mode/substate/tree position/moveIndex and clears return target | `workbenchFlowService.returnFromAnalysis` | Active tab is Analysis and has saved return target. |
| Legacy Sabaki analysis workspace setup or teardown | `ModeEnterEffect` / `ModeExitEffect` adapter | Injected through service dependency. Temporary migration seam until training-owned analysis workspace is complete. |
| `attemptService.markAnalysisOpened` | `workbenchFlowService.enterAnalysis` | Optional, only if active attempt exists; must not alter `Attempt.userLine` or freeze/submit status. |
| Scratch analysis scheduling | Mode effect adapter / analysis adapter | Only for Analysis scratch/current workspace, not from resolver or store. |
| Structured logs for accepted/rejected transitions | `workbenchFlowService` | Logs must not be primary test oracle except presence of rejection metadata. |
| Snapshot task creation and tab opening | `workbenchFlowService.snapshotFromCurrentContext` through snapshot/task import/repository/tab boundaries | Only when current tab is Analysis and position is capturable. |
| UI re-render from subscriptions | Container subscriptions to workbench/runtime/Sabaki adapter | After store/effect state changes. |

## 8. 禁止的副作用

| 禁止项 | 理由 |
| --- | --- |
| Resolver or modeStateResolver mutates store, calls service, engine, DB, UI, or ModeEffect | Resolver must stay pure. |
| Presentational WorkbenchShell/panels import or call service/store/repository/Sabaki | UI components only emit semantic callbacks. |
| Container writes `workbenchStore` or `runtimeStore` directly for mode effects | Container reads store and delegates service; service owns orchestration. |
| Container directly creates/exits legacy analysis workspace after step4 | Current `ensureAnalysisWorkspace`/`exitAnalysisWorkspace` is temporary seam only. |
| Snapshot from Play / Problem / Recall directly persists a task | PRD requires Analysis scratch/current first. |
| `snapshotService` opens tab or orchestrates flow | Architecture assigns tab opening to tab service and flow orchestration to workbenchFlowService. |
| `repository.loadTask(null/undefined)` during null-task Snapshot/enter-analysis guard | `sourceTaskId` is optional; null-task free play must not crash. |
| Effect writes source `Attempt.userLine`, freezes/submits attempts, updates Recall progress, clears checkpoint, or writes formal game tree | Enter/exit Analysis are read-only for source facts. |
| Effect branches by `origin.provider`, old `source/kind`, `openProblemTab`, `openGameTab`, `openSnapshotProblemTab` | v0.5 forbids restoring legacy source-specific main paths. |
| Analysis Return guesses target from UI label or current selected mode | It must restore only saved `AnalysisReturnTarget`. |
| Tests use callback-called-once as the main success signal | Weak fake-green risk. Callback mapping can only be auxiliary. |

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| WME-C01 | WIRING | MUST_AUTOMATE | Enter Analysis command reaches `workbenchFlowService.enterAnalysis`, transition guard passes, `ModeEnterEffect` is invoked through injected port, and workbench tab becomes Analysis. | Prevents Container-owned workspace decisions from remaining the real owner. | UI appears to switch but source state/effects drift. |
| WME-C02 | STATE | MUST_AUTOMATE | `analysisReturnTarget` captures source mode, recallSubstate, treePosition, and moveIndex when entering Analysis. | Required for Recall checkpoint and precise return. | Return loses checkpoint or board position. |
| WME-C03 | WIRING | MUST_AUTOMATE | Return from Analysis restores only the saved target and invokes `ModeExitEffect`; no target means reject and no effect. | Prevents label-based or mode-based guessing. | Wrong mode restore or unguarded exit. |
| WME-C04 | SIDE_EFFECT | MUST_AUTOMATE | Rejected enter/return/snapshot transitions do not call mode effects, snapshot service, repository, tab service, or Sabaki adapter. | Guards side-effect boundary. | Red tests can still create hidden tasks or mutate legacy state. |
| WME-C05 | SIDE_EFFECT | MUST_AUTOMATE | Snapshot from Analysis creates new task/tab and preserves source tab mode/substate. | Product-critical snapshot flow. | Snapshot pollutes current tab or reuses tab. |
| WME-C06 | SIDE_EFFECT | MUST_AUTOMATE | Snapshot from Play/Problem/Recall is not persisted directly; null-task/free-play path enters Analysis without `repository.loadTask(null/undefined)`. | Covers step2 audit and crash guard. | Null-task crash returns or direct Snapshot bypasses scratch. |
| WME-C07 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Mode effects are injected service ports/adapters; no UI component imports service/store/repository/Sabaki; no resolver effect calls. | Keeps v0.5 boundaries intact. | New hidden global or UI-store coupling. |
| WME-C08 | STATE | MUST_AUTOMATE | `workbenchStore` updates notify subscribers after enter/return and Container projection can re-read updated state. | Proves state return path starts. | Store changes occur but UI remains stale. |
| WME-C09 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | Real UI buttons/shortcuts show Analysis active, show Return/Snapshot actions, and then restore previous mode without board jump. | Human workflow confidence. | Automated service tests pass while visible workflow is broken. |
| WME-C10 | STATE | MUST_AUTOMATE | Problem/Recall/Analysis readonly boundary: enter/exit Analysis does not write source game tree, `Attempt.userLine`, frozen Attempt, Recall expected/current progress, or checkpoint facts. | Protects training facts. | Study edits corrupt source answer lines. |
| WME-C11 | UI_BEHAVIOR | DO_NOT_TEST | Exact button copy, CSS class, color, pixel layout. | Visual workflows own those checks. | Brittle tests block wiring changes. |
| WME-C12 | SIDE_EFFECT | DO_NOT_TEST | Exact timestamp/ID generation and exact log message wording. | Not business contract. | Flaky tests. |

### In-Scope Matrix Expansion

| 字段/事件 | Mode/State | 期望值/行为 | 测试 ID | 测试状态 | GAP/Deferred |
| --- | --- | --- | --- | --- | --- |
| `enterAnalysis` | play/problem with task | Save `AnalysisReturnTarget`, enter `mode='analysis'`, invoke ModeEnterEffect, no attempt/game-tree mutation. | WME-T01 | RED | Effect port absent; moveIndex capture not guaranteed. |
| `enterAnalysis` | recall with active session | Preserve `recallSubstate`, treePosition, moveIndex, enter Analysis, invoke ModeEnterEffect. | WME-T01 | RED | Effect port absent; current legacy allowance without session must be retired when recall sessions hydrate. |
| `enterAnalysis` | null-task/free-play for Snapshot guard | Enter Analysis scratch/current without `repository.loadTask(null/undefined)` and without snapshot persistence. | WME-T06 | RED | Step2 audit marks Container null-task guard RED. |
| `returnFromAnalysis` | analysis with target | Restore target mode/substate/treePosition/moveIndex; clear `previousMode` and return target; invoke ModeExitEffect. | WME-T03 | RED | Effect port absent; moveIndex restoration not locked. |
| `returnFromAnalysis` | analysis without target | Throw/reject; no store change; no ModeExitEffect. | WME-T04 | GREEN | Current service rejects no-target; tests must extend to no effect after port exists. |
| `snapshotFromCurrentContext` | analysis | Capture scratch/current, create task and child tab, current tab remains Analysis. | WME-T07 | GREEN | Current flow covers analysis-only/current-tab preservation; future taskImportService alignment can be separate. |
| `snapshotFromCurrentContext` | play/problem/recall | Reject direct persistence; no snapshotService/repository/tabService calls. | WME-T08 | GREEN | Existing tests cover rejection; add no-call assertions with typed spies. |
| `Analysis edit workspace` | analysis entry | Effect initializes or points to scratch/current; later edit bar writes only scratch. | WME-T09 | RED | Container currently owns workspace setup. |
| `Problem readonly` | problem -> analysis -> return | Attempt remains unsubmitted/unfrozen and `Attempt.userLine` unchanged. | WME-T10 | RED | Needs focused no-mutation coverage. |
| `Recall readonly` | recall/checkpoint -> analysis -> return | Recall progress/expectedMoves and active checkpoint/correction facts unchanged. | WME-T10 | RED | Needs focused no-mutation coverage. |
| `Projection return` | after enter/return | Projection maps store state to active mode/actions. | WME-T11 | DEFERRED | Step4/step8 projection work; approved reason: step3.2 test scope is flow service. Exit when Container integration runs. |
| `Rendered UI return` | real Shell/Panel | Mode chip, panels, bottom bar, Snapshot/Return actions update. | WME-T12 | DEFERRED | Step4/step9 visual/Playwright acceptance. Exit with real browser/E2E evidence. |

## 10. 必须自动化的测试

Detailed test contract rows:

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WME-T01 | SERVICE_REPOSITORY_TRANSITION | `createWorkbenchFlowService().enterAnalysis` | real `workbenchFlowService`, real `workbenchStore`, real transition resolver | `ModeEnterEffect` typed spy, minimal logger | `real production interface/type` for ModeEffect; logger can be `local tiny stub` | mock `workbenchFlowService`; fake store implementation; UI component mocks | Enter from play/problem/recall saves `analysisReturnTarget` including mode/substate/treePosition/moveIndex when known, updates tab to Analysis, and calls ModeEnterEffect with before/after tab once after guard. | WME-T08, WME-T11 |
| WME-T02 | SIDE_EFFECT_BOUNDARY | `enterAnalysis` rejection paths | real `workbenchFlowService`, real `workbenchStore`, real resolver | ModeEnterEffect typed spy, logger | `real production interface/type`; logger `local tiny stub` | mock resolver to allow illegal transition; per-file hand spy for flow service | Illegal enterAnalysis does not update tab and does not call ModeEnterEffect. | not-covered: rendered rejection UI deferred to step4/9. |
| WME-T03 | SERVICE_REPOSITORY_TRANSITION | `createWorkbenchFlowService().returnFromAnalysis` | real `workbenchFlowService`, real `workbenchStore`, real resolver | `ModeExitEffect` typed spy, logger | `real production interface/type`; logger `local tiny stub` | mock service/store; test calling handler with made-up toMode payload | Return restores saved mode/substate/treePosition/moveIndex, clears `previousMode`/`analysisReturnTarget`, and calls ModeExitEffect with saved target. | WME-T08, WME-T11 |
| WME-T04 | SIDE_EFFECT_BOUNDARY | `returnFromAnalysis` no-target path | real `workbenchFlowService`, real `workbenchStore` | ModeExitEffect typed spy, logger | `real production interface/type`; logger `local tiny stub` | mock `InvalidModeTransitionError`; manually mutate post-state | No target throws/rejects, tab remains Analysis, ModeExitEffect not called. | not-covered: disabled Return UI deferred to step4/9. |
| WME-T05 | CONTAINER_DELEGATION | `TrainingWorkbenchContainer` Snapshot handler from non-analysis | real Container source or mounted Container, real upstream callback signature | flowService typed spy only | `shared typed spy factory` or `real production interface/type` for flowService; no per-file full fake | mock workbenchStore state transitions and claim state-forward; calling handler with tabId argument | Non-analysis `onSnapshot()` calls `enterAnalysis(activeTab.id, reason:'snapshot')` or equivalent first and does not call `snapshotFromCurrentContext`. This proves delegation only, not persistence. | WME-T06, WME-T11 |
| WME-T06 | SIDE_EFFECT_BOUNDARY | Flow service null-task enter-analysis guard | real `workbenchFlowService`, real `workbenchStore` | ModeEnterEffect typed spy; repository/snapshot/tab service spies that throw if called | repository fake must be `shared typed spy factory` or `in-memory repository fake`; SnapshotService via production type | per-file hand spy for repository ports; snapshotService fake without type; mock service | For active tab with `taskId:null/undefined`, enterAnalysis for snapshot reason succeeds when visible position is capturable, calls ModeEnterEffect, and does not call repository load, snapshot capture, createTask, or openTask. | WME-T11 |
| WME-T07 | SERVICE_REPOSITORY_TRANSITION | `snapshotFromCurrentContext` from Analysis | real `workbenchFlowService`, real `workbenchStore`, in-memory repository fake | SnapshotService typed fake, tabService typed fake, logger | `in-memory repository fake`; SnapshotService/TabService by `real production interface/type` or shared factory | mock `snapshotFromCurrentContext`; `snapshotService` opening tab | From Analysis, captures scratch/current, creates one task/new tab, sets child parentTabId, and source tab remains Analysis. | WME-T12 |
| WME-T08 | SIDE_EFFECT_BOUNDARY | `snapshotFromCurrentContext` from Play/Problem/Recall | real `workbenchFlowService`, real `workbenchStore`, real resolver | SnapshotService/repository/tabService spies that throw if called | `shared typed spy factory` or in-memory fake constrained by production types | mock resolver; callback-only UI test | Rejects direct Snapshot outside Analysis and no persistence/open-tab side effects occur. | WME-T05 for UI delegation |
| WME-T09 | ARCHITECTURE_BOUNDARY | Mode effect port/module imports | source scan or dependency graph over production files | none, except local tiny path scanner helper | scanner helper can be `local tiny stub` | mocking file text instead of scanning actual files | `ModeEnterEffect`/`ModeExitEffect` live behind injected service/adapter boundary; presentational components do not import training services/stores/repositories/Sabaki; resolver does not import effects. | architecture review step |
| WME-T10 | SERVICE_REPOSITORY_TRANSITION | enter/return readonly source facts | real `workbenchFlowService`, real `workbenchStore`, in-memory repository/attempt/recall fakes | Mode effects typed spies | `in-memory repository fake` for attempts/sessions; ModeEffect by production interface | local per-file full production service fake; mocked store | Problem and Recall enter/return do not change `Attempt.userLine`, frozen status, recall progress/expectedMoves, checkpoint status, or source game-tree/document write port. | WME-T12 |
| WME-T11 | STORE_SUBSCRIPTION | `workbenchStore.subscribe` during enter/return | real store, real flow service | typed no-op mode effects | `real production interface/type` | fake store with manual subscriber call | Store subscriber fires after enter and return updates, allowing Container projection to re-read updated tab. | WME-T12 |
| WME-T12 | RENDERED_UI_RETURN | Real WorkbenchShell/Panel after store transition | real Shell/Panel/Container integration | service spies only if test is explicitly Container delegation; otherwise real flow service | shared typed spy factory for service only in delegation tests | asserting `container.render().props` while claiming rendered UI; callback-called-only main assertion | Deferred to step4/9: rendered mode/actions/bottom bar update after actual store/effect transitions. | DEFERRED: approved because step3.2 writes flow-service tests only; exit when Container integration lands. |

Mock helper requirement:

- If a test needs to fake `WorkbenchFlowService`, `SnapshotService`, `documentStore.playMove` port, `RecallService`, `AttemptService`, repository ports, or the new ModeEffect adapter, the fake must be constrained by a production TypeScript interface/type or a shared typed spy factory.
- If no shared typed helper exists for a dependency, test-writer must first add a helper in `test/**/shared/*SpyFactories.ts` or a same-scope typed helper, instead of hand-writing a drifting per-file full service mock.
- Local tiny stubs are allowed only for a single callback, logger writer, or no-state function.

## 11. 仅手动验收

| ID | 验收项 | 步骤 | 通过标准 |
| --- | --- | --- | --- |
| WME-M01 | Problem enters and returns Analysis | Open a problem task, click `进入复盘`, then `返回上一个模式`. | Analysis becomes active without submitting/freezing; Return restores Problem view and current answer line. |
| WME-M02 | Recall checkpoint enters and returns Analysis | Open Recall checkpoint, click `进入 Analysis`, then Return. | Return restores Recall checkpoint substate, correction draft context, and board position. |
| WME-M03 | Null-task Snapshot guard | In free-play/null-task tab, click Snapshot outside Analysis. | No crash; no task immediately created; UI enters Analysis scratch/current for confirmation. |
| WME-M04 | Analysis Snapshot | In Analysis, click top or bottom Snapshot. | A child task/tab opens; source tab remains Analysis; source Attempt/game tree unchanged. |
| WME-M05 | Visual continuity | Use mode segmented control and top actions to enter/return. | Board does not jump or resize; top actions and bottom toolbar change to the active mode. |

## 12. 不测试

| 项 | 理由 |
| --- | --- |
| Exact CSS classes, colors, pixel dimensions, icon glyphs, or copy variants | Visual contract/test workflow owns visual fidelity. |
| Exact order of `workbenchStore.updateTab` vs ModeEffect invocation | Unless implementation makes rollback/order a product guarantee, tests should assert guard-before-effect and final state/effects, not incidental call order. |
| Exact generated task IDs, timestamps, or random suffixes | Not business behavior. |
| Exact logger message strings | Assert structured rejection metadata only if needed. |
| Presentational callback invocation count as primary proof | Callback mapping is auxiliary and cannot prove state-forward/state-return. |
| Current Container `ensureAnalysisWorkspace` implementation details | It is a migration seam to remove, not a stable contract. |

## 13. 脆弱测试警告

- Do not test `onSnapshot` by calling a Container handler with `(tabId, event)` or `(mode, event)`. Upstream callbacks provide no such payload.
- A test that only asserts `flowService.enterAnalysis` was called is `CONTAINER_DELEGATION`; it does not prove ModeEnterEffect, workbenchStore state, Sabaki state, or rendered UI.
- A test that mocks `workbenchFlowService` cannot claim `SERVICE_REPOSITORY_TRANSITION`.
- A test that mocks `workbenchStore.updateTab` cannot claim store state changed or subscribers fired.
- Do not assert current legacy `sabaki.setMode('analysis')` in Container as the desired final path. The contract owner is the injected effect adapter behind flow service.
- Do not lock a branch on `origin.provider='snapshot'` or legacy `source_kind`; origin is trace metadata only.
- Avoid testing exact call order among repository/snapshot/tab services unless the order is the business contract being protected. For this step, the hard order is: guard before side effect; no snapshot persistence before Analysis; no effect on rejection.

## 14. 超出范围

- Writing or modifying production code.
- Writing or modifying test code.
- Implementing `modeStateResolver.ts` or reviewing the parallel step3.1 code.
- Full Analysis edit-bar scratch executor behavior beyond requiring scratch/current entry.
- Full six-screen visual/layout fidelity.
- Library/Fox/101 import wiring.
- Replacing all legacy Sabaki analysis internals. This contract allows a temporary adapter seam with an explicit exit condition.

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 禁止 | Architecture lines 23-25, 108-109, 2169-2195 | Flow branch by WorkbenchMode, transition event, and saved tab/runtime state only. Origin remains trace metadata. |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 禁止 | Architecture lines 23-25, 33, 711-718, 2187-2195 | Use `workbenchTabService.openTask` for new task tabs. |
| 是否让 `snapshotService` 承担 tab opening / flow orchestration | 禁止 | Architecture lines 100-108, 1110-1159 | `snapshotService` captures input only; flow service orchestrates; tab service opens. |
| 是否让 Container 直接写 store，而不是通过 v0.5 指定 service | 禁止 | Architecture lines 91-95, 180-198, 201-207 | Container reads stores and delegates commands. Current analysis workspace writes are temporary seam to move in step4. |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 禁止 | Architecture lines 89-98; UI plan lines 8-15 | WorkbenchShell/panels emit callbacks only. Static scan required. |
| 是否把 `problem` 当成棋盘 mode 或把 Play/Recall/Analysis 降级成 board modes | 禁止 | PRD lines 237-253; Architecture lines 78-79 | They are Workbench runtime modes/phases. Board clicks still go resolver/executor. |
| 是否让 ModeState resolver or modeTransitions produce effects | 禁止 | Architecture lines 112-116 plus resolver purity rule | Resolver returns data/decision only. Service invokes injected effects. |
| 是否从 Play / Problem / Recall direct Snapshot 创建 task | 禁止 | PRD lines 255-269, 560-574 | Non-analysis Snapshot first calls enterAnalysis and creates scratch/current projection. |
| 是否在 null-task path 调用 `repository.loadTask(null/undefined)` | 禁止 | Architecture lines 1148-1151 | Null task is allowed as free-play source; no source task load. |
| 是否让 Analysis enter/exit 写 Attempt/game-tree/Recall facts | 禁止 | PRD lines 610-614, 1460-1465; Architecture lines 150-158, 2169-2178 | Enter/return effects write UI/workspace only; source facts stay read-only. |

## 16. Workbench 接线清单（如适用）

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mode segmented `复盘模式` | enter Analysis or return via policy | Presentational: `ModeBar`; temporary command owner: `TrainingWorkbenchContainer`; target owner: flow service/controller | UI spec lines 143-172; Architecture lines 137-142 | active tab `mode` changes to Analysis or restores saved target; effect updates Sabaki workspace | workbenchStore subscription -> projection -> ModeBar active state/actions | WME-T01/T03, WME-T11; rendered deferred | container/projection, controller |
| Problem top `进入复盘` | `enterAnalysis(tabId)` | `ModeBar` emits `onAnalysis`; Container delegates; flow service owns | UI spec lines 156-172; Architecture lines 140-142 | Problem Attempt remains mutable/unsubmitted; Analysis return target saved | Analysis panels/actions visible; Return restores Problem | WME-T01, WME-T10, manual WME-M01 | tests by mode, container/projection |
| Recall top `进入复盘` | `enterAnalysis(tabId)` | Same as above | PRD lines 1511-1515; Architecture lines 140, 153-154 | Recall substate/session preserved; target saved | Analysis visible; Return restores Recall/substate | WME-T01, WME-T10, manual WME-M02 | tests by mode |
| Recall checkpoint `进入 Analysis` | `enterAnalysis(tabId, checkpoint context)` | Recall panel/ModeBar emits; flow service owns | UI spec lines 876-883 | checkpoint remains substate; correction draft not cleared | Return restores checkpoint surface | WME-T01/T10, manual WME-M02 | tests by mode |
| Non-analysis `Snapshot` | `enterAnalysis(tabId,{reason:'snapshot'})` first | UI callback -> Container guard -> flow service | PRD lines 255-269, 560-574; UI plan lines 55-56 | No task created; tab enters Analysis scratch/current; no `loadTask(null)` | UI shows Analysis confirmation/scratch | WME-T05/T06, manual WME-M03 | container/projection, panel callback plumbing |
| Analysis top/left/bottom `Snapshot` | `snapshotFromCurrentContext(tabId)` | UI emits `onSnapshot`; flow service orchestrates snapshot/task/tab | Architecture lines 1110-1159, 1883-1891; UI spec lines 734-742, 946-953 | new task + child tab; current tab unchanged | new tab visible; source Analysis still available | WME-T07/T08, manual WME-M04 | tests by mode, panel callback plumbing |
| Analysis `返回上一个模式` | `returnFromAnalysis({tabId})` | UI emits `onReturn`; flow service owns target restore | Architecture lines 142, 153-155; UI spec lines 876-884 | restores target mode/substate/treePosition/moveIndex; clears target | previous mode panels/actions visible | WME-T03/T04/T11, manual WME-M01/M02 | tests by mode, container/projection |
| Bottom `Edit position` outside Analysis | `enterAnalysis(tabId,{reason:'edit-position', selectedTool:'stone_1'})` | BottomActionBar emits; Container temporary delegate; flow service/effect owns selected tool | PRD lines 591-614; UI spec lines 803-819 | enters Analysis scratch/current; selected edit tool active; source unchanged | Analysis edit bar active | WME-T01/T09/T10 | controller, panel callback plumbing |
| Keyboard `A` | enter/return Analysis | Keyboard command map, same owner as buttons | UI spec lines 888-903 | Same as button path | Same as button path | DEFERRED to command-map/E2E | panel callback plumbing, visual acceptance |
| Keyboard `S` | Snapshot | Keyboard command map, same owner as Snapshot buttons | UI spec lines 888-903 | Non-analysis first enters Analysis; Analysis creates task | Same as button path | DEFERRED to command-map/E2E | panel callback plumbing, visual acceptance |

Command owner summary:

| Semantic command | Presentational component | `TrainingWorkbenchContainer` | Controller | Service | Adapter/Repository/Sabaki |
| --- | --- | --- | --- | --- | --- |
| `enterAnalysis` | emit callback only | temporary delegate; no store writes | deferred semantic command boundary | `workbenchFlowService.enterAnalysis` owns guard/store/effect | ModeEnterEffect adapter may touch Sabaki workspace; optional attemptService mark |
| `returnFromAnalysis` | emit callback only | temporary delegate; no target guessing | deferred semantic command boundary | `workbenchFlowService.returnFromAnalysis` owns target restore | ModeExitEffect adapter may hide/restore legacy analysis workspace |
| `snapshotFromCurrentContext` | emit callback only | route non-analysis to enterAnalysis guard, route analysis to service | deferred semantic command boundary | `workbenchFlowService.snapshotFromCurrentContext` owns orchestration | `snapshotService` captures; task import/repository creates; tab service opens |

State forward contract:

- Enter Analysis changes workbench tab mode/return target and Sabaki analysis workspace only.
- Exit Analysis restores workbench tab state from saved target and updates Sabaki analysis workspace only.
- Snapshot from Analysis creates task/tab and preserves source tab.
- Runtime store fields are read/preserved unless a separate explicit service command owns them.

State return contract:

- `workbenchStore.subscribe` must notify Container after tab patch.
- `runtimeStore.subscribe` must continue to notify projection for active attempt/recall/checkpoint overlays; ModeEnter/Exit must not manually fake those projections.
- Sabaki/goban adapter subscriptions must refresh board props when legacy analysis workspace changes.
- Projection returns active mode, mode policy, Analysis/Problem/Recall panel props, bottom toolbar status, and board props from stores/adapters.

Weak test ban:

- Do not accept "callback called once" as main success for WME-C01 through WME-C10.
- A callback-only assertion may only be a `UI_COMMAND_MAPPING` or `CONTAINER_DELEGATION` auxiliary row with downstream state/effect tests named.

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| contracts/docs | `docs/archive/daily-design/2026-05-26/workbench-mode-effects/test-contract-v0.1.md` | Source truth docs | Read-only to production and tests | Low; commit only contract file. |
| tests by mode | `test/training/workbenchFlowService.test.js` plus shared typed helper if needed | This contract | Flow service tests can be written before implementation | Medium; must avoid per-file drifting mocks. |
| controller | future workbench mode command boundary if introduced | Flow service effect interface | Can proceed independently after effect API is known | Medium; do not duplicate flow guard. |
| container/projection | `src/components/TrainingWorkbenchContainer.js` and projection tests | step3.2.impl | Removes Container-owned workspace seam after service effect exists | High; shared lock on Container. |
| panel callback plumbing | WorkbenchShell/ModeBar/BottomActionBar/Analysis panel callbacks | Contract and container integration | Presentational callback names can be aligned without touching service internals | Medium; must preserve real callback signatures. |
| architecture review | source scans and event trace | implementation commits | Read-only review after integration | Low; may block if UI imports or hidden globals appear. |
