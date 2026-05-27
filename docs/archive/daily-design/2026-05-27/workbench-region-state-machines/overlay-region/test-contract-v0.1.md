Date: 2026-05-27
Status: pending-confirmation
Gate: step1.contract
Slice: overlay child-region transition boundary for Workbench mode enter/exit

# 契约草案

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/archive/prd-versions/gabaki-sabaki-training-prd-v0.5.md` | lines 86-113 | 产品主模式固定为 `Play / Problem / Recall / Analysis`；`Play/Problem -> Submit -> Recall` 是主干，`Play/Problem/Recall -> Analysis` 是自由研究入口。 |
| `docs/archive/prd-versions/gabaki-sabaki-training-prd-v0.5.md` | lines 140-153 | `TrainingAttempt.userLine` 是 Play/Problem 产出的核心事实，提交后冻结；Snapshot 才创建新 TrainingTask。Overlay 清理不得修改 Attempt 或创建 Task。 |
| `docs/archive/prd-versions/gabaki-sabaki-training-prd-v0.5.md` | lines 299-315 | Analysis 是自由研究空间，允许 territory / ownership / eval 对比；Analysis 自由摆棋不污染 Attempt。 |
| `docs/product/sabaki-training-prd.md` | lines 235-269, 560-563 | 当前 PRD 继承 v0.5 口径：运行态 mode 只有四个；Snapshot 可发现但落库前必须投影到 Analysis scratch/current。Snapshot/scratch 创建不属于本 slice。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 23-25, 64-70 | 新路径不得使用 v0.4 的 `source_kind` / `openProblemTab` / `openSnapshotProblemTab` 作为主路径；核心流程围绕 Play/Problem/Recall/Analysis。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 89-116 | UI 只展示；Container/Controller 调 Service；Service 编排；Store 不调 Service；mode guard/effect 规则不得散落在 UI callback。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 135-158 | `modeTransitions.ts` 是正式状态机契约；Analysis return 必须恢复 previous mode；非法转换必须 reject/throw 并记录日志。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 180-209 | 命令写路径是 `UI Component -> Controller/Container -> Service -> Store/Repository/Adapter -> Existing Sabaki Core`；本 slice 的 overlay 通知必须挂在 service/child-region owner 边界。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 412-430 | `overlayStore` 是显示层 overlay 状态 owner，不承载训练业务，不得调用 recall checkpoint 或 bad move 业务逻辑。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 727-788, 1871-1881 | `workbenchFlowService` 负责 Tab 内 mode 转换和跨实体流程编排；进入 Analysis 不改变 `Attempt.userLine`。 |
| `AGENTS.md` | lines 34-45 | `WorkbenchMode` 是父状态机；mode 迁移走 `workbenchFlowService`；overlay 可作为 child region；child region 不能反向修改 WorkbenchMode；测试验证最终 outcome，不只断言 setter 顺序。 |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 19-47 | 本文是当前运行态状态机最高优先级 source truth；mode 是上层主 region，约束 overlay/engine/analysis child regions。 |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 56-71 | `WorkbenchMode` 由 workbench service 编排写；`Overlay` owner 是 `overlayStore`；Legacy `sabaki.state.mode` 对 workbench 只能是 adapter projection。 |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 83, 125-130 | Play/Problem/Recall overlay 必须 off；Analysis 中 territory/compare 仅 Analysis 可用，来源是 game-tree 或 scratch current/reference。 |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 176-211 | `play/problem/recall -> analysis` 允许 overlay command；`analysis -> previous mode` 必须清 territory/compare、bump generation，并丢弃 pending state。 |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 227-235 | 非 Analysis toggle territory/compare 非法；防护是 `overlayStore` 拒绝，并补 UI disabled 和 async 测试。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | lines 21-28, 63-90 | 父状态机只向 child region owner 发送 transition intent；`modeStateResolver` 只诊断，不写状态或修复。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | lines 92-135 | `overlay.territoryEnabled` / `territoryCompareEnabled` 是可自动同步的 transient/cache；Overlay Region owner 是 `overlayStore` 或未来 `overlayRegion`，负责 Analysis 允许、离开 Analysis 关闭、generation guard、且不反向修改 Workbench mode。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` | lines 20-27, 40-45, 49-76 | step1 是第一条 child-region vertical slice；现有 gap 是 flow orchestration 没有显式调用 overlay child-region owner；本 slice 锁定 `src/modules/overlays/*`、`workbenchFlowService.ts` 和 overlay tests。 |
| 当前实现证据：`src/modules/overlays/overlayStore.ts` | lines 1-12, 18-23, 62-84 | `overlayStore` 已声明 owner，其状态为 `territoryEnabled`、`territoryCompareEnabled`、`showInfoOverlay`、`infoOverlayText`，通过 `notifyChange` 和 `subscribe` 回流 UI。 |
| 当前实现证据：`src/modules/overlays/overlayStore.ts` | lines 138-223, 234-282, 292-329 | territory/compare 已有 Analysis guard、互斥、async generation、`onModeChange` 清理和 notification。 |
| 当前实现证据：`src/modules/training/workbench/workbenchFlowService.ts` | lines 619-653, 662-711, 760-803, 878-905 | `enterAnalysis`、`returnFromAnalysis`、`completeRecall`、`restartAttempt` 会 patch tab/mode 并调用 analysis mode effects，但没有显式 overlay child-region transition port。 |
| 当前实现证据：`src/modules/sabaki.js` | lines 501-571 | legacy `sabaki.setMode` 会调用 `overlayStore.onModeChange(mode)` 并在进入 analysis 时 auto-enable territory；这不是 Workbench v0.5 主 transition path。 |
| 当前测试证据：`test/overlays/overlayStore.test.js` | lines 47-93 | 现有测试覆盖非 analysis 拒绝 territory 和 `onModeChange('play')` 清理，但未覆盖 late async 或 `workbenchFlowService` integration。 |

