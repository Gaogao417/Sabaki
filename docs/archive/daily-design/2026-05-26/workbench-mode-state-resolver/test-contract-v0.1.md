Date: 2026-05-26
Status: pending-confirmation

# 契约草案

Scope: checklist `step1.2.contract` for a read-only `ModeState` / companion state resolver. This contract is a derived test scope only. If it conflicts with `docs/product/`, `docs/architecture/`, or `docs/ui_ux/`, the active source truth wins.

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | lines 8-25 | Current PRD is the product authority; architecture v0.5, mode orchestration, position-source mutation, UI/UX, and implementation plan are active references. Product wins over UI/UX when scope differs. |
| `docs/product/sabaki-training-prd.md` | lines 41-54 | Resolver must preserve the product loop: Play -> Submit/freeze Attempt -> Recall -> RecallCheckpoint -> Analysis -> Snapshot -> Problem -> Bad Move -> Review. It must not invent a fifth workbench mode. |
| `docs/product/sabaki-training-prd.md` | lines 235-269 | Runtime workbench modes are exactly `play`, `problem`, `recall`, `analysis`. `Problem` entity, `RecallCheckpoint`, `Review`, and `Punishment Problem` are not new modes. Snapshot can be visible globally, but persistence must first project to Analysis scratch/current. |
| `docs/product/sabaki-training-prd.md` | lines 321-330 | Play completion freezes the `TrainingAttempt`, creates default `RecallSession`, then enters Recall. The resolver may report this expected companion shape but must not perform the transition. |
| `docs/product/sabaki-training-prd.md` | lines 351-357 | Recall reads frozen `TrainingAttempt.userLine` and must not modify the frozen Attempt. |
| `docs/product/sabaki-training-prd.md` | lines 411-427 | RecallCheckpoint is a Recall sub-flow: original bad move -> correction line -> reveal AI candidates -> comment -> resume Recall or enter Analysis. It must resolve as `mode:'recall'`, not `mode:'checkpoint'`. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 450-471 | MVP state stores are only `workbenchStore`, `trainingRuntimeStore`, and optional `reviewQueueStore`; entity facts remain repository/service owned. Resolver must not introduce entity stores. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 473-523, 549-562 | `workbenchStore` owns tabs and active tab. Writers are `workbenchTabService` and `workbenchFlowService`; readers include `TrainingWorkbenchContainer` and view-models. Resolver reads a tab snapshot only. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 564-628 | `trainingRuntimeStore` owns runtime/cache fields such as active attempt/session/checkpoint, AI pending, pending evaluations, correction draft, exploration branches, and visible bad move ids. Resolver reads these as companion input only. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 388-410 | `analysisService` owns analysis result cache/events and is read through `analysisResultAdapter`. Resolver may consume an already-normalized engine/analysis projection; it must not call analysis services. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 412-430 | `overlayStore` is display state and does not carry training business. Resolver may classify overlay region ownership; overlay must not drive RecallCheckpoint or BadMove business logic. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 682-725 | Workbench tab opening uses `workbenchTabService.openTask({taskId, mode?, parentTabId?})`. New source-specific APIs such as `openProblemTab` or `openSnapshotProblemTab` are forbidden as main paths. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 727-802 | `workbenchFlowService` owns mode transitions; illegal transitions must reject. Resolver only describes current state and invalid companion combinations; it cannot perform flow orchestration. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 1755-1809 | Open-task and user-move flows show service/store write boundaries. Resolver must not use task origin/provider/source_kind to infer mode; mode comes from active `WorkbenchTab.mode`. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 1811-1826, 1831-1869, 1871-1881 | Submit, RecallCheckpoint, and Enter Analysis flows write through flow/recall services and stores. Resolver sits after those writes as a projection input. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 1928-1955 | Render path is `workbenchStore.activeTab + trainingRuntimeStore -> TrainingWorkbenchContainer -> panel by tab.mode`. Resolver output must be suitable for that projection path. |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 19-47 | ModeState is the upper-level state machine. It derives position source and mutation contract, then board resolver/executor handles writes. `workbenchFlowService` is the mode transition owner. |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 56-71 | Owners: `workbenchStore`, `trainingRuntimeStore`, repository/services, document store, scratch workspace, overlay, engine, and UI projection are separate. Resolver cannot collapse them into one mutable owner. |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 73-147 | Companion state tables define legal state per mode and legal action categories. Resolver must expose these as read-only validity/projection data. |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 225-239, 241-310 | Illegal transitions and high-risk pollution points are contract gaps; tests must reject false green assertions of current legacy behavior. |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 312-426 | Target TypeScript shape defines `ModeState`, companion variants, overlay region, and engine region. Tests should lock this discriminated-union behavior. |
| `docs/architecture/position-source-mutation-contract.md` | lines 27-90 | Position sources are `game-tree` or `scratch` with roles `current`, `reference`, `problem-attempt`. Mutation contracts are `playMove`, `problemAttemptMove`, `recallAnswer`, `scratchEdit`, `variationMove`. |
| `docs/architecture/position-source-mutation-contract.md` | lines 187-252 | Board events still route through resolver -> intent + position source + mutation contract -> focused executor. This ModeState resolver is read-only and must not become the central executor. |
| `docs/architecture/position-source-mutation-contract.md` | lines 254-263 | Workspace defaults: Play uses `game-tree/playMove`; Problem uses `game-tree` or `scratch/problem-attempt` with `problemAttemptMove`; Recall uses `game-tree` or `scratch/problem-attempt` with `recallAnswer`; Edit Analysis uses `scratch/current/scratchEdit`; variation uses `game-tree/variationMove`. |
| `docs/architecture/position-source-mutation-contract.md` | lines 264-287 | Overlays consume position sources and never mutate positions. Resolver may derive overlay region but must not mutate board state. |
| `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md` | lines 8-15 | Components render from projected view models, cannot mutate core store directly, board clicks still go through resolver/executor, and every visible action needs command owner/disabled reason. |
| `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md` | lines 19-26 | UI/UX only supplies screen placement and runtime data expectations for Problem, Recall, Play+Library, Analysis+Library, Analysis, and Recall checkpoint. It does not override product/architecture state ownership. |
| `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md` | lines 44-63 | Command matrix confirms service owners for submit, recall complete, snapshot, library opens, and edit-bar scratch commands. Resolver does not own these commands. |
| `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md` | lines 64-79 | Non-goals and acceptance reinforce no fifth mode, no direct `window.sabaki`, no direct Problem creation from live non-analysis contexts, and no checkpoint overwrite of frozen Attempt. |
| `docs/architecture/gabaki-sabaki-training-implementation-plan.md` | lines 23-35 | Current execution authority forbids extending `workbenchPhaseService`, `openProblemTab`, `source_kind`, and `problemView + sabaki.state.mode='play'` as new main paths. |
| `docs/architecture/gabaki-sabaki-training-implementation-plan.md` | lines 71-108 | Remaining gaps include mode effects, snapshot source restriction, problem attempt executor, recall/checkpoint projection, six-screen projection, external data, edit bar, and legacy cleanup. Resolver tests should expose these gaps without implementing them. |
| `docs/architecture/gabaki-sabaki-training-implementation-plan.md` | lines 113-120 | Out of scope: no fifth mode, no direct component store writes, no resolver side effects, no expansion of deprecated phase service. |
| `docs/architecture/gabaki-sabaki-training-implementation-plan.md` | lines 128-135 | `step1.2` specifically requires ModeState / companion read-only resolver tests from tab/runtime/overlay/engine, including illegal companion state; implementation later writes `src/modules/training/workbench/modeStateResolver.ts`. |

