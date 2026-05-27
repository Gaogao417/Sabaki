Date: 2026-05-27
Status: ready-for-contract-audit
Gate: step2.1.contract
Slice: runtime companion child-region cleanup and ownership

# 契约草案

## 0. 真源对齐

本节只列 authoritative source truth。产品与架构判断只来自 active `docs/product/`、`docs/architecture/`、`docs/ui_ux/`；优先级为 product > architecture > ui_ux。`AGENTS.md`、`docs/design/`、slice plan、checklist 和当前实现证据只作为 guardrail / implementation clarification / derived scope / current evidence，不得覆盖本表。

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | 5.2, lines 235-269 | Workbench 运行态 mode 只有 `Play / Problem / Recall / Analysis`。`WorkbenchMode.problem` 拥有 `problemView` 等运行态 companion；`RecallCheckpoint` 是 Recall 子流程，不是独立 mode。Snapshot 必须先经 Analysis scratch/current，不属于本 runtime cleanup slice。 |
| `docs/product/sabaki-training-prd.md` | 6.2.6, lines 411-427 | Recall 命中 major/severe BadMove 后进入 checkpoint 子流程；用户先摆 correction line，checkpoint 完成后继续 Recall 或进入 Analysis。本 slice 只处理 checkpoint runtime transient 的激活/清理，不定义 AI reveal 或 comment persistence 规则。 |
| `docs/product/sabaki-training-prd.md` | 10.3-10.4, lines 1321-1344 | `ProblemAttempt` 不是平行主事实；BadMove 可绑定 `attemptId` / `checkpointId`。runtime cleanup 不得改写 Attempt 或 BadMove 等持久事实。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 0.3, lines 89-110 | UI 只展示，Container/Controller 调 Service，Service 编排业务动作，Store 不调 Service；禁止 `snapshotService` 打开 Tab，禁止根据 `origin.provider` 分叉主流程。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 0.4, lines 112-155 | mode transition 必须收敛到可测状态机；`submit` 进入 recall，`enterAnalysis` 保存 return target，`return` 恢复 target，checkpoint 是 Recall substate，非法转换必须 reject/throw。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 1.2-1.3, lines 180-209 | 命令写路径是 `UI Component -> Controller/Container -> Service -> Store/Repository/Adapter -> Existing Sabaki Core`；Store 不依赖 Service，Container 不直接写业务 Store。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 4.2, lines 474-490 | `WorkbenchTab` 拥有 `mode`、`activeAttemptId`、`activeRecallSessionId`、`recallSubstate`、`analysisReturnTarget` 等 tab-level 状态。runtime owner 不能反向写 mode。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 4.3, lines 564-585 | `trainingRuntimeStore` 只保存当前训练运行态，不保存完整历史事实；相关字段包括 `activeRecallSessionId`、`activeCheckpointId`、`correctionDraft`、`visibleBadMoveIds`。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 5.3, lines 727-802 | `workbenchFlowService` 是 Tab 内 mode 转换和跨实体流程编排入口；`submit`、`enterRecall`、`completeRecall`、`enterAnalysis`、`returnFromAnalysis`、`restartAttempt` 是 mode/workflow 命令；非法转换必须 reject 并记录日志。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 9.4, lines 1811-1826 | Submit 链路必须经 `TrainingWorkbenchContainer.handleSubmit -> workbenchFlowService.submit -> attempt/recall services -> workbenchStore.updateTab({mode:'recall', activeRecallSessionId}) -> trainingRuntimeStore.setActiveRecallSession(...)`。本 slice 将 runtime transient writes 收束到 runtime-region owner，但业务顺序不变。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 9.5, lines 1828-1869 | Recall checkpoint 链路可以激活 `activeCheckpointId`，提交 correction 后保存修正线，comment/resume 后清 active checkpoint。runtime owner 只处理 runtime transient，不拥有 checkpoint repository fact。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 9.6, lines 1871-1878 | 进入 Analysis 的 service path 是 `workbenchFlowService.enterAnalysis -> workbenchStore.updateTab({mode:'analysis', analysisContext, analysisReturnTarget})`；Analysis panel 读 badMoves/comments/candidates。temporary Analysis 不应把 source runtime 当成新的 mutable target。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 10.1-10.4, lines 1936-1993 | UI 按 `tab.mode` 选择四个 panel；checkpoint UI 从 `trainingRuntimeStore.activeCheckpointId` 读入并加载 checkpoint 详情。UI/projection 是下游回流，不是本契约主验收。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | 0, lines 23-31 | UI/UX 只提供控件位置、视觉状态和文案；可见 mode 固定为四个；Recall 普通回忆和 RecallCheckpoint 是同一 mode 的两种表面。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | 7.2, lines 620-647 | checkpoint 队列和当前 checkpoint 表面要求：当前 checkpoint 显示来源、moveNumber、状态，用户先摆 correction line，再提交修正图。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | 9.4, lines 878-884; 15.2, lines 1218-1225 | UI 必须与 Architecture v0.5 状态机表一致；Checkpoint 是 Recall substate，不是第五个 mode；Analysis return 恢复 saved target。 |

### 0.1 Guardrail / Clarification / Evidence