## 1. 用户故事

作为使用训练工作台的用户，我可以从 Play/Problem/Recall 进入 Analysis 做自由研究，并从 Analysis 返回原 mode。无论我何时离开 Analysis，territory/compare overlay 都不会残留到 Play/Problem/Recall；如果引擎 ownership 检查晚到，也不能把已离开的 Analysis overlay 重新点亮。Overlay child region 只管理 overlay transient state，不改变 WorkbenchMode、Attempt、RecallSession、Task 或棋谱。

## 2. 用户动作

1. 点击 ModeBar 的 Analysis segment 或 Analysis action，从 Play/Problem/Recall 触发 `enterAnalysis`。
2. 在 Analysis 中点击 previous mode segment 或 Return action，触发 `returnFromAnalysis`。
3. Recall 完成后进入 Analysis，触发 `completeRecall` 的 mode transition。
4. 在 Analysis 中 restart attempt，触发 `restartAttempt` 并离开 Analysis。
5. 在 Analysis 中切换 territory 或 compare；在非 Analysis 中同类命令必须被拒绝或禁用。
6. 引擎 capability / ownership promise 在用户离开 Analysis 后才 resolve。

上游调用签名证据：

| 调用方 | 真实调用签名 | 证据 | 假绿风险 |
| --- | --- | --- | --- |
| `ModeBar` | `onClick: () => onModeChange(key)`，其中 `key` 是 mode string | `src/components/workbench/shell/ModeBar.js:62` | 测试不得按 `(mode, event)` 双参数调用 `onModeChange`。 |
| `WorkbenchShell` | `h(ModeBar, {activeMode: mode, onModeChange, ...})` | `src/components/WorkbenchShell.js:139` | Shell 只透传 callback，不拥有 mode state。 |
| `TrainingWorkbenchContainer.handleModeChange` | `handleModeChange(mode)`，再用 `getModeTransitionAction(...)` 映射到 `flowService.enterAnalysis(activeTab.id, {reason:'manual'})` 或 `flowService.returnFromAnalysis({tabId, reason:'return'})` | `src/components/TrainingWorkbenchContainer.js:117-133` | 只断言 callback 被调用不能证明 overlay 清理，必须有 service/overlay state-forward 测试。 |

## 3. 当前阶段

当前阶段是 Workbench parent mode transition 与 Overlay child region 的边界建立。`play`、`problem`、`recall`、`analysis` 是 WorkbenchMode，不是棋盘 mode；`problem` 不是 board mode；checkpoint/review/punishment 也不是新 mode。

