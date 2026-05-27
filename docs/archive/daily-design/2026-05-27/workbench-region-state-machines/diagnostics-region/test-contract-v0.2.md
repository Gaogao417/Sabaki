Date: 2026-05-27
Status: revised-for-contract-audit

# 契约草案

本契约修订 `diagnostics-region/test-contract-v0.1.md`，用于 `step2.3.contract retry1`。本轮可执行范围只限于：

- `modeStateResolver.ts` 现有 projection / invariant diagnostics 的契约测试。
- `modeStateResolver.ts` 或同职责纯 helper 中的 preflight/postflight diagnostics classifier 测试。
- 不写 `workbenchFlowService.ts` 生产集成；该共享文件由 `step3.integration` 串行处理。

状态含义：

- `GREEN` 只表示当前仓库已经存在自动化测试，并且该测试完整覆盖本行契约。
- 如果当前实现看起来已经满足，但仍需要 test-writer 新增或扩展自动化测试，必须标记为 `RED`，并在 Notes 写 `implementation evidence: likely green`。
- `DEFERRED` 表示本轮不执行，必须在 deferred ledger 或 Notes 中写明激活条件。

## 0. 真源对齐

优先级固定为：`docs/product/` > `docs/architecture/` > `docs/ui_ux/`。`docs/design/*`、`AGENTS.md`、当前源码、slice plan、checklist 都是 guardrail / evidence / scope ledger，不覆盖 active truth。若派生产物与 active truth 冲突，派生产物作废。

提示中的 “PRD v0.5” 与当前仓库 active PRD 存在版本命名差异：`docs/product/sabaki-training-prd.md` lines 8-25 声明当前 PRD 是 v0.7 合并修正版，Architecture 仍是 v0.5。因此本契约按 active PRD v0.7 + Architecture v0.5 执行。

### Active Source Truth

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | lines 8-25 | 当前 PRD 定义产品目标、训练闭环、数据对象和验收方向；产品能力边界以 PRD 为准。 |
| `docs/product/sabaki-training-prd.md` | lines 41-54, 116-131 | 产品闭环是 Play -> Submit/freeze Attempt -> Recall -> RecallCheckpoint -> Analysis -> Snapshot -> Problem；`TrainingAttempt.userLine` 提交后冻结，后续 Recall/Analysis/Review 引用事实但不反向改写。 |
| `docs/product/sabaki-training-prd.md` | lines 235-269 | Workbench 运行态 mode 只有 Play / Problem / Recall / Analysis；Problem entity、RecallCheckpoint、Review、Punishment Problem 不是新 mode；Snapshot 落库前必须经 Analysis scratch/current。 |
| `docs/product/sabaki-training-prd.md` | lines 321-330, 351-357 | Play/Problem 提交后冻结 Attempt、创建 RecallSession 并进入 Recall；Recall 输入是冻结 `TrainingAttempt.userLine`，不能改写已冻结 Attempt。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 14-25, 64-110 | 新架构围绕四个 WorkbenchMode；旧 `source_kind`、source-specific tab API 只能作为迁移背景；`TaskOrigin` 不参与流程判断；禁止 `snapshotService` 打开 Tab、按 `origin.provider` 分叉主流程。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 112-158 | Mode transition 必须收敛到可测试状态机；非法转换 reject/throw 并记录结构化日志；Snapshot 不修改当前 tab；Analysis 自由摆棋不写 `Attempt.userLine`。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 162-210 | 渲染读路径是 Store/Repository -> Container/ViewModel -> UI；命令写路径是 UI -> Controller/Container -> Service -> Store/Repository/Adapter -> Existing Core。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 473-563, 564-575 | `workbenchStore` 只拥有 tab/activeTab；写入者是 `workbenchTabService` / `workbenchFlowService`。`trainingRuntimeStore` 保存 transient runtime，不保存完整历史事实。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 682-725 | 新 tab 主路径只允许 `workbenchTabService.openTask`；不得新增 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API。 |
| `docs/architecture/position-source-mutation-contract.md` | lines 10-18, 27-43, 81-90 | ModeState / TransitionEffect 派生 PositionSource + MutationContract；合法 contracts 是 `playMove`、`problemAttemptMove`、`recallAnswer`、`scratchEdit`、`variationMove`。 |
| `docs/architecture/position-source-mutation-contract.md` | lines 109-170, 216-252, 254-263 | Problem/Recall/Analysis 的读写边界不同；resolver 必须纯读，写入进入 focused executor；Problem 是 first-class WorkbenchMode；Recall 默认 answer-focused 且不改 source Attempt。 |
| `docs/architecture/workbench-architecture-overview.md` | lines 103-124 | Mode orchestration 先于 source/contract；禁止绕过 `workbenchFlowService` 或同职责 service 直接 patch store。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | lines 1-31, 145-172 | UI/UX 只约束四个 mode 的控件位置、文案、Snapshot 可发现性和 RecallCheckpoint 同一 Recall surface；不替代 PRD/Architecture。 |

### Guardrail / Evidence / Scope Ledger