| 非真源上下文 | 类型 | 行索引 | 用法限制 |
| --- | --- | --- | --- |
| `AGENTS.md` | repository guardrail | lines 24-45 | 约束 resolver/store/service 边界、WorkbenchMode 父状态机、child region 不反写 mode、测试验证最终 outcome。不得覆盖 active PRD/Architecture/UI truth。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` | derived scope / gate ledger | lines 42-64 | 只限定 step2.1 scope：runtime companion cleanup 归 owner，`workbenchFlowService.ts` 是 shared integration point，不能同时做 step2.2 scratch 或 step2.3 diagnostics。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | workflow ledger | lines 20-27 | 说明 step1 overlay 已过 review，当前未完成项是 step2.1 contract。不得作为产品/架构事实来源。 |
| `docs/design/workbench-mode-orchestration-contract.md` | implementation clarification | lines 39-47, 56-71, 76-129, 150-211 | 用于理解 companion state 表、当前 gap 和 runtime cleanup 迁移意图；不是 active truth。若与 PRD/Architecture 冲突，以 active truth 为准。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | implementation clarification | lines 15-28, 92-129, 170-188 | 用于 child-region owner 模型和 transient state 可自动同步清单；不得引入新业务事实或大改架构。 |
| `src/modules/training/store/trainingRuntimeStore.ts` | current implementation evidence | lines 47-107, 148-177, 222-289 | 证明 runtimeStore 现有字段与 setters；现状有 setter 级联清理，但不是 mode transition owner。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | current implementation evidence | lines 472-579, 625-846, 989-1101 | 证明当前 flow service 在 submit/completeRecall/checkpoint commands 中直接或间接分散调用 runtime setters；用于判定 RED/GREEN，不是契约来源。 |
| `src/modules/training/recall/recallCheckpointService.ts` | current implementation evidence | lines 83-126, 137-154, 237-303 | 证明 checkpoint service 当前同时写 repository fact 和 runtime transient；step2.1 可把 runtime transient 写入委托给 runtime-region owner。 |
| `test/training/workbenchFlowService.test.js` | current test evidence | lines 330-364, 540-571, 1406-1416, 1498-1518 | 现有测试覆盖部分 submit/complete/invalid transitions，但未证明 runtime-region owner、stale checkpoint cleanup、activeRecallSession cleanup 或 rejected atomicity 的完整 runtime outcome。 |
| `test/workbench/wiring/phase5-checkpoint-command-path.test.js` | current test evidence | lines 1-13, 206-261, 320-389 | 现有 checkpoint tests 使用真实 flow/checkpoint/runtime store 和 in-memory repo，适合作为 harness 参考；但不能把 callback-only 或直接 setter 清理当成 step2.1 主验收。 |

### 0.2 Active Source Row Coverage

| Source Row | Required Behavior | Test ID | Layer | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PRD 5.2 lines 237-253 | Runtime cleanup must preserve the four Workbench modes and must not turn Problem, checkpoint, Review, or punishment problem into new board modes. | RTM-T10 | ARCHITECTURE_BOUNDARY | RED | Requires source/API boundary check after runtime-region owner lands. |
| PRD 5.2 lines 246-250 | `problemView` belongs to `WorkbenchMode.problem`; `RecallCheckpoint` belongs to Recall substate. Successful Problem/Play submit into Recall must remove problem runtime and activate recall runtime. | RTM-T01, RTM-T02 | SIDE_EFFECT_BOUNDARY | RED | Existing tests cover only part of the final state and not the owner boundary or stale checkpoint cleanup. |
| PRD 6.2.6 lines 413-427 | Completing/skipping checkpoint returns to Recall or Analysis without keeping stale active checkpoint runtime. | RTM-T05 | SIDE_EFFECT_BOUNDARY | RED | Existing phase5 tests prove some final outcomes, but runtime ownership is still scattered. |
| Architecture 0.3 lines 91-110 | UI/Container cannot directly repair runtime; Store cannot call service; snapshot/source-specific APIs cannot own runtime cleanup. | RTM-T10 | ARCHITECTURE_BOUNDARY | RED | Runtime owner may depend on runtimeStore, not UI, repository, DB, snapshotService, or Workbench mode writers. |
| Architecture 0.4 lines 137-148 | Submit, enterAnalysis, return, checkpoint resume rows must only sync runtime after the transition/service action succeeds. | RTM-T01, RTM-T04, RTM-T05, RTM-T06, RTM-T07, RTM-T08 | SIDE_EFFECT_BOUNDARY | RED / GREEN | RTM-T07/RTM-T08 may be current GREEN for atomicity, but must still be written as regression guards. |
| Architecture 1.2 lines 180-199 | State-forward tests must exercise the real command path through `workbenchFlowService`, real workbenchStore, real runtimeStore, and production runtime-region owner/adapter. | RTM-T01 to RTM-T09 | SIDE_EFFECT_BOUNDARY / STORE_SUBSCRIPTION | RED | Forbidden: mocked flowService, mocked runtimeStore setters, callback-only/logger-only assertions. |
| Architecture 4.2 lines 478-490 | `WorkbenchTab` remains the owner of mode/return target; runtime-region owner cannot write mode or repair tab state. | RTM-T10 | ARCHITECTURE_BOUNDARY | RED | Source boundary must prevent child region from importing `workbenchStore` or `workbenchFlowService`. |
| Architecture 4.3 lines 564-585 | Runtime transient fields must be cleaned/activated as current runtime state, not persisted facts. | RTM-T01 to RTM-T05, RTM-T09 | SIDE_EFFECT_BOUNDARY / STORE_SUBSCRIPTION | RED | Fields in scope: `problemView`, `recallView`, `activeRecallSessionId`, `activeCheckpointId`, `correctionDraft`. |
| Architecture 5.3 lines 746-756, 779-802 | `submit`, `enterRecall`, `completeRecall`, `enterAnalysis`, `returnFromAnalysis`, and checkpoint resume commands must reject illegal transitions atomically. | RTM-T01, RTM-T03, RTM-T04, RTM-T06, RTM-T07 | SIDE_EFFECT_BOUNDARY | RED / GREEN | Illegal command tests must assert final runtime snapshot, not setter order. |
| Architecture 9.4 lines 1811-1826 | Submit creates/finalizes recall path, patches tab to recall, then activates runtime recall session. | RTM-T01, RTM-T02 | SIDE_EFFECT_BOUNDARY | RED | Test must use real attempt/recall service or typed in-memory repository fake, not flow mocks. |
| Architecture 9.5 lines 1828-1869 | Checkpoint activation/resume affects runtime checkpoint id/draft only as transient state; checkpoint fact writes stay in recallCheckpointService/repository. | RTM-T05, RTM-D04 | SIDE_EFFECT_BOUNDARY / SERVICE_REPOSITORY_TRANSITION | RED / DEFERRED | StartCheckpoint activation path is deferred unless step2.1 implementation touches recall move/start path. |
| Architecture 9.6 lines 1871-1878 | Temporary enterAnalysis preserves saved return target and does not convert source runtime into mutable Analysis state. | RTM-T06 | SIDE_EFFECT_BOUNDARY | RED | The test guards against over-cleaning source runtime during temporary Analysis entry/return. |
| Architecture 10.1-10.4 lines 1936-1993 | Runtime state changes must be observable through store subscriptions for later projection, but rendered UI return is outside step2.1. | RTM-T09, RTM-D01 | STORE_SUBSCRIPTION / RENDERED_UI_RETURN | RED / DEFERRED | No rendered Shell/Panel assertions in this slice. |
| UI/UX lines 23-31, 878-884 | UI remains four-mode; checkpoint is a Recall surface; Analysis return restores saved target. | RTM-T06, RTM-D01 | SIDE_EFFECT_BOUNDARY / RENDERED_UI_RETURN | RED / DEFERRED | UI/UX only contributes control/state placement and visible policy, not runtime owner internals. |

### 0.3 Derived Guardrail Coverage

| Source Row | Required Behavior | Test ID | Layer | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Slice plan step2.1 lines 42-45, 53-64 | Route `problemView` / `recallView` / checkpoint transient cleanup through runtime-region owner instead of scattered `runtimeStore.setX` calls. | RTM-T10 | ARCHITECTURE_BOUNDARY | RED | Derived scope only; active truth still controls business semantics. |
| Design notes lines 92-104 | Only transient companion/projection/cache can be auto-synced: `problemView`, `recallView`, `activeCheckpointId`, `correctionDraft`, visible UI cache. | RTM-T01 to RTM-T05 | SIDE_EFFECT_BOUNDARY | RED | Persistent facts such as Attempt, RecallSession, Checkpoint, comments remain outside runtime owner. |
| AGENTS.md lines 36-45 | Parent sends transition intent; child region handles cleanup and notification; tests verify final outcome. | RTM-T01 to RTM-T10 | SIDE_EFFECT_BOUNDARY / ARCHITECTURE_BOUNDARY | RED | Guardrail matches step2.1 but does not replace active docs. |

## 1. 用户故事

作为训练工作台用户，我在 Play/Problem 提交 attempt 后进入 Recall、在 Recall 完成后进入 Analysis、在 checkpoint 完成/跳过后回到 Recall 时，界面和后续命令只看到与当前 mode/substate 匹配的 runtime companion。旧的 `problemView`、旧 recall projection、旧 active checkpoint 和 correction draft 不会残留到新的流程；如果命令被拒绝或中途失败，这些 runtime companion 也不会被误清，避免用户丢失仍然有效的当前状态。

作为实现者，我需要一个 runtime-region owner/adapter 接收成功 transition 或 checkpoint substate intent，并由它集中写 `trainingRuntimeStore` transient state。`workbenchFlowService` 仍然是父状态机/编排入口，runtime owner 不能写 WorkbenchMode、不能写 repository fact、不能调用 UI、不能用日志作为验收 oracle。

## 2. 用户动作

1. Play active attempt 点击 Submit，触发 `workbenchFlowService.submit(tabId)`，成功后进入 Recall。
2. Problem active attempt 点击 Submit，触发 `workbenchFlowService.submit(tabId)`，成功后进入 Recall。
3. 从已有 attempt 进入 Recall，触发 `workbenchFlowService.enterRecall({tabId, attemptId})`。
4. Recall 点击结束/完成，触发 `workbenchFlowService.completeRecall(tabId)`，进入 Analysis 的 completed recall 路径。
5. Recall checkpoint 中点击 `跳过 checkpoint` 或保存 comment 后 resume，触发 `workbenchFlowService.skipCheckpoint(tabId)` / `saveCheckpointComment({tabId, content})`。
6. Recall/Problem 临时进入 Analysis 再返回，触发 `enterAnalysis` / `returnFromAnalysis`，source runtime 应作为 read-only return context 保留，不被当成完成清理。
7. 用户或 UI 触发非法转换，例如 non-recall `completeRecall` 或 analysis without return target `returnFromAnalysis`；命令 reject，runtime snapshot 必须保持原样。

上游调用签名证据只作为防假绿 guardrail；本 slice 不要求 UI command mapping 测试，除非 test-writer 触碰 UI/container：

| 调用方 | 真实调用签名 | 证据 | 假绿风险 |
| --- | --- | --- | --- |
| `ModeBar` | `onClick: () => onModeChange(key)`，其中 `key` 是 mode string。 | `src/components/workbench/shell/ModeBar.js:62` | 测试不得按 `(mode, event)` 调用 mode handler。 |
| `WorkbenchShell` | `h(ModeBar, {activeMode: mode, onModeChange, ...})` | `src/components/WorkbenchShell.js:138-139` | Shell 只透传 callback，不拥有 runtime state。 |
| `TrainingWorkbenchContainer.handleSubmit` | `handleSubmit()` 无参数，内部 `await flowService.submit(activeTab.id)`。 | `src/components/TrainingWorkbenchContainer.js:136-139` | callback 被调用一次不能证明 runtime cleanup。 |
| `TrainingWorkbenchContainer.handleEndRecall` | `handleEndRecall()` 无参数，内部 `flowService.completeRecall(activeTab.id)`。 | `src/components/TrainingWorkbenchContainer.js:164-167` | 不能用 mocked flowService 证明 state-forward。 |
| `TrainingWorkbenchContainer.handleSkipCheckpoint` | `handleSkipCheckpoint()` 无参数，内部 `await flowService.skipCheckpoint(activeTab.id)`。 | `src/components/TrainingWorkbenchContainer.js:637-640` | checkpoint tests 必须看 repository/runtime final outcome。 |
| `TrainingWorkbenchContainer.handleSaveCheckpointComment` | `handleSaveCheckpointComment({content})`，内部 `await flowService.saveCheckpointComment({tabId, content})`。 | `src/components/TrainingWorkbenchContainer.js:643-646` | 测试若传字符串而非 `{content}` 是假绿风险。 |

## 3. 当前阶段

当前阶段是 step2.1 runtime companion child-region cleanup。step1 overlay child-region 已完成并通过 architecture review。step2.1 只处理 runtime companion transient cleanup/activation ownership，不处理：

- overlay territory/compare cleanup，已由 step1 owner。
- analysis scratch workspace、engine target、stale scratch result，属于 step2.2。
- `modeStateResolver` production diagnostics/reject policy，属于 step2.3。
- Snapshot flow、source-specific tab opening、UI rendered projection、visual/layout。

## 4. 位置源

| Mode / Substate | 相关位置源 | 本 slice runtime 约束 |
| --- | --- | --- |
| `play` | `game-tree` | `problemView=null`、`recallView=null`、`activeRecallSessionId` 无 active recall、`activeCheckpointId/correctionDraft` absent。runtime owner 不改变 game tree 或 Attempt line。 |
| `problem` | `problem-attempt` | `problemView` 可以存在并指向 active problem attempt；`recallView=null`；checkpoint transient absent。Problem submit 成功后清 `problemView` 并进入 recall runtime。 |
| `recall` normal | `reference/current` 或 recall expected/current position；source Attempt read-only | `recallView` 与 `activeRecallSessionId` active；`problemView=null`；无 active checkpoint。 |
| `recall` checkpoint | `reference/current` at checkpoint position plus correction draft | `activeCheckpointId` 与 `correctionDraft.checkpointId` 可存在；skip/resume/comment 成功后清 checkpoint transient 并保留/刷新 recall runtime。 |
| `analysis` temporary from play/problem/recall | `scratch/current` for analysis, source runtime as read-only return context | `enterAnalysis` 不应把 source runtime 当成 mutable Analysis target；return 后仍能恢复 source mode runtime。Scratch lifecycle deferred to step2.2。 |
| `analysis` completed recall path | `scratch/current` for post-recall analysis | completed recall runtime must clear `recallView`、`activeRecallSessionId`、`activeCheckpointId`、`correctionDraft`。 |

## 5. 变更契约

| Contract | 是否适用 | 说明 |
| --- | --- | --- |
| `playMove` | 不适用 | 本 slice 不处理棋盘点击落子或正式棋谱写入。 |
| `scratchEdit` | 不适用 / DEFERRED | Analysis scratch workspace、edit position、engine target 属于 step2.2。 |
| `recallAnswer` | 部分相关但不实现 | Recall answer/checkpoint persistence 属于 recall services；本 slice只接管 checkpoint/recall runtime transient activation/cleanup。 |
| `variationMove` | 不适用 | 不处理 game-tree variation。 |
| `无变更` | 对持久事实适用 | Runtime owner 不修改 Attempt、RecallSession、RecallAttempt、RecallCheckpoint、MoveComment、Task、BadMove、MoveEvaluation、SGF tree。 |
| `runtimeCompanionTransition` | 适用 | 成功 command/transition 后，父编排调用 production runtime-region owner/adapter，例如 `onWorkbenchModeTransition`、`onRecallActivated`、`onRecallCompleted`、`onCheckpointResumed`。名称可调整，但 typed boundary、owner 语义和 final runtime outcome 必须成立。 |

## 6. 预期状态流

### 6.1 Play/Problem Submit -> Recall

```text
UI event
-> callback prop onSubmit / onSubmitAnswer
-> TrainingWorkbenchContainer.handleSubmit()
-> workbenchFlowService.submit(tabId)
-> assertTransition(tab, 'submit')
-> attempt/problem service + recallService create/finalize/freeze/create recall session
-> workbenchStore.updateTab({mode:'recall', recallSubstate:'normal', activeRecallSessionId})
-> runtime-region owner receives successful recall activation intent
-> trainingRuntimeStore final state:
   problemView=null
   activeRecallSessionId=session.id
   recallView hydrated from session
   activeCheckpointId=undefined
   correctionDraft=undefined