本 slice 不改变 `modeTransitions.ts` 的 pure policy，不把 overlay 规则塞进 resolver，也不将 `workbenchFlowService` 扩成 overlay state owner。目标是让 `workbenchFlowService` 在成功 mode transition 后通知 overlay child-region owner/adapter，由 owner 自己清理 territory/compare 和 stale async state。

## 4. 位置源

| Mode / State | 相关位置源 | 本 slice 约束 |
| --- | --- | --- |
| `play` | `game-tree` | overlay territory/compare off；本 slice 不改变落子、导航或 game-tree mutation。 |
| `problem` | `problem-attempt` over game-tree/current problem position | overlay territory/compare off；本 slice 不改变 Attempt 或 problem runtime。 |
| `recall` | recall answer/reference position，source attempt read-only | overlay territory/compare off；本 slice 不改 RecallSession/RecallAttempt/checkpoint。 |
| `analysis` | `scratch/current`，可带 `reference/current` compare source；legacy game-tree analysis source 仍存在 | overlay territory/compare commands allowed；本 slice 不实现 scratch lifecycle，只保证 overlay owner 不污染 parent mode。 |
| late async ownership result | pending overlay capability request tied to overlay generation | leaving Analysis invalidates generation so late result cannot revive overlay or schedule analysis for stale mode. |

## 5. 变更契约

| Contract | 是否适用 | 说明 |
| --- | --- | --- |
| `playMove` | 不适用 | 本 slice 不处理棋盘落子。 |
| `scratchEdit` | 不适用 / DEFERRED | Analysis scratch workspace lifecycle 属于后续 `step2.2`；本 slice 只允许 Analysis overlay commands，不写 scratch。 |
| `recallAnswer` | 不适用 | Recall answer 和 checkpoint 属于 recall services，不由 overlay child region 管理。 |
| `variationMove` | 不适用 | 显式 game-tree variation move 不在本 slice。 |
| `无变更` | 适用 | overlay toggle/cleanup 不改变 domain facts、repository、Attempt、RecallSession、Task、SGF tree。 |
| `overlayRegionTransition` | 适用 | `workbenchFlowService` 成功改变 `WorkbenchTab.mode` 后，通知 overlay child-region owner/adapter，例如 `onWorkbenchModeTransition({tabId, fromMode, toMode, reason, beforeTab, afterTab})`。名称可调整，但语义和 typed boundary 必须成立。 |

## 6. 预期状态流

### 6.1 ModeBar / action 进入 Analysis

```text
UI event
-> ModeBar.onClick()
-> onModeChange(key)
-> TrainingWorkbenchContainer.handleModeChange(mode)
-> getModeTransitionAction(...) = 'enterAnalysis'
-> workbenchFlowService.enterAnalysis(tabId, {reason:'manual'})
-> assertTransition(tab, 'enterAnalysis')
-> workbenchStore.updateTab({mode:'analysis', previousMode, analysisReturnTarget, analysisContext})
-> overlay child-region owner receives {fromMode:'play'|'problem'|'recall', toMode:'analysis', reason}
-> overlayStore keeps territory/compare off by default but now permits analysis overlay commands
-> optional legacy modeEffects enter Analysis scratch adapter (DEFERRED ownership cleanup)
-> workbenchStore subscriber / overlayStore subscriber notify
-> TrainingWorkbenchContainer projection reads active tab + overlayStore state
-> WorkbenchShell / toolbar props reflect mode='analysis' and current overlay flags
```

`enterAnalysis` must not auto-enable territory inside `workbenchFlowService`. If legacy `sabaki.setMode('analysis')` still auto-enables territory, that remains a legacy mode-effect seam and must not become the new v0.5 contract.

### 6.2 Analysis return / exit

```text
UI event
-> ModeBar.onClick(previousMode) or Return action
-> TrainingWorkbenchContainer.handleModeChange(mode) / handleReturnFromAnalysis()
-> workbenchFlowService.returnFromAnalysis({tabId, reason:'return'})
-> assertTransition(tab, 'returnFromAnalysis')
-> workbenchStore.updateTab({mode: target.mode, previousMode: undefined, analysisReturnTarget: undefined})
-> overlay child-region owner receives {fromMode:'analysis', toMode: target.mode, reason:'return'}
-> overlayStore clears territoryEnabled and territoryCompareEnabled
-> overlayStore bumps generation / invalidates pending ownership checks
-> overlayStore emits notifyChange and subscriber callbacks
-> projection reads overlay false
-> UI no longer renders territory/compare as selected
```