## 1. 用户故事

作为 Workbench 用户，当我打开 Play、Problem、Recall、Analysis 或在这些状态中触发训练流程后，界面应从真实 tab/runtime/overlay/engine/Sabaki 状态派生当前 workbench 状态，而不是从静态文案、旧 `sabaki.state.mode`、task origin/provider 或组件本地状态猜测。

作为实现者，我需要一个纯 `ModeState` / companion resolver，它把已订阅的状态快照转换成四个 mode 的 read-only projection、position source、mutation contract hints、overlay/engine region 和 illegal companion diagnostics，供 Container projection、controller guard 和后续测试使用。

## 2. 用户动作

本 step 没有新的用户按钮或命令。它触摸的是状态回流环：

- 打开/切换 task tab 后，`workbenchStore.activeTab` 变化。
- Play/Problem submit 后，service 写入 Attempt/RecallSession 并把 tab/runtime 切到 Recall。
- Recall answer/checkpoint/correction/comment 后，recall services 写 runtime/checkpoint projection。
- Enter Analysis / return / snapshot command 的 service 写 tab、scratch/analysis context 或 child tab。
- Overlay/engine/Sabaki edit workspace 更新后，Container 重新投影 UI 状态。

## 3. 当前阶段

- 当前 checklist step: `step1.2.contract`。
- 本契约只定义测试和验收范围，不写生产代码、不写测试代码。
- 目标生产 subject: future `src/modules/training/workbench/modeStateResolver.ts` from implementation-plan step3.1.
- 当前阶段的 tests 应按目标行为写 RED tests；不得为了当前 legacy fallback 写 GREEN assertion。

## 4. 位置源

| Mode | 合法位置源 | 派生 MutationContract | Resolver 输出要求 | 非法组合 |
| --- | --- | --- | --- | --- |
| `play` | `game-tree` from current document/tree position | `playMove` | `positionSource.kind='game-tree'`; no scratch primary source; overlay/territory off; companion may include mutable playing attempt and pending evaluation cache. | `problemView`/`recallView`/checkpoint/correctionDraft active; territory/compare active; scratch primary engine target; frozen attempt exposed as mutable. |
| `problem` | `game-tree` or `scratch` with role `problem-attempt` | `problemAttemptMove` | Must require `tab.mode='problem'`, active attempt, and `problemView`; may report pending evaluation / visible bad moves for this attempt. | `playMove` as sole write hint; missing `problemView`; active recall session/view/checkpoint; analysis scratch role `current/reference` as problem attempt; frozen attempt exposed mutable. |
| `recall` | `game-tree` or `scratch` with role `problem-attempt` as answer surface | `recallAnswer` | Must require active recall session and `recallView`; checkpoint remains `recallSubstate` / companion, not mode. Source attempt is frozen/read-only. | `mode='checkpoint'`; mutable source Attempt; `problemView` active; territory/compare/analysis overlay visible; correctionDraft without active checkpoint. |
| `analysis` | `scratch/current` primary; optional `scratch/reference`; explicit `game-tree` only for variation analysis | `scratchEdit` or `variationMove` depending active tool/context | Must require `tab.mode='analysis'`, analysis context/return target, and current working position for snapshot persistence. Overlay may be off, territory, or compare, but only under analysis ownership. | Source Attempt mutable; scratch edits writing game tree; snapshot persistence allowed without scratch/current; return target arbitrary instead of saved analysis return target. |