| 来源 | 角色 | 对本契约的使用方式 |
| --- | --- | --- |
| `AGENTS.md` | repository guardrail | 保护 resolver/store/service 边界、四个 WorkbenchMode、禁止隐藏 `window.sabaki`、禁止 resolver repair。若与 active docs 冲突，以 active docs 为准。 |
| `docs/design/workbench-mode-orchestration-contract.md` | design guardrail | 提供当前 state-machine guardrail、companion state 与 transition effects 术语；不覆盖 active PRD/Architecture/UI。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | implementation guardrail | lines 30-40, 63-90, 106-120, 190-219 支持 `modeStateResolver` 只读、preflight/postflight 可 reject/warn/log、不 repair。 |
| `src/modules/training/workbench/modeStateResolver.ts` | implementation evidence | lines 20-139 当前返回 legal projection / `ok:false`；lines 149-242 当前区分 `diagnostics[]` 与 `illegal[]`。不是产品事实来源。 |
| `test/training/modeStateResolver.test.js` | existing coverage evidence | lines 313-406 覆盖四 mode projection；lines 408-539 覆盖部分 illegal/diagnostics；lines 541-600 覆盖 purity/import boundary。仅用于判断哪些行可以标 `GREEN`。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | integration evidence | lines 221-242 flow factory 当前未注入 diagnostics resolver；lines 1086-1161 Snapshot 仍在 flow service 中 orchestration。生产集成不是 step2.3-local 范围。 |
| `src/modules/sabaki.js` | composition evidence | lines 1032-1044 当前生产 composition 注入 flow deps，但未注入 diagnostics deps。不是架构事实来源。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` | derived scope ledger | lines 42-46, 56-64 将 `workbenchFlowService.ts` 标为 shared integration point；step2.3 owns `modeStateResolver.ts`。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | derived workflow ledger | lines 28-40, 55 声明 step2.2/step2.3 parallel，shared `workbenchFlowService.ts` 留给 `step3.integration`。本契约不修改 checklist。 |

## 1. 用户故事

作为 Workbench mode transition 编排层，我希望在执行 mode command 前后消费 `modeStateResolver` 的只读结果，以便：

1. 在 preflight 阶段发现 active tab/runtime/overlay/scratch companion state 已经非法时拒绝 command，避免进一步污染 store、repository、Sabaki 或 child region。
2. 在只有 legacy/source mismatch 等 non-blocking diagnostics 时记录结构化诊断并允许 command 继续，避免把 migration diagnostic 误当成产品流程分支。
3. 在 postflight 阶段发现 transition 后仍不自洽时记录/暴露 invalid-after-commit，而不是由 resolver 或 diagnostics helper 自动修 runtime、overlay、scratch、Attempt、RecallSession 或 SGF。

## 2. 用户动作

本 slice 不新增 UI 控件或用户动作，只约束现有 semantic commands 的 invariant diagnostics。

| Command | 当前 owner | Diagnostics role |
| --- | --- | --- |
| `submit(tabId)` | `workbenchFlowService` | step3 preflight must reject illegal source state before freeze/finalize/create recall; step2.3 only defines resolver projection + pure decision policy. |
| `enterAnalysis(tabId, options)` | `workbenchFlowService` | step3 preflight checks source companion; postflight checks analysis scratch/current after explicit effects. |
| `returnFromAnalysis({tabId})` | `workbenchFlowService` | step3 preflight checks current analysis state; postflight checks restored mode companion. |
| `completeRecall(tabId)` | `workbenchFlowService` | step3 postflight checks analysis entry after recall completion; no resolver repair of RecallSession/Attempt. |
| `snapshotFromCurrentContext(tabId)` | `workbenchFlowService` | Snapshot remains analysis scratch/current based; diagnostics must not let `snapshotService` orchestrate tab opening or branch by source. |
| checkpoint commands | `workbenchFlowService` + `recallCheckpointService` | Checkpoint internals are out of scope except resolver may report `checkpoint-without-recall`. |

## 3. 当前阶段

Workflow stage: `step2.3.contract retry1` for `diagnostics-region`.

Workbench stages covered by diagnostics policy: `play`, `problem`, `recall`, `analysis`.

Current implementation evidence:

- `modeStateResolver.ts` already produces projections, `diagnostics[]`, and `illegal[]`.
- Existing `test/training/modeStateResolver.test.js` gives real automated coverage for the resolver projection/purity rows marked `GREEN`.
- `workbenchFlowService.ts` currently does not call `resolveModeState`.
- Step2.2 scratch region is parallel-active; any conflicting shared flow-service production edit is deferred to `step3.integration`.

## 4. 位置源

Diagnostics reads position/source shape only through explicit snapshots; it does not mutate any position.

| Source | In scope? | Contract |
| --- | --- | --- |
| `game-tree` | yes | Legal projection for Play and some Problem/Recall surfaces; diagnostics may report illegal companions but must not write formal SGF. |
| `scratch` | yes | Legal projection for Analysis `scratch/current` and Problem `scratch/problem-attempt`; diagnostics may report missing scratch/current in Analysis. |
| `problem-attempt` | yes | Read-only diagnostic source role for Problem/Recall attempt surfaces; cannot be collapsed into `playMove`. |
| `reference/current` | yes, read-only | Analysis compare/reference context may be observed via scratch projection; scratch target/generation behavior is step2.2/out of scope. |
| source/origin metadata | diagnostic only | `origin.provider` / old `source.kind/source_kind` may produce non-blocking diagnostics but must not select mode, command path, tab-opening API, or mutation contract. |

## 5. 变更契约

Primary change contract for diagnostics itself: **无变更**.

Step2.3-local may add a pure diagnostics decision helper, but it must not introduce a new mutation contract. If a command is allowed, the command continues to use its existing owner and mutation/effect contract.

| Command/effect | Underlying contract | Diagnostics rule |
| --- | --- | --- |
| Play/Problem submit | freeze/finalize Attempt + create Recall + mode `recall` | Step3 preflight illegal state rejects before persistence/service/region writes. Diagnostics-only state logs and continues. |
| Enter Analysis | `scratchEdit` target setup through analysis/scratch owner or legacy mode effects | Step2.3 defines pure policy; flow integration and shared `workbenchFlowService.ts` edit deferred to step3. |
| Return from Analysis | exit analysis effects + restore previous mode | Step3 postflight illegal state is invalid-after-commit, not auto-repair. |
| Snapshot | Analysis scratch/current -> Task -> child Problem tab | No direct live mutable snapshot persistence; no `snapshotService` tab orchestration; no source-specific tab API. |
| Resolver projection | `playMove`, `problemAttemptMove`, `recallAnswer`, `scratchEdit`, `variationMove` hints | Hints are read-only projection, not execution. |

### Diagnostics / Reject / Repair Distinction

| Term | Meaning | Allowed behavior | Forbidden behavior |
| --- | --- | --- | --- |
| Diagnostics | `resolveModeState(...).ok === true` with non-empty `diagnostics[]`, e.g. `legacy-mode-mismatch` or `source-mode-mismatch`. | Return allow decision and diagnostic codes for service-level structured logging; continue command using WorkbenchTab.mode as truth. | Reject only because legacy Sabaki mode or source/provider metadata disagrees; branch product flow by `origin.provider` or old `source.kind/source_kind`. |
| Reject | Preflight `resolveModeState(...).ok === false` because `illegal[]` is non-empty. | Return/throw deterministic transition invariant error before repository/service/region/store writes; preserve illegal codes. | Partially run freeze/create recall/snapshot/child region effects after preflight reject. |
| Invalid after commit | Postflight `resolveModeState(...).ok === false` after explicit transition effects completed. | Signal invalid-after-commit to caller/logger; leave state visible for owner/integration repair work. | Silently repair in resolver/policy; rollback by ad hoc store patches; hide invalid state by logger-only tests. |
| Repair | Mutating state to make invariant pass. | Only explicit owner services/regions may perform contracted transient cleanup during normal transition effects. | Resolver or diagnostics helper writes store, calls service, edits SGF, changes Attempt/RecallSession/Task/Problem/MoveEvaluation/BadMove/comment/review schedule, or calls Sabaki/engine/DB. |

## 6. 预期状态流

Step2.3-local executable path:

```text
explicit immutable test snapshot
-> resolveModeState(snapshot)
-> pure diagnostics classifier/helper
-> decision: allow | reject | invalid-after-commit
-> no store/service/repository/adapter/UI side effects
```

Step3 integration target, formally deferred:

```text
UI / Container command
-> workbenchFlowService.<command>
-> assertTransition / modeTransitions.resolveTransition
-> preflight snapshot from explicit deps
-> modeStateResolver.resolveModeState
-> if illegal: reject before writes
-> if diagnostics only: structured log and continue
-> service / adapter / repository / child-region effects
-> workbenchStore / runtimeStore / overlayStore / Sabaki adapter state
-> postflight snapshot from explicit deps
-> modeStateResolver.resolveModeState
-> if illegal: invalid_after_commit diagnostic, no repair
-> existing store subscriptions
-> TrainingWorkbenchContainer projection
-> UI state
```

Temporary migration seam:

- `workbenchFlowService.ts` currently does not consume `resolveModeState`.
- Exit condition: `step3.integration` wires preflight/postflight once, after step2.2 scratch owner and step2.3 diagnostics helper are reviewed.

Subscription contract:

- Step2.3 diagnostics policy does not subscribe to stores.
- Existing `workbenchStore.subscribe` and `runtimeStore.subscribe` drive UI return after allowed transitions.
- Preflight reject must not trigger store updates.
- Postflight invalid-after-commit must not create extra subscription paths or force UI repair.

## 7. 允许的副作用

1. Step2.3-local: none beyond returning pure values from resolver/helper.
2. Step3 integration: structured diagnostic/rejection logging from the flow/service boundary.
3. Step3 integration: deterministic throw/reject before writes on preflight illegal state.
4. Step3 integration: deterministic invalid-after-commit signal after a transition if postflight remains illegal.
5. Existing command effects when preflight allows the command: repository writes, store updates, child-region notifications, Sabaki adapter effects already owned by that command.

## 8. 禁止的副作用

1. `modeStateResolver.ts` or diagnostics policy writes any store, repository, DB, engine, overlay, Sabaki state, IPC, UI, or hidden global.
2. Resolver/policy calls `workbenchFlowService`, `workbenchTabService`, `snapshotService`, `attemptService`, `recallService`, `recallCheckpointService`, `problemFlowService`, engine, DB, or `window.sabaki`.
3. Resolver/policy clears `problemView`, `recallView`, checkpoint runtime, overlay territory/compare, editWorkspace, Attempt, RecallSession, Task/Problem, MoveEvaluation/BadMove, SGF tree, comments, or review schedule.
4. Diagnostics branch product flow by `origin.provider` or old source/kind fields.
5. `snapshotService` opens tabs or orchestrates mode flow.
6. UI components directly depend on diagnostics service/store/repository/Sabaki.
7. Step2.3 implementation makes production edits to shared `workbenchFlowService.ts`; shared flow edits are `step3.integration`.

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| DIAG-C01 | PURE_LOGIC / STATE | MUST_AUTOMATE | `resolveModeState` keeps legal projections for play/problem/recall/analysis, including position source, mutation contract hints, snapshot persist flag, and analysis scratch projection. | Proves diagnostics are grounded in current ModeState, not source metadata. | Flow integration could gate commands using stale or wrong projection. |
| DIAG-C02 | PURE_LOGIC / STATE | MUST_AUTOMATE | `resolveModeState` reports illegal companion states as `ok:false` + `illegal[]` and never repairs input. | These are preflight reject candidates. | Preflight could allow polluted state to perform more writes. |
| DIAG-C03 | ARCHITECTURE_BOUNDARY / SIDE_EFFECT | MUST_AUTOMATE | Resolver and diagnostics policy remain pure: no store/service/repository/engine/overlay/document/Sabaki/global/timer imports or calls, and no mutation of frozen input graphs. | Prevents diagnostics becoming hidden writer/repair path. | Fake-green tests could pass while resolver mutates state. |
| DIAG-C04 | ARCHITECTURE_BOUNDARY / PURE_LOGIC | MUST_AUTOMATE | `legacy-mode-mismatch` / `source-mode-mismatch` are diagnostics only; WorkbenchTab.mode remains truth and source/provider fields do not select mode or mutation contract. | Protects v0.5 source-origin demotion. | Old source/kind branching could re-enter v0.4 architecture. |
| DIAG-C05 | SIDE_EFFECT / ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | A pure diagnostics policy/classifier maps preflight `ok:false` to reject, preflight diagnostics-only to allow-with-diagnostics, postflight `ok:false` to invalid-after-commit, and never returns repair operations. | This is the step2.3-local production scope that can land without shared flow-service edits. | Test-writer might cover only projection and never lock consumption semantics. |
| DIAG-C06 | SIDE_EFFECT / STATE | MUST_AUTOMATE | Step3 preflight flow integration rejects illegal state before freeze/finalize/create recall/snapshot/region effects and before `workbenchStore.updateTab`. | Core behavioral guard. | Illegal state can still produce writes before diagnostics run. |
| DIAG-C07 | SIDE_EFFECT / STATE | MUST_AUTOMATE | Step3 postflight flow integration evaluates resulting snapshot after explicit transition/child-region effects; illegal result is surfaced without automatic repair. | Catches failed region synchronization without hiding it. | Transition may commit invalid state silently or be fixed by resolver. |
| DIAG-C08 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Step3 production composition passes explicit diagnostics deps/snapshot provider into flow; no `window.sabaki`, no hidden global, no source-specific tab APIs as new main path. | Ensures app path actually runs diagnostics. | Tests may cover manually constructed service while production remains no-op. |
| DIAG-C09 | STATE / WIRING | MUST_AUTOMATE | Step3 successful allowed transition still updates owner stores and existing subscriptions/projectors; diagnostics-only warnings do not suppress UI return. | Proves diagnostics did not break normal command loop. | App can reject invalid states but stop updating visible Workbench state. |
| DIAG-C10 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | No new UI diagnostics surface is required in this slice; existing UI updates only through successful transition store subscriptions. | Avoids expanding into UI redesign. | Reviewer might expect visible diagnostic UI that is out of scope. |
| DIAG-C11 | ARCHITECTURE_BOUNDARY | DO_NOT_TEST | Do not test exact logger message strings, setter order, or callback call counts as primary oracle. | Keeps tests contract-level. | Brittle tests pass/fail on implementation detail, not invariant behavior. |

### Source Row Coverage

| Source Row | Required Behavior | Test ID | Layer | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `docs/product/sabaki-training-prd.md` lines 235-253 | Runtime WorkbenchMode set remains exactly Play / Problem / Recall / Analysis; Problem entity, RecallCheckpoint, Review, Punishment Problem are not new modes. | DIAG-T01 | PROJECTION_RETURN | GREEN | Existing `test/training/modeStateResolver.test.js` lines 313-406 covers legal projections for all four modes. |
| `docs/product/sabaki-training-prd.md` lines 116-131 | Attempt is the durable fact; resolver projection must not turn Recall/Analysis into mutable Attempt writers. | DIAG-T01, DIAG-T03A | PROJECTION_RETURN | GREEN | Existing tests lines 351-378 assert Recall projects frozen `sourceAttempt` and no mutable companion attempt; lines 541-560 prove no input mutation. |
| `docs/product/sabaki-training-prd.md` lines 321-330 | Submit flow must freeze/finalize Attempt, create RecallSession, and enter Recall; diagnostics preflight must reject illegal state before those writes. | DIAG-T06 | SIDE_EFFECT_BOUNDARY | DEFERRED | Flow write ordering is step3 due shared `workbenchFlowService.ts` lock / step2.2 parallel risk. |
| `docs/product/sabaki-training-prd.md` lines 351-357 | Recall input is frozen `TrainingAttempt.userLine`; Recall may reference Game/Problem/BadMove but must not rewrite frozen Attempt. | DIAG-T01, DIAG-T03A | PROJECTION_RETURN | GREEN | Existing tests lines 351-378 and 541-560 cover projection and no resolver mutation. |
| `docs/product/sabaki-training-prd.md` lines 255-269 | Snapshot persistence must be through Analysis scratch/current, not direct Play/Problem/Recall live mutable context. | DIAG-T01B | PROJECTION_RETURN | RED | Existing tests cover Play false and Analysis true, but not full Play/Problem/Recall non-analysis matrix; implementation evidence: likely green via `modeStateResolver.ts` lines 61-62, 83-84, 105-106, 133. Flow persistence remains DIAG-T08 deferred. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` lines 14-25, 64-110 | Source/kind/provider metadata cannot choose product flow; no `snapshotService` tab opening or origin-provider branch. | DIAG-T04 | PROJECTION_RETURN | GREEN | Existing tests lines 506-539 assert WorkbenchTab.mode remains truth with source/provider mismatch diagnostics. Composition/API ban is DIAG-T08 deferred. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` lines 112-158 | Illegal transition/state must reject/throw and log; Snapshot does not mutate current tab; Analysis scratch does not write Attempt. | DIAG-T05 | SIDE_EFFECT_BOUNDARY | RED | Step2.3 must add/cover pure preflight/postflight classifier; implementation evidence: resolver already returns illegal vs diagnostics, but no classifier test exists. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` lines 112-158 | Real flow must consume diagnostics preflight/postflight around actual command effects. | DIAG-T06, DIAG-T07 | SIDE_EFFECT_BOUNDARY | DEFERRED | Deferred to step3 real flow/store/resolver integration. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` lines 162-210 | Command write path remains UI -> Container/Controller -> Service -> Store/Repository/Adapter; diagnostics cannot create store/UI side path. | DIAG-T03A, DIAG-T03B | ARCHITECTURE_BOUNDARY | GREEN | Existing tests lines 541-600 prove resolver no-mutation and no banned imports/calls. Flow-path proof is DIAG-T06/T09 deferred. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` lines 473-563, 564-575 | Stores own state/subscription only; workbench writes remain `workbenchTabService` / `workbenchFlowService`; runtime holds transient state only. | DIAG-T06, DIAG-T09 | SIDE_EFFECT_BOUNDARY | DEFERRED | Requires real flow/store integration in step3; step2.3-local must not edit stores. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` lines 682-725 | New main path must not introduce `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` or other source-specific tab APIs. | DIAG-T08 | ARCHITECTURE_BOUNDARY | DEFERRED | Existing legacy API may exist; step3 must prove diagnostics/composition introduces none and uses explicit `openTask` path. |
| `docs/architecture/position-source-mutation-contract.md` lines 10-18, 27-43, 81-90, 254-263 | ModeState derives PositionSource + MutationContract; Play=`game-tree/playMove`, Problem=`game-tree or scratch/problem-attempt/problemAttemptMove`, Recall=`game-tree or scratch/problem-attempt/recallAnswer`, Analysis=`scratch/current/scratchEdit`. | DIAG-T01 | PROJECTION_RETURN | GREEN | Existing tests lines 313-406 cover all four projections and mutation hints. |
| `docs/architecture/position-source-mutation-contract.md` lines 109-170 | Problem attempts must not reuse `playMove`; Recall must not mutate source Attempt; Analysis scratchEdit must not write current SGF tree. | DIAG-T01, DIAG-T03A | PROJECTION_RETURN | GREEN | Existing tests lines 330-349 assert Problem excludes `playMove`; lines 351-378 assert Recall frozen source Attempt; lines 541-560 cover resolver no-mutation. Executor write enforcement is outside this contract. |
| `docs/architecture/position-source-mutation-contract.md` lines 216-252 | Resolver remains pure and writes/effects move behind focused executor boundaries. | DIAG-T03A, DIAG-T03B | ARCHITECTURE_BOUNDARY | GREEN | Existing tests lines 541-600 cover no frozen input mutation and no banned store/service/import path in resolver. |
| `docs/architecture/workbench-architecture-overview.md` lines 103-124 | New behavior must pass through mode orchestration before source/contract and must not bypass flow service to patch store. | DIAG-T06, DIAG-T08 | ARCHITECTURE_BOUNDARY | DEFERRED | Requires step3 real flow/composition integration. |
| `docs/ui_ux/workbench-ui-ux-spec.md` lines 23-31, 145-154 | UI remains four-mode Workbench surface; diagnostics does not add a new visual mode or selector item. | DIAG-T01 | PROJECTION_RETURN | GREEN | Existing resolver tests cover four mode projections; no UI/CSS change is in scope. |
| `docs/ui_ux/workbench-ui-ux-spec.md` lines 23-31, 156-172 | RecallCheckpoint remains a Recall surface; Snapshot / enter-analysis / return actions remain existing command surfaces. | DIAG-T02A, DIAG-T09 | PROJECTION_RETURN | DEFERRED | Resolver already has checkpoint rows covered for projection, but rendered command return is only activated if step3 changes projection/render path. |

## 10. 必须自动化的测试

Step2.3 test-writer may land only tests whose production write scope is `modeStateResolver.ts` or a pure diagnostics helper in the same boundary, plus non-invasive boundary tests. Flow-service production integration tests are specified for step3 and must remain deferred until `step3.integration`.

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DIAG-T01 | PROJECTION_RETURN | `resolveModeState` legal mode projection | real `modeStateResolver.ts` | none; plain frozen snapshot values only | none | mocked resolver, stores, services, repository, Sabaki globals | Play/problem/recall/analysis snapshots return correct `mode`, `positionSource`, `allowedMutationContracts`, `snapshotPersistAllowed`, and analysis scratch projection. | DIAG-T06, DIAG-T07 |
| DIAG-T01B | PROJECTION_RETURN | `resolveModeState` snapshot affordance matrix | real `modeStateResolver.ts` | none; plain frozen snapshot values only | none | mocked resolver, flow service, snapshot service | Play/problem/recall return `snapshotPersistAllowed:false` + `snapshotNextStep:'enter-analysis'`; analysis with scratch/current returns `snapshotPersistAllowed:true`; analysis missing scratch/current returns invalid + false. | DIAG-T08 |
| DIAG-T02A | PROJECTION_RETURN | `resolveModeState` existing illegal companion diagnostics | real `modeStateResolver.ts` | none; plain frozen snapshot values only | none | mocked resolver, stores, services, repository, Sabaki globals | Existing covered illegal snapshots return `ok:false`, expected `illegal[].code`, and no repair side effects. | DIAG-T06, DIAG-T07 |
| DIAG-T02B | PROJECTION_RETURN | `resolveModeState` missing illegal companion matrix rows | real `modeStateResolver.ts` | none; plain frozen snapshot values only | none | mocked resolver, stores, services, repository, Sabaki globals | Missing problem attempt, missing recall view, missing frozen source attempt, and missing active tab return `ok:false`, exact illegal code, and no repair side effects. | DIAG-T06, DIAG-T07 |
| DIAG-T03A | SIDE_EFFECT_BOUNDARY | `resolveModeState` input purity | real `modeStateResolver.ts` | none; deep-frozen plain snapshot values only | none | mocked resolver, fake stores/services | Resolver does not mutate legal or illegal frozen input graphs. | DIAG-T05 |
| DIAG-T03B | ARCHITECTURE_BOUNDARY | `modeStateResolver.ts` import/call boundary | filesystem read of production file | none | none | per-file fake source, mocked resolver module | Source has no direct store/service/repository/engine/overlay/document/Sabaki/global/timer imports or calls. | DIAG-T08 |
| DIAG-T04 | PROJECTION_RETURN | `resolveModeState` source/provider diagnostics | real `modeStateResolver.ts` | none; plain frozen snapshot values only | none | mocked resolver, source-specific fake services | `origin.provider` or old `source.kind/source_kind` only emits diagnostics; WorkbenchTab.mode controls projection and mutation contract. | DIAG-T06 |
| DIAG-T05 | SIDE_EFFECT_BOUNDARY | Step2.3 pure diagnostics policy/classifier in `modeStateResolver.ts` boundary | real `resolveModeState` + real policy helper | none; plain frozen snapshot values only | none | mocked policy helper, mocked resolver, service/store/repository fakes | Preflight illegal => `reject`; preflight diagnostics-only => `allow` + diagnostic codes; postflight illegal => `invalid_after_commit`; decision contains no repair operation/callback/store patch. | DIAG-T06, DIAG-T07 |
| DIAG-T06 | SIDE_EFFECT_BOUNDARY | Step3 `createWorkbenchFlowService` preflight integration | real `workbenchFlowService`, real `modeTransitions`, real `resolveModeState`, real `workbenchStore`, real `trainingRuntimeStore` | typed service/repository/region/logger ports only | real production interface/type or shared typed spy factory | mocked `workbenchFlowService`, mocked `resolveModeState`, mocked stores, handwritten full service/repository spies | Illegal preflight rejects before `workbenchStore.updateTab`, `attemptService.freezeAttempt/finalizeAttemptResult`, recall creation, snapshot capture, overlay/runtime/mode effects. | DEFERRED to step3.integration |
| DIAG-T07 | SIDE_EFFECT_BOUNDARY | Step3 `createWorkbenchFlowService` postflight integration | real `workbenchFlowService`, real `modeTransitions`, real `resolveModeState`, real stores | typed modeEffects/region/logger ports only | real production interface/type or shared typed spy factory | mocked `workbenchFlowService`, mocked `resolveModeState`, resolver repair stubs | After transition effects, invalid postflight emits invalid-after-commit and does not call runtime/overlay/scratch repair setters from diagnostics path. | DEFERRED to step3.integration |
| DIAG-T08 | ARCHITECTURE_BOUNDARY | Step3 production composition | real production composition source + real flow factory type | none or shared typed factory if executing composition | real production interface/type | source-specific tab API mocks, hidden global lookup mocks | App composition wires diagnostics dependencies explicitly and does not introduce source-specific tab APIs or hidden `window.sabaki` for diagnostics. | DEFERRED to step3.integration |
| DIAG-T09 | STORE_SUBSCRIPTION | Step3 successful allowed transition return path | real `workbenchFlowService`, real stores, existing container subscription if tested | typed service/region ports only | real production interface/type or shared typed spy factory | mocked stores, mocked container projection for rendered-return claim | Successful allowed transition still updates stores through owner service and existing subscriptions; diagnostics-only warnings do not suppress projection. | DEFERRED to step3.integration |

Mock policy:

- Step2.3 pure resolver/policy tests use plain immutable value snapshots, not mocked production services.
- A logger spy may be `local tiny stub` only for logger writer calls; logger output cannot be the primary oracle.
- Step3 integration tests must not mock `workbenchFlowService`, `modeStateResolver`, `workbenchStore`, or `trainingRuntimeStore` when claiming state-forward or postflight behavior.
- `WorkbenchFlowService`, `WorkbenchTabService`, `SnapshotService`, documentStore playMove ports, `RecallService`, `AttemptService`, `ReviewService`, repository ports, overlay/runtime/scratch region ports must not be per-file handwritten full spies. Use production TypeScript interfaces or shared typed spy factories; if helper is missing, add a shared helper first.
- No test may use "callback called once" as main acceptance.

### RED/GREEN/DEFERRED 状态表

| 字段/事件 | Mode/State | 期望值/行为 | 测试 ID | 测试状态 | GAP/Deferred |
| --- | --- | --- | --- | --- | --- |
| `positionSource` + `allowedMutationContracts` | play | `game-tree` + `playMove`; snapshot persistence false, next step enter-analysis. | DIAG-T01 | GREEN | Existing automated coverage at `test/training/modeStateResolver.test.js` lines 315-328. |
| `positionSource` + `allowedMutationContracts` | problem | `game-tree` or `scratch/problem-attempt` + `problemAttemptMove`; no `playMove` fallback. | DIAG-T01 | GREEN | Existing automated coverage at lines 330-349. |
| `positionSource` + `allowedMutationContracts` | recall | frozen source attempt + recall position + `recallAnswer`; no mutable Attempt projection. | DIAG-T01 | GREEN | Existing automated coverage at lines 351-378. |
| `positionSource` + `allowedMutationContracts` | analysis | `scratch/current` + `scratchEdit`; snapshot persistence true when scratch/current exists. | DIAG-T01 | GREEN | Existing automated coverage at lines 380-405. |
| `snapshotPersistAllowed` / `snapshotNextStep` | play/problem/recall/analysis | Full matrix: non-analysis must be false + `enter-analysis`; analysis scratch/current true; analysis missing scratch/current false. | DIAG-T01B | RED | Current implementation likely satisfies; existing tests only partially cover matrix. |
| `illegal[]` | problem missing `problemView` | `ok:false`, code `missing-problem-view`, no state mutation. | DIAG-T02A | GREEN | Existing automated coverage at lines 408-420. |
| `illegal[]` | problem missing active attempt/attempt | `ok:false`, code `missing-problem-attempt`, no state mutation. | DIAG-T02B | RED | implementation evidence: likely green via `modeStateResolver.ts` lines 193-196. |
| `illegal[]` | recall missing `recallView` or active recall id | `ok:false`, code `missing-recall-view`, no state mutation. | DIAG-T02B | RED | implementation evidence: likely green via lines 205-208. |
| `illegal[]` | recall missing frozen source attempt | `ok:false`, code `missing-frozen-source-attempt`, no state mutation. | DIAG-T02B | RED | implementation evidence: likely green via lines 209-210. |
| `illegal[]` | recall polluted with `problemView` | `ok:false`, code `problem-view-in-recall`, no state mutation. | DIAG-T02A | GREEN | Existing automated coverage at lines 422-435. |
| `illegal[]` | non-recall with checkpoint/correction draft | `ok:false`, code `checkpoint-without-recall`, no state mutation. | DIAG-T02A | GREEN | Existing automated coverage at lines 437-454. |
| `illegal[]` | non-analysis territory/compare overlay | `ok:false`, `non-analysis-territory-overlay` / `non-analysis-compare-overlay`, no overlay cleanup by resolver. | DIAG-T02A | GREEN | Existing automated coverage at lines 456-483. |
| `illegal[]` | analysis without scratch/current | `ok:false`, code `analysis-missing-scratch-current`, `snapshotPersistAllowed:false`. | DIAG-T02A | GREEN | Existing automated coverage at lines 485-503. |
| `illegal[]` | missing/unknown active tab mode | `ok:false`, code `missing-active-tab`, no state mutation. | DIAG-T02B | RED | implementation evidence: likely green via `modeStateResolver.ts` lines 26-32. |
| `diagnostics[]` | legacy Sabaki mode mismatch | Non-blocking diagnostic; WorkbenchTab.mode remains truth. | DIAG-T04 | GREEN | Existing automated coverage at lines 506-539. |
| `diagnostics[]` | old source/live/provider mismatch | Non-blocking diagnostic; no mode/command/source-specific branch. | DIAG-T04 | GREEN | Existing automated coverage at lines 506-539. |
| resolver purity | legal/illegal snapshots | Frozen input graphs unchanged; no direct store/service/global imports/calls. | DIAG-T03A, DIAG-T03B | GREEN | Existing automated coverage at lines 541-600. |
| diagnostics policy | preflight `ok:false` | decision `reject`, illegal codes preserved, no repair ops. | DIAG-T05 | RED | Step2.3-local helper/test required. |
| diagnostics policy | preflight diagnostics-only | decision `allow`, diagnostic codes preserved for logging, no reject. | DIAG-T05 | RED | Step2.3-local helper/test required. |
| diagnostics policy | postflight `ok:false` | decision `invalid_after_commit`, no repair ops/rollback. | DIAG-T05 | RED | Step2.3-local helper/test required. |
| flow preflight consumption | `submit` / `enterAnalysis` / `snapshot` | Shared flow rejects illegal state before writes/effects. | DIAG-T06 | DEFERRED | Deferred ledger DIAG-D01. |
| flow postflight consumption | `enterAnalysis` / `returnFromAnalysis` / `completeRecall` | Shared flow evaluates post-effect snapshot and surfaces invalid-after-commit without repair. | DIAG-T07 | DEFERRED | Deferred ledger DIAG-D02. |
| production composition | app path | Diagnostics deps/snapshot provider wired explicitly; no hidden global/source-specific APIs as diagnostics path. | DIAG-T08 | DEFERRED | Deferred ledger DIAG-D03. |
| store/subscription/UI return | diagnostics-only allowed transition | Existing subscriptions/projected props update UI after allowed transition. | DIAG-T09 | DEFERRED | Deferred ledger DIAG-D04. |

### Formal Deferred Ledger

| Deferred ID | Test ID | Approved Reason | Exit Condition | Downstream Step | Downstream Test ID/task | Activation Trigger |
| --- | --- | --- | --- | --- | --- | --- |
| DIAG-D01 | DIAG-T06 | Shared `workbenchFlowService.ts` lock / step2.2 parallel risk. Preflight flow integration would edit the same shared orchestration file while scratch-region target/generation work is parallel-active. | `step3.integration` wires diagnostics with real `workbenchFlowService`, real `workbenchStore`, real `trainingRuntimeStore`, real `resolveModeState`, and typed external ports in one integrated diff. | `step3.integration` | `DIAG-T06.step3` or integration task "diagnostics preflight rejects before writes" | step2.2 scratch region and step2.3 diagnostics helper/review are complete and merged. |
| DIAG-D02 | DIAG-T07 | Shared `workbenchFlowService.ts` lock / step2.2 parallel risk. Postflight ordering depends on final scratch/runtime/overlay owner ordering. | `step3.integration` runs postflight resolver after real transition effects and proves invalid-after-commit without resolver/helper repair. | `step3.integration` | `DIAG-T07.step3` or integration task "diagnostics postflight invalid_after_commit no repair" | Integrated flow has stable runtime/scratch/overlay effect ordering. |
| DIAG-D03 | DIAG-T08 | Shared composition and flow factory changes depend on step2.2/step2.3 final APIs; editing production composition early risks drift and conflicts. | `step3.integration` wires explicit diagnostics snapshot/provider deps through real production composition and proves no hidden global/source-specific diagnostics path. | `step3.integration` | `DIAG-T08.step3` or integration task "production diagnostics composition boundary" | Final diagnostics helper API and scratch snapshot provider shape are known. |
| DIAG-D04 | DIAG-T09 | Store/subscription return requires real flow integration; adding it in step2.3 would force shared `workbenchFlowService.ts` edits during step2.2 parallel risk. | `step3.integration` proves allowed diagnostics-only transitions still update real stores/subscriptions/projection; if projection/render path changes, add rendered Shell/Panel test. | `step3.integration` | `DIAG-T09.step3`; optional `RENDERED_UI_RETURN` task if projection/render changes | DIAG-T06/DIAG-T07 integration exists and an allowed diagnostics-only command path is wired. |

## 11. 仅手动验收

| ID | 验收项 | Reason |
| --- | --- | --- |
| DIAG-M01 | Contract/audit confirms diagnostics policy is not a repair path and does not expand into scratch/runtime/engine/UI implementation. | Human boundary review is more valuable than brittle source scans for scope creep. |
| DIAG-M02 | Architecture reviewer confirms step3 integration ordering after step2.2 scratch region is coherent. | Shared `workbenchFlowService.ts` ordering depends on merged runtime/scratch/diagnostics implementation. |
| DIAG-M03 | Reviewer confirms diagnostic log channel names and payload fields are sufficient for audit but not used as primary test oracle. | Exact log wording should not be locked by tests. |

## 12. 不测试

| ID | 不测试项 | Reason |
| --- | --- | --- |
| DIAG-N01 | Exact logger message text or call order. | Logs are supporting evidence, not primary oracle. |
| DIAG-N02 | UI/CSS/layout/visual selected state. | Out of scope; use frontend visual workflow if needed. |
| DIAG-N03 | Simple getter wrappers or one-line boolean accessors unless they encode diagnostics policy. | Low value and brittle. |
| DIAG-N04 | Callback called once as primary acceptance. | Would be fake green for state-forward diagnostics. |
| DIAG-N05 | Runtime companion cleanup, overlay internals, scratch generation/target, engine ownership migration, persistent fact repair. | Owned by other slices or explicitly out of scope. |

## 13. 脆弱测试警告

1. Do not assert every setter order in `workbenchFlowService`; assert no writes before preflight reject and final state after allowed transition.
2. Do not claim `CONTROLLER_STATE_TRANSITION`, `SERVICE_REPOSITORY_TRANSITION`, or `STORE_SUBSCRIPTION` while mocking the production service/store responsible for the transition.
3. Do not mock `resolveModeState` in any test claiming diagnostics integration.
4. Do not use source-code regex as the only proof of production behavior, except for narrow architecture-boundary checks.
5. Do not test exact `diagnostics[]` array order unless order becomes a documented user-visible contract.
6. Do not write a single "full lifecycle" test that claims projection, state transition, repository write, and rendered UI return unless it executes the full production chain.

## 14. 超出范围

1. Runtime companion cleanup implementation beyond diagnostics read/reject policy.
2. Overlay owner internals, territory compare generation, and late overlay async behavior.
3. Analysis scratch target/generation implementation and stale-result guards.
4. Engine ownership migration and target-id enforcement.
5. Persistent fact repair for Attempt, RecallSession, Task/Problem, MoveEvaluation/BadMove, SGF, comments, or review schedule.
6. UI redesign, controls, CSS, layout, screenshots, or visual acceptance.
7. New tab-opening APIs such as `openProblemTab` or `openSnapshotProblemTab`.
8. Shared `workbenchFlowService.ts` production integration during step2.3.

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 禁止；只允许 diagnostic | Architecture v0.5 lines 23-25, 100-110；existing tests lines 506-539 cover non-blocking diagnostics. | DIAG-T04 remains GREEN; DIAG-T08 step3 covers composition/API path. |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 禁止 | Architecture v0.5 lines 711-723 | Step2.3 不新增 API；DIAG-T08 deferred to step3. |
| 是否让 `snapshotService` 承担 Architecture v0.5 未分配给它的 tab opening / flow orchestration | 禁止 | Architecture v0.5 lines 100-110；current flow evidence uses `tabService.openTask` at `workbenchFlowService.ts` lines 1157-1161. | Keep snapshotService capture-only; DIAG-T08 deferred to step3 composition. |
| 是否让 container 直接写 store，而不是通过 v0.5 指定 service | 不允许；本 slice 不改 container | Architecture v0.5 lines 180-210 | No step2.3 container edits. |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 不允许；本 slice 无 UI wiring | Architecture v0.5 lines 89-110; UI/UX lines 23-31 only define surface. | No UI component changes/tests except deferred rendered-return if step3 needs it. |
| 是否让 `modeStateResolver.ts` 写状态或 repair | 禁止 | Implementation notes lines 63-90, 106-120; existing tests lines 541-600. | DIAG-T03A/T03B GREEN; DIAG-T05 RED for decision no-repair helper. |
| 是否把 diagnostics 规则塞进 `modeTransitions.ts` | 禁止 | Architecture v0.5 lines 112-158; implementation notes lines 63-76 separate transition policy vs invariant resolver. | Step2.3 helper belongs in resolver/diagnostics boundary, not transition table. |
| 是否让 `workbenchFlowService.ts` 变成巨型 state bucket | 风险；本 step deferred | Implementation notes lines 190-203; slice plan lines 56-64. | Step3 must call diagnostics/child owners without absorbing runtime/scratch internals. |
| 是否静默修复业务事实或用户产物 | 禁止 | PRD lines 116-131; implementation notes lines 106-120. | DIAG-T05 rejects any repair ops; step3 tests forbid store/repository writes from diagnostics path. |
| 是否将 `problem` 当作 board mode 或新增 review/checkpoint/punishment mode | 禁止 | PRD lines 235-253; UI/UX lines 23-31. | Resolver projection keeps four WorkbenchMode values only; DIAG-T01 GREEN. |
| 是否允许 Recall/Analysis 修改 game tree or source Attempt | 禁止 | PRD lines 351-357; Position contract lines 133-170. | Resolver remains read-only; executor write tests are separate/out of scope. |

## 16. Workbench 接线清单（如适用）

本任务不是 already-drawn UI control wiring；没有 presentational callback signature 需要锁定。以下表只记录 diagnostics command ownership，避免 test-writer 扩大到 UI callback 或 callback-once 验收。

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A service command | `submit` | `workbenchFlowService` | Architecture lines 112-158, 180-199 | step3 preflight reject or allowed submit effects | existing store subscriptions/projection | DIAG-T06 deferred | step3 integration |
| N/A service command | `enterAnalysis` | `workbenchFlowService` + scratch owner/mode effects | Architecture lines 137-148; Position contract lines 254-263 | step3 preflight + explicit analysis effects | existing subscriptions/projection | DIAG-T06/DIAG-T07 deferred; scratch details step2.2 | step3 integration after step2.2 |
| N/A service command | `returnFromAnalysis` | `workbenchFlowService` + child regions | Architecture lines 140-158 | step3 postflight restored mode check | existing subscriptions/projection | DIAG-T07 deferred | step3 integration |
| N/A service command | `snapshotFromCurrentContext` | `workbenchFlowService`; `snapshotService` capture only; `tabService.openTask` | PRD lines 255-269; Architecture lines 711-723 | analysis-only snapshot persists child task/tab | existing subscriptions/projection | DIAG-T08 deferred | step3 integration |
| Diagnostics policy | `classify preflight/postflight resolver result` | `modeStateResolver.ts` diagnostics helper | implementation notes lines 75-90, 204-219 | no state write; returns decision | no subscription | DIAG-T05 step2.3 | diagnostics-region |

Weak-test ban: callback invocation count is not acceptable as primary acceptance for this slice.

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| diagnostics contract/docs | this contract file only | source docs/current code/audit | Read/write scope disjoint from production code. | None besides audit feedback. |
| diagnostics resolver/policy tests | `test/training/modeStateResolver.test.js` or dedicated diagnostics-policy test | approved DIAG-T01B/T02B/T05 | Does not touch shared flow production; can run while scratch contract/tests proceed. | Test naming/status must not imply flow integration landed. |
| diagnostics policy helper implementation | `src/modules/training/workbench/modeStateResolver.ts` only | diagnostics tests | Owned by step2.3 per slice plan; pure helper avoids shared flow conflict. | API naming drift; contract audit should approve helper shape before implementation. |
| scratch region step2.2 | `src/modules/analysis/*`, scratch tests, possible deferred flow hooks | step1 review | Independent from resolver/policy helper. | Shared `workbenchFlowService.ts` hooks must wait for step3. |
| step3 flow integration | `src/modules/training/workbench/workbenchFlowService.ts`, composition, integration tests | step2.2 + step2.3 reviews | Serial integrator resolves runtime/scratch/diagnostics ordering once. | High if parallel branches independently edit flow service. |
| architecture review | docs + final implementation diff | step3 | Review after stable integrated code. | Must verify no hidden repair/source branch. |

### Downstream required_constraints

| Constraint ID | Required downstream constraint | Applies to | Exit condition |
| --- | --- | --- | --- |
| DIAG-RC01 | `workbenchFlowService.ts` preflight/postflight consumption is deferred to step3 and must be implemented once after step2.2 scratch owner is stable. | step3 integration | A single integrated diff wires diagnostics, scratch, runtime, and overlay order without competing parallel edits. |
| DIAG-RC02 | Preflight snapshot must be built from explicit deps: active tab from `workbenchStore`, runtime from `runtimeStore`, overlay/Sabaki/scratch from explicit adapter/provider. No hidden `window.sabaki`. | step3 integration | DIAG-T06/DIAG-T08 pass with real stores and explicit providers. |
| DIAG-RC03 | Preflight illegal result rejects before repository writes, service calls, child-region calls, mode effects, snapshot capture, and `workbenchStore.updateTab`. | step3 integration | DIAG-T06 proves no write/effect ports were invoked on reject. |
| DIAG-RC04 | Diagnostics-only result logs but allows command; WorkbenchTab.mode remains truth. | step2.3 helper + step3 integration | DIAG-T05 covers helper; DIAG-T06/DIAG-T09 cover flow once integrated. |
| DIAG-RC05 | Postflight runs after synchronous mode transition/child-region/mode-effect writes that define the committed target state; async child-region results remain owned by their region/generation guards. | step3 integration | DIAG-T07 passes without waiting on unrelated async engine/scratch results. |
| DIAG-RC06 | Postflight illegal result is invalid-after-commit, not repair; no runtime/overlay/scratch/store/repository patches may be issued by diagnostics path. | step2.3 helper + step3 integration | DIAG-T05 and DIAG-T07 pass. |
| DIAG-RC07 | Structured log payloads include at least `tabId`, `phase`, `fromMode`, `toMode` when known, command/method, `illegalCodes`, `diagnosticCodes`, and reason/correlation id when available. | step3 integration | Manual review + focused assertions on payload shape, not exact wording. |
| DIAG-RC08 | Tests that claim state transition use real production `workbenchFlowService`, `resolveModeState`, and stores; mocks may only cover typed external ports. | test-writer/test-audit | Test audit rejects fake-green mocks. |
| DIAG-RC09 | No rendered UI return test is required until step3 changes projection/render path; if added, it must render real Shell/Panel rather than only `container.render().props`. | step3 or later | RENDERED_UI_RETURN either implemented with real render or remains explicitly deferred. |
