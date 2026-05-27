Date: 2026-05-27
Status: revised-for-contract-audit
Gate: step1.contract retry1
Slice: overlay child-region transition boundary for Workbench mode enter/exit

# 契约草案

## 0. 真源对齐

本节只列 authoritative source truth。产品与架构判断只来自 active `docs/product/`、`docs/architecture/`、`docs/ui_ux/`；优先级为 product > architecture > ui_ux。`AGENTS.md`、`docs/design/`、slice plan 和当前实现证据只作为 guardrail / implementation clarification / derived scope / current evidence，不得覆盖本表。

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | 5.2, lines 235-269 | 运行态 Workbench mode 只有 `Play / Problem / Recall / Analysis`。Problem/RecallCheckpoint/Review/Punishment Problem 不是新 mode。Snapshot 可从任意 mode 发现，但创建 Problem 前必须进入 Analysis scratch/current projection。 |
| `docs/product/sabaki-training-prd.md` | 6.3.6-6.3.7, lines 560-614 | Snapshot service 只能从 Analysis Mode 的 scratch/current source 派生；Analysis edit bar 只写 scratch/current，不能改 source `TrainingAttempt.userLine`。本 overlay slice 不得绕过该 scratch 约束。 |
| `docs/product/sabaki-training-prd.md` | 11.1-11.2, lines 1381-1423; 12.1-12.4, lines 1487-1523 | MVP 闭环进入 Analysis 后可 snapshot 出题；RecallCheckpoint 不改写原始 Attempt；Analysis 用于对比原线、修正图和 AI candidates，但本 slice 只处理 overlay transient cleanup。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 0.3, lines 89-116 | UI 只展示；Container/Controller 读 Store、调 Service；Service 编排业务动作；Store 不调 Service；`snapshotService` 不打开 Tab；不得根据 `origin.provider` 分叉主流程。Mode guard/effect 不得散落在 UI callback。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 0.4, lines 135-158 | 状态机表包含 `enterAnalysis`、`return`、`restartAttempt` 等行；Analysis return 必须恢复 previous mode / recall substate / tree position / move index；非法转换必须 reject/throw。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 1.2-1.3, lines 180-209 | 命令写路径必须是 `UI Component -> Controller/Container -> Service -> Store/Repository/Adapter -> Existing Sabaki Core`；Store 不依赖 Service；Container 不直接写业务 Store。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 3.4, lines 412-430 | `overlayStore` 定位是显示层 overlay 状态，不承载训练业务；禁止 `overlayStore -> recallCheckpointService` 或 bad move business logic。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 5.3, lines 727-802 | `workbenchFlowService` 负责 Tab 内 mode 转换和跨实体流程编排；`enterAnalysis` 保存 `AnalysisReturnTarget`；`returnFromAnalysis` 只能使用保存过的 target；`restartAttempt` 从 Analysis 回到 play/problem。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 5.10, lines 1108-1163; 9.6-9.7, lines 1871-1898 | `snapshotService` 只捕获输入，不创建 Tab；完整 Snapshot 流程由 `workbenchFlowService.snapshotFromCurrentContext` 编排。Architecture 的旧全局 Snapshot 行不能覆盖 PRD 的 Analysis scratch 前置约束。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 10.1, lines 1930-1945 | UI 通过 `workbenchStore.activeTab + trainingRuntimeStore -> TrainingWorkbenchContainer -> choose panel by tab.mode` 回流；四个 mode 各自投影到对应 panel。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | 0, lines 1-31 | UI/UX spec 不替代 PRD 或 Architecture 的产品与架构真源；Workbench 可见模式固定为四个；顶部展示四段 mode segmented control。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | 2, lines 143-172 | Mode segmented control 文案是 `[对局模式][做题模式][回忆模式][复盘模式]`；右侧动作按 mode 切换；Snapshot 是全局可发现入口。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | 9.2-9.4, lines 859-884 | 点击顶部模式标签只切换工作视图，不销毁棋谱状态；Analysis 从 Play/Problem/Recall 临时进入，返回时恢复上一个 mode 上下文；UI 必须与 Architecture v0.5 状态机表一致。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | 13, lines 986-1017 | `ModeSegmentedControl` 位于 `TopToolbar`，`ToolGroup` 位于底部；UI 仅提供控件位置和可见状态，不拥有业务状态。 |

### 0.1 Guardrail / Clarification / Evidence