If transition is rejected before tab update, overlay child-region must not be notified and overlay state must not be cleared as a side effect of a failed command.

### 6.3 Late async result

```text
Analysis mode
-> overlayStore.setTerritoryEnabled(true) or setTerritoryCompareEnabled(true)
-> overlayStore stores intent and starts ensureAnalysisReady({requireOwnership:true}) with generation N
-> user leaves Analysis through workbenchFlowService
-> overlay child region calls overlayStore transition cleanup
-> generation becomes N+1 and overlay flags become false
-> ensureAnalysisReady resolves late
-> callback sees stale generation or disabled flag
-> no territory/compare revive, no stale scheduleEditWorkspaceAnalysis/analyzeMove
```

### 6.4 暂时 no-op / 迁移接缝

| Segment | Current status | Exit condition |
| --- | --- | --- |
| Analysis scratch enter/exit | `ModeEnterEffect` / `ModeExitEffect` still adapts legacy Sabaki workspace | `step2.2` introduces scratch-region target/generation semantics. |
| Runtime companion cleanup | `runtimeStore.setX` remains scattered in flow service | `step2.1` routes runtime transient cleanup through runtime-region owner. |
| `modeStateResolver` production diagnostics | Read-only helper exists but not consumed by flow | `step2.3` adds preflight/postflight diagnostics without writer behavior. |
| Rendered visual verification | Existing projection reads overlay state; no new visual placement in this slice | Add rendered UI test only if overlay state shape or toolbar projection changes. |

## 7. 允许的副作用

1. `workbenchFlowService` may update `WorkbenchTab.mode`, `previousMode`, `analysisReturnTarget`, and related tab transition fields through `workbenchStore`.
2. `workbenchFlowService` may notify an injected/owned overlay child-region transition port after a successful mode transition.
3. Overlay child-region owner may mutate only overlay transient state: `territoryEnabled`, `territoryCompareEnabled`, `showInfoOverlay` if already part of cleanup, internal generation, and overlay notifications.
4. Overlay child-region may log structured transition/cleanup/stale-ignored events.
5. Existing `ModeEnterEffect` / `ModeExitEffect` may continue to adapt legacy Sabaki analysis workspace until scratch-region migration.

## 8. 禁止的副作用