-> trainingRuntimeStore subscribers are notified with final cleaned/activated snapshot
-> projection/UI return is downstream and not asserted in step2.1
```

The runtime cleanup must happen after the transition/service operation succeeds. If `assertTransition`, problem submit, freeze/finalize, or recall creation rejects, runtime remains unchanged.

### 6.2 Enter Recall From Attempt

```text
UI/command owner
-> workbenchFlowService.enterRecall({tabId, attemptId})
-> recallService creates session from attempt
-> workbenchStore.updateTab({mode:'recall', recallSubstate:'normal', activeRecallSessionId})
-> runtime-region owner activates recall runtime
-> trainingRuntimeStore final state:
   problemView=null
   activeRecallSessionId=session.id
   recallView hydrated from session
   activeCheckpointId=undefined
   correctionDraft=undefined
```

This protects the explicit `enterRecall` API in Architecture v0.5, not only the `submit` path.

### 6.3 Recall Complete -> Analysis

```text
UI event
-> TrainingWorkbenchContainer.handleEndRecall()
-> workbenchFlowService.completeRecall(tabId)
-> assertTransition(tab, 'completeRecall')
-> recallService.completeRecall(recallSessionId) persists recall completion according to recall service contract
-> workbenchStore.updateTab({mode:'analysis', previousMode:'recall', analysisReturnTarget, analysisContext})
-> runtime-region owner receives recall-complete transition intent
-> trainingRuntimeStore final state:
   recallView=null
   activeRecallSessionId=undefined
   activeCheckpointId=undefined
   correctionDraft=undefined
   problemView already null and remains null