## 5. 变更契约

The resolver itself has **no change contract**:

- It does not run `playMove`, `problemAttemptMove`, `recallAnswer`, `scratchEdit`, or `variationMove`.
- It returns which mutation contract a downstream board/controller path may use.
- It returns illegal companion states instead of repairing them.
- It returns snapshot capability as read-only projection:
  - `snapshotVisible` may be true globally.
  - `snapshotPersistAllowed` is true only for `mode:'analysis'` with `scratch/current`.
  - non-analysis modes may expose `snapshotNextStep='enter-analysis'`, never direct persistence.

## 6. 预期状态流

### 6.1 UI/state loop touched

```text
UI control event
  -> WorkbenchShell / panel callback prop
  -> TrainingWorkbenchContainer handler
  -> controller command
  -> service / adapter / repository
  -> runtimeStore / workbenchStore / Sabaki state
  -> container subscription
  -> read-only ModeState resolver
  -> projection into props
  -> UI state update
```

For this read-only resolver step, the first five segments are usually upstream events from existing command paths. The resolver participates only after state has changed:

```text
workbenchStore / trainingRuntimeStore / overlay projection / engine projection / Sabaki adapter snapshot
  -> TrainingWorkbenchContainer subscription/re-render
  -> resolveModeState(input)
  -> mode-specific projection + illegal companion diagnostics
  -> Shell / panel / board props
```

If a segment is temporarily no-op, mark it as migration seam:

- `controller command -> service` is no-op for pure state read.
- `service / adapter / repository` is no-op for pure state read.
- Exit condition: step3.1 implements resolver; step4 integrates it into Container projection without adding writes to the resolver.

### 6.2 Proposed resolver input signature

Tests must call the same single-object signature that production uses:

```ts
resolveModeState({
  tab,
  runtime,
  overlay,
  engine,
  sabaki
})
```

Calling a future handler with positional arguments when production uses one object, or vice versa, is a false-green risk. This is not a React callback passed from a child component; therefore there is no external component callback signature to cite for this contract.

### 6.3 Input contract

| Input region | Required source | Fields / projection consumed | Resolver boundary |
| --- | --- | --- | --- |
| Tab | `workbenchStore.activeTab` snapshot | `id`, `mode`, `activeAttemptId`, `activeRecallSessionId`, `recallSubstate`, `analysisContext`, `analysisReturnTarget`, `currentTreePosition`, `parentTabId`, `childTabIds` | Mode truth comes from `tab.mode`; resolver must not infer mode from task origin/provider/source_kind. |
| Runtime | `trainingRuntimeStore.getState()` snapshot plus current runtime view projection | `activeAttemptId`, `activeRecallSessionId`, `activeCheckpointId`, `correctionDraft`, `aiMovePending`, `pendingMoveEvaluations`, `visibleBadMoveIds`, `problemView`, `recallView`, active exploration branch when present | Runtime is companion/cache, not business truth. Missing/mismatched companion returns diagnostics, not store writes. |
| Overlay | resolved overlay projection or overlay store snapshot passed by caller | `territoryEnabled`, `territoryCompareEnabled`, ownership source, generation/pending/unavailable reason, display maps | Overlay is display-only; non-analysis territory/compare is illegal projection. |
| Engine / analysis | normalized engine/analysis projection from adapter | target kind (`none`, `game-tree-live`, `scratch`), pending status, candidate/ownership availability, workspace id | Resolver classifies target and allowed write region; it must not start/stop engines or read engine services. |
| Sabaki/document adapter | caller-provided snapshot of document and edit workspace | game-tree position, board size/current player if needed, `editWorkspace.currentSnapshot`, `editWorkspace.referenceSnapshot`, scratch ownership/currentAnalysis, legacy `sabaki.state.mode` for mismatch diagnostics only | `sabaki.state.mode` is adapter projection only. It cannot override `WorkbenchTab.mode`; no hidden `window.sabaki` lookup. |

### 6.4 Output contract

| Mode | Required output |
| --- | --- |
| `play` | `{mode:'play', tab, companion:{kind:'play', attempt?: MutableAttemptProjection, pendingMoveEvaluations, visibleBadMoveIds}, positionSource:{kind:'game-tree'}, allowedMutationContracts:['playMove'], overlay:{kind:'off'} or info-only, engine:{kind:'game-tree-live'|'none'}, illegal:[]}` |
| `problem` | `{mode:'problem', tab, companion:{kind:'problem', attempt: MutableAttemptProjection, problemView, pendingMoveEvaluations, visibleBadMoveIds}, positionSource:{kind:'game-tree'|'scratch', role?:'problem-attempt'}, allowedMutationContracts:['problemAttemptMove'], overlay:{kind:'off'} or info-only, engine:{kind:'game-tree-live'|'none'}, illegal:[]}` |
| `recall` | `{mode:'recall', tab, companion:{kind:'recall', sourceAttempt: FrozenAttemptProjection, recallView, activeCheckpoint?, correctionDraft?}, positionSource:{kind:'game-tree'|'scratch', role?:'problem-attempt'}, allowedMutationContracts:['recallAnswer'], overlay:{kind:'off'} or info-only, engine:{kind:'none'|'game-tree-live-readonly'}, illegal:[]}` |
| `analysis` | `{mode:'analysis', tab, companion:{kind:'analysis', previousMode/returnTarget, sourceAttempt?: FrozenAttemptProjection, sourceRecallSessionId?, scratch:{workspaceId,currentSnapshotId,referenceSnapshotId?}}, positionSource:{kind:'scratch', role:'current'} or explicit variation source, allowedMutationContracts:['scratchEdit'] or ['variationMove'], overlay:{kind:'off'|'territory'|'compare', owner:'analysis'}, engine:{kind:'scratch', mayWrite:'edit-workspace-only'} or legal readonly game-tree target, illegal:[]}` |