1. Overlay child-region must not call `workbenchStore.updateTab`, `workbenchFlowService`, `sabaki.setMode`, `snapshotService`, repository, engine service, DB, or UI APIs.
2. Overlay child-region must not mutate `WorkbenchMode`, `Attempt.userLine/result/status`, RecallSession, RecallAttempt, RecallCheckpoint, Task/Problem, MoveEvaluation/BadMove, SGF tree, comments, or review schedule.
3. `workbenchFlowService` must not directly manipulate overlay internals beyond invoking the owner/adapter command.
4. Non-analysis overlay commands must not trigger `ensureAnalysisReady`, `analyzeMove`, `scheduleEditWorkspaceAnalysis`, or `captureEditReference`.
5. Late/pending overlay async result after leaving Analysis must not revive `territoryEnabled` or `territoryCompareEnabled`.
6. This slice must not introduce `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` as new main path, nor branch workflow by `origin.provider`, old `source`, or `kind`.

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| OVR-C01 | STATE | MUST_AUTOMATE | In real `overlayStore`, `setTerritoryEnabled(true)` and `setTerritoryCompareEnabled(true)` are rejected outside Analysis and leave flags false. | Prevents visible stale territory in Play/Problem/Recall. | Non-analysis training screens can show analysis ownership from wrong context. |
| OVR-C02 | STATE / SIDE_EFFECT | MUST_AUTOMATE | In real `overlayStore`, leaving Analysis clears both territory and compare and notifies subscribers. | Locks owner responsibility before flow integration. | Cleanup may depend on legacy `sabaki.setMode` only. |
| OVR-C03 | SIDE_EFFECT | MUST_AUTOMATE | A pending `ensureAnalysisReady` result cannot revive territory/compare or schedule analysis after `onModeChange(nonAnalysis)`. | Primary async safety guarantee. | Late engine/capability result can reopen overlay in Recall/Problem. |
| OVR-C04 | WIRING / STATE | MUST_AUTOMATE | `workbenchFlowService.returnFromAnalysis` uses real flow + store and notifies overlay owner so final state is target mode and overlay false. | Proves parent-to-child boundary, not just overlayStore unit behavior. | Fake green where overlay unit tests pass but Workbench transitions never call owner. |
| OVR-C05 | WIRING / STATE | MUST_AUTOMATE | Representative successful non-analysis transition that is not legacy `sabaki.setMode` clears dirty overlay through the same child-region path. Prefer `restartAttempt` from Analysis or a submit/enterRecall path if harness is already stable. | Ensures cleanup is transition-boundary behavior, not only return button behavior. | Future mode transitions can bypass overlay cleanup. |
| OVR-C06 | SIDE_EFFECT | MUST_AUTOMATE | Rejected/invalid mode transition does not notify overlay child region and does not clear overlay as a failed-command side effect. | Preserves command atomicity. | Failed command hides user-visible analysis state while mode remains unchanged. |
| OVR-C07 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Overlay region/store imports no Workbench service/store and exposes no API that can mutate WorkbenchMode. Type-only `WorkbenchMode` import is acceptable if needed. | Protects child region one-way ownership. | Overlay child region becomes a hidden parent-mode writer. |
| OVR-C08 | WIRING | MANUAL_ACCEPTANCE | Container callback path still maps `ModeBar.onModeChange(key)` to `flowService.enterAnalysis/returnFromAnalysis` with one mode argument. | Guards known handler signature risk. | Tests may pass with a two-arg handler shape that the UI never sends. |
| OVR-C09 | UI_BEHAVIOR | DO_NOT_TEST in this slice | Pixel/layout/visual selected state of toolbar buttons. | Visual fidelity is outside this business/state slice. | Visual drift belongs to frontend visual workflow, not this contract. |
| OVR-C10 | STATE / SIDE_EFFECT | DEFERRED | Scratch workspace teardown, engine target id, runtime companion cleanup, and modeStateResolver production diagnostics. | They are real risks but owned by step2.1/2.2/2.3. | Oversized first slice would mix overlay, runtime, scratch, and diagnostics. |

