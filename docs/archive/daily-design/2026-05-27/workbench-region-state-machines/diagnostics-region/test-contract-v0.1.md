Date: 2026-05-27
Status: pending-confirmation

# 契约草案

## 0. 真源对齐

本契约只定义 step2.3 diagnostics-region 的测试与验收边界。产品/架构/UI 真源仍以 active `docs/product/`、`docs/architecture/`、`docs/ui_ux/` 为准；`docs/design/` 是本 slice 的状态机 guardrail；当前源码是实现证据，不是产品事实来源；当前 daily slice plan/checklist 只限定范围和并行锁。

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `AGENTS.md` | lines 34-45 | WorkbenchMode 是父状态机；`modeTransitions.ts` 纯 policy；`modeStateResolver.ts` 只做 read-only projection / invariant diagnostics；resolver 不写 store、不调用 service、不自动 repair；测试要验最终 outcome，日志不是主要 oracle。 |
| `docs/product/sabaki-training-prd.md` | lines 8-25 | 当前 active PRD 是产品蓝图；若 UI/UX 或设计稿与 PRD/Architecture 冲突，以 PRD/Architecture 为准。历史 PRD v0.5 仅追溯，不作为本契约事实源。 |
| `docs/product/sabaki-training-prd.md` | lines 41-54, 116-131 | 产品闭环是 Play -> Submit/freeze Attempt -> Recall -> RecallCheckpoint -> Analysis -> Snapshot -> Problem；`TrainingAttempt.userLine` 提交后冻结，Recall/Analysis/Review 不反向改写。Diagnostics 不能 repair 或改写这些事实。 |
| `docs/product/sabaki-training-prd.md` | lines 235-269 | 运行态 WorkbenchMode 只有 Play / Problem / Recall / Analysis；Problem entity、RecallCheckpoint、Review、Punishment Problem 都不是新 mode；Snapshot 持久化必须经 Analysis scratch/current，不能从 live mutable context 直接创建 Problem。 |
| `docs/product/sabaki-training-prd.md` | lines 321-330, 351-357 | Play/Problem 提交后冻结 Attempt 并进入 Recall；Recall 输入是冻结 Attempt，不改写已冻结 Attempt。Preflight illegal state 可以 reject；不能通过 resolver 静默修正 Attempt 或 Recall facts。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 14-25, 64-71 | v0.5 围绕四个产品 mode；旧 `source_kind`、`openProblemTab`、`openSnapshotProblemTab` 只能作为迁移背景，不能成为新主路径。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 89-110 | UI 展示、Container/Controller 调 Service、Service 编排、Repository 存取、Adapter 隔离 legacy；禁止 store 调 service、snapshotService 打开 Tab、按 `origin.provider` 分叉主流程。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 112-158 | Mode transition 必须收敛到可测试状态机；非法转换 reject/throw 并记录结构化日志；Snapshot 不修改当前 tab；Analysis 自由摆棋不写 Attempt.userLine。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 162-199, 201-210 | 渲染读路径是 Store/Repository -> Container/ViewModel -> UI；写路径是 UI -> Controller/Container -> Service -> Store/Repository/Adapter -> Existing Core。Diagnostics consumption 必须位于 Service/Flow 边界，不让 UI 或 store 直接决策。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 473-563, 564-629 | `workbenchStore` 只拥有 tab/activeTab；写入者是 `workbenchTabService` / `workbenchFlowService`。`trainingRuntimeStore` 保存 transient runtime，不保存完整历史事实。Diagnostics 只能读取显式 snapshot。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 682-720 | 新路径只用 `workbenchTabService.openTask`; 不新增 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API。 |
| `docs/architecture/position-source-mutation-contract.md` | lines 10-18, 81-90, 92-170 | ModeState 派生 PositionSource + MutationContract；合法 contracts 是 `playMove`、`problemAttemptMove`、`recallAnswer`、`scratchEdit`、`variationMove`。Diagnostics 是 read-only gate，不新增 mutation contract。 |
| `docs/architecture/position-source-mutation-contract.md` | lines 216-252, 254-263 | Board event 仍应走 resolver -> intent/source/contract -> focused executor；Problem 是 first-class WorkbenchMode；Recall 默认 hidden overlays；新行为不得扩大 legacy mode switch。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | lines 5-22, 23-32, 156-173 | UI/UX 只提供四 mode 控件位置、文案、Snapshot 可发现性和 RecallCheckpoint 表面；本契约不改 UI/CSS/布局。 |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 19-48, 56-72 | Slice-specific guardrail：`workbenchFlowService` 是 mode transition 编排入口；状态 owner 清楚；UI 是 projection；legacy Sabaki mode 只能是 adapter projection。若与 active PRD/Architecture 冲突，以 active docs 为准。 |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 73-147, 148-223 | 四 mode companion state、transition effects、禁止污染规则；Diagnostics 必须识别 illegal companion state，但不直接执行 runtime/overlay/scratch cleanup。 |
| `docs/design/workbench-mode-orchestration-contract.md` | lines 225-239, 312-480 | 非法 transition/写入污染风险和目标 type shape；Frozen Attempt、scratch/game-tree 隔离、overlay outside analysis 等都是 diagnostics 的 reject/invalid candidates。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | lines 30-40, 63-90 | 当前层级：`modeTransitions.ts` 纯 policy，`workbenchFlowService.assertTransition` 薄 guard，`modeStateResolver.ts` 只读 projection / invariant checker；接入生产后 preflight/postflight 可以 reject/warn/log，但 resolver 不修复。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | lines 92-120 | 只适合自动同步 transient companion/cache；Persistent facts、用户产物、SGF、comments、review schedule 不能被 resolver 或 mode sync 静默 repair。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | lines 190-203, 204-219, 221-242, 243-252 | 避免 `workbenchFlowService` 变巨型 switch；resolver 自动修状态是风险；迁移路径第 5 步是把 `modeStateResolver` 用作 preflight/postflight checker；测试要 outcome-based，不能只测 diagnostics 存在。 |
| `src/modules/training/workbench/modeTransitions.ts` | lines 1-10, 70-140, 236-250 | 当前 pure state machine 无 service/store imports；snapshot analysis-only、submit play/problem-only、enter/return analysis policy 已存在。Diagnostics 不替代该 transition policy。 |
| `src/modules/training/workbench/modeStateResolver.ts` | lines 20-44, 46-139 | 当前 resolver 已返回 `ok:false` + `illegal[]`，或 legal mode projection + positionSource/mutation contracts；这是 diagnostics policy 的生产 subject。 |
| `src/modules/training/workbench/modeStateResolver.ts` | lines 149-183, 185-242 | `diagnostics[]` 现在包含 legacy/source mismatch；`illegal[]` 包含 missing problem/recall companion、checkpoint outside recall、non-analysis overlay、analysis missing scratch/current。契约必须区分 diagnostics vs reject。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | lines 250-311, 461-563, 609-660, 662-726, 762-827, 1086-1105 | 当前 flow service 只用 `resolveTransition` 和 explicit service/region effects；尚未消费 `resolveModeState`。任何共享 `workbenchFlowService.ts` 生产改动可能与 step2.2 scratch slice 冲突，本契约将其标为 step3 integration。 |
| `src/components/TrainingWorkbenchContainer.js` | lines 63-66, 87-114, 1401-1487 | Container 通过 store subscriptions 回流 UI props。Diagnostics 本身不新增 UI wiring；允许 transition 成功后的既有 store subscription 继续投影。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` | lines 42-46, 53-64 | Derived scope only：step2.3 负责 transition invariant diagnostics；`workbenchFlowService.ts` 是共享 integration point；与 step2.2 冲突的生产编辑必须推迟到 step3。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | lines 28-39, 55 | Derived ledger only：step2.2 与 step2.3 可并行做 contracts/tests；共享 `workbenchFlowService.ts` 生产集成保留给 step3。 |

Conflict note: gate 模板提到“PRD v0.5”。Active product doc declares current PRD v0.7 as product truth and Architecture v0.5 as module truth, with historic v0.5 only for traceability. 本契约按 active PRD v0.7 + Architecture v0.5 执行；未发现与 `docs/design/` guardrails 的冲突。

## 1. 用户故事

作为 Workbench mode transition 编排层，我希望在执行 mode command 前后消费 `modeStateResolver` 的只读结果，以便：

1. 在 preflight 阶段发现当前 active tab/runtime/overlay/scratch companion state 已经非法时拒绝 command，避免进一步污染 store、repository、Sabaki 或 child region。
2. 在仅有 legacy/source mismatch 等 diagnostics 时记录结构化诊断并允许 command 继续，避免把 migration diagnostic 误当成产品流程分支。
3. 在 postflight 阶段发现 transition 后仍不自洽时记录/暴露 invalid-after-commit，而不是由 resolver 或 policy helper 自动清 runtime、overlay、scratch、Attempt、RecallSession 或 SGF。

## 2. 用户动作

本 slice 不新增 UI 控件或用户动作。它覆盖现有 semantic commands 的 invariant diagnostics：

| Command | 当前 owner | Diagnostics role |
| --- | --- | --- |
| `submit(tabId)` | `workbenchFlowService` | step3 preflight must reject illegal source state before freeze/finalize/create recall; step2.3 only defines pure policy/helper and tests. |
| `enterAnalysis(tabId, options)` | `workbenchFlowService` | step3 preflight checks source companion; postflight checks analysis scratch/current after mode effects/child regions. |
| `returnFromAnalysis({tabId})` | `workbenchFlowService` | step3 preflight checks current analysis state; postflight checks restored mode companion. |
| `completeRecall(tabId)` | `workbenchFlowService` legacy event | step3 postflight checks analysis entry after recall completion; no resolver repair of RecallSession/Attempt. |
| `snapshotFromCurrentContext(tabId)` | `workbenchFlowService` | existing transition policy requires analysis; diagnostics must not let SnapshotService orchestrate tab opening or branch by source. |
| checkpoint commands | `workbenchFlowService` + `recallCheckpointService` | checkpoint activation internals are out of scope except that resolver may report `checkpoint-without-recall`. |

## 3. 当前阶段

Workflow stage: `step2.3.contract` for `diagnostics-region`.

Workbench stages covered by diagnostics policy: `play`, `problem`, `recall`, `analysis`.

Current implementation state:

- `modeStateResolver.ts` already produces projections, `diagnostics[]`, and `illegal[]`.
- `workbenchFlowService.ts` currently does not call `resolveModeState`.
- Step1 overlay region and step2.1 runtime region are complete.
- Step2.2 scratch region may run in parallel; any conflicting shared flow-service production edit is deferred to step3 integration.

## 4. 位置源

Diagnostics reads position/source shape only through explicit snapshots; it does not mutate any position.

| Source | In scope? | Contract |
| --- | --- | --- |
| `game-tree` | yes | Legal projection for Play and some Problem/Recall surfaces; diagnostics may report illegal companions but must not write the formal SGF tree. |
| `scratch` | yes | Legal projection for Analysis `scratch/current` and Problem `scratch/problem-attempt`; diagnostics may report missing scratch/current in Analysis. |
| `problem-attempt` | yes | Read-only diagnostic source role for Problem/Recall attempt surfaces; cannot be collapsed into `playMove`. |
| `reference/current` | yes, read-only | Analysis compare/reference context may be observed via scratch projection; implementation of scratch target/generation is step2.2/out of scope. |
| source/origin metadata | diagnostic only | `origin.provider` / old `source.kind/source_kind` may produce non-blocking diagnostics but must not select mode, command path, tab-opening API, or mutation contract. |

## 5. 变更契约

Primary change contract for diagnostics itself: **无变更**.

Diagnostics consumption is a gate/classifier around existing mode commands. It must not introduce a new mutation contract. If a command is allowed, the command continues to use its existing owner and mutation/effect contract:

| Command/effect | Underlying contract | Diagnostics rule |
| --- | --- | --- |
| Play/Problem submit | freeze/finalize Attempt + create Recall + mode `recall` | Preflight illegal state rejects before persistence/service/region writes. Diagnostics-only state logs and continues. |
| Enter Analysis | `scratchEdit` target setup through analysis/scratch owner or legacy mode effects | Step2.3 defines policy; flow integration and any shared `workbenchFlowService.ts` edit deferred to step3. |
| Return from Analysis | exit analysis effects + restore previous mode | Postflight illegal state is invalid-after-commit, not auto-repair. |
| Snapshot | Analysis scratch/current -> Task -> child Problem tab | No direct live mutable snapshot persistence; no `snapshotService` tab orchestration; no source-specific tab API. |
| Resolver projection | `playMove`, `problemAttemptMove`, `recallAnswer`, `scratchEdit`, `variationMove` hints | Hints are read-only projection, not execution. |

### Diagnostics / Reject / Repair Distinction

| Term | Meaning | Allowed behavior | Forbidden behavior |
| --- | --- | --- | --- |
| Diagnostics | `resolveModeState(...).ok === true` with non-empty `diagnostics[]`, e.g. `legacy-mode-mismatch` or `source-mode-mismatch`. | Log/emit structured diagnostic such as `flow.transition.diagnostic`; continue command using WorkbenchTab.mode as truth. | Reject only because legacy Sabaki mode or source/provider metadata disagrees; branch product flow by `origin.provider` or old `source.kind/source_kind`. |
| Reject | Preflight `resolveModeState(...).ok === false` because `illegal[]` is non-empty, e.g. missing companion, checkpoint outside recall, non-analysis overlay, analysis missing scratch/current. | Throw deterministic transition/invariant error before repository/service/region/store writes; log `flow.transition.rejected` with illegal codes. | Partially run freeze/create recall/snapshot/child region effects after preflight reject. |
| Invalid after commit | Postflight `resolveModeState(...).ok === false` after explicit transition effects completed. | Log `flow.transition.invalid_after_commit` and surface deterministic invariant failure to caller/test; leave state visible for owner/integration repair work. | Silently repair in resolver/policy; rollback by ad hoc store patches; hide the invalid state by only testing logs. |
| Repair | Mutating state to make invariant pass. | Only explicit owner services/regions may perform contracted transient cleanup during normal transition effects. | Resolver or diagnostics helper writes store, calls service, edits SGF, changes Attempt/RecallSession/Task/Problem/MoveEvaluation/BadMove/comment/review schedule, or calls Sabaki/engine/DB. |

## 6. 预期状态流

Current step2.3 landing path:

```text
explicit test snapshot
-> resolveModeState(snapshot)
-> pure diagnostics policy/classifier
-> decision: allow | reject | invalid-after-commit
-> no store/service/repository/adapter/UI side effects
```

Step3 integration target, deferred because it edits shared `workbenchFlowService.ts`:

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

- `workbenchFlowService.ts` currently does not consume `resolveModeState`; this remains no-op until step3 integration.
- Exit condition: after step2.2 scratch owner and step2.3 diagnostics policy are reviewed, step3 wires preflight/postflight into `workbenchFlowService.ts` once, resolving shared edits.

Subscription contract:

- Diagnostics policy does not subscribe to stores.
- Existing `workbenchStore.subscribe` and `runtimeStore.subscribe` drive `TrainingWorkbenchContainer.forceUpdate()` and projection after allowed transitions.
- Rejecting preflight must not trigger store updates.
- Postflight invalid-after-commit must not create extra subscription paths or force UI repair; any already-committed state returns through existing subscriptions.

## 7. 允许的副作用

1. Structured diagnostic/rejection logging from the flow/service boundary.
2. Deterministic throw/reject before writes on preflight illegal state.
3. Deterministic invalid-after-commit signal after a transition if postflight remains illegal.
4. Existing command effects when preflight allows the command: repository writes, store updates, child-region notifications, Sabaki adapter effects already owned by the command.

## 8. 禁止的副作用

1. `modeStateResolver.ts` or diagnostics policy writes any store, repository, DB, engine, overlay, Sabaki state, IPC, UI, or hidden global.
2. Resolver/policy calls `workbenchFlowService`, `workbenchTabService`, `snapshotService`, `attemptService`, `recallService`, `recallCheckpointService`, `problemFlowService`, engine, DB, or `window.sabaki`.
3. Resolver/policy clears `problemView`, `recallView`, checkpoint runtime, overlay territory/compare, editWorkspace, Attempt, RecallSession, Task/Problem, MoveEvaluation/BadMove, SGF tree, comments, or review schedule.
4. Diagnostics branch product flow by `origin.provider` or old source/kind fields.
5. `snapshotService` opens tabs or orchestrates mode flow.
6. UI components directly depend on diagnostics service/store/repository/Sabaki.
7. Step2.3 implementation makes competing production edits to `workbenchFlowService.ts`; shared flow edits are step3 integration.

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| DIAG-C01 | PURE_LOGIC / STATE | MUST_AUTOMATE | `resolveModeState` keeps legal projections for play/problem/recall/analysis, including position source, mutation contract hints, snapshot persist flag, and analysis scratch projection. | Proves diagnostics are grounded in current ModeState, not source metadata. | Flow integration could gate commands using stale or wrong projection. |
| DIAG-C02 | PURE_LOGIC / STATE | MUST_AUTOMATE | `resolveModeState` reports illegal companion states as `ok:false` + `illegal[]` for missing Problem companion, missing Recall companion/source Attempt, checkpoint outside Recall, non-analysis overlay, and Analysis without scratch/current. | These are the reject candidates. | Preflight could allow polluted state to perform more writes. |
| DIAG-C03 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Resolver and diagnostics policy remain pure: no store/service/repository/engine/overlay/document/Sabaki/global/timer imports or calls. | Prevents diagnostics becoming hidden writer/repair path. | Fake-green tests could pass while resolver mutates state. |
| DIAG-C04 | ARCHITECTURE_BOUNDARY / PURE_LOGIC | MUST_AUTOMATE | `legacy-mode-mismatch` / `source-mode-mismatch` are diagnostics only; WorkbenchTab.mode remains truth and source/provider fields do not select mode or mutation contract. | Protects v0.5 source-origin demotion. | Old source/kind branching could re-enter v0.4 architecture. |
| DIAG-C05 | SIDE_EFFECT / ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | A pure diagnostics policy/classifier maps preflight `ok:false` to reject, preflight diagnostics-only to allow-with-log intent, postflight `ok:false` to invalid-after-commit, and never returns repair operations. | This is the step2.3 production scope that can land without shared flow-service edits. | Test-writer might write only resolver projection tests and never lock consumption semantics. |
| DIAG-C06 | SIDE_EFFECT / STATE | MUST_AUTOMATE | Preflight flow integration rejects illegal state before freeze/finalize/create recall/snapshot/region effects and before `workbenchStore.updateTab`. | Core behavioral guard. | Illegal state can still produce writes before diagnostics run. |
| DIAG-C07 | SIDE_EFFECT / STATE | MUST_AUTOMATE | Postflight flow integration evaluates the resulting snapshot after explicit transition/child-region effects; illegal result is logged/surfaced without automatic repair. | Catches failed region synchronization without hiding it. | Transition may commit invalid state silently or be "fixed" by resolver. |
| DIAG-C08 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Flow integration uses explicit dependency snapshots, not `window.sabaki` or hidden globals, and does not mock `resolveModeState` in state-forward tests. | Prevents global lookup and fake-green coverage. | Production may pass tests with per-file stubs while real composition is absent. |
| DIAG-C09 | STATE / WIRING | MUST_AUTOMATE | Production composition eventually passes any required explicit snapshot provider / diagnostics policy into `createWorkbenchFlowService`; `snapshotService` remains capture-only and does not open tabs. | Ensures integration actually runs in app, not only unit harness. | Tests might cover manually constructed service but app path remains no-op. |
| DIAG-C10 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | No new UI diagnostics surface is required in this slice; existing UI updates only through successful transition store subscriptions. | Avoids expanding into UI redesign. | Manual reviewer might expect visible diagnostic UI that is out of scope. |
| DIAG-C11 | ARCHITECTURE_BOUNDARY | DO_NOT_TEST | Do not test exact logger message strings, setter order, or callback call counts as primary oracle. | Keeps tests contract-level. | Brittle tests pass/fail on implementation detail, not invariant behavior. |

## 10. 必须自动化的测试

Step2.3 test-writer may land only tests whose production write scope is `modeStateResolver.ts` or diagnostics policy helpers in that module, plus non-invasive tests. Flow-service production integration tests are specified here for step3 but must not land as active step2.3 tests unless the contract audit explicitly approves deferring them with `it.skip`/documented pending status.

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DIAG-T01 | PROJECTION_RETURN | `resolveModeState` legal mode projection | real `modeStateResolver.ts` | none; plain frozen snapshot values only | none | mocked resolver, stores, services, repository, Sabaki globals | Play/problem/recall/analysis snapshots return correct `mode`, `positionSource`, `allowedMutationContracts`, `snapshotPersistAllowed`, and analysis scratch projection. | DIAG-T06, DIAG-T07 |
| DIAG-T02 | PROJECTION_RETURN | `resolveModeState` illegal companion diagnostics | real `modeStateResolver.ts` | none; plain frozen snapshot values only | none | mocked resolver, stores, services, repository, Sabaki globals | Illegal snapshots return `ok:false`, expected `illegal[].code`, and no repair side effects. | DIAG-T06, DIAG-T07 |
| DIAG-T03 | ARCHITECTURE_BOUNDARY | `modeStateResolver.ts` source boundary | filesystem source read of production file | none | none | per-file fake source, mocked resolver module | Source has no direct store/service/repository/engine/overlay/document/Sabaki/global/timer imports/calls and does not mutate frozen input graphs. | DIAG-T08 |
| DIAG-T04 | PROJECTION_RETURN | `resolveModeState` source/provider diagnostics | real `modeStateResolver.ts` | none; plain frozen snapshot values only | none | mocked resolver, source-specific fake services | `origin.provider` or old `source.kind/source_kind` only emits diagnostic; WorkbenchTab.mode controls projection and mutation contract. | DIAG-T06 |
| DIAG-T05 | SIDE_EFFECT_BOUNDARY | Step2.3 pure diagnostics policy/classifier in `modeStateResolver.ts` | real `resolveModeState` + real policy helper | none; plain frozen snapshot values only | none | mocked policy helper, mocked resolver, service/store/repository fakes | Preflight illegal => `reject`; preflight diagnostics-only => `allow` + diagnostic codes; postflight illegal => `invalid_after_commit`; decision contains no repair operation/callback/store patch. | DIAG-T06, DIAG-T07 |
| DIAG-T06 | SIDE_EFFECT_BOUNDARY | Step3 `createWorkbenchFlowService` preflight integration | real `workbenchFlowService`, real `modeTransitions`, real `resolveModeState`, real `workbenchStore`, real `trainingRuntimeStore` | typed service/repository/region/logger ports only | real production interface/type or existing shared typed spy factory | mocked `workbenchFlowService`, mocked `resolveModeState`, mocked stores, handwritten full service/repository spies | Illegal preflight rejects before `workbenchStore.updateTab`, `attemptService.freezeAttempt/finalizeAttemptResult`, recall creation, snapshot capture, overlay/runtime/mode effects. | not-covered until step3 integration |
| DIAG-T07 | SIDE_EFFECT_BOUNDARY | Step3 `createWorkbenchFlowService` postflight integration | real `workbenchFlowService`, real `modeTransitions`, real `resolveModeState`, real stores | typed modeEffects/region/logger ports only | real production interface/type or existing shared typed spy factory | mocked `workbenchFlowService`, mocked `resolveModeState`, resolver repair stubs | After transition effects, invalid postflight emits invalid-after-commit and does not call runtime/overlay/scratch repair setters from diagnostics path. | not-covered until step3 integration |
| DIAG-T08 | ARCHITECTURE_BOUNDARY | Step3 production composition | real `src/modules/sabaki.js` composition source + real flow factory type | none or shared typed factory if executing composition | real production interface/type | source-specific tab API mocks, hidden global lookup mocks | App composition wires diagnostics dependencies explicitly and does not introduce `openGameTab`/`openProblemTab`/`openSnapshotProblemTab` or hidden `window.sabaki`. | not-covered until step3 integration |
| DIAG-T09 | STORE_SUBSCRIPTION | Step3 successful allowed transition return path | real `workbenchFlowService`, real stores, existing container subscription if tested | typed service/region ports only | real production interface/type or shared typed spy factory | mocked stores, mocked container projection for rendered-return claim | Successful allowed transition still updates stores through owner service and existing subscriptions; diagnostics-only warnings do not suppress projection. | RENDERED_UI_RETURN deferred/not-covered |

Mock policy:

- Step2.3 pure resolver/policy tests should use plain immutable value snapshots, not mocked production services.
- If any test needs a logger spy, it may use `local tiny stub` only for logger writer calls; logger output cannot be the primary oracle.
- Workbench wiring/integration tests in step3 must not mock `workbenchFlowService`, `modeStateResolver`, `workbenchStore`, or `trainingRuntimeStore` when claiming state-forward or postflight behavior.
- `WorkbenchFlowService`, `WorkbenchTabService`, `SnapshotService`, documentStore playMove ports, `RecallService`, `AttemptService`, `ReviewService`, repository ports, overlay/runtime/scratch region ports must not be per-file handwritten full spies. Use production TypeScript interfaces or shared typed spy factories; if such helper is missing, the test-writer must add a shared helper before writing the test.
- No test may use "callback called once" as main acceptance. Callback/port invocation can only support UI command mapping or narrow dependency evidence.

### RED/GREEN/DEFERRED 状态表

| 字段/事件 | Mode/State | 期望值/行为 | 测试 ID | 测试状态 | GAP/Deferred |
| --- | --- | --- | --- | --- | --- |
| `positionSource` + `allowedMutationContracts` | play | `game-tree` + `playMove`; snapshot persistence false, next step enter-analysis. | DIAG-T01 | GREEN | Existing resolver behavior should satisfy. |
| `positionSource` + `allowedMutationContracts` | problem | `game-tree` or `scratch/problem-attempt` + `problemAttemptMove`; no `playMove` fallback. | DIAG-T01 | GREEN | Existing resolver behavior should satisfy; extend coverage if missing exact source role. |
| `positionSource` + `allowedMutationContracts` | recall | frozen source attempt + recall position + `recallAnswer`; no mutable Attempt projection. | DIAG-T01 | GREEN | Existing resolver behavior should satisfy. |
| `positionSource` + `allowedMutationContracts` | analysis | `scratch/current` + `scratchEdit`; snapshot persistence true only when scratch/current exists. | DIAG-T01 | GREEN | Existing resolver behavior should satisfy. |
| `illegal[]` | problem missing `problemView` | `ok:false`, code `missing-problem-view`, no state mutation. | DIAG-T02 | GREEN | Existing resolver behavior should satisfy. |
| `illegal[]` | problem missing active attempt/attempt | `ok:false`, code `missing-problem-attempt`, no state mutation. | DIAG-T02 | GREEN | If not covered, add step2.3 test against existing code. |
| `illegal[]` | recall missing `recallView` or active recall id | `ok:false`, code `missing-recall-view`, no state mutation. | DIAG-T02 | GREEN | If not covered, add step2.3 test against existing code. |
| `illegal[]` | recall missing frozen source attempt | `ok:false`, code `missing-frozen-source-attempt`, no state mutation. | DIAG-T02 | GREEN | If not covered, add step2.3 test against existing code. |
| `illegal[]` | recall polluted with `problemView` | `ok:false`, code `problem-view-in-recall`, no state mutation. | DIAG-T02 | GREEN | Existing resolver behavior should satisfy. |
| `illegal[]` | non-recall with checkpoint/correction draft | `ok:false`, code `checkpoint-without-recall`, no state mutation. | DIAG-T02 | GREEN | Existing resolver behavior should satisfy. |
| `illegal[]` | non-analysis territory/compare overlay | `ok:false`, `non-analysis-territory-overlay` / `non-analysis-compare-overlay`, no overlay cleanup by resolver. | DIAG-T02 | GREEN | Existing resolver behavior should satisfy. |
| `illegal[]` | analysis without scratch/current | `ok:false`, code `analysis-missing-scratch-current`, `snapshotPersistAllowed:false`. | DIAG-T02 | GREEN | Existing resolver behavior should satisfy. |
| `diagnostics[]` | legacy Sabaki mode mismatch | Non-blocking diagnostic; WorkbenchTab.mode remains truth. | DIAG-T04 | GREEN | Existing resolver behavior should satisfy. |
| `diagnostics[]` | old source/live/provider mismatch | Non-blocking diagnostic; no mode/command/source-specific branch. | DIAG-T04 | GREEN | Existing resolver behavior should satisfy. |
| diagnostics policy | preflight `ok:false` | decision `reject`, illegal codes preserved, no repair ops. | DIAG-T05 | RED | Step2.3 implementation may add pure classifier/helper in `modeStateResolver.ts`; does not touch shared flow. |
| diagnostics policy | preflight diagnostics-only | decision `allow`, diagnostic codes preserved for logging, no reject. | DIAG-T05 | RED | Step2.3 implementation may add pure classifier/helper. |
| diagnostics policy | postflight `ok:false` | decision `invalid_after_commit`, no repair ops/rollback. | DIAG-T05 | RED | Step2.3 implementation may add pure classifier/helper. |
| flow preflight consumption | `submit` / `enterAnalysis` / `snapshot` | Shared flow rejects illegal state before writes/effects. | DIAG-T06 | DEFERRED | Deferred to step3 integration due shared `workbenchFlowService.ts` lock with step2.2. |
| flow postflight consumption | `enterAnalysis` / `returnFromAnalysis` / `completeRecall` | Shared flow evaluates post-effect snapshot and surfaces invalid-after-commit without repair. | DIAG-T07 | DEFERRED | Deferred to step3 integration. |
| production composition | app path | Diagnostics deps/snapshot provider wired explicitly; no hidden global/source-specific APIs. | DIAG-T08 | DEFERRED | Deferred to step3 integration. |
| rendered UI return | diagnostics-only allowed transition | Existing subscriptions/projected props update UI after allowed transition. | DIAG-T09 | DEFERRED | Not a step2.3 UI task; activate only in step3 if flow integration changes projection/render path. |

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
2. Do not claim `CONTROLLER_STATE_TRANSITION` or `SERVICE_REPOSITORY_TRANSITION` while mocking the production service/store responsible for the transition.
3. Do not mock `resolveModeState` in any test claiming diagnostics integration; that only proves a stub was called.
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
8. Shared `workbenchFlowService.ts` production integration during step2.3 if step2.2 scratch work is still parallel-active.

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 禁止；只允许 diagnostic | Architecture v0.5 lines 23-25, 100-110; resolver currently uses source/provider only in `sourceLooksLikeLiveFeed` diagnostics at `modeStateResolver.ts` lines 174-183. | DIAG-T04 locks non-blocking diagnostic behavior. |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 禁止 | Architecture v0.5 lines 711-720 | Step2.3 不新增 API； step3 DIAG-T08 must scan composition/integration. |
| 是否让 `snapshotService` 承担 Architecture v0.5 未分配给它的 tab opening / flow orchestration | 禁止 | Architecture v0.5 lines 100-110; current flow uses `tabService.openTask` in `workbenchFlowService.ts` lines 1157-1161. | Keep snapshotService capture-only; DIAG-T08 deferred to step3 composition. |
| 是否让 container 直接写 store，而不是通过 v0.5 指定 service | 不允许；本 slice 不改 container | Architecture v0.5 lines 180-199; Container subscribes/projects at `TrainingWorkbenchContainer.js` lines 63-66, 87-114. | No step2.3 container edits. |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 不允许；本 slice 无 UI wiring | Architecture v0.5 lines 89-110 | No UI component changes/tests except deferred rendered-return if step3 needs it. |
| 是否让 `modeStateResolver.ts` 写状态或 repair | 禁止 | AGENTS lines 37-41; implementation notes lines 63-90, 106-120; current source lines 20-139 are projection-only. | DIAG-T03 and DIAG-T05 required. |
| 是否把 diagnostics 规则塞进 `modeTransitions.ts` | 禁止 | `modeTransitions.ts` lines 1-10 pure policy; implementation notes lines 63-76 separate transition policy vs resolver invariants. | Step2.3 policy/helper belongs in resolver/diagnostics layer, not transition table. |
| 是否让 `workbenchFlowService.ts` 变成巨型 state bucket | 风险；本 step deferred | AGENTS lines 39-42; implementation notes lines 190-203 | Step3 must call diagnostics/child owners without absorbing runtime/scratch internals. |
| 是否静默修复业务事实或用户产物 | 禁止 | AGENTS lines 40-41; implementation notes lines 106-120; PRD lines 116-131. | DIAG-T05 rejects any repair ops; step3 tests forbid store/repository writes from diagnostics path. |
| 是否将 `problem` 当作 board mode 或新增 review/checkpoint/punishment mode | 禁止 | AGENTS lines 30-32; PRD lines 235-253. | Resolver projection keeps four WorkbenchMode values only. |
| 是否允许 Recall/Analysis 修改 game tree or source Attempt | 禁止 | AGENTS line 32; position mutation contract lines 154-170; PRD lines 356-357. | Diagnostics must reject/diagnose state but not mutate; underlying executor tests remain separate. |

## 16. Workbench 接线清单（如适用）

本任务不是 already-drawn UI control wiring；没有 presentational control callback signature 需要锁定。以下表只记录 diagnostics command ownership，避免 test-writer 扩大到 UI callback 或 callback-once 验收。

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N/A service command | `submit` | `workbenchFlowService` | Architecture lines 112-158, 180-199 | step3 preflight reject or allowed submit effects | existing store subscriptions/projection | DIAG-T06 deferred | step3 integration |
| N/A service command | `enterAnalysis` | `workbenchFlowService` + scratch owner/mode effects | Architecture lines 137-148; design notes lines 148-159 | step3 preflight + explicit analysis effects | existing subscriptions/projection | DIAG-T06/DIAG-T07 deferred; scratch details step2.2 | step3 integration after step2.2 |
| N/A service command | `returnFromAnalysis` | `workbenchFlowService` + child regions | Architecture lines 140-158 | step3 postflight restored mode check | existing subscriptions/projection | DIAG-T07 deferred | step3 integration |
| N/A service command | `snapshotFromCurrentContext` | `workbenchFlowService`; `snapshotService` capture only; `tabService.openTask` | PRD lines 255-269; Architecture lines 711-720 | analysis-only snapshot persists child task/tab | existing subscriptions/projection | DIAG-T08 deferred | step3 integration |
| Diagnostics policy | `classify preflight/postflight resolver result` | `modeStateResolver.ts` diagnostics helper | implementation notes lines 75-90, 204-219 | no state write; returns decision | no subscription | DIAG-T05 step2.3 | diagnostics-region |

Weak-test ban: callback invocation count is not acceptable as primary acceptance for this slice.

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| diagnostics contract/docs | this contract file only | source docs/current code | Read/write scope disjoint from production code. | None besides audit feedback. |
| diagnostics resolver/policy tests | `test/training/modeStateResolver.test.js` or dedicated diagnostics-policy test | approved DIAG-T01..T05 | Does not touch shared flow production; can run while scratch contract/tests proceed. | Test naming/status must not imply flow integration landed. |
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
| DIAG-RC07 | Structured log payloads include at least `tabId`, `phase` (`preflight`/`postflight`), `fromMode`, `toMode` when known, command/method, `illegalCodes`, `diagnosticCodes`, and reason/correlation id when available. | step3 integration | Manual review + focused assertions on payload shape, not exact wording. |
| DIAG-RC08 | Tests that claim state transition use real production `workbenchFlowService`, `resolveModeState`, and stores; mocks may only cover typed external ports. | test-writer/test-audit | Test audit rejects fake-green mocks. |
| DIAG-RC09 | No rendered UI return test is required until step3 changes projection/render path; if added, it must render real Shell/Panel rather than only `container.render().props`. | step3 or later | RENDERED_UI_RETURN either implemented with real render or remains explicitly deferred. |