If required companion data is absent or contradictory, output must be an invalid result with stable diagnostics rather than silently coercing:

```ts
{ok:false, mode: tab?.mode ?? null, illegal: IllegalCompanionState[]}
```

## 7. 允许的副作用

None inside the resolver.

Allowed upstream/downstream side effects remain owned elsewhere:

- `workbenchFlowService` may write mode transition state.
- `problemFlowService`, `recallService`, `recallCheckpointService`, and repository services may write their owned facts.
- `overlayStore`, engine services, document store, and scratch workspace may write only through their existing owner boundaries.
- `TrainingWorkbenchContainer` may subscribe and project, but must not let the resolver write stores.

## 8. 禁止的副作用

- No `workbenchStore.addTab/updateTab/setActiveTab/removeTab`.
- No `trainingRuntimeStore` setters.
- No `overlayStore` setters or overlay generation bumps.
- No `sabaki.setMode`, `documentStore.playMove`, `editWorkspace` mutation, `window.sabaki` lookup, or IPC.
- No service/repository/DB calls, including `WorkbenchFlowService`, `WorkbenchTabService`, `SnapshotService`, `RecallService`, `AttemptService`, `ReviewService`, repository ports, `analysisService`, engine service, or adapters that trigger work.
- No timers, subscriptions, async engine requests, logging side effects, or hidden global caches.
- No mutation of input objects, arrays, maps, snapshots, or nested runtime/overlay/engine projections.
- No branch that treats `origin.provider`, old `source/kind`, or `sabaki.state.mode + problemView` as primary mode truth.

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| WMSR-T01 | STATE | MUST_AUTOMATE | Play tab/runtime input resolves to `mode:'play'`, `play` companion, `game-tree` source, `playMove` hint, non-analysis overlay off, and no scratch primary engine target. | Locks default Play projection. | Play UI may render from stale problem/recall state or legacy board mode. |
| WMSR-T02 | STATE | MUST_AUTOMATE | Problem input resolves only when `tab.mode='problem'`, active attempt and `problemView` exist; output uses `problemAttemptMove`, not `playMove` fallback. | Protects first-class Problem mode. | Legacy `sabaki.state.mode='play' + problemView` remains a hidden main path. |
| WMSR-T03 | STATE | MUST_AUTOMATE | Recall input resolves only when active recall session and `recallView` exist; checkpoint remains companion/substate; source attempt projection is frozen/read-only. | Protects Recall and checkpoint semantics. | Checkpoint may become fifth mode or mutate source Attempt. |
| WMSR-T04 | STATE | MUST_AUTOMATE | Analysis input resolves with scratch/current source, return target/previous mode, and engine region `scratch` with `mayWrite:'edit-workspace-only'`; snapshot persistence is allowed only here. | Protects Analysis scratch boundary. | Snapshot or scratch edits may write source tree/Attempt. |
| WMSR-T05 | STATE | MUST_AUTOMATE | Illegal companion combinations return stable diagnostics and never auto-clean stores: problem+recall overlap, checkpoint without recall, recall with problemView, non-analysis territory/compare, analysis without scratch/current. | Makes migration gaps visible. | Tests can pass by silently coercing polluted state. |
| WMSR-T06 | SIDE_EFFECT | MUST_AUTOMATE | Deep-frozen input snapshots remain unchanged after resolving every mode and illegal case. | Proves read-only behavior. | Resolver may "fix" companion state by mutating caller data. |
| WMSR-T07 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Resolver source/import graph has no direct imports from stores, services, repositories, engine, overlay store, document store, `sabaki.js`, IPC, or globals. | Enforces no direct store mutation in resolver. | Resolver becomes a hidden orchestration/service layer. |
| WMSR-T08 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Mode truth comes from `WorkbenchTab.mode`; tests inject conflicting legacy `sabaki.state.mode` and task origin/provider/source_kind and assert diagnostics only, not mode override. | Prevents source-truth drift. | New code may bless the old `problemView + sabaki.state.mode='play'` path. |
| WMSR-T09 | PURE_LOGIC | MUST_AUTOMATE | Position source and mutation hints match the Position Source contract for play/problem/recall/analysis, including `scratch/problem-attempt`, `scratch/current`, and `scratch/reference`. | Connects ModeState to board resolver inputs. | Board tests may assert callback delegation without proving write boundary. |
| WMSR-T10 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | Six-screen Shell/Panel projection consumes resolver output as display state only; no visual layout or text fidelity is accepted by this contract. | Keeps resolver contract tied to UI loop. | Contract could be misread as visual acceptance. |
| WMSR-T11 | WIRING | MANUAL_ACCEPTANCE | Integration plan step4 must wire `workbenchStore`/`trainingRuntimeStore`/overlay/engine/Sabaki subscriptions to resolver projection and then UI props. | Names the loop touched by a read-only resolver. | Resolver tests pass but UI never receives state return. |
| WMSR-T12 | PURE_LOGIC | DO_NOT_TEST | Do not test object property order, exact array identity for returned diagnostics, CSS classes, static copy, or one-line getters. | Avoids brittle implementation lock-in. | Over-specified tests fail harmless refactors. |