## 10. 必须自动化的测试

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OVR-T01 | STORE_SUBSCRIPTION | `createOverlayStore` `onModeChange(nonAnalysis)` | Real `overlayStore` implementation and real subscriber callback set | `getAppState`, logger, `ensureAnalysisReady`, analysis trigger callbacks | `local tiny stub` for stateless deps; no production service fake | Do not mock `overlayStore`; do not assert only logger calls | After territory/compare active in Analysis, `onModeChange('play'|'problem'|'recall')` sets both false and subscriber/notify path fires. | OVR-T04 |
| OVR-T02 | SIDE_EFFECT_BOUNDARY | `createOverlayStore` async generation guard | Real `overlayStore`; controlled pending Promise for `ensureAnalysisReady` | `getAppState`, logger, analysis trigger callbacks | `local tiny stub` for Promise resolver and callbacks | Do not mock generation behavior; do not use fake timers as sole oracle | Enable territory or compare in Analysis, call `onModeChange(nonAnalysis)`, resolve pending promise, assert flags remain false and `scheduleEditWorkspaceAnalysis/analyzeMove` not called. | OVR-T04 |
| OVR-T03 | ARCHITECTURE_BOUNDARY | Overlay region/store module boundary | Real source files after implementation | None, or filesystem scan helper | `real production interface/type` if checking exported port shape | Do not use runtime monkeypatch of `workbenchStore` or `flowService` | Overlay region/store has no non-type import of `workbenchStore`, `workbenchFlowService`, repository, DB, engine, UI, or `window.sabaki`; public API cannot set mode. | OVR-T04 |
| OVR-T04 | CONTROLLER_STATE_TRANSITION | `createWorkbenchFlowService(...).returnFromAnalysis` with overlay child-region port | Real `workbenchFlowService`, real `createWorkbenchStore`, real `overlayStore` or production overlay-region adapter | Repository/attempt/recall/snapshot/tab deps not exercised by this command; modeEffects no-op | `shared typed spy factory` or helper typed by `WorkbenchFlowServiceDeps`; if unavailable, add helper first. Overlay port fake must be typed by production interface. | Do not mock `workbenchFlowService`; do not replace `workbenchStore.updateTab`; do not assert only "overlay callback called once" | Given analysis tab with `analysisReturnTarget.mode='play'` and overlay active, calling `returnFromAnalysis` results in tab mode `play`, cleared return target, and overlay flags false. | OVR-T07 or DEFERRED rendered return |
| OVR-T05 | CONTROLLER_STATE_TRANSITION | Representative non-return mode transition path in `workbenchFlowService` | Real `workbenchFlowService`, real `createWorkbenchStore`, real overlay owner/adapter | Minimum typed service/repository fakes required by chosen command path | `shared typed spy factory` or `in-memory repository fake`; no per-file handwritten production service replacement | Do not use legacy `sabaki.setMode` as state-forward path | A successful mode transition to a non-analysis target goes through overlay child-region cleanup and final overlay flags are false. Suggested path: `restartAttempt` from Analysis to stored return target, unless submit/enterRecall harness is cleaner. | OVR-T07 or DEFERRED rendered return |
| OVR-T06 | SIDE_EFFECT_BOUNDARY | Rejected transition path in `workbenchFlowService` | Real `workbenchFlowService`, real `createWorkbenchStore`, real overlay owner/adapter | Typed minimal deps | `shared typed spy factory` or real production interface/type | Do not mock `assertTransition`; do not mutate overlay directly in assertion setup after command | Invalid `returnFromAnalysis` from non-analysis or analysis-without-target throws/rejects, tab mode remains unchanged, and overlay owner is not notified/overlay state unchanged. | not-covered: no UI needed; service atomicity is terminal for this slice |
| OVR-T07 | PROJECTION_RETURN | Overlay state projection to workbench props | Real projection/container path if touched by implementation | Existing harness sabaki shell surface | `shared typed spy factory` for shell/sabaki harness | Do not claim RENDERED_UI_RETURN unless rendering actual Shell/Panel | DEFERRED unless implementation changes overlay state shape or projection. If activated, assert cleared overlayStore state projects to `territoryEnabled=false` and `territoryCompareEnabled=false` props. | DEFERRED: rendered UI owned by visual/frontend workflow if visual state regresses |

测试状态:

| Test ID | 当前状态 | 说明 |
| --- | --- | --- |
| OVR-T01 | GREEN | Current `overlayStore.onModeChange` already clears flags; existing tests partially cover this. Expand only if current test does not assert subscriber behavior. |
| OVR-T02 | GREEN | Current generation checks should satisfy this, but no existing late-async test locks it. |
| OVR-T03 | RED | Future overlay-region adapter/port does not yet exist; current `overlayStore` alone has no parent transition boundary. |
| OVR-T04 | RED | `workbenchFlowService` currently patches mode and calls `modeEffects`, but has no explicit overlay child-region notification. |
| OVR-T05 | RED | Same integration gap as OVR-T04; choose one representative non-return transition only to keep slice small. |
| OVR-T06 | RED | Must be written with the new overlay port to ensure no notification on rejected transition. |
| OVR-T07 | DEFERRED | Approved reason: this slice changes child-region service boundary, not rendered visual/projection shape. Exit condition: activate if implementation changes overlay state shape, container overlay props, or toolbar subscription path. |

## 11. 仅手动验收

1. In the running app, enter Analysis, toggle territory or compare, return to Play/Problem/Recall, and verify selected overlay controls are no longer active.
2. Confirm that entering Analysis still permits territory/compare commands after any legacy scratch setup completes.
3. Confirm logs, if inspected, use transition/region/stale-ignored style metadata and are not the primary acceptance oracle.

Manual acceptance must not replace OVR-T04/OVR-T05 state-forward tests.

## 12. 不测试

1. CSS, visual spacing, button shape, or screenshot fidelity for toolbar/mode bar.
2. Exact logger text or logger call order.
3. Internal setter order inside `overlayStore`, unless ordering is required to prove stale async guard.
4. Snapshot persistence, problem runtime cleanup, recall checkpoint lifecycle, analysis scratch workspace teardown, and engine target isolation in this slice.

## 13. 脆弱测试警告