-> store subscriber observes cleaned runtime snapshot
```

If recall completion persistence is async/fire-and-forget during migration, tests must still assert runtime final state after the synchronous command path settles. Do not use logger output as the oracle.

### 6.4 Checkpoint Resume / Skip Cleanup

```text
UI event
-> TrainingWorkbenchContainer.handleSkipCheckpoint()
   or handleSaveCheckpointComment({content})
-> workbenchFlowService.skipCheckpoint(tabId)
   or saveCheckpointComment({tabId, content})
-> recallCheckpointService writes repository facts:
   checkpoint status/completedAt/comment
   recallSession currentMoveIndex
-> workbenchStore.updateTab({recallSubstate:'normal'})
-> runtime-region owner receives checkpoint resumed/skipped intent
-> trainingRuntimeStore final state:
   activeCheckpointId=undefined
   correctionDraft=undefined
   recallView refreshed or still active for the same recall session
   activeRecallSessionId remains current recall session id
-> no Attempt protected fields are written
```

Start checkpoint activation is in scope only if the implementation touches the recall move/startCheckpoint path. Otherwise it is deferred because current step2.1 can land cleanup ownership through `workbenchFlowService` checkpoint commands without expanding into recall move controller work.

### 6.5 Temporary Analysis Entry / Return

```text
UI event
-> TrainingWorkbenchContainer.handleModeChange('analysis')
-> workbenchFlowService.enterAnalysis(tabId, {reason:'manual'})
-> workbenchStore.updateTab({mode:'analysis', previousMode, analysisReturnTarget, analysisContext})
-> runtime-region owner records/observes transition intent but does not clear source runtime for temporary Analysis
-> returnFromAnalysis({tabId, reason:'return'})
-> workbenchStore restores saved mode/recallSubstate/treePosition/moveIndex
-> runtime state for source problem/recall remains available as read-only return context
```

This row prevents over-cleaning. Completed recall to Analysis is different from temporary Analysis entry.

### 6.6 Rejected / Failed Transition Atomicity

```text
Command enters workbenchFlowService
-> precondition/transition guard rejects
   or required service/repository call rejects before successful transition commit