### 9.1 Mode/companion matrix expansion

All in-scope rows are target behavior for the future resolver. Current implementation may not satisfy them; test-writer should write RED tests where production subject is absent or incomplete.

| 字段/事件 | Mode/State | 期望值/行为 | 测试 ID | 测试状态 | GAP/Deferred |
| --- | --- | --- | --- | --- | --- |
| `WorkbenchTab.mode` | play | Primary mode truth is `play`; `activeRecallSessionId` empty; `previousMode`/analysis return absent. | WMSR-T01 | RED | Future resolver not implemented in this step. |
| Runtime companion | play | `problemView=null`, `recallView=null`, `activeCheckpointId=null`, `correctionDraft=null`; pending eval and visible bad moves may be present. | WMSR-T01/WMSR-T05 | RED | Need stable runtime projection fields. |
| Position/mutation | play | `game-tree` + `playMove`; no scratch primary source. | WMSR-T09 | RED | Contract target. |
| Overlay/engine | play | territory/compare illegal/off; engine region `game-tree-live` or `none`, not scratch primary. | WMSR-T01/WMSR-T05 | RED | Contract target. |
| `WorkbenchTab.mode` | problem | Primary mode truth is `problem`; active attempt required; active recall session empty. | WMSR-T02 | RED | Problem legacy fallback is a known migration gap. |
| Runtime companion | problem | `problemView` required; `recallView=null`, checkpoint/draft empty; pending eval and visible bad moves scoped to current attempt. | WMSR-T02/WMSR-T05 | RED | Contract target. |
| Position/mutation | problem | `game-tree` or `scratch/problem-attempt` + `problemAttemptMove`; never `playMove` as sole main path. | WMSR-T02/WMSR-T09 | RED | Problem executor comes later. |
| Overlay/engine | problem | territory/compare illegal/off; engine/evaluation may update MoveEvaluation/BadMove but not frozen Attempt. | WMSR-T02/WMSR-T05 | RED | Resolver can only classify; service guard later. |
| `WorkbenchTab.mode` | recall | Primary mode truth is `recall`; active recall session required; active attempt is frozen source. | WMSR-T03 | RED | Contract target. |
| Runtime companion | recall | `recallView` required; `problemView=null`; checkpoint/draft allowed only as recall companion. | WMSR-T03/WMSR-T05 | RED | Checkpoint projection later. |
| Position/mutation | recall | `game-tree` or `scratch/problem-attempt` + `recallAnswer`; no free board editing and no source Attempt mutation. | WMSR-T03/WMSR-T09 | RED | Contract target. |
| Overlay/engine | recall | territory/compare/analysis overlay hidden or illegal; historical eval may be read for checkpoint. | WMSR-T03/WMSR-T05 | RED | Implementation plan notes Recall page must not show analysis projection. |
| `WorkbenchTab.mode` | analysis | Primary mode truth is `analysis`; return target/previous mode comes from saved analysis return target, not arbitrary target. | WMSR-T04 | RED | Mode effects integrated later. |
| Runtime companion | analysis | Source runtime read-only; scratch state is not owned by training runtime; completed Recall path should not expose mutable recall companion. | WMSR-T04/WMSR-T05 | RED | Contract target; effect cleanup later. |
| Position/mutation | analysis | `scratch/current` + `scratchEdit`; optional `scratch/reference`; explicit `game-tree` + `variationMove` only for variation analysis. | WMSR-T04/WMSR-T09 | RED | Contract target. |
| Overlay/engine | analysis | territory/compare allowed only with owner `analysis`; scratch engine writes `edit-workspace-only`; snapshot persistence allowed only with scratch/current. | WMSR-T04/WMSR-T05 | RED | Contract target. |
| Snapshot capability | non-analysis | `snapshotVisible` may be true, but `snapshotPersistAllowed=false`; next step is enter Analysis. | WMSR-T04/WMSR-T08 | RED | PRD/implementation plan override older architecture wording. |
| Legacy adapter mismatch | any | `sabaki.state.mode` mismatch becomes diagnostic only; never overrides `tab.mode`. | WMSR-T08 | RED | Legacy cleanup later. |
| Missing active tab | null | Return invalid/empty projection with diagnostics; do not infer from legacy state or task origin. | WMSR-T05/WMSR-T08 | RED | Contract target. |
| Rendered panel return | all | Real Shell/Panel re-render from resolver projection is not covered by this resolver test file. | WMSR-D01 | DEFERRED | Approved reason: step1.3 and step4 own six-screen projection/integration; exit condition: Container uses resolver output. |