1. Weak-test ban: "overlay callback called once" is not primary acceptance. It may only support command mapping; primary assertion must be final tab + overlay state.
2. Do not mock `workbenchFlowService` in state-forward tests. If flow is mocked, the test layer is only `CONTAINER_DELEGATION`.
3. Do not use `sabaki.setMode` as the only route under test. It is a legacy adapter seam and already calls overlay cleanup; the target gap is Workbench v0.5 flow.
4. Do not require a specific method name if implementation uses a typed equivalent to `onWorkbenchModeTransition`; require input semantics and owner boundary.
5. Do not overfit to logger messages, `generation` numeric value, or setter order. Assert stale outcome and forbidden callbacks.
6. Do not assert current dirty behavior as green. If a Workbench transition leaves territory/compare enabled, the test must be RED.
7. Handler tests must use the real upstream signature `onModeChange(key)`, not invented event payloads.

## 14. 超出范围

1. Analysis scratch workspace lifecycle, workspaceId guards, and scratch result stale handling: DEFERRED to `step2.2`.
2. Runtime companion cleanup for `problemView`, `recallView`, `activeCheckpointId`, `correctionDraft`: DEFERRED to `step2.1`.
3. `modeStateResolver` preflight/postflight diagnostics: DEFERRED to `step2.3`.
4. Engine live-analysis target isolation and game-tree/scratch analysis cache split: DEFERRED to engine/scratch region work.
5. Snapshot non-analysis persistence tightening: outside this overlay slice unless implementation accidentally touches snapshot path.
6. UI visual disabled styling for territory/compare controls: frontend visual workflow if needed.

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 不允许，本契约不使用 | Architecture v0.5 lines 23-25, 64-70, 100-110 | Tests must not branch overlay behavior by origin/source/kind. |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 不允许，本 slice 不打开 tab | Architecture v0.5 lines 23-25 | Any tab opening in overlay tests is out of scope. |
| 是否让 `snapshotService` 承担 tab opening / flow orchestration | 不允许，本 slice 不调用 snapshotService | Architecture v0.5 lines 107, 1883-1891 | Snapshot deps in flow harness must remain unused. |
| 是否让 container 直接写 store，而不是通过 v0.5 指定 service | 不允许 | Architecture v0.5 lines 180-209; Container evidence lines 117-133 calls flow service | Do not add container overlay cleanup; state-forward belongs to flow -> child owner. |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 不允许新增 | Architecture v0.5 lines 89-98 | UI may emit callbacks only; no UI changes in this slice. |
| 是否让 overlay child region mutates WorkbenchMode | 不允许 | AGENTS.md lines 42-43; implementation notes lines 121-135 | Architecture boundary test OVR-T03. |
| 是否让 `modeStateResolver` 写状态或 repair | 不允许，本 slice不改 resolver | AGENTS.md lines 37-39; implementation notes lines 63-90 | Resolver diagnostics deferred to step2.3. |
| 是否把 `workbenchFlowService` 变成 overlay state bucket | 不允许 | implementation notes lines 121-124 | Flow only sends transition intent; overlay owner handles cleanup. |
| 是否新增 Workbench runtime mode | 不允许 | AGENTS.md lines 30-32; PRD v0.5 lines 86-93 | No review/checkpoint/punishment overlay mode. |
| 是否让 Analysis/Recall 修改 game tree or Attempt | 不允许 | AGENTS.md line 32; PRD v0.5 lines 140-153, 299-315 | Overlay cleanup has no domain persistence writes. |