| 非真源上下文 | 类型 | 行索引 | 用法限制 |
| --- | --- | --- | --- |
| `AGENTS.md` | repository guardrail | lines 34-45 | 约束 WorkbenchMode 父状态机、child region 不反写 mode、测试验证最终 outcome。不得覆盖 active PRD/Architecture/UI truth。 |
| `docs/design/workbench-mode-orchestration-contract.md` | implementation clarification | lines 56-71, 124-146, 176-211, 227-239 | 用于理解当前迁移意图、overlay owner、非法 action 风险和已知 gap；不是 authoritative source truth。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | implementation clarification | lines 21-28, 63-90, 92-136, 192-220 | 用于 child-region owner、resolver read-only、outcome-based 测试策略；不得引入未被 PRD/Architecture 支持的新业务事实。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` | derived scope / gate ledger | lines 20-27, 38-76 | 只限定本轮 step1 scope：overlay first vertical slice、runtime/scratch/diagnostics 后续拆分、写入锁。不是产品或架构真源。 |
| `src/modules/overlays/overlayStore.ts` | current implementation evidence | lines 18-84, 138-223, 234-329 | 只用于判断测试现状：当前 owner、subscriber、Analysis guard、generation cleanup 已存在或缺测。 |
| `test/overlays/overlayStore.test.js` | current test evidence | lines 47-93 | 只证明现有测试覆盖非 analysis reject 和部分 mode change cleanup；未完整覆盖 subscriber 或 late async。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | current implementation evidence | lines 619-717, 760-918 | 只证明当前 flow service patch mode 并调用 mode effects；尚无显式 overlay child-region transition port。 |

### 0.2 Source Row Coverage

| Source Row | Required Behavior | Test ID | Layer | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PRD 5.2 four Workbench modes, lines 237-253 | Overlay slice must not introduce a fifth mode or treat problem/checkpoint/review/punishment as board modes. Overlay region receives `fromMode/toMode` from the four-mode parent only. | OVR-T03 | ARCHITECTURE_BOUNDARY | RED | Existing mode tests cover parts of transition policy, but no overlay boundary test yet proves the overlay API cannot mutate or create Workbench modes. |
| PRD 5.2 + 6.3.6 Snapshot scratch constraints, lines 255-269 and 560-574 | Snapshot from Play/Problem/Recall must not directly create Problem; overlay cleanup must not call snapshot APIs or capture live mutable source. | OVR-D06 | SIDE_EFFECT_BOUNDARY | DEFERRED | Approved reason: snapshot tightening is outside overlay step1 unless touched. Exit condition: if step1 modifies snapshot path, add failing test before implementation; otherwise cover in analysis scratch/snapshot gate. |
| Architecture 0.3 command boundary, lines 89-116 | UI emits commands; Container/Controller calls Service; Service writes Store/Repository/Adapter; Store never calls Service; overlay child region does not call training services. | OVR-T03, OVR-T08 | ARCHITECTURE_BOUNDARY / CONTAINER_DELEGATION | RED / DEFERRED | T03 is required for overlay imports/API. T08 is conditional because this slice should not edit UI/container; activate if handler plumbing changes. |
| Architecture 1.2 write path, lines 180-209 | Successful Workbench commands must flow through `TrainingWorkbenchContainer -> workbenchFlowService -> workbenchStore/overlay owner`; no Container direct store cleanup. | OVR-T04, OVR-T05 | SIDE_EFFECT_BOUNDARY | RED | The flow service is the production service boundary; do not label these controller transition tests. |
| Architecture 0.4 `enterAnalysis`, lines 140-141; 5.3 lines 752-756, 793-794 | `enterAnalysis` from play/problem/recall saves `AnalysisReturnTarget`, sets mode analysis, and informs overlay region without auto-enabling territory/compare. | OVR-T09 | SIDE_EFFECT_BOUNDARY | RED | Existing tests cover return target; they do not prove overlay transition owner notification or no auto-enable through the v0.5 path. |
| Architecture 0.4 `analysis -> return`, lines 142, 154; 5.3 lines 758-760, 795 | `returnFromAnalysis` restores saved target and clears analysis-only overlay via overlay owner after successful transition. | OVR-T04 | SIDE_EFFECT_BOUNDARY | RED | Existing flow tests cover tab restoration only; overlay child-region integration is absent. |
| Architecture 0.4 `analysis -> restartAttempt`, line 143; 5.3 lines 762, 786-787 | `restartAttempt` from Analysis creates/resets attempt context and leaves Analysis; overlay region must clear territory/compare on the same successful transition. | OVR-T05 | SIDE_EFFECT_BOUNDARY | RED | If implementation path requires attempt/repository work, use typed fakes or in-memory repository fake; do not per-file handwrite production service mocks. |
| Architecture 3.4 overlayStore owner, lines 412-430 | `overlayStore` owns display overlay state only and must not call recall checkpoint, bad move logic, repository, engine service, UI, or Workbench mode writers. | OVR-T01, OVR-T02, OVR-T03 | STORE_SUBSCRIPTION / SIDE_EFFECT_BOUNDARY / ARCHITECTURE_BOUNDARY | RED | T01/T02 are not GREEN because existing automated tests do not fully cover subscriber and late async rows. |
| UI/UX TopToolbar segmented control, lines 143-172, 986-996 | Visible mode control is a UI surface only. It must emit semantic mode command and cannot itself write overlay/store state. Visual selected state is not accepted as business proof. | OVR-T08, OVR-D05 | CONTAINER_DELEGATION / RENDERED_UI_RETURN | DEFERRED | No UI production change in step1. Activate projection/rendered tests only if control props, selected state, or subscription path changes. |
| Slice-plan step1 overlay boundary gap, lines 20-27, 40-45, 70-75 | Step1 must introduce or test a parent-to-overlay child-region transition owner so Workbench flow no longer relies on legacy `sabaki.setMode` overlay cleanup. | OVR-T04, OVR-T05, OVR-T06, OVR-T09 | SIDE_EFFECT_BOUNDARY | RED | This is derived scope evidence, not source truth. It defines the first vertical slice because overlay has clear owner and concrete cleanup outcome. |

## 1. 用户故事

作为训练工作台用户，我可以从 Play/Problem/Recall 进入 Analysis 做自由研究，并从 Analysis 返回原 mode 或重启 attempt。无论我怎样离开 Analysis，territory/compare overlay 都不会残留到 Play/Problem/Recall；如果 ownership/engine capability 结果晚到，也不能重新点亮已经失效的 overlay。Overlay child region 只管理 overlay transient/cache state，不改变 WorkbenchMode、Attempt、RecallSession、Task、Snapshot、Repository 或 SGF tree。

## 2. 用户动作

1. 点击顶部 mode segmented control 的 Analysis segment，或点击当前 mode 的 `进入复盘` action，触发 `enterAnalysis`。
2. 在 Analysis 中点击 previous mode segment 或 `返回上一个模式` action，触发 `returnFromAnalysis`。
3. Recall 完成后进入 Analysis，触发 `completeRecall` 的 mode transition；runtime cleanup 不属于本 slice。
4. 在 Analysis 中触发 `restartAttempt` 并离开 Analysis，overlay 必须清理。
5. 在 Analysis 中切换 territory / compare；在非 Analysis 中同类命令必须被禁用或被 overlay owner 拒绝。
6. `ensureAnalysisReady({requireOwnership:true})` 或 ownership promise 在用户离开 Analysis 后才 resolve。

上游调用签名证据：

| 调用方 | 真实调用签名 | 证据 | 假绿风险 |
| --- | --- | --- | --- |
| `ModeBar` | `onClick: () => onModeChange(key)`，其中 `key` 是 mode string。 | `src/components/workbench/shell/ModeBar.js:62` | 测试不得按 `(mode, event)` 或事件对象调用 `onModeChange`。 |
| `WorkbenchShell` | `h(ModeBar, {activeMode: mode, onModeChange, ...})` | `src/components/WorkbenchShell.js:139` | Shell 只透传 callback，不拥有 mode state。 |
| `TrainingWorkbenchContainer.handleModeChange` | `handleModeChange(mode)`，内部映射为 `flowService.enterAnalysis(activeTab.id, {reason:'manual'})` 或 `flowService.returnFromAnalysis({tabId, reason:'return'})`。 | `src/components/TrainingWorkbenchContainer.js:117-133` | 只断言 callback 被调用不能证明 overlay cleanup；state-forward 必须测真实 flow service 和 overlay owner outcome。 |

## 3. 当前阶段

当前阶段是 Workbench parent mode transition 与 Overlay child region 的第一条垂直切片。`play`、`problem`、`recall`、`analysis` 是 WorkbenchMode，不是棋盘 mode；`problem` 不是 board mode；checkpoint/review/punishment 不新增 mode。

本 slice 不改变 `modeTransitions.ts` 的 pure policy，不把 overlay 规则塞进 `modeStateResolver`，不让 `TrainingWorkbenchContainer` 直接调用 overlay cleanup，也不让 `workbenchFlowService` 拥有 overlay state。目标是在成功 mode transition 后由 `workbenchFlowService` 通知 typed overlay child-region owner/adapter，owner 通过真实 `overlayStore` 处理 territory/compare cleanup、generation invalidation 和 notification。

## 4. 位置源

| Mode / State | 相关位置源 | 本 slice 约束 |
| --- | --- | --- |
| `play` | `game-tree` | territory/compare off；本 slice 不改变落子、导航、game-tree mutation 或 Attempt append。 |
| `problem` | `problem-attempt` over current problem position | territory/compare off；本 slice 不改变 problem runtime、Attempt 或 passRule。 |
| `recall` | recall answer/reference position，source Attempt read-only | territory/compare off；本 slice 不改 RecallSession/RecallAttempt/checkpoint。 |
| `analysis` | `scratch/current`；可带 `reference/current` compare source；legacy game-tree analysis source 仍存在 | territory/compare commands are allowed only through overlay owner. Scratch lifecycle and source isolation are deferred to step2.2. |
| late async ownership result | overlay generation tied to pending capability request | Leaving Analysis invalidates generation so late results cannot revive overlay or schedule stale analysis work. |

## 5. 变更契约

| Contract | 是否适用 | 说明 |
| --- | --- | --- |
| `playMove` | 不适用 | 本 slice 不处理棋盘落子。 |
| `scratchEdit` | 不适用 / DEFERRED | Analysis scratch workspace lifecycle 属于 step2.2；本 slice 不写 scratch。 |
| `recallAnswer` | 不适用 | Recall answer/checkpoint 属于 recall services，不由 overlay child region 管理。 |
| `variationMove` | 不适用 | 显式 game-tree variation move 不在本 slice。 |
| `无变更` | 适用 | Overlay toggle/cleanup 不改变 domain facts、Repository、Attempt、RecallSession、Task、Snapshot 或 SGF tree。 |
| `overlayRegionTransition` | 适用 | 成功 `WorkbenchTab.mode` 变化后，`workbenchFlowService` 通知 overlay child-region owner/adapter，例如 `onWorkbenchModeTransition({tabId, fromMode, toMode, reason, beforeTab, afterTab})`。名称可变，但 typed boundary 与语义必须成立。 |

## 6. 预期状态流

### 6.1 Mode segmented control / action 进入 Analysis

```text
UI event
-> ModeBar.onClick()
-> callback prop onModeChange(key)
-> WorkbenchShell passes callback unchanged
-> TrainingWorkbenchContainer.handleModeChange(mode)
-> getModeTransitionAction(...) resolves 'enterAnalysis'
-> controller command boundary: no separate controller in current path; Container invokes workbenchFlowService command
-> workbenchFlowService.enterAnalysis(tabId, {reason:'manual'})
-> assertTransition(tab, 'enterAnalysis')
-> workbenchStore.updateTab({mode:'analysis', previousMode, analysisReturnTarget, analysisContext})
-> overlay child-region owner receives {fromMode:'play'|'problem'|'recall', toMode:'analysis', reason}
-> overlayStore remains territoryEnabled=false and territoryCompareEnabled=false by default, but now accepts later Analysis overlay commands
-> legacy ModeEnterEffect may create/schedule Analysis scratch (temporary migration seam)
-> workbenchStore subscriber and overlayStore subscriber/notifyChange fire as applicable
-> TrainingWorkbenchContainer projection reads active tab and overlay state
-> WorkbenchShell / toolbar props show mode='analysis' with overlay controls not selected until user toggles them
```

`enterAnalysis` must not auto-enable territory inside `workbenchFlowService`. If legacy `sabaki.setMode('analysis')` still auto-enables territory, that is a legacy mode-effect seam and must not become the v0.5 Workbench flow contract.

### 6.2 Analysis return / exit

```text
UI event
-> ModeBar.onClick(previousMode) or Return action
-> callback prop onModeChange(key) / onReturnFromAnalysis()
-> TrainingWorkbenchContainer.handleModeChange(mode) or handleReturnFromAnalysis()
-> workbenchFlowService.returnFromAnalysis({tabId, reason:'return'})
-> assertTransition(tab, 'returnFromAnalysis')
-> workbenchStore.updateTab({
     mode: analysisReturnTarget.mode,
     recallSubstate,
     currentTreePosition,
     previousMode: undefined,
     analysisReturnTarget: undefined
   })