## 10. 必须自动化的测试

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WMSR-T01 | PROJECTION_RETURN | `src/modules/training/workbench/modeStateResolver.ts::resolveModeState` | Real resolver implementation and production ModeState/input types | Plain immutable tab/runtime/overlay/engine/Sabaki snapshots | `real production interface/type`; if production input types are absent, add typed fixtures before broad tests | No store/service/repository/controller/engine mocks | Play input returns `ok:true`, `mode:'play'`, `game-tree`, `playMove`, legal overlay/engine region, no illegal diagnostics | WMSR-D01 (DEFERRED rendered UI return by step1.3/step4) |
| WMSR-T02 | PROJECTION_RETURN | `resolveModeState` | Real resolver implementation and production types | Plain immutable snapshots | `real production interface/type` | No `WorkbenchFlowService`, `documentStore.playMove`, legacy controller mocks | Problem input returns `mode:'problem'`, requires `problemView`/active attempt, uses `problemAttemptMove`, and ignores conflicting `sabaki.state.mode='play'` | WMSR-D01 |
| WMSR-T03 | PROJECTION_RETURN | `resolveModeState` | Real resolver implementation and production types | Plain immutable snapshots | `real production interface/type` | No `RecallService`, `AttemptService`, repository mocks | Recall input returns `mode:'recall'`, frozen source attempt projection, checkpoint as companion/substate, `recallAnswer`, and no Attempt mutation capability | WMSR-D01 |
| WMSR-T04 | PROJECTION_RETURN | `resolveModeState` | Real resolver implementation and production types | Plain immutable snapshots | `real production interface/type` | No `SnapshotService`, `scratchAnalysis`, engine service, or Sabaki global mocks | Analysis input returns scratch/current source, saved return target, analysis-owned overlay/engine, and `snapshotPersistAllowed=true` only for scratch/current | WMSR-D01 |
| WMSR-T05 | PROJECTION_RETURN | `resolveModeState` | Real resolver implementation and production diagnostics enum/type | Plain invalid-state snapshots | `real production interface/type` | No store cleanup or service mocks that repair state before assertion | Each illegal companion row returns `ok:false` or diagnostics with stable codes and does not coerce to legal state | WMSR-D01 |
| WMSR-T06 | SIDE_EFFECT_BOUNDARY | `resolveModeState` | Real resolver implementation | Deep-frozen plain snapshots; optional local tiny stub callback only if resolver accepts diagnostics sink (not recommended) | `real production interface/type`; `local tiny stub` only for a single local logger/callback if such API exists | No fake stores/services/controllers/repositories/adapters | After resolving legal and illegal cases, input graph is unchanged; deep-freeze catches mutation attempts | WMSR-T07 |
| WMSR-T07 | ARCHITECTURE_BOUNDARY | `src/modules/training/workbench/modeStateResolver.ts` import/source boundary | Real source file/import graph | None | `real production interface/type` and source text/import graph | Per-file spies for `WorkbenchFlowService`, `WorkbenchTabService`, `SnapshotService`, `documentStore.playMove`, `RecallService`, `AttemptService`, `ReviewService`, repository ports | File has no imports/calls to stores, services, repositories, engine, overlay store, document store, `sabaki.js`, IPC, timers, or globals; resolver cannot directly mutate stores | not-covered; architecture review step should re-check after implementation |
| WMSR-T08 | ARCHITECTURE_BOUNDARY | `resolveModeState` | Real resolver implementation and production types | Immutable snapshots with conflicting legacy `sabaki.state.mode`, task origin/provider/source_kind | `real production interface/type` | No source-specific tab service mocks; no legacy controller mocks | Mode remains derived from `tab.mode`; legacy/source fields are diagnostics only and never primary flow branch | WMSR-D01 |
| WMSR-T09 | PROJECTION_RETURN | `resolveModeState` | Real resolver implementation and production position/mutation contract helpers if available | Plain immutable snapshots for source roles | `real production interface/type`; use shared typed factory if position-source helper exists | No focused executor mocks; no central mutation executor fake | Returned `positionSource` and `allowedMutationContracts` match Play/Problem/Recall/Analysis defaults, including `scratch/problem-attempt`, `scratch/current`, `scratch/reference` | Board resolver/executor tests in later step6/step8; not covered here |

## 11. 仅手动验收

| ID | 验收项 | 范围 | 退出条件 |
| --- | --- | --- | --- |
| WMSR-M01 | Contract source review | Verify this archive cites active PRD, architecture v0.5, mode orchestration, position-source mutation, UI/UX wiring plan, and implementation plan in the requested priority order. | Human confirms no source-truth drift. |
| WMSR-M02 | Integration design review | Confirm step4 integrates resolver after store subscriptions and before panel projection, without moving store writes into the resolver. | Architecture reviewer traces one state update to UI projection. |
| WMSR-M03 | Visual acceptance | Not in this contract. Six-screen layout/copy/screenshot fidelity belongs to frontend visual workflow and step1.3/step9. | Visual contract/test artifacts cover it separately. |

## 12. 不测试

- Do not test CSS, layout, viewport, screenshot, or exact text content in this resolver contract.
- Do not test that a presentational callback was called once as primary evidence; callback mapping belongs to UI command tests and is insufficient for state-forward/state-return.
- Do not test service call order; resolver must not call services.
- Do not assert current legacy fallback as desired behavior, especially `problemView + sabaki.state.mode='play'`.
- Do not add tests for simple getters or property order.
- Do not mock full production services/controllers/stores/adapters/repositories inside the resolver test file.