## 16. Workbench 接线清单（如适用）

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ModeBar Analysis segment | `enterAnalysis` | Presentational emits `onModeChange(key)`; Container maps; `workbenchFlowService` owns transition | Architecture v0.5 lines 180-209; Container evidence `TrainingWorkbenchContainer.js:117-133` | `workbenchStore.updateTab({mode:'analysis', ...})`; overlay region notified with toMode analysis | workbench subscriber projects mode; overlay flags remain command-eligible | Existing mode tests plus OVR-T04 for overlay boundary; no visual test | container/projection unaffected; controller/service |
| ModeBar previous segment / Return action | `returnFromAnalysis` | Container -> `workbenchFlowService` -> overlay child region | Architecture v0.5 lines 135-158, 781-788 | `mode` restored, return target cleared, overlay owner clears territory/compare | overlayStore notify/subscription; projection sees flags false | OVR-T04 | controller/service + overlay tests |
| Complete Recall action | `completeRecall -> analysis` | `workbenchFlowService`; recall persistence remains recallService | Orchestration contract lines 189-199 | Mode enters analysis and overlay region notified; runtime cleanup remains current owner/deferred | overlay command eligibility in analysis; runtime cleanup deferred | Covered by implementation constraint; automated expansion deferred unless changed | controller/service; runtime deferred step2.1 |
| Restart attempt from Analysis | `restartAttempt` | `workbenchFlowService` | Architecture v0.5 lines 781-788 | Leaves analysis to play/problem/recall target and overlay owner clears | overlay false | Candidate for OVR-T05 | controller/service |
| Territory toggle | `setTerritoryEnabled/toggleTerritoryEnabled` | `overlayStore` / overlayRegion owner | Orchestration contract lines 125-130, 227-235 | Analysis only: overlay state true and pending capability check; non-analysis rejected | overlay subscription/projection | OVR-T01/OVR-T02; no UI visual | overlay tests |
| Territory compare toggle | `setTerritoryCompareEnabled/toggleTerritoryCompareEnabled` | `overlayStore` / overlayRegion owner | Orchestration contract lines 125-130, 201-211 | Analysis with reference/scratch: compare true; non-analysis rejected; leaving analysis clears | overlay subscription/projection | OVR-T01/OVR-T02 | overlay tests |
| Snapshot button | `snapshotFromCurrentContext` | `workbenchFlowService` / snapshotService / tabService | PRD current lines 560-563 | DEFERRED; do not couple to overlay region | DEFERRED | Out of scope | snapshot branch later |

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| overlay owner tests | `test/overlays/*` | Contract OVR-T01/OVR-T02 | Uses real `overlayStore`; no flow service edits | Low; may need controllable Promise helper. |
| flow integration tests | `test/training/workbenchFlowService*` or focused new test | Requires production overlay-region port shape or expected RED compile | Tests real flow/store integration | Medium; shared harness/mock policy must be typed. |
| architecture boundary test | focused architecture/static test | Production file names after implementation | Disjoint assertions from behavior tests | Low; avoid brittle text scans beyond import boundary. |
| implementation overlay region | `src/modules/overlays/*` | After tests | Owner state changes are local to overlays | Medium if API name drifts from tests; use typed interface. |
| implementation flow wiring | `src/modules/training/workbench/workbenchFlowService.ts` | After overlay region port exists | Shared integration point for parent mode changes | High; centralize notification to avoid missing one transition path. |
| architecture review | docs/review only | After implementation + verification | No code writes | Low. |

## 18. Required Constraints For Downstream Agents

1. Introduce or expose a typed overlay child-region transition boundary. Acceptable shape:

```ts
type WorkbenchOverlayRegionTransition = {
  tabId: string
  fromMode: WorkbenchMode
  toMode: WorkbenchMode
  reason?: string
  beforeTab?: WorkbenchTab
  afterTab?: WorkbenchTab
}
```

The exact name may differ, but the production interface/type must be shared with tests.

2. `workbenchFlowService` must call the overlay child-region owner only after a successful mode-changing transition. Rejected transitions must not notify.
3. All successful `WorkbenchTab.mode` changes in `workbenchFlowService` should use one local helper or equivalent centralized path so overlay notification is not missed. If a path is intentionally excluded, document why and add a DEFERRED row.
4. Overlay owner/adapter must delegate to real `overlayStore` behavior for cleanup and stale generation; it must not duplicate state outside `overlayStore`.
5. Do not make `modeTransitions.ts` run effects or import overlay modules.
6. Do not make `modeStateResolver.ts` repair overlay state in this slice.
7. Do not make `TrainingWorkbenchContainer` call `overlayStore.onModeChange` directly.
8. Do not test by mocking `workbenchFlowService`; tests that prove state-forward must instantiate the real service.
9. If a production service/controller/store/repository is faked, use a production interface/type, shared typed spy factory, or in-memory fake. No per-file handwritten replacement for `WorkbenchFlowService`, `SnapshotService`, repository ports, or overlay-region port.
10. Existing dirty worktree changes outside this archive document are unrelated and must not be reverted or included by downstream agents unless explicitly assigned.