-> no workbench tab commit for the new mode
-> runtime-region owner is not invoked for cleanup
-> trainingRuntimeStore snapshot remains deep-equal to pre-command snapshot
```

The atomicity oracle is final `workbenchStore` + `trainingRuntimeStore` state, not setter call count or logs.

### 6.7 Temporary Migration Seams

| Segment | Current status | Exit condition |
| --- | --- | --- |
| Scattered `runtimeStore.setX` calls in flow/checkpoint services | Current implementation writes runtime fields in multiple places | step2.1 introduces production runtime-region owner and routes transition/checkpoint transient writes through it. |
| `recallCheckpointService` owns persistence and runtime cleanup together | Active Architecture v0.5 allows service to write runtime store, but step2.1 guardrail wants runtime transient writes centralized | Service may still own repository facts; runtime transient writes move to owner/adapter or typed runtime port. |
| Temporary Analysis scratch setup | Existing `ModeEnterEffect` / legacy Sabaki adapter remains | step2.2 owns scratch workspace target/generation cleanup. |
| Resolver diagnostics | `modeStateResolver` remains read-only evidence/helper | step2.3 decides preflight/postflight diagnostics/reject policy. |
| UI projection/rendered return | Existing container/projector reads runtime store | Not tested in step2.1 unless implementation changes projection or subscriptions. |

## 7. 允许的副作用

1. `workbenchFlowService` may update `WorkbenchTab.mode`, `recallSubstate`, `activeRecallSessionId`, `previousMode`, `analysisReturnTarget`, `analysisContext`, and `currentTreePosition` through `workbenchStore` when a transition succeeds.
2. `workbenchFlowService` and/or recall checkpoint service may notify the production runtime-region owner/adapter after a successful service/transition commit.
3. Runtime-region owner may mutate only `trainingRuntimeStore` transient companion fields in scope: `problemView`, `recallView`, `activeRecallSessionId`, `activeCheckpointId`, `correctionDraft`; it may also preserve existing inactive fields when the command contract says preserve.
4. Runtime-region owner may trigger `trainingRuntimeStore.subscribe` listeners through real store setters or a real store-owned batch API.
5. Recall services may persist RecallSession / RecallAttempt / RecallCheckpoint / MoveComment facts according to existing contracts; runtime owner does not own those facts.
6. Structured logs may be emitted for audit, but logs are never the primary test oracle.

## 8. 禁止的副作用

1. Runtime-region owner must not call `workbenchStore.updateTab`, `workbenchFlowService`, UI components, renderer globals, `window.sabaki`, `snapshotService`, DB APIs, engine services, overlay region, scratch analysis, or source-specific tab opening APIs.
2. Runtime-region owner must not mutate `Attempt.userLine/result/status`, RecallSession facts, RecallAttempt facts, RecallCheckpoint facts, MoveComment, Task/Problem, BadMove/MoveEvaluation, review schedule, SGF game tree, or documentStore.
3. `workbenchFlowService` must not continue to own scattered runtime cleanup details for the in-scope fields after the owner is introduced.
4. Store must not call Service or Repository to repair runtime companion state.
5. Rejected/failed commands must not clear `problemView`, `recallView`, `activeRecallSessionId`, `activeCheckpointId`, or `correctionDraft`.
6. Temporary `enterAnalysis` must not clean source runtime as if the source flow was completed.
7. This slice must not introduce `openGameTab`, `openProblemTab`, `openSnapshotProblemTab`, old `source/kind` branching, `origin.provider` branching, snapshot orchestration, resolver repairs, scratch workspace cleanup, or rendered UI assertions as new main path.

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| RTM-C01 | WIRING / STATE | MUST_AUTOMATE | Play submit uses real `workbenchFlowService` + real runtimeStore + production runtime-region owner to activate recall runtime and clear stale problem/checkpoint/draft state after success. | Protects the primary Play/Problem -> Recall product loop. | Stale runtime contaminates Recall; tests can fake-green by checking only tab mode. |
| RTM-C02 | WIRING / STATE | MUST_AUTOMATE | Problem submit clears `problemView`, hydrates `recallView`, sets `activeRecallSessionId`, and clears checkpoint/draft only after the problem submit/recall creation succeeds. | Problem runtime is the highest-risk companion source. | Problem panel/runtime can remain active during Recall. |
| RTM-C03 | WIRING / STATE | MUST_AUTOMATE | Explicit `enterRecall({tabId, attemptId})` activates recall runtime and removes problem/checkpoint transient state. | Covers the v0.5 API beyond Submit. | One entry path works while another leaves stale state. |
| RTM-C04 | WIRING / STATE | MUST_AUTOMATE | `completeRecall` final path clears `recallView`, `activeRecallSessionId`, `activeCheckpointId`, and `correctionDraft` while transitioning tab to Analysis. | Prevents completed recall from remaining mutable/current. | Later board or checkpoint command can target completed recall runtime. |
| RTM-C05 | WIRING / STATE / SIDE_EFFECT | MUST_AUTOMATE | `skipCheckpoint` / `saveCheckpointComment` use real flow/checkpoint service/repository/runtime owner and end with checkpoint runtime cleared, recall runtime active, and no protected Attempt writes. | Covers checkpoint transient cleanup without taking over persistence facts. | Checkpoint UI/commands can remain active after resume. |
| RTM-C06 | STATE | MUST_AUTOMATE | Temporary `enterAnalysis`/`returnFromAnalysis` preserves source runtime needed for return; completed recall cleanup remains separate. | Prevents over-eager owner cleanup. | Returning to Recall/Problem loses valid runtime context. |
| RTM-C07 | STATE / SIDE_EFFECT | MUST_AUTOMATE | Invalid transition rejects atomically: runtime snapshot and tab state remain unchanged. | Required by v0.5 illegal transition behavior. | Failed command hides or destroys active user state. |
| RTM-C08 | STATE / SIDE_EFFECT | MUST_AUTOMATE | Accepted command that fails before transition commit, such as recall creation rejection during submit, leaves runtime snapshot unchanged. | Guards success-only cleanup ordering. | User loses problem/checkpoint draft after backend/service failure. |
| RTM-C09 | STATE | MUST_AUTOMATE | Real runtimeStore subscription observes final cleaned/activated snapshot for at least one owner-driven transition. | Downstream UI relies on store subscription, but UI rendering is out of scope. | Runtime changes occur without update propagation. |
| RTM-C10 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Production runtime-region owner is the only in-scope transition cleanup owner; it imports no UI/repository/flow/workbench mode writer/global Sabaki APIs, and flow/checkpoint services do not scatter raw setter cleanup for the fields under owner control. | Protects the architecture boundary this slice exists to create. | Cleanup remains ad hoc and future transitions bypass it. |
| RTM-D01 | UI_BEHAVIOR | DEFERRED | Rendered WorkbenchShell/Panel projection after runtime cleanup. | Projection/rendered UI is not part of step2.1. | Visual/control state bugs remain for UI workflow. |
| RTM-D02 | SIDE_EFFECT | DEFERRED | Analysis scratch workspace cleanup, engine target generation, stale scratch result handling. | Owned by step2.2. | Scratch/engine pollution must be handled later. |
| RTM-D03 | ARCHITECTURE_BOUNDARY | DEFERRED | `modeStateResolver` production preflight/postflight diagnostics for illegal companion states. | Owned by step2.3. | Diagnostics gap remains until dedicated slice. |
| RTM-D04 | SERVICE_REPOSITORY_TRANSITION | DEFERRED | Recall move path that calls `startCheckpoint` and activates checkpoint runtime. | Current step can cover cleanup through flow checkpoint commands; start path requires recall move/controller expansion unless implementation touches it. | Start activation may stay scattered until a recall move owner slice. |
| RTM-D05 | STATE | DEFERRED | `visibleBadMoveIds` and hint/cache cleanup beyond the listed fields. | User named primary fields; visible bad move cache needs separate owner decision if touched. | Stale UI cache may remain but is not this slice's blocking contract. |
| RTM-N01 | UI_BEHAVIOR | DO_NOT_TEST | Pixel/layout/CSS/visual selected states for mode segments or checkpoint controls. | Visual fidelity belongs to frontend visual workflow. | Business contract tests would be brittle and insufficient for visual drift. |
| RTM-N02 | PURE_LOGIC | DO_NOT_TEST | Simple getter/setter unit tests for individual runtimeStore setters as primary acceptance. | User explicitly forbids setter-call-only coverage. | False confidence without service outcome. |

## 10. 必须自动化的测试

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RTM-T01 | SIDE_EFFECT_BOUNDARY | `createWorkbenchFlowService(...).submit` from Play | Real `workbenchFlowService`, real `createWorkbenchStore`, real `createTrainingRuntimeStore`, production runtime-region owner/adapter, real attempt/recall service where practical | In-memory repository fake; logger tiny stub; modeEffects/overlay no-op if required by constructor | `in-memory repository fake` implementing production methods actually called; `local tiny stub` for logger only; shared typed factory preferred for no-op deps | Do not mock `workbenchFlowService`; do not replace runtimeStore setters; do not assert callback/logger only | Given stale runtime (`problemView`, old `activeCheckpointId`, `correctionDraft`) and Play active attempt, successful `submit` ends with tab recall, `activeRecallSessionId=session.id`, hydrated `recallView`, `problemView=null`, `activeCheckpointId=undefined`, `correctionDraft=undefined`. | RTM-T09 |
| RTM-T02 | SIDE_EFFECT_BOUNDARY | `createWorkbenchFlowService(...).submit` from Problem | Real `workbenchFlowService`, real stores, production runtime-region owner/adapter, real or typed `problemFlowService` path | In-memory repository fake; if `problemFlowService` is not production-real in harness, use shared typed fake constrained by `ProblemFlowService` interface | `real production interface/type` or `shared typed spy factory`; no per-file handwritten full service fake unless audit approves why it is only a narrow command port | Do not mock flow; do not test only `problemFlowService.submitActiveProblem` call count | Given active problem tab/runtime and successful recall creation, final runtime has `problemView=null`, active recall id/view, checkpoint/draft cleared. On rejected service result this test must not pass by clearing early. | RTM-T08, RTM-T09 |
| RTM-T03 | SIDE_EFFECT_BOUNDARY | `createWorkbenchFlowService(...).enterRecall` | Real `workbenchFlowService`, real stores, production runtime-region owner/adapter, real recall service where practical | In-memory repository fake; logger tiny stub | `in-memory repository fake` and real production service interfaces | Do not call runtime owner directly as the only proof; do not use mocked flow | Explicit `enterRecall({tabId, attemptId})` results in tab recall, hydrated `recallView`, `activeRecallSessionId=session.id`, and stale `problemView/activeCheckpointId/correctionDraft` cleared. | RTM-T09 |
| RTM-T04 | SIDE_EFFECT_BOUNDARY | `createWorkbenchFlowService(...).completeRecall` | Real `workbenchFlowService`, real stores, production runtime-region owner/adapter | Recall service may be an interface-constrained tiny async implementation only for persistence completion if current command does not await it; logger tiny stub | `real production interface/type` for recall service port or shared typed factory | Do not mock flow; do not assert only `completeRecall` service called; do not rely on logger | Given Recall tab with active session, `recallView`, `activeCheckpointId`, `correctionDraft`, successful `completeRecall` transitions tab to Analysis and final runtime clears `recallView`, `activeRecallSessionId`, `activeCheckpointId`, `correctionDraft`. | RTM-T09 |
| RTM-T05 | SIDE_EFFECT_BOUNDARY | `createWorkbenchFlowService(...).skipCheckpoint` and/or `saveCheckpointComment` | Real `workbenchFlowService`, real `createRecallCheckpointService`, real stores, production runtime-region owner/adapter, in-memory repository that records checkpoint/session/comment/attempt writes | Attempt/recall services not exercised can be typed no-op ports; logger tiny stub | `in-memory repository fake` implementing actual recall checkpoint methods; reuse/extend existing phase5 typed fake if available | Do not mock `recallCheckpointService`; do not replace runtimeStore setters; do not use rendered button click as primary oracle | After skip or save+resume, repository checkpoint/session facts are correct, tab remains recall with `recallSubstate='normal'`, runtime clears active checkpoint/draft, recall runtime remains active, and no protected Attempt fields are written. | RTM-T09 |
| RTM-T06 | SIDE_EFFECT_BOUNDARY | `createWorkbenchFlowService(...).enterAnalysis` + `returnFromAnalysis` temporary path | Real `workbenchFlowService`, real stores, production runtime-region owner/adapter | ModeEffects no-op typed adapter; repository/service deps not exercised by these commands | `real production interface/type` or shared typed factory for modeEffects | Do not test scratch workspace; do not clear runtime through test setup after command | Given Recall or Problem source runtime, manual `enterAnalysis` followed by `returnFromAnalysis` restores tab target and preserves source runtime fields needed for return; it must not apply completed-recall cleanup. | not-covered: UI projection deferred RTM-D01 |
| RTM-T07 | SIDE_EFFECT_BOUNDARY | Rejected precondition in real `workbenchFlowService` | Real `workbenchFlowService`, real stores, production runtime-region owner/adapter | Minimal typed deps; logger tiny stub | `real production interface/type`; `local tiny stub` only for logger/stateless deps | Do not mock `assertTransition`; do not use setter spies as oracle | Invalid command, such as `completeRecall` from play or `returnFromAnalysis` without target, throws/rejects; tab state and deep-cloned runtime snapshot remain unchanged. | not-covered: terminal atomicity guard |
| RTM-T08 | SIDE_EFFECT_BOUNDARY | Mid-flight failure before successful transition commit in real `workbenchFlowService.submit` | Real `workbenchFlowService`, real stores, production runtime-region owner/adapter | Recall service/repository fake configured to reject at recall creation; logger tiny stub | `real production interface/type` or `in-memory repository fake` with failure injection | Do not simulate by throwing from mocked flow; do not clear runtime in test harness cleanup | If submit preconditions pass but recall creation rejects, tab mode remains source mode and runtime snapshot remains unchanged, including `problemView` and any draft. | not-covered: terminal atomicity guard |
| RTM-T09 | STORE_SUBSCRIPTION | `createTrainingRuntimeStore.subscribe` as exercised by one real flow + runtime-region owner transition | Real flow command from RTM-T01 or RTM-T04, real runtimeStore, real subscription, production runtime-region owner/adapter | Same typed dependencies as chosen flow test | Same as chosen flow test; local listener callback is allowed | Do not assert exact setter call count or intermediate notification ordering; do not use mocked store | A subscriber observes at least one post-command snapshot matching the final cleaned/activated runtime state. | RTM-D01 (deferred rendered UI return) |
| RTM-T10 | ARCHITECTURE_BOUNDARY | Runtime-region owner module and integration boundaries | Real production source files after implementation; production exported type/interface for runtime owner/adapter | Filesystem read helper only | `real production interface/type`; local stateless source-scan helper is allowed | Do not monkeypatch modules; do not claim state-forward from source scan alone | Runtime owner imports no UI, repository, DB, snapshot, overlay/scratch/engine, `workbenchStore`, `workbenchFlowService`, or global Sabaki; it exposes no mode writer; in-scope cleanup in flow/checkpoint commands routes through owner/typed port instead of scattered raw `runtimeStore.setX` calls. | RTM-T01 to RTM-T05 |

测试状态:

| Test ID | 当前状态 | 说明 |
| --- | --- | --- |
| RTM-T01 | RED | Current flow directly calls runtime setters and current `setActiveRecallSession(session.id)` does not clear a stale checkpoint/draft when previous `activeRecallSessionId` is undefined. |
| RTM-T02 | RED | Existing problem submit tests cover `problemView=null` and active recall id, but not production runtime owner or stale checkpoint/draft cleanup. |
| RTM-T03 | RED | Current `enterRecall` sets active recall/view but does not clear stale `problemView` or checkpoint transient through an owner. |
| RTM-T04 | RED | Current `completeRecall` clears `recallView` and active checkpoint but does not clear `activeRecallSessionId`; ownership is still scattered. |
| RTM-T05 | RED | Existing phase5 tests prove some final checkpoint cleanup outcomes, but current `recallCheckpointService` writes runtime setters directly and no runtime-region owner boundary is proven. |
| RTM-T06 | RED | Current outcome may preserve runtime, but no production runtime-region owner contract exists; write as a regression guard before implementation and expect failure if the owner import/API is required. |
| RTM-T07 | GREEN | Current guard paths likely preserve runtime because they reject before cleanup. Still required to prevent future owner cleanup on reject. |
| RTM-T08 | GREEN | Current submit cleanup appears after recall creation, so failure before recall creation should preserve runtime. Still required as success-only cleanup regression guard. |
| RTM-T09 | RED | Subscription exists, but final cleaned runtime state in RTM-T04 is not currently achieved and owner-driven notification is absent. |
| RTM-T10 | RED | Production runtime-region owner/adapter and integration boundary do not yet exist. |

## 11. 仅手动验收

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | --- | --- | --- | --- | --- |
| RTM-M01 | STATE | MANUAL_ACCEPTANCE | In a running app or dev harness, submit a Problem attempt, enter Recall, then complete Recall; inspect debug state to confirm runtime companion follows the same final states as RTM-T02/RTM-T04. | Useful smoke after implementation. | Manual inspection cannot replace automated final-state tests. |
| RTM-M02 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | During Recall checkpoint, skip checkpoint and confirm active checkpoint controls disappear in the app. | Downstream user-facing sanity check. | Rendered UI is not this slice's automated oracle. |

## 12. 不测试

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | --- | --- | --- | --- | --- |
| RTM-N01 | UI_BEHAVIOR | DO_NOT_TEST | CSS, layout, design tokens, viewport fit, screenshots, visual color states. | Out of scope for business/state contract. | Must use frontend visual workflow if visual drift is suspected. |
| RTM-N02 | PURE_LOGIC | DO_NOT_TEST | Direct runtimeStore setter unit tests as the main proof, such as "setActiveCheckpoint(undefined) clears draft". | Setter behavior is an implementation detail unless exposed through owner/flow outcome. | Fake green while flow never calls owner. |
| RTM-N03 | SIDE_EFFECT | DO_NOT_TEST | Logger order/count assertions. | Logs are audit support only. | Test suite becomes brittle and misses state bugs. |
| RTM-N04 | UI_COMMAND_MAPPING | DO_NOT_TEST | Callback-called-once tests for Submit/Skip/End Recall. | Existing wiring may already cover mapping; step2.1 is state-forward ownership. | Callback tests cannot prove runtime cleanup. |

## 13. 脆弱测试警告

1. Do not assert exact `runtimeStore` setter order or notification count. Assert final runtime snapshot and at least one subscriber snapshot when subscription is the layer under test.
2. Do not mock `workbenchFlowService`, `trainingRuntimeStore`, or the production runtime-region owner for RTM-T01 through RTM-T09.
3. Do not handwrite a full fake `WorkbenchFlowService`, `RecallService`, `AttemptService`, repository, or runtime owner inside a test file unless it is constrained by a production interface or shared typed factory. Prefer extending existing typed in-memory harnesses.
4. Do not claim `RENDERED_UI_RETURN` unless rendering real Shell/Panel. Projection/rendered UI is deferred in this step.
5. Do not turn current bugs into green contract. Known gaps such as incomplete activeRecallSession cleanup are RED target behavior.
6. Do not let architecture boundary scans be the only proof. RTM-T10 is supplemental to real flow outcome tests.
7. Do not use old `source/kind`, `origin.provider`, or source-specific open APIs to branch runtime cleanup in tests or production.
8. Do not collapse RTM-T01/RTM-T02/RTM-T04 into one "state-forward" mega-test; they prove different transition rows.

## 14. 超出范围

| 项目 | 处理 |
| --- | --- |
| Overlay child region | Completed in step1; do not retest territory/compare except as untouched regression if needed by shared flow service. |
| Analysis scratch workspace / engine target | DEFERRED to step2.2. |
| `modeStateResolver` diagnostics/repair/reject policy | DEFERRED to step2.3; resolver remains read-only. |
| Snapshot flow and child tab opening | Out of step2.1; no `snapshotService` orchestration changes. |
| Rendered UI, panel projection, visual acceptance | Out of step2.1 unless implementation changes projection/subscription API; then split a UI/projection test step. |
| Problem undo / Attempt rollback | Not runtime cleanup ownership; belongs to problem flow/attempt consistency work. |
| StartCheckpoint activation through recall move controller | DEFERRED RTM-D04 unless implementation touches this path. |
| `visibleBadMoveIds` / hint caches | DEFERRED RTM-D05 unless implementation explicitly chooses to include them in runtime-region owner. |

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 禁止 | Architecture 0.3 lines 100-110 禁止根据 `origin.provider` 分叉主流程 | Runtime cleanup must branch by current successful command/transition intent and tab/runtime state, not source metadata. |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 禁止 | UI/UX lines 16-21 警告旧 path 只作迁移前理解；Architecture 5.3 定义 flow API | Step2.1 only touches runtime owner and flow/checkpoint integration; no new tab open API. |
| 是否让 `snapshotService` 承担 tab opening / flow orchestration | 禁止 | Architecture 0.3 line 107; active snapshot flow outside scope | No snapshot tests or production changes in step2.1. |
| 是否让 container 直接写 store，而不是通过 v0.5 指定 service | 禁止 | Architecture 1.2-1.3 lines 180-209; current handlers call flow service | RTM-T10 must fail if Container gets direct runtime cleanup for these fields. |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 禁止新增 | Architecture 0.3 and 1.3; UI/UX only placement | UI changes out of scope; no UI component dependency changes. |
| 是否把 checkpoint 当作第五个 WorkbenchMode | 禁止 | PRD lines 237-253; Architecture lines 152-155; UI/UX lines 878-884 | Runtime owner handles checkpoint as Recall substate/transient only. |
| 是否把 `problem` 当作 board mode | 禁止 | PRD lines 243-253 and AGENTS guardrail | Runtime cleanup must not add board mode branches. |
| 是否让 runtime owner 写 WorkbenchMode | 禁止 | Architecture 4.2 lines 478-490; 5.3 lines 727-802 | Parent flow writes tab mode; child owner writes runtime transient only. |
| 是否让 runtime cleanup 修复持久事实 | 禁止 | PRD `TrainingAttempt` freeze lines 248-249; Architecture 4.3 says runtime is current runtime only | Attempt/RecallSession/Checkpoint facts remain in services/repository. |
| 是否把 temporary Analysis 与 completed Recall Analysis 混为一谈 | 禁止 | Architecture 0.4 lines 140-142; UI/UX lines 881-883 | RTM-T04 cleans completed recall; RTM-T06 preserves temporary source runtime. |
| 是否同时做 step2.2 scratch 或 step2.3 diagnostics | 禁止 | Slice plan lines 43-46, 53-64 | Marked DEFERRED RTM-D02/RTM-D03. |

### 15.1 Runtime Field Conflict Matrix

| 字段/事件 | Mode/State | 期望值/行为 | 测试 ID | 测试状态 | GAP/Deferred |
| --- | --- | --- | --- | --- | --- |
| `problemView` | play/recall/completed analysis | `null` after successful submit/enterRecall/completeRecall cleanup | RTM-T01, RTM-T02, RTM-T03, RTM-T04 | RED | Current owner absent; some paths only partially clear. |
| `problemView` | temporary analysis from problem | preserved as read-only return context unless product/architecture later says otherwise | RTM-T06 | RED | Projection/rendered behavior deferred. |
| `recallView` | enter recall via submit/enterRecall | hydrated from created RecallSession | RTM-T01, RTM-T02, RTM-T03 | RED | Existing hydration partial, but owner not proven. |
| `recallView` | completeRecall -> analysis | `null` | RTM-T04 | RED | Current direct clear exists, but owner and active session cleanup missing. |
| `recallView` | temporary analysis from recall | preserved for return context | RTM-T06 | RED | Defends against over-cleaning. |
| `activeRecallSessionId` | enter recall via submit/enterRecall | created session id | RTM-T01, RTM-T02, RTM-T03 | RED | Owner missing. |
| `activeRecallSessionId` | completeRecall -> analysis | `undefined` | RTM-T04 | RED | Current flow does not clear runtime active recall id. |
| `activeCheckpointId` | checkpoint resume/skip/comment complete | `undefined` after successful resume to normal | RTM-T05 | RED | Existing outcome may pass, owner boundary missing. |
| `activeCheckpointId` | completeRecall -> analysis | `undefined` | RTM-T04 | RED | Current direct clear exists; owner boundary missing. |
| `activeCheckpointId` | temporary analysis from recall checkpoint | preserved if return target is checkpoint substate | RTM-T06 | RED | Product/UI says checkpoint is Recall substate and return target restores context. |
| `correctionDraft` | checkpoint correction submitted | cleared for submitted checkpoint id | RTM-D04 | DEFERRED | Existing flow command `submitCheckpointCorrection` is not mode transition cleanup; activate if step2.1 moves this path into owner. |
| `correctionDraft` | checkpoint resume/skip/comment complete | `undefined` | RTM-T05 | RED | Owner boundary missing. |
| `correctionDraft` | completeRecall -> analysis | `undefined` | RTM-T04 | RED | Current clear occurs via activeCheckpoint setter, but active session cleanup missing. |
| `correctionDraft` | failed/rejected command | unchanged | RTM-T07, RTM-T08 | GREEN | Regression guard; must remain true after owner implementation. |
| `visibleBadMoveIds` | mode transition cleanup | not specified in active truth for step2.1 primary fields | RTM-D05 | DEFERRED | Approved reason: avoid scope creep; exit when implementation chooses visible bad move cache ownership. |

## 16. Workbench 接线清单（如适用）

This is not a visual Workbench wiring task, but the runtime owner sits behind existing Workbench command wiring. The checklist below records semantic controls only; no UI/projection tests are activated unless implementation touches UI/container.

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Submit button / answer submit | `submit(tabId)` | `TrainingWorkbenchContainer` delegates; `workbenchFlowService` orchestrates; runtime-region owner cleans/activates runtime | Architecture 9.4 lines 1811-1826 | Attempt finalization/recall creation, tab recall, runtime recall active | runtimeStore subscription; UI projection deferred | RTM-T01, RTM-T02, RTM-T09 | controller + runtime owner |
| Enter Recall command | `enterRecall({tabId, attemptId})` | `workbenchFlowService` + runtime-region owner | Architecture 5.3 lines 746-750 | creates recall session, tab recall, runtime recall active | runtimeStore subscription | RTM-T03 | controller + runtime owner |
| End Recall | `completeRecall(tabId)` | `workbenchFlowService`; recallService owns persistence; runtime-region owner clears runtime | Architecture 5.3 lines 750, 776-787 | tab analysis, completed recall runtime cleared | runtimeStore subscription | RTM-T04, RTM-T09 | controller + runtime owner |
| Skip checkpoint | `skipCheckpoint(tabId)` | `workbenchFlowService`; recallCheckpointService owns persistence; runtime-region owner clears checkpoint transient | Architecture 9.5 lines 1863-1869 | checkpoint skipped/resumed, tab recall normal, active checkpoint/draft cleared | runtimeStore subscription; UI projection deferred | RTM-T05 | checkpoint service + runtime owner |
| Save checkpoint comment | `saveCheckpointComment({tabId, content})` | `workbenchFlowService`; recallCheckpointService owns comment/checkpoint facts; runtime-region owner clears checkpoint transient | Architecture 9.5 lines 1860-1869 | comment persisted, checkpoint completed, tab recall normal, active checkpoint/draft cleared | runtimeStore subscription | RTM-T05 | checkpoint service + runtime owner |
| Temporary Analysis enter/return | `enterAnalysis` / `returnFromAnalysis` | `workbenchFlowService`; runtime-region owner preserves source runtime | Architecture 0.4 lines 140-142; UI/UX lines 881-883 | tab analysis then previous mode; source runtime preserved | runtimeStore unchanged or subscription not required | RTM-T06 | controller + runtime owner |
| Invalid command | rejected flow command | `workbenchFlowService.assertTransition` / service guard | Architecture 5.3 line 801 | no tab/runtime mutation | no runtimeStore cleanup | RTM-T07 | controller |

Weak test ban: A test that only proves "callback was called once", "runtime setter was called", or "logger wrote a transition line" is not a valid RTM acceptance test. It can only be auxiliary UI command mapping evidence if UI/container changes are separately approved.

订阅契约:

| Store | Subscription requirement | Test |
| --- | --- | --- |
| `trainingRuntimeStore` | Owner-driven runtime cleanup/activation must notify subscribers through the real store. Tests should assert a subscriber observes a final snapshot, not exact setter count. | RTM-T09 |
| `workbenchStore` | Flow transition still updates tab state before/with runtime owner according to the command contract. Existing flow tests plus RTM-T01-RTM-T06 assert final tab state where relevant. | RTM-T01-RTM-T06 |

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| contracts/docs | `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/*` | none | Contract/audit only; no production/test writes. | Must not update checklist in this contract-designer agent per user request. |
| tests by runtime mode | `test/training/workbenchFlowService.test.js` or new focused runtime-region flow test | approved contract | Tests can be grouped by submit/enterRecall/complete/atomicity using shared harness. | Avoid duplicating in-memory fake services per file. |
| checkpoint runtime tests | Existing phase5 checkpoint command test or new focused service/flow test | approved contract | Checkpoint cleanup path uses different repository harness from submit. | Must keep repository fact assertions separate from runtime owner assertions. |
| runtime owner implementation | `src/modules/training/workbench/*runtime*` and possibly `src/modules/training/store/trainingRuntimeStore.ts` | tests + test audit | Owner can be implemented without scratch/diagnostics changes. | API naming must be stable enough for tests; do not batch unrelated visibleBadMove cleanup unless contracted. |
| flow integration | `src/modules/training/workbench/workbenchFlowService.ts` | runtime owner implementation | Shared integration point; should be one serial integrator edit if step2.2/2.3 run in parallel. | Merge conflicts with scratch/diagnostics branches; step3 may need integrator. |
| checkpoint service integration | `src/modules/training/recall/recallCheckpointService.ts` if touched | runtime owner implementation | Can route runtime transient calls to owner while preserving repository ownership. | Active Architecture v0.5 names runtimeStore calls here; contract audit should approve exact boundary before edit. |
| architecture review | review docs + production diff | implementation verification | Separate read-only review can verify no parent/child inversion. | Must distinguish active truth from derived guardrail. |