## 13. 脆弱测试警告

- **False green by positional call**: Tests must call the resolver with the same single-object signature production uses.
- **False green by mocked service**: A test that stubs `WorkbenchFlowService` or `SnapshotService` only proves delegation, not resolver projection or no-side-effect behavior.
- **False green by static strings**: Tests must inspect structured output (`mode`, companion, source, mutation contract, diagnostics), not panel copy.
- **Legacy-current-behavior trap**: Existing fallback behavior can be a known gap. RED tests should target PRD/architecture contract, not encode the fallback.
- **Over-specific diagnostics**: Assert stable diagnostic codes and essential fields, not exact array order unless order is declared as product behavior.
- **Hidden mutation**: Use deep-frozen inputs or clone comparison; shallow equality can miss nested state mutation.

## 14. 超出范围

- Production implementation of `modeStateResolver.ts`.
- Test implementation under `test/training/modeStateResolver.test.ts`.
- ModeEnterEffect / ModeExitEffect orchestration.
- Snapshot service restriction implementation.
- Problem attempt executor, recall checkpoint board source, analysis edit bar executor.
- Six-screen visual fidelity, CSS, layout, and screenshot acceptance.
- Large architecture rewrite or deletion of legacy Sabaki modes.

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 禁止 | Architecture v0.5 openTask uses generic task fields and forbids source-specific tab APIs (lines 682-725); implementation plan forbids `source_kind` main path (lines 23-35). | Resolver tests inject these fields and assert diagnostics only; `tab.mode` remains primary. |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 禁止 | Architecture v0.5 lines 711-725 explicitly forbid those APIs. | Contract has no tab-opening command; future integration must use `openTask`. |
| 是否让 `snapshotService` 承担 Architecture v0.5 未分配给它的 tab opening / flow orchestration | 禁止 | Snapshot tab creation belongs to `workbenchFlowService` and `workbenchTabService` in flow docs; resolver is read-only. | Resolver only returns snapshot capability and diagnostics; no `SnapshotService` import allowed. |
| 是否让 container 直接写 store，而不是通过 v0.5 指定 service | 禁止 | Architecture v0.5 lines 549-562 list store writers as tab/flow services; UI plan lines 8-15 says components render projections and do not mutate core store. | This resolver cannot write stores; step4 integration must preserve service-owned writes. |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 禁止 | UI plan lines 8-15 and 64-79 forbid direct store/global mutation; render path is Container projection. | Resolver is called by Container/projection layer with snapshots; panels receive props only. |
| 是否把 `problem` 当成 legacy board mode | 禁止 | PRD lines 235-253 and position contract lines 20-22 distinguish Problem entity from `WorkbenchMode.problem`; implementation plan lines 83-87 marks current fallback as gap. | Resolver must output `mode:'problem'` from `tab.mode` even if legacy `sabaki.state.mode` differs. |
| 是否把 RecallCheckpoint 变成独立 mode | 禁止 | PRD lines 250 and 411-427; Architecture v0.5 line 796. | Resolver outputs checkpoint as Recall companion/substate only. |
| 是否允许 non-analysis 直接 snapshot persist | 冲突已识别，按 PRD 收紧 | PRD lines 255-269 requires Analysis scratch/current before persistence; implementation plan lines 78-81 repeats this. Architecture v0.5 lines 778-800 and 1883-1904 still describe broader global snapshot capture. | Source priority: PRD wins. Resolver returns `snapshotVisible` globally but `snapshotPersistAllowed` only for Analysis scratch/current; non-analysis result says `enter-analysis` first. |
| 是否让 resolver 产生业务副作用 | 禁止 | Implementation plan lines 113-120 says resolver must not implement business side effects. Position contract lines 187-252 keeps executor as write owner. | WMSR-T06/T07 enforce deep read-only and import boundary. |