-> overlay child-region owner receives {fromMode:'analysis', toMode: target.mode, reason:'return'}
-> overlayStore clears territoryEnabled and territoryCompareEnabled
-> overlayStore bumps/invalidates generation for pending ownership checks
-> overlayStore emits notifyChange and subscriber callbacks
-> projection reads overlay flags false
-> UI no longer renders territory/compare as selected
```

If transition is rejected before the tab update, overlay child region must not be notified and overlay state must not be cleared as a side effect of a failed command.

### 6.3 Restart attempt from Analysis

```text
UI event / command
-> TrainingWorkbenchContainer or command owner invokes workbenchFlowService.restartAttempt(tabId)
-> workbenchFlowService computes target mode from analysisReturnTarget/previousMode/task
-> workbenchStore.updateTab({mode: targetMode, previousMode: undefined, analysisReturnTarget: undefined})
-> overlay child-region owner receives {fromMode:'analysis', toMode: targetMode, reason:'restart-attempt'}
-> overlayStore clears territory/compare and invalidates pending checks
-> workbenchStore + overlayStore subscriptions propagate final state
```

If this path later performs real attempt/repository creation, that work belongs to the production service/repository boundary and tests must use typed interfaces or in-memory repository fakes, not per-file handwritten production service mocks.

### 6.4 Late async result

```text
Analysis mode
-> overlayStore.setTerritoryEnabled(true) or setTerritoryCompareEnabled(true)
-> overlayStore records intent and starts ensureAnalysisReady({requireOwnership:true}) with generation N
-> user leaves Analysis through workbenchFlowService
-> overlay child-region owner calls overlayStore transition cleanup
-> generation becomes N+1 and overlay flags become false
-> ensureAnalysisReady resolves late
-> callback sees stale generation or disabled flag
-> no territory/compare revive
-> no stale scheduleEditWorkspaceAnalysis/analyzeMove/captureEditReference side effect
```

### 6.5 Temporary Migration Seams

| Segment | Current status | Exit condition |
| --- | --- | --- |
| Analysis scratch enter/exit | `ModeEnterEffect` / `ModeExitEffect` adapts legacy Sabaki workspace | step2.2 introduces scratch-region target/generation semantics and owns workspace lifecycle. |
| Runtime companion cleanup | Runtime fields are still cleaned in flow/runtime services | step2.1 routes `problemView/recallView/activeCheckpoint/correctionDraft` cleanup through runtime-region owner. |
| Engine target isolation | Game-tree live analysis and scratch analysis still need explicit target/generation contract | step2.2 covers scratch/engine target isolation; split a dedicated engine-region gate only if step2.2 cannot own the engine target writes cleanly. |
| `modeStateResolver` production diagnostics | Read-only helper exists; production flow does not consume it as pre/postflight diagnostics in this slice | step2.3 adds diagnostics/reject policy without writer behavior. |
| Rendered UI selected state | No new visual placement in this slice | Activate projection/rendered/visual tests only if implementation changes overlay state shape, toolbar props, selected state, or subscription path. |

## 7. 允许的副作用

1. `workbenchFlowService` may update `WorkbenchTab.mode`, `previousMode`, `analysisReturnTarget`, `analysisContext`, `recallSubstate`, and `currentTreePosition` through `workbenchStore` when a transition succeeds.
2. `workbenchFlowService` may notify an injected/owned overlay child-region transition port after a successful mode-changing transition.
3. Overlay child region may mutate only overlay transient/cache state: `territoryEnabled`, `territoryCompareEnabled`, existing info overlay cleanup if already part of owner behavior, internal generation, and overlay notifications.
4. Overlay child region may log structured transition/cleanup/stale-ignored events, but logs are not primary test oracle.
5. Existing `ModeEnterEffect` / `ModeExitEffect` may continue to adapt legacy Sabaki analysis workspace until step2.2.

## 8. 禁止的副作用

1. Overlay child region must not call `workbenchStore.updateTab`, `workbenchFlowService`, `sabaki.setMode`, `snapshotService`, repository, DB, engine service, UI APIs, or `window.sabaki`.
2. Overlay child region must not mutate `WorkbenchMode`, `Attempt.userLine/result/status`, RecallSession, RecallAttempt, RecallCheckpoint, Task/Problem, Snapshot inputs, MoveEvaluation/BadMove, SGF tree, comments, or review schedule.
3. `workbenchFlowService` must not directly manipulate overlay internals beyond invoking the owner/adapter command.
4. Non-analysis overlay commands must not trigger `ensureAnalysisReady`, `analyzeMove`, `scheduleEditWorkspaceAnalysis`, `captureEditReference`, repository writes, or snapshot capture.
5. Late/pending overlay async result after leaving Analysis must not revive `territoryEnabled` or `territoryCompareEnabled`.
6. This slice must not introduce `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` as new main path, nor branch workflow by `origin.provider`, old `source`, or `kind`.

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| OVR-C01 | STATE | MUST_AUTOMATE | In real `overlayStore`, territory/compare commands are rejected outside Analysis and leave flags false without analysis side effects. | Prevents analysis ownership from leaking into Play/Problem/Recall. | Non-analysis screens display stale ownership or schedule analysis for wrong target. |
| OVR-C02 | STATE / SIDE_EFFECT | MUST_AUTOMATE | In real `overlayStore`, leaving Analysis clears territory/compare and notifies subscribers when state changes. | Locks owner responsibility before flow integration. | Cleanup may depend only on legacy `sabaki.setMode`. |
| OVR-C03 | SIDE_EFFECT | MUST_AUTOMATE | A pending `ensureAnalysisReady` result cannot revive territory/compare or schedule analysis after `onModeChange(nonAnalysis)`. | Primary async safety guarantee. | Late ownership result reopens overlay in Recall/Problem. |
| OVR-C04 | WIRING / STATE | MUST_AUTOMATE | `workbenchFlowService.returnFromAnalysis` uses real flow + store and notifies overlay owner so final state is restored target mode and overlay false. | Proves parent-to-child boundary, not only overlay unit behavior. | Fake green where overlay unit tests pass but Workbench transitions never call owner. |
| OVR-C05 | WIRING / STATE | MUST_AUTOMATE | `workbenchFlowService.restartAttempt` or equivalent non-return Analysis exit clears dirty overlay through the same child-region path. | Ensures cleanup is transition-boundary behavior beyond Return button. | Future mode transitions bypass overlay cleanup. |
| OVR-C06 | SIDE_EFFECT | MUST_AUTOMATE | Rejected/invalid mode transition does not notify overlay child region and does not clear overlay as a failed-command side effect. | Preserves command atomicity. | Failed command hides analysis state while mode remains unchanged. |
| OVR-C07 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Overlay region/store imports no Workbench service/store, repository, DB, engine service, UI module, or global Sabaki mode writer; public API cannot set mode. | Protects one-way parent-to-child ownership. | Overlay becomes hidden parent-mode writer. |
| OVR-C08 | WIRING | MUST_AUTOMATE | `workbenchFlowService.enterAnalysis` saves return target, transitions to Analysis, and invokes overlay region without auto-enabling territory/compare. | Covers Architecture enterAnalysis row for the overlay boundary. | Analysis entry may rely on legacy `sabaki.setMode` or silently enable overlay. |
| OVR-C09 | WIRING | MANUAL_ACCEPTANCE | Container callback path still maps `ModeBar.onModeChange(key)` to `flowService.enterAnalysis/returnFromAnalysis` with one mode argument. | Guards handler signature drift. | Tests may pass with a handler shape the UI never sends. |
| OVR-C10 | UI_BEHAVIOR | DO_NOT_TEST in this slice | Pixel/layout/button shape of segmented control and toolbar. | Visual fidelity is outside business/state slice. | Visual drift belongs to frontend visual workflow, not this contract. |
| OVR-C11 | STATE / SIDE_EFFECT | DEFERRED | Runtime cleanup, scratch lifecycle, engine target isolation, resolver diagnostics, rendered visual selected state, and Snapshot scratch enforcement. | Real risks owned by later steps or conditional activation. | Oversized first slice would mix overlay, runtime, scratch, engine, diagnostics, and visual work. |

## 10. 必须自动化的测试

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OVR-T01 | STORE_SUBSCRIPTION | `createOverlayStore` `onModeChange(nonAnalysis)` | Real `overlayStore`, real `subscribe` listener set, real `notifyChange` callback path | `getAppState`, logger, `ensureAnalysisReady`, analysis trigger callbacks | `local tiny stub` for stateless deps and single callbacks | Do not mock `overlayStore`; do not assert only logger calls | After territory/compare active in Analysis, `onModeChange('play'|'problem'|'recall')` sets both false and subscriber/notify path fires exactly as a state-change outcome. | OVR-T04 |
| OVR-T02 | SIDE_EFFECT_BOUNDARY | `createOverlayStore` async generation guard | Real `overlayStore`; controlled pending Promise for `ensureAnalysisReady` | `getAppState`, logger, analysis trigger callbacks | `local tiny stub` for Promise resolver and callbacks | Do not mock generation behavior; do not use fake timers as sole oracle | Enable territory or compare in Analysis, call `onModeChange(nonAnalysis)`, resolve pending promise, assert flags remain false and forbidden analysis callbacks are not called. | OVR-T04 |
| OVR-T03 | ARCHITECTURE_BOUNDARY | Overlay region/store module boundary | Real source files after implementation; production exported type/interface for overlay transition port | None, or filesystem scan helper | `real production interface/type` for port shape; scan helper may be local stateless helper | Do not monkeypatch `workbenchStore`, `flowService`, `window.sabaki`, or module loader | Overlay region/store has no non-type import of Workbench service/store, repository, DB, engine service, UI, or global Sabaki; public API cannot set mode. | OVR-T04, OVR-T09 |
| OVR-T04 | SIDE_EFFECT_BOUNDARY | `createWorkbenchFlowService(...).returnFromAnalysis` with overlay child-region port | Real `workbenchFlowService`, real `createWorkbenchStore`, real `overlayStore` or production overlay-region adapter | Repository/attempt/recall/snapshot/tab deps not exercised by this command; modeEffects no-op or typed adapter | `shared typed spy factory` or helper typed by `WorkbenchFlowServiceDeps`; overlay port fake must be typed by production interface | Do not mock `workbenchFlowService`; do not replace `workbenchStore.updateTab`; do not assert only "overlay callback called once" | Given analysis tab with `analysisReturnTarget.mode='play'|'problem'|'recall'` and overlay active, `returnFromAnalysis` results in restored tab state, cleared return target, and overlay flags false. | OVR-T07 or OVR-D05 |
| OVR-T05 | SIDE_EFFECT_BOUNDARY | Representative non-return Analysis exit in real `workbenchFlowService`, preferably `restartAttempt` from Analysis | Real `workbenchFlowService`, real `createWorkbenchStore`, real overlay owner/adapter | Minimum typed service/repository fakes required by chosen command path | `shared typed spy factory` or `in-memory repository fake`; no per-file handwritten production service replacement | Do not use legacy `sabaki.setMode` as state-forward path; do not mock the service under test | A successful transition from Analysis to a non-analysis target goes through overlay child-region cleanup and final overlay flags are false. | OVR-T07 or OVR-D05 |
| OVR-T06 | SIDE_EFFECT_BOUNDARY | Rejected transition path in real `workbenchFlowService` | Real `workbenchFlowService`, real `createWorkbenchStore`, real overlay owner/adapter | Typed minimal deps | `shared typed spy factory` or real production interface/type | Do not mock `assertTransition`; do not clear overlay directly in the command path | Invalid `returnFromAnalysis` from non-analysis or analysis-without-target throws/rejects; tab mode remains unchanged; overlay owner is not notified and overlay state remains unchanged. | not-covered: service atomicity is terminal for this slice |
| OVR-T07 | PROJECTION_RETURN | Overlay state projection to workbench props | Real projection/container path if touched by implementation | Existing shell/sabaki harness surface | `shared typed spy factory` for shell/sabaki harness | Do not claim `RENDERED_UI_RETURN` unless rendering actual Shell/Panel | DEFERRED unless implementation changes overlay state shape or projection. If activated, assert cleared overlayStore state projects to `territoryEnabled=false` and `territoryCompareEnabled=false` props. | OVR-D05 |
| OVR-T08 | CONTAINER_DELEGATION | `ModeBar -> WorkbenchShell -> TrainingWorkbenchContainer.handleModeChange` command mapping | Real component callback signatures if UI/container touched | Single semantic callback/service spy only | `local tiny stub` only for callback or typed service command spy | Do not assert state migration from a mocked flow service; do not call handler with invented `(mode,event)` signature | DEFERRED unless UI/container touched. If activated, one-arg `onModeChange(key)` maps to the correct `workbenchFlowService` command. | OVR-T04 / OVR-T09 |
| OVR-T09 | SIDE_EFFECT_BOUNDARY | `createWorkbenchFlowService(...).enterAnalysis` with overlay child-region port | Real `workbenchFlowService`, real `createWorkbenchStore`, real overlay owner/adapter | Mode effects no-op or typed adapter; repository/service deps not exercised by this command | `shared typed spy factory` or helper typed by `WorkbenchFlowServiceDeps`; overlay port fake typed by production interface | Do not mock `workbenchFlowService`; do not rely on `sabaki.setMode('analysis')`; do not assert callback-only | From play/problem/recall, `enterAnalysis` saves return target, sets tab mode analysis, invokes overlay owner with from/to modes, and leaves territory/compare false until user command. | OVR-T04, OVR-D02 |

测试状态:

| Test ID | 当前状态 | 说明 |
| --- | --- | --- |
| OVR-T01 | RED | Existing `test/overlays/overlayStore.test.js` partially covers clearing flags but does not fully cover the exact contract row because it does not assert the `subscribe` listener path and full notify outcome. If the new exact test passes immediately, treat it as newly added regression coverage, not pre-existing GREEN. |
| OVR-T02 | RED | No existing late-async/generation test covers stale `ensureAnalysisReady` after leaving Analysis. Current implementation appears intended to support it, but it is unproven by automated coverage. |
| OVR-T03 | RED | The overlay-region transition port/import boundary does not yet exist as a production boundary to test. |
| OVR-T04 | RED | Current `workbenchFlowService` restores tab state and calls mode effects, but has no explicit overlay child-region transition owner. |
| OVR-T05 | RED | Same integration gap as OVR-T04 for non-return Analysis exits. Use one representative path to keep step1 small. |
| OVR-T06 | RED | Must be written with the new overlay port to ensure rejected transitions do not notify or clear overlay. |
| OVR-T07 | DEFERRED | Approved reason: step1 changes service/child-region boundary, not projection shape. Exit condition: activate if overlay state shape, container overlay props, toolbar subscription path, or rendered selected state changes. |
| OVR-T08 | DEFERRED | Approved reason: no UI/container edit is assigned in step1. Exit condition: activate if ModeBar/Shell/Container handler plumbing changes or if contract audit requests command mapping proof. |
| OVR-T09 | RED | Existing enterAnalysis tests cover tab return target, not overlay owner notification/no-auto-enable in the v0.5 Workbench path. |

## 11. 仅手动验收

1. In the running app, enter Analysis, toggle territory or compare, return to Play/Problem/Recall, and verify selected overlay controls are no longer active.
2. Confirm entering Analysis still permits territory/compare commands after legacy scratch setup completes, but does not auto-select them through `workbenchFlowService`.
3. Inspect logs only as supporting evidence; logs must not be the main acceptance oracle.

Manual acceptance must not replace OVR-T04/OVR-T05/OVR-T09 state-forward tests.

## 12. 不测试

1. CSS, visual spacing, button shape, screenshot fidelity, or color tokens for the mode segmented control.
2. Exact logger text or logger call order.
3. Internal setter order inside `overlayStore`, unless ordering is required to prove stale async guard outcome.
4. Snapshot persistence, problem runtime cleanup, recall checkpoint lifecycle, analysis scratch workspace teardown, engine target isolation, modeStateResolver diagnostics, and rendered visual selected state in this slice.

## 13. 脆弱测试警告

1. Weak-test ban: "overlay callback called once" is not primary acceptance. It may only support command mapping; primary assertion must be final tab + overlay state.
2. Do not mock `workbenchFlowService` in state-forward tests. If flow is mocked, the layer is only `CONTAINER_DELEGATION`.
3. Do not use `sabaki.setMode` as the only route under test. It is a legacy adapter seam and already calls overlay cleanup; the target gap is Workbench v0.5 flow.
4. Do not require a specific method name if implementation uses a typed equivalent to `onWorkbenchModeTransition`; require input semantics and owner boundary.
5. Do not overfit to logger messages, numeric `generation`, or setter order. Assert stale outcome and forbidden callbacks.
6. Do not assert current dirty behavior as green. If a Workbench transition leaves territory/compare enabled after leaving Analysis, the test must be RED.
7. Handler tests must use the real upstream signature `onModeChange(key)`, not invented event payloads.
8. Do not let a single test claim callback delegation, real state migration, and rendered UI return unless it runs the full production chain. Split by layer.

## 14. 超出范围

| Deferred ID | Scope | Approved Reason | Exit Condition | Downstream Step / Test ID |
| --- | --- | --- | --- | --- |
| OVR-D01 | Runtime companion cleanup for `problemView`, `recallView`, `activeCheckpointId`, `correctionDraft` | Slice plan splits runtime companion region to step2.1; mixing it into overlay step would expand write scopes and obscure owner boundaries. | step2.1 contract introduces runtime-region owner, routes cleanup through that owner, and proves mode transitions update runtime projection without repairing persistent facts. | step2.1 / `RUN-T01` `RUN-T02` `RUN-T03` |
| OVR-D02 | Analysis scratch lifecycle: workspace create/destroy, scratch/current source, stale scratch result handling | Slice plan assigns scratch region to step2.2; overlay step only ensures overlay state does not revive. | step2.2 contract wraps ModeEnterEffect/ModeExitEffect with scratch-region target/generation semantics and tests scratch source no-write to source Attempt/tree. | step2.2 / `SCR-T01` `SCR-T02` |
| OVR-D03 | Engine target isolation between game-tree live analysis and scratch analysis | Approved as part of step2.2 if scratch target owns engine request target/generation. If target isolation requires broader engine ownership, step2.2 must split a named engine-region follow-up before implementation. | Exit when engine/analysis results carry target id/workspace id and stale or wrong-target results cannot write scratch, game tree, overlay, or Attempt. | step2.2 / `ENG-SCR-T01`; fallback follow-up `engine-region.contract` / `ENG-T01` |
| OVR-D04 | `modeStateResolver` production diagnostics / preflight-postflight usage | Slice plan assigns diagnostics to step2.3; resolver must remain read-only and cannot be used for repair in overlay step. | step2.3 contract consumes resolver snapshots before/after transition for reject/warn/log diagnostics only, with no store/service writes by resolver. | step2.3 / `DIAG-T01` `DIAG-T02` |
| OVR-D05 | Rendered UI / visual selected state for mode segmented control and territory/compare buttons | Step1 is a service/owner boundary slice and should not edit visual surface. | Activate if implementation changes overlay state shape, projection, toolbar props, subscription path, or visual selected state. `RENDERED_UI_RETURN` must render real Shell/Panel; visual fidelity belongs to frontend visual workflow. | conditional `OVR-T07`; visual workflow `VIS-OVR-T01` |
| OVR-D06 | Snapshot non-analysis scratch enforcement | PRD requires Analysis scratch/current source before Problem creation, but overlay step must not edit snapshot flow. | Activate if step1 touches `snapshotFromCurrentContext`, `snapshotService`, tab opening, or Analysis scratch source. Otherwise cover in scratch/snapshot contract after step2.2 target semantics exist. | future scratch/snapshot gate / `SNAP-T01` |

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 不允许；本契约不使用 | Architecture lines 89-110; UI/UX lines 15-17 | Overlay tests must not branch by origin/source/kind. Snapshot provenance remains outside step1. |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 不允许；本 slice 不打开 tab | UI/UX lines 15-17; Architecture lines 727-768 | Any tab opening in overlay tests is out of scope. |
| 是否让 `snapshotService` 承担 Architecture v0.5 未分配的 tab opening / flow orchestration | 不允许 | Architecture lines 1108-1163; PRD lines 560-574 | Snapshot deps in flow harness must remain unused for overlay tests. |
| 是否让 container 直接写 store，而不是通过 v0.5 指定 service | 不允许 | Architecture lines 180-209; Container evidence `TrainingWorkbenchContainer.js:117-133` calls flow service | Do not add `TrainingWorkbenchContainer -> overlayStore.onModeChange`. State-forward belongs to `workbenchFlowService -> overlay owner`. |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 不允许新增 | Architecture lines 89-98; UI/UX lines 986-1017 | UI may emit callbacks only. No UI edit is assigned in step1. |
| 是否让 overlay child region mutate WorkbenchMode | 不允许 | AGENTS.md lines 42-43; implementation notes lines 121-136 | OVR-T03 must fail on upward mode writer imports/API. |
| 是否让 `modeStateResolver` 写状态或 repair | 不允许；本 slice 不改 resolver | AGENTS.md lines 37-39; implementation notes lines 63-90 | Resolver diagnostics deferred to OVR-D04 / step2.3. |
| 是否把 `workbenchFlowService` 变成 overlay state bucket | 不允许 | implementation notes lines 121-124, 192-198 | Flow only sends transition intent; overlay owner handles cleanup. |
| 是否新增 Workbench runtime mode | 不允许 | PRD lines 237-253; AGENTS.md lines 30-32 | No review/checkpoint/punishment overlay mode. |
| 是否让 Analysis/Recall modify game tree or Attempt | 不允许 | PRD lines 243-269, 591-614, 1500-1523 | Overlay cleanup has no domain persistence writes. |
| 是否把 Architecture 9.7 全局 Snapshot 行覆盖 PRD scratch constraint | 不允许 | PRD lines 560-574 outranks Architecture lines 1883-1898 | Source coverage row OVR-D06 marks snapshot enforcement deferred but not contradicted. |
| 是否把 OVR-T04/OVR-T05 标成 controller 层 | 已修正 | Architecture lines 727-802 places `workbenchFlowService` at service/orchestration boundary | OVR-T04/OVR-T05 are `SIDE_EFFECT_BOUNDARY`; controller tests are separate and conditional. |

## 16. Workbench 接线清单（如适用）

### 16.1 控件清单

| 控件/区域 | 状态 | 说明 |
| --- | --- | --- |
| Mode segmented control | active with disabled policy | Visible four-mode surface. It emits `onModeChange(key)`; invalid transitions must be disabled or rejected by service. |
| Analysis segment / `进入复盘` action | active when transition is allowed | Maps to `workbenchFlowService.enterAnalysis`; does not directly enable overlay. |
| Previous mode segment / `返回上一个模式` action | active only in Analysis with saved return target | Maps to `workbenchFlowService.returnFromAnalysis`; overlay cleanup happens through child region owner. |
| Territory toggle | active in Analysis, disabled/rejected outside Analysis | Owner is overlayStore/overlayRegion; non-analysis command must not trigger engine/analysis side effects. |
| Territory compare toggle | active in Analysis with comparison source, disabled/rejected outside Analysis | Owner is overlayStore/overlayRegion; leaving Analysis clears it. |
| Snapshot button | deferred for this slice | Globally discoverable, but PRD requires Analysis scratch/current source before Problem creation. |
| Overlay status/selected state | display-only / conditional test | State returns through overlayStore subscription/projection; visual fidelity is deferred unless projection changes. |

### 16.2 命令与状态回流清单

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ModeBar Analysis segment | `enterAnalysis` | Presentational emits `onModeChange(key)`; Container maps; `workbenchFlowService` owns transition | Architecture lines 180-209, 727-802; UI/UX lines 143-172 | `workbenchStore.updateTab({mode:'analysis', previousMode, analysisReturnTarget})`; overlay region notified with toMode analysis | workbench subscriber projects mode; overlay flags remain false/eligible | OVR-T09; OVR-T08 conditional | controller/service |
| ModeBar previous segment / Return action | `returnFromAnalysis` | Container -> `workbenchFlowService` -> overlay child region | Architecture lines 142-158, 758-802 | Mode restored, return target cleared, overlay owner clears territory/compare | workbenchStore + overlayStore subscriptions; projection sees overlay false | OVR-T04 | controller/service + overlay |
| Restart attempt from Analysis | `restartAttempt` | `workbenchFlowService`; attempt/repository owner only if path creates attempt | Architecture lines 143, 762, 786-787 | Leaves Analysis to play/problem; overlay owner clears territory/compare | overlay false; tab target mode projected | OVR-T05 | controller/service |
| Territory toggle | `setTerritoryEnabled/toggleTerritoryEnabled` | `overlayStore` / overlayRegion owner | Architecture lines 412-430; PRD four-mode constraint | Analysis only: overlay true and pending capability check; non-analysis rejected; exit clears | overlay subscription/projection | OVR-T01/OVR-T02 | overlay tests |
| Territory compare toggle | `setTerritoryCompareEnabled/toggleTerritoryCompareEnabled` | `overlayStore` / overlayRegion owner | Architecture lines 412-430; PRD scratch/source constraints | Analysis with reference/current: compare true; non-analysis rejected; exit clears | overlay subscription/projection | OVR-T01/OVR-T02 | overlay tests |
| Snapshot button | `snapshotFromCurrentContext` | `workbenchFlowService` orchestration; `snapshotService` captures only | PRD lines 560-574; Architecture lines 1108-1163 | DEFERRED; must not couple to overlay region | DEFERRED | OVR-D06 | scratch/snapshot branch |

### 16.3 订阅契约

| Store / Source | 必须触发的更新 | 本 slice 断言 |
| --- | --- | --- |
| `overlayStore.subscribe` / `notifyChange` | territory/compare cleanup after leaving Analysis must notify subscribers when state changes | OVR-T01 and OVR-T04/T05 assert final overlay state plus notification path where observable. |
| `workbenchStore` subscription | `mode`, return target, and current tree position updates must re-project through `TrainingWorkbenchContainer` | OVR-T04/T05/T09 assert store state; projection/rendered return is OVR-T07/OVR-D05 conditional. |
| `trainingRuntimeStore` subscription | Runtime companion cleanup is not owned by overlay step | OVR-D01 deferred to step2.1. |
| Legacy Sabaki mode/effects | May still adapt scratch workspace during migration | OVR-D02 deferred; step1 tests must not use legacy `sabaki.setMode` as the primary state-forward path. |

### 16.4 弱测试禁令

`callback called once`、`overlay port called once`、logger text、setter order、class/data-testid presence are insufficient as primary acceptance. They may only support command mapping. The primary proof for step1 is final production state: tab mode/return target and overlay flags, with forbidden side effects absent.

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| contracts/docs | `docs/archive/daily-design/.../overlay-region/test-contract-v0.2.md` | audit v0.1 | Read-only source alignment and contract rewrite | Low; do not edit checklist in this agent. |
| overlay owner tests | `test/overlays/*` | Contract OVR-T01/OVR-T02 | Uses real `overlayStore`; no flow service edits | Low; needs controlled Promise helper. |
| flow integration tests | `test/training/workbenchFlowService*` or focused test | Production overlay-region port shape or expected RED compile | Tests real flow/store integration and owns service-layer assertions | Medium; shared typed spy/fake policy must be followed. |
| architecture boundary test | focused architecture/static test | Production file names after implementation | Disjoint from behavior tests | Low; avoid brittle text scans beyond import/API boundary. |
| implementation overlay region | `src/modules/overlays/*` | After tests | Owner state changes local to overlays | Medium if API name drifts from tests; use production type. |
| implementation flow wiring | `src/modules/training/workbench/workbenchFlowService.ts` | After overlay region port exists | Central shared transition point for parent mode changes | High; centralize notification to avoid missed transition path. |
| runtime region follow-up | `src/modules/training/store/trainingRuntimeStore.ts`, runtime-region files | After step1 | Separate transient companion owner | Medium with shared `workbenchFlowService` integration; use step3 if conflicts. |
| scratch/engine follow-up | `src/modules/analysis/*`, engine target integration | After step1 | Separate scratch target/generation owner | Medium/high; may require engine-region split. |
| diagnostics follow-up | `modeStateResolver.ts`, flow diagnostics tests | After step1 | Read-only diagnostics can be independently contracted | Medium due shared flow integration. |
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
3. Successful `WorkbenchTab.mode` changes in `workbenchFlowService` should use one local helper or equivalent centralized path so overlay notification is not missed. If a path is intentionally excluded, document why and add a deferred row.
4. Overlay owner/adapter must delegate to real `overlayStore` behavior for cleanup and stale generation; it must not duplicate overlay state outside `overlayStore`.
5. Do not make `modeTransitions.ts` run effects or import overlay modules.
6. Do not make `modeStateResolver.ts` repair overlay state in this slice.
7. Do not make `TrainingWorkbenchContainer` call `overlayStore.onModeChange` directly.
8. Do not test by mocking `workbenchFlowService`; tests that prove state-forward must instantiate the real service.
9. If a production service/controller/store/repository is faked, use a production interface/type, shared typed spy factory, or in-memory fake. No per-file handwritten replacement for `WorkbenchFlowService`, `SnapshotService`, repository ports, or overlay-region port.
10. Existing dirty worktree changes outside this archive document are unrelated and must not be reverted or included by downstream agents unless explicitly assigned.