## 16. Workbench 接线清单（如适用）

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `resolveModeState` projection helper | read-only derive `ModeState` | resolver module; invoked by `TrainingWorkbenchContainer` / projection layer | Mode orchestration lines 24-47; implementation plan step1.2/step3.1 | 无写入；consumes state snapshots only | returns ModeState/diagnostics used for Shell/panel/board props | WMSR-T01..T09 | contracts/docs, tests by mode |
| `ModeBar` active mode display | display-only current mode | presentational component receives props | UI plan screens lines 19-26; render path architecture lines 1928-1945 | Upstream flow services change tab mode | subscription -> resolver -> mode prop/chip/disabled reason | Deferred to step1.3/step4 rendered projection | container/projection |
| Play panel/right area | display-only Play companion | presentational component receives props | Mode contract Play table lines 75-85 | Upstream play/attempt/engine writes happen outside resolver | resolver returns play companion/source/mutation hint | WMSR-T01/WMSR-T09; rendered return deferred | tests by mode, container/projection |
| Problem panels/bottom actions | display-only state; commands still owned by flow/problem services | command owner remains `TrainingWorkbenchContainer` -> flow/problem service | PRD lines 245-249; UI matrix lines 48-50 | Problem submit/hint/undo writes outside resolver | resolver returns problem companion and illegal diagnostics | WMSR-T02/WMSR-T05; command tests elsewhere | tests by mode; panel callback plumbing later |
| Recall / checkpoint panels | display-only Recall companion; checkpoint commands owned by recall checkpoint service/flow | `TrainingWorkbenchContainer` -> recall services | PRD lines 351-357, 411-427; UI matrix lines 51-54 | Recall answer/checkpoint writes outside resolver | resolver returns recall companion/checkpoint substate | WMSR-T03/WMSR-T05; rendered return deferred | tests by mode; container/projection |
| Analysis panels / overlay badges | display-only analysis, overlay, engine state; edit commands owned by scratch executor/service path | `TrainingWorkbenchContainer` -> flow/scratch/board controller | Mode contract Analysis lines 121-131; UI matrix lines 55-61 | Enter analysis/scratch/overlay/engine writes outside resolver | resolver returns analysis companion, scratch source, overlay/engine region | WMSR-T04/WMSR-T09; edit bar tests later | tests by mode; architecture review |
| Main board state dispatch | no direct command in this resolver; board clicks remain active through controller/resolver/executor | boardInteractionController / focused executors | Position contract lines 187-252 | Board action writes via focused executor only | ModeState supplies source/mutation hints to downstream projection/guard | WMSR-T09 plus later board executor tests | controller, tests by mode |
| Store subscriptions | read state and trigger projection | `TrainingWorkbenchContainer` | Architecture render path lines 1928-1945 | Store setters from services trigger subscriptions | subscription -> resolver -> projection -> UI props | Deferred WMSR-D01; step4 integration | container/projection |

### 16.1 控件清单状态

| 控件/区域 | 状态 | 原因 |
| --- | --- | --- |
| Resolver API | active after implementation | Pure projection helper; no user-visible control. |
| Mode display / active chip | display-only | Reflects `tab.mode`; does not change mode by itself in this contract. |
| Problem/Recall/Analysis panel fields | display-only | Fields come from resolver/projection; commands remain owned elsewhere. |
| Snapshot button capability | deferred to command tests | Resolver may return visible/disabled/persist capability, but click path belongs to flow service and command map. |
| Board click routing | deferred | Resolver returns position/mutation hints; focused executor tests own writes. |
| Overlay toggles | deferred | Resolver can mark illegal/disabled outside analysis; overlay command tests own actual toggles. |

### 16.2 命令清单

| 语义命令 | Owner | 本契约处理 |
| --- | --- | --- |
| `resolveModeState(input)` | resolver module, called by Container/projection | Pure read-only projection; no writes. |
| Submit Play/Problem | `TrainingWorkbenchContainer` -> `workbenchFlowService.submit` | Resolver observes result only. |
| Enter/return Analysis | `TrainingWorkbenchContainer` -> `workbenchFlowService` | Resolver observes tab/runtime/scratch/overlay result only. |
| Snapshot | `TrainingWorkbenchContainer` -> `workbenchFlowService.snapshotFromCurrentContext` after Analysis scratch/current precondition | Resolver returns capability/diagnostic only. |
| Board click | board interaction resolver/controller -> focused executor | Resolver can feed state hints; it is not executor. |
| Overlay toggle/compare | overlay command owner / flow-adapter path | Resolver validates ownership only. |

### 16.3 订阅契约

| Subscription | Must trigger | Resolver input affected | Expected projection return |
| --- | --- | --- | --- |
| `workbenchStore.subscribe` | active tab or mode changes | `tab` | New `ModeState.mode`, companion requirements, panel selection. |
| `trainingRuntimeStore.subscribe` | active attempt/session/checkpoint/runtime view/eval changes | `runtime` | Companion fields and illegal diagnostics update. |
| overlay projection/store subscription | territory/compare/pending/ownership changes | `overlay` | Overlay region updates; non-analysis illegal/disabled state visible. |
| engine/analysis adapter subscription | target/pending/candidates/ownership changes | `engine` | Engine region updates without triggering engine side effects. |
| Sabaki/document adapter update | tree position or edit workspace snapshot changes | `sabaki` | Position source/scratch availability/snapshot capability updates. |

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| contracts/docs | `docs/archive/daily-design/2026-05-26/workbench-mode-state-resolver/` | none | Read-only contract artifact only. | Low; derived docs can conflict with truth source if not reviewed. |
| tests by mode | `test/training/modeStateResolver.test.ts` | this contract | Mode matrix cases can be organized by play/problem/recall/analysis within one file or helper. | Medium if multiple workers touch same test file; use shared typed fixtures. |
| architecture boundary test | `test/training/modeStateResolver.test.ts` or shared architecture helper | this contract | Static import-boundary check does not require Container or UI changes. | Low; avoid brittle path matching beyond forbidden imports/globals. |
| controller | none for this contract | later step6 | Resolver is not controller/executor. | N/A. |
| container/projection | `TrainingWorkbenchContainer` and projection helpers | step3.1 implementation; step4 integration | Should wait for resolver implementation to avoid fake projection. | High if it starts before resolver shape is stable. |
| panel callback plumbing | panel/shell components | step1.3/step4 | Visual/panel wiring is separate from pure resolver. | Medium; callback-only tests are weak. |
| architecture review | docs + future implementation | after tests/implementation | Can independently verify no boundary leaks. | Low; must use source truth, not this derived contract, when conflicts appear. |
