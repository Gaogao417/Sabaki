Date: 2026-05-25
Status: pending-confirmation
Workflow: workbench-wiring-workflow
Step: step1
Task: phase5-checkpoint-command-path
Revision: v0.2 after contract-auditor REQUEST_CHANGES

# 契约草案

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | lines 35-45 | 产品训练链路是 Play -> Recall -> Analysis -> Snapshot -> Problem -> Bad Move -> Punishment Problem -> Review；checkpoint 只能服务 Recall 训练链路，不能变成独立 tab/mode 主路径。 |
| `docs/product/sabaki-training-prd.md` | lines 102-105, 261-337, 339-370 | Recall 的产品目标是先回忆/背谱再复盘；Recall 记录回忆错误点和关键节点，不应在 checkpoint 命令中改写源 Attempt。 |
| `docs/product/sabaki-training-prd.md` | lines 1224-1237 | Play 完成后进入 Recall；Recall 可进入 Analysis，但 Recall 本身仍负责记录回忆错误点。 |
| `docs/architecture/gabaki-sabaki-training-implementation-plan.md` | Phase 5 lines 778-827 | Phase 5 目标是 Recall 遇到 major/severe BadMove 进入主动纠错子流程；用户先提交 correction line，再 reveal AI candidate lines，再保存 comment，最后 resume Recall。UI command path 必须通过真实 service path 完成 correction -> reveal -> comment -> resume。 |
| `docs/architecture/gabaki-sabaki-training-implementation-plan.md` | lines 808-815 | Checkpoint 是 Recall substate，不是 WorkbenchMode；`correctionDraft` / `activeCheckpointId` 是 runtime companion state；reveal/comment/resume 只能写 RecallCheckpoint / MoveComment / RecallSession，不得修改 source Attempt `userLine` / `result` / `status`。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §0.4 lines 112-158 | `WorkbenchMode = play/problem/recall/analysis`；`RecallSubstate = normal/checkpoint_correction/checkpoint_ai_revealed/checkpoint_commenting`；checkpoint transitions must keep `mode=recall` and change only `recallSubstate` plus companion state. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 144-147 | Active checkpoint state machine rows are `startCheckpoint`, `revealAi`, `commentCheckpoint`, `resumeRecall`; each row must have explicit row coverage in this contract. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 790-801 | Recall checkpoint 只能改变 `recallSubstate`，不得变成独立 mode；非法转换必须 reject/throw 并记录结构化日志。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §5.9 lines 1080-1105 | `RecallCheckpointService` owns `submitUserCorrectionLine`, `revealAiCandidateLines`, `saveComment`, `skipCheckpoint`, `resumeRecall` service boundary. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | repository API lines 1326-1346 | Repository boundary for this step is RecallCheckpoint and MoveComment persistence, plus RecallSession advancement as already used by service. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §9.5 lines 1828-1869 | Command path: recall move may start checkpoint; correction writes checkpoint correction line; reveal loads AI/reference candidates; comment creates MoveComment, marks checkpoint commented, resumes Recall and clears active checkpoint. |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §10.4 lines 1986-1993 | UI return path starts from `trainingRuntimeStore.activeCheckpointId`, loads checkpoint-related facts, and projects into `RecallCheckpointPanel`. This step only closes command path and the runtime/workbench projection loop; richer candidate/comment visual rendering is not expanded beyond existing panel surface unless already present. |
| Current code evidence only, not truth source | `TrainingWorkbenchContainer.js` lines 421-458; `workbenchFlowService.ts` lines 54-65; `RecallModePanel.js` lines 175-187; `TrainingWorkbenchContainer.js` lines 928-960; runtime/workbench stores lines 144-149, 195-197 and 91-113 | Current gap: Container directly pulls checkpoint service for checkpoint actions while `workbenchFlowService` has no checkpoint commands. Existing UI has visible buttons for submit correction, reveal AI, and skip; `onSaveCheckpointComment({content})` exists at shell/container prop level but no visible comment editor is in this step's in-scope panel evidence. |
| `docs/ui_ux/workbench-ui-ux-spec.md` | lines 616-639, 876-877, 1196-1200 | UI/UX only supplies control placement and visible states: checkpoint queue/current checkpoint, `提交修正图`, `查看 AI`, `跳过 checkpoint`, and the rule that checkpoint is Recall substate. It does not override product/architecture state ownership. |

## 1. 用户故事

作为正在 Recall checkpoint 子流程中的训练用户，我点击提交修正图、查看 AI、跳过 checkpoint 或保存 checkpoint comment 时，Workbench 必须通过统一的 Workbench command path 编排这些动作。命令应更新 RecallCheckpoint / MoveComment / RecallSession 和 runtime/workbench projection，使 UI 回到正确状态，同时保持源 Attempt 的 `userLine`、`result`、`status` 不变。

## 2. 用户动作

1. 在 Recall checkpoint 卡片中点击 `提交修正图`。
2. 在 correction 已提交后点击 `查看 AI`。
3. 在 active checkpoint 中点击 `跳过 checkpoint`。
4. 保存 checkpoint comment：当前 in-scope 代码证据只有 shell/container prop `onSaveCheckpointComment({content})`；可见 comment editor/save control 不在 step1 写入范围，标记为 DEFERRED。
5. 观察 active checkpoint 清理后 UI 从 checkpoint card 回到 Recall 原线/进度状态。

真实调用签名必须锁定：

| 上游调用方 | 真实调用签名 | 证据 | 假绿风险 |
| --- | --- | --- | --- |
| `RecallModePanel` submit correction button | `onSubmitCorrection(clickEvent)`，handler 不应依赖 event payload | `RecallModePanel.js` lines 175-179 | 测试直接调用 private handler 或传 `{checkpointId}` 会掩盖 Container 是否真正从 active tab/flow command 取状态。 |
| `RecallModePanel` reveal AI button | `onRevealAI(clickEvent)`，handler 不应依赖 event payload | `RecallModePanel.js` lines 180-183 | 测试不得按 `(checkpointId)` 调用。 |
| `RecallModePanel` skip checkpoint button | `onSkipCheckpoint(clickEvent)`，handler 不应依赖 event payload | `RecallModePanel.js` lines 184-187 | 测试不得按 `(checkpointId)` 调用。 |
| `WorkbenchShell` -> `RecallModePanel` | Shell passes `...rest` into `RecallModePanel` | `WorkbenchShell.js` lines 86-90 | 测试只检查 shell prop 存在不能证明 rendered panel callback mapping。 |
| Current shell/container comment prop | `onSaveCheckpointComment({content: string})` | `TrainingWorkbenchContainer.js` lines 608-612; current tests call this shape | 没有当前 panel caller evidence；若后续 UI 用 `onSaveCheckpointComment(content)` 字符串调用，必须先改契约或加 UI_COMMAND_MAPPING 测试。 |

## 3. 当前阶段

当前阶段是 Workbench `mode='recall'`。Checkpoint 是 Recall substate，允许值为：

- `checkpoint_correction`：active checkpoint 正在等待或已收到用户 correction line。
- `checkpoint_ai_revealed`：AI/reference candidate lines 已 reveal。
- `checkpoint_commenting`：comment 保存/编辑阶段；如果 `saveCheckpointComment` 继续作为 atomic command，它仍必须显式应用 `commentCheckpoint` guard/effect，从 `checkpoint_ai_revealed` 进入 `checkpoint_commenting`，再应用 `resumeRecall` guard/effect 回到 `normal`。
- `normal`：checkpoint 保存/跳过/resume 后的 Recall 状态。

禁止新增 `mode='checkpoint'`、`mode='problem'` 分支或任何 checkpoint tab type。

## 4. 位置源

| 位置源 | 本 step 用法 | 写入权限 |
| --- | --- | --- |
| `game-tree` | 可作为原始棋谱/reference read path，被 Recall/Analysis 读取 | 禁止写入；checkpoint 命令不得调用 documentStore/game-tree move API。 |
| `scratch` | 本 step 不使用；Analysis scratch 与 checkpoint command path 无关 | 禁止写入。 |
| `problem-attempt` | 本 step 不使用；checkpoint correction 不是 Problem answer | 禁止写入。 |
| `reference/current` | reveal AI 可读取 MoveEvaluation/reference candidates；Recall panel 可显示原线/AI 线 | 只读。 |
| runtime checkpoint companion state | `trainingRuntimeStore.activeCheckpointId` 和 `correctionDraft` 是 command input companion state | 只能由 service/flow orchestration 清理或投影；Container 不拥有写入。 |

## 5. 变更契约

变更契约类型：`其他: recallCheckpointCommand`。

不是 `playMove`、不是 `scratchEdit`、不是 `recallAnswer`、不是 `variationMove`。用户 correction line 的落子捕获已在前置 checkpoint/runtime draft 中完成；step1 只负责 Workbench command path closure。

`WorkbenchFlowService` 必须成为 checkpoint command owner，并新增或等价暴露以下语义命令：

```ts
submitCheckpointCorrection(tabId: string): Promise<void>
revealCheckpointAi(tabId: string): Promise<ReferenceLine[]>
skipCheckpoint(tabId: string): Promise<void>
saveCheckpointComment(input: {tabId: string; content: string}): Promise<void>
```

命令 ownership：

- Presentational panels: 只发出 callback，不读写 service/store/repository/Sabaki。
- `TrainingWorkbenchContainer`: 只把 shell/panel callback 绑定到 flowService command；允许读取 active tab id；不得读取或调用 `recallCheckpointService` / `checkpointService`。
- `workbenchFlowService`: 负责 tab guard、active checkpoint lookup、mode transition guard、调用 checkpoint service、更新 `workbenchStore.recallSubstate`。
- `recallCheckpointService`: 负责 RecallCheckpoint / MoveComment / RecallSession 写入和 runtime companion state 清理。
- Repository: 只持久化 RecallCheckpoint / MoveComment / RecallSession；不得在本路径更新 source Attempt protected fields。

## 6. 预期状态流

完整链路必须是：

```text
UI control event
-> WorkbenchShell / RecallModePanel callback prop
-> TrainingWorkbenchContainer handler
-> workbenchFlowService checkpoint command
-> recallCheckpointService / repository boundary
-> runtimeStore / workbenchStore state
-> store subscription
-> container projection
-> UI state update
```

### Submit correction

```text
RecallModePanel submit button onClick
-> onSubmitCorrection(clickEvent)
-> TrainingWorkbenchContainer.handleSubmitCorrection()
-> flowService.submitCheckpointCorrection(activeTab.id)
-> flowService reads runtimeStore.activeCheckpointId and correctionDraft.moves
-> recallCheckpointService.submitUserCorrectionLine({checkpointId, moves})
-> repository.updateRecallCheckpoint({userCorrectionLine: moves})
-> runtimeStore.setCorrectionDraft(undefined)
-> runtimeStore subscription triggers Container forceUpdate
-> projection keeps activeCheckpointId, recallOriginalLine=false, recallSubstate=checkpoint_correction
-> UI remains in checkpoint surface, now eligible for reveal AI
```

Before:

- active tab: `{mode:'recall', recallSubstate:'checkpoint_correction', activeRecallSessionId}`
- runtime: `{activeCheckpointId:'cp_x', correctionDraft:{checkpointId:'cp_x', moves:[...]}}`
- source Attempt: immutable for this command path

After:

- RecallCheckpoint `userCorrectionLine` equals correctionDraft moves
- runtime `correctionDraft` is `undefined`
- active checkpoint remains active
- active tab `mode` remains `recall`
- active tab `recallSubstate` remains `checkpoint_correction`
- strict repository fake records no `updateAttempt` patch containing `userLine`, `result`, or `status`

### Reveal AI

```text
RecallModePanel reveal button onClick
-> onRevealAI(clickEvent)
-> TrainingWorkbenchContainer.handleRevealAI()
-> flowService.revealCheckpointAi(activeTab.id)
-> flowService validates recall checkpoint guard with resolveTransition(event='revealAi')
-> recallCheckpointService.revealAiCandidateLines(checkpointId)
-> repository.loadBadMove + listMoveEvaluationsByAttempt
-> repository.updateRecallCheckpoint({status:'ai_revealed', aiCandidateLines})
-> workbenchStore.updateTab({recallSubstate:'checkpoint_ai_revealed'})
-> workbenchStore subscription triggers Container forceUpdate
-> projection exposes recallSubstate='checkpoint_ai_revealed' and activeCheckpointId
-> UI remains checkpoint surface and can show AI/reference candidate state when panel projection exists
```

After:

- RecallCheckpoint `status='ai_revealed'`
- AI candidate lines are persisted on the checkpoint
- active tab `mode='recall'`
- active tab `recallSubstate='checkpoint_ai_revealed'`
- source Attempt unchanged and strict repository fake records no protected `updateAttempt` writes

### Skip checkpoint

```text
RecallModePanel skip button onClick
-> onSkipCheckpoint(clickEvent)
-> TrainingWorkbenchContainer.handleSkipCheckpoint()
-> flowService.skipCheckpoint(activeTab.id)
-> recallCheckpointService.skipCheckpoint(checkpointId)
-> repository.updateRecallCheckpoint({status:'skipped', completedAt})
-> repository.updateRecallSession({currentMoveIndex: previous + 1})
-> runtimeStore.setActiveCheckpoint(undefined)
-> runtimeStore.setCorrectionDraft(undefined)
-> workbenchStore.updateTab({recallSubstate:'normal'})
-> subscriptions trigger Container forceUpdate
-> projection activeCheckpointId=null, recallOriginalLine=true, recallSubstate='normal'
-> UI returns to Recall original/progress surface
```

### Save checkpoint comment and resume

If `saveCheckpointComment` remains an atomic user command, the command still has two required transition applications. A test must prove both; asserting only final `normal` is insufficient.

```text
Comment save event
-> onSaveCheckpointComment({content})
-> TrainingWorkbenchContainer.handleSaveCheckpointComment({content})
-> flowService.saveCheckpointComment({tabId: activeTab.id, content})
-> flowService validates and applies resolveTransition(event='commentCheckpoint')
-> workbenchStore.updateTab({recallSubstate:'checkpoint_commenting'})
-> recallCheckpointService.saveComment({checkpointId, comment:{target:{kind:'checkpoint', checkpointId}, content}})
-> repository.createMoveComment
-> repository.updateRecallCheckpoint({status:'commented', userCommentId})
-> flowService or service validates and applies resolveTransition(event='resumeRecall') from checkpoint_commenting/commented
-> recallCheckpointService.resumeRecall(checkpointId)
-> repository.updateRecallCheckpoint({completedAt})
-> repository.updateRecallSession({currentMoveIndex: previous + 1})
-> runtimeStore.setActiveCheckpoint(undefined)
-> workbenchStore.updateTab({recallSubstate:'normal'})
-> subscriptions trigger projection and UI return
```

After:

- MoveComment is independent and targets the checkpoint
- checkpoint is commented and completed
- RecallSession advances past the checkpoint move
- runtime active checkpoint is cleared
- active tab remains `mode='recall'`, with transition log proving `checkpoint_ai_revealed -> checkpoint_commenting -> normal`
- source Attempt protected fields remain unchanged and strict repository fake records no protected `updateAttempt` writes

## 7. 允许的副作用

- `trainingRepository.updateRecallCheckpoint` for `userCorrectionLine`, `status`, `aiCandidateLines`, `userCommentId`, `completedAt`.
- `trainingRepository.createMoveComment` for independent checkpoint comment.
- `trainingRepository.updateRecallSession` to advance `currentMoveIndex` when checkpoint is skipped or resumed.
- `trainingRuntimeStore.setCorrectionDraft(undefined)` after correction submit or skip.
- `trainingRuntimeStore.setActiveCheckpoint(undefined)` after skip/resume.
- `workbenchStore.updateTab(tabId, {recallSubstate})` to move within Recall substate only, including the save-comment atomic sequence `checkpoint_ai_revealed -> checkpoint_commenting -> normal`.
- Structured logging for accepted/rejected transitions.
- Repository reads of BadMove / MoveEvaluation / RecallCheckpoint / RecallSession.

## 8. 禁止的副作用

- 不得修改 source Attempt `userLine`、`result`、`status`，也不得通过 repository protected-field patch 间接修改；T02/T03/T04 必须用 strict fake 记录或拒绝 protected `updateAttempt({userLine/result/status})` patch，并断言没有 protected write。
- 不得调用 documentStore/game-tree mutation such as `playMove`, `clickVertex`, `setCurrentTreePosition` as part of checkpoint submit/reveal/skip/comment.
- 不得新增 `WorkbenchMode='checkpoint'`，不得把 checkpoint 作为 `problem` mode 或新 tab type。
- `TrainingWorkbenchContainer` 不得直接调用 `recallCheckpointService` / `checkpointService`、repository、store setters、documentStore 或 hidden global lookup。
- Presentational panels 不得 import/use service/store/repository/Sabaki。
- `snapshotService` 不得承担 tab opening、checkpoint orchestration 或 flow command 责任。
- 不得引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为 checkpoint 主路径。
- `modeTransitions.ts` 必须保持 pure：无 service/store/repository/engine/DB/UI imports。

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 测试状态 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | --- | -------- | -------------- | --------------- |
| P5CP-T01 | WIRING | MUST_AUTOMATE | RED | Container checkpoint handlers delegate to flowService commands and do not call checkpoint service directly. | 关闭本 step 的主要 gap。 | 继续出现 callback fake green；真实 command path 仍绕过 controller/flow owner。 |
| P5CP-T02 | STATE | MUST_AUTOMATE | RED | Real flowService submit correction + reveal AI updates repository/runtime/workbench substate through real checkpoint service, with strict repository fake proving no protected `updateAttempt({userLine/result/status})` writes. | 证明 command path forward state 和 Attempt 保护。 | 只测 mock service call 或 unchanged snapshot，无法证明 substate/runtime 回流，也无法发现 protected no-op write。 |
| P5CP-T03 | STATE | MUST_AUTOMATE | RED | Real flowService save comment command proves both transition guard/effect applications: `checkpoint_ai_revealed -> checkpoint_commenting` via `commentCheckpoint`, then `checkpoint_commenting/commented -> normal` via `resumeRecall`; it persists independent MoveComment, resumes Recall, clears active checkpoint, and records no protected Attempt writes. | 覆盖 Phase 5 comment/resume completion，不允许只断言最终 normal。 | comment 被嵌入 Attempt、跳过 commentCheckpoint 中间状态、或 protected Attempt patch 被 snapshot 掩盖。 |
| P5CP-T04 | STATE | MUST_AUTOMATE | RED | Real flowService skip command marks checkpoint skipped, advances RecallSession, clears runtime, keeps mode recall/substate normal, and strict fake records no protected Attempt writes. | 覆盖跳过 checkpoint 的 completion path 和 Attempt 保护。 | skip 清 runtime 但 tab 仍 stuck in checkpoint substate；或通过 Attempt patch 偷改源事实。 |
| P5CP-T05 | UI_BEHAVIOR | MUST_AUTOMATE | RED | Rendered Container/Shell/Recall panel observes active checkpoint, invokes rendered skip control, and re-renders to original/progress state after store notifications. | 证明 state return reaches UI, not just service. | store 更新成功但 UI 不回流。 |
| P5CP-T06 | SIDE_EFFECT | MUST_AUTOMATE | GREEN | Existing recallCheckpointService baseline remains the source for service/repository transition behavior, including `startCheckpoint` baseline and service-level correction/reveal/save/skip/resume effects. | 避免本 step 重写已通过 service tests，同时覆盖 startCheckpoint state-machine source row。 | 如果 service baseline 缺失，flow tests 会承担过多责任。 |
| P5CP-T07 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | RED | Static/source boundary: Container/panels do not depend on checkpoint service/store/repository/Sabaki; flowService owns commands; no checkpoint mode or snapshot/tab-open API introduced. | 防止迁移后再次绕过 flow owner。 | 代码能过功能测试但边界倒退。 |
| P5CP-T08 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | DEFERRED | Visible comment editor/save control -> `onSaveCheckpointComment({content})` mapping. Downstream owner/test task: step2 `P5CP-followup-comment-ui-mapping`, proposed Test ID `P5CP-FU-T01`; exit condition: visible comment editor lands in panel scope. | 当前 in-scope code has no rendered comment save control evidence. | 未来补 UI 时 signature drift。Approved reason: step1 closes shell/flow command path only. |

### Source Row / Command Row Coverage

| Source Row | Required Behavior | Test ID | Layer | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Active state machine row: `startCheckpoint` | A Recall checkpoint is entered only as Recall substate, sets/keeps `activeCheckpointId`, and does not create a new mode/tab. | P5CP-T06 | SERVICE_REPOSITORY_TRANSITION | GREEN | Existing service baseline covers start behavior; step1 uses this as setup and protects no new checkpoint mode via P5CP-T07. |
| Active state machine row: `revealAi` | From `checkpoint_correction` with submitted correction, reveal AI persists candidate lines/status and updates tab to `recallSubstate='checkpoint_ai_revealed'`. | P5CP-T02 | CONTROLLER_STATE_TRANSITION | RED | Must use real flowService + real checkpoint service; no mocked state transition. |
| Active state machine row: `commentCheckpoint` | From `checkpoint_ai_revealed`, save-comment path must explicitly apply guard/effect to `recallSubstate='checkpoint_commenting'` before resume. | P5CP-T03 | CONTROLLER_STATE_TRANSITION | RED | Required even if save remains atomic; transition log/store updates must prove this intermediate state. |
| Active state machine row: `resumeRecall` | From `checkpoint_commenting/commented` or skipped checkpoint, resume clears active checkpoint, advances RecallSession where applicable, and sets `recallSubstate='normal'`. | P5CP-T03/P5CP-T04 | CONTROLLER_STATE_TRANSITION | RED | P5CP-T03 covers comment resume; P5CP-T04 covers skip completion. |
| Command-path row: submit correction | UI callback delegates to flowService, flow reads active tab/runtime draft, service writes checkpoint correction line, runtime draft clears, source Attempt protected fields are not written. | P5CP-T01/P5CP-T02 | CONTAINER_DELEGATION / CONTROLLER_STATE_TRANSITION | RED | T02 strict fake must record/reject protected `updateAttempt` patches, not only compare snapshots. |
| Command-path row: reveal AI | UI callback delegates to flowService, transition guard accepts only after correction, service persists AI lines, workbench substate becomes `checkpoint_ai_revealed`. | P5CP-T01/P5CP-T02 | CONTAINER_DELEGATION / CONTROLLER_STATE_TRANSITION | RED | Test may assert rejected invalid ordering separately if implemented in same focused row. |
| Command-path row: save comment | UI/container command saves independent MoveComment, applies `commentCheckpoint`, then `resumeRecall`, clears runtime, and never patches source Attempt protected fields. | P5CP-T01/P5CP-T03/P5CP-T08 | CONTAINER_DELEGATION / CONTROLLER_STATE_TRANSITION / UI_COMMAND_MAPPING | RED / DEFERRED | Rendered comment editor mapping is deferred to step2 `P5CP-followup-comment-ui-mapping`; command state path remains step1. |
| Command-path row: skip | UI callback delegates to flowService, service marks checkpoint skipped/completed, advances RecallSession, clears runtime, tab returns normal, rendered UI exits checkpoint surface. | P5CP-T01/P5CP-T04/P5CP-T05 | CONTAINER_DELEGATION / CONTROLLER_STATE_TRANSITION / RENDERED_UI_RETURN | RED | T05 proves state return through real rendered panel after skip. |

## 10. 必须自动化的测试

| Status | Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RED | P5CP-T01 | CONTAINER_DELEGATION | `TrainingWorkbenchContainer` checkpoint handlers | real Container render and shell prop assembly; real runtime/workbench stores | typed spy `WorkbenchFlowService`; throw-if-called checkpoint service spy | `shared typed spy factory` extending `test/workbench/shared/workbenchSpyFactories.ts` with production `WorkbenchFlowService` type | Container under test; private handler invocation; per-file untyped flow/checkpoint service spies | `onSubmitCorrection`, `onRevealAI`, `onSkipCheckpoint`, `onSaveCheckpointComment({content})` call only flowService checkpoint commands with active tab id/content; checkpoint service direct calls remain zero. | P5CP-T02/P5CP-T03/P5CP-T04/P5CP-T05 |
| RED | P5CP-T02 | CONTROLLER_STATE_TRANSITION | `createWorkbenchFlowService().submitCheckpointCorrection` and `.revealCheckpointAi` | real flowService, real `resolveTransition`, real workbenchStore/runtimeStore, real recallCheckpointService | typed strict in-memory repository fake with protected Attempt patch recorder/rejector; unused deps as typed tiny stubs | `in-memory repository fake` implementing actual repository methods invoked; `real production interface/type` for service deps | flowService under test; recallCheckpointService under test; runtime/workbench stores under test; fake that only snapshots source Attempt fields without recording/rejecting protected `updateAttempt` patches | Starting from recall/checkpoint_correction with active checkpoint and correctionDraft: submit persists correction line and clears draft; reveal persists AI lines/status, updates `recallSubstate='checkpoint_ai_revealed'`, keeps `mode='recall'`; strict fake records zero protected `updateAttempt({userLine/result/status})` writes. | P5CP-T05/P5CP-T07 |
| RED | P5CP-T03 | CONTROLLER_STATE_TRANSITION | `createWorkbenchFlowService().saveCheckpointComment` | real flowService, real `resolveTransition`, real workbenchStore/runtimeStore with transition/update log, real recallCheckpointService | typed strict in-memory repository fake with protected Attempt patch recorder/rejector; unused deps as typed tiny stubs | `in-memory repository fake`; `real production interface/type` | flowService under test; recallCheckpointService under test; repository state asserted via manual mutation outside command; fake that accepts protected Attempt writes silently; assertion that only final `normal` proves the command | From recall/checkpoint_ai_revealed, save first applies `commentCheckpoint` guard/effect to `recallSubstate='checkpoint_commenting'`, creates `MoveComment` with checkpoint target, marks checkpoint commented, then applies `resumeRecall` guard/effect from `checkpoint_commenting/commented` to `normal`, advances RecallSession, clears runtime active checkpoint, and records zero protected `updateAttempt({userLine/result/status})` writes. | P5CP-T05/P5CP-T07 |
| RED | P5CP-T04 | CONTROLLER_STATE_TRANSITION | `createWorkbenchFlowService().skipCheckpoint` | real flowService, real workbenchStore/runtimeStore, real recallCheckpointService | typed strict in-memory repository fake with protected Attempt patch recorder/rejector; unused deps as typed tiny stubs | `in-memory repository fake`; `real production interface/type` | flowService under test; recallCheckpointService under test; fake that only snapshots source Attempt fields without recording/rejecting protected `updateAttempt` patches | Skip marks checkpoint skipped/completed, advances RecallSession, clears `activeCheckpointId` and `correctionDraft`, sets tab `recallSubstate='normal'`, keeps `mode='recall'`, and strict fake records zero protected `updateAttempt({userLine/result/status})` writes. | P5CP-T05/P5CP-T07 |
| RED | P5CP-T05 | RENDERED_UI_RETURN | `TrainingWorkbenchContainer` + `WorkbenchShell` + `RecallModePanel` rendered loop | real Container/Shell/Panel, real flowService, real stores, real recallCheckpointService | typed strict in-memory repository fake and unused typed deps | `in-memory repository fake`; `real production interface/type` | rendered components under test; flowService/checkpoint service under test; asserting only `container.render().props` while claiming rendered UI | Active checkpoint renders checkpoint controls; clicking rendered skip control runs full chain and re-renders with `activeCheckpointId=null`, `recallOriginalLine=true`, `recallSubstate='normal'`, and checkpoint controls absent or inactive. | not-covered: richer AI/comment visual details remain outside step1 |
| GREEN | P5CP-T06 | SERVICE_REPOSITORY_TRANSITION | `createRecallCheckpointService` service methods | real recallCheckpointService, real runtimeStore | existing typed/in-memory repository fake in service tests | existing service test harness bound to `TrainingRepository` interface | mocking recallCheckpointService while claiming service transition | Existing passing service tests prove startCheckpoint plus correction/reveal/save/skip/resume repository/runtime effects; step1 tests may rely on this baseline but must still run real service in flow transition tests. | P5CP-T02/P5CP-T03/P5CP-T04 |
| RED | P5CP-T07 | ARCHITECTURE_BOUNDARY | source boundary for Container/panels/flowService/modeTransitions | source files and TypeScript interfaces | none, or local tiny file reader helper | none | regex-only check that misses imports/calls if AST helper exists; allowing panel service imports | Container has no checkpoint service direct lookup/call; panels import no service/store/repository/Sabaki; flowService type owns checkpoint commands; `modeTransitions.ts` remains pure; no `checkpoint` WorkbenchMode or source-specific tab opener/snapshot orchestration is introduced. | architecture-reviewer |
| DEFERRED | P5CP-T08 | UI_COMMAND_MAPPING | future visible comment editor/save control | future panel component | local tiny callback only | `local tiny stub` only after UI exists | using shell prop call as proof of rendered comment UI mapping | When comment UI is added in step2 `P5CP-followup-comment-ui-mapping`, save action must call `onSaveCheckpointComment({content})` exactly; proposed downstream Test ID `P5CP-FU-T01`. Approved reason: no current visible comment save control in in-scope panel evidence; exit condition: panel/editor implementation lands. | DEFERRED to step2 `P5CP-followup-comment-ui-mapping` / `P5CP-FU-T01` |

## 11. 仅手动验收

- With an active Recall checkpoint, click submit correction, reveal AI, skip, and save comment in the running app if the visible controls exist. Confirm checkpoint remains under Recall and no new checkpoint mode/tab appears.
- Confirm source game tree and source Attempt line/result/status are unchanged after checkpoint commands.
- Confirm invalid ordering is user-safe: reveal before correction or comment before reveal rejects/does not silently mutate wrong state. Automated tests should cover service/flow guard; manual acceptance checks user-visible failure handling only.
- Comment editor visible UI mapping is not a step1 manual pass/fail item unless the editor already exists in the running panel. If it does exist, file step2 `P5CP-followup-comment-ui-mapping` immediately rather than silently accepting uncontracted mapping.

## 12. 不测试

- CSS, layout, button copy, icon style, spacing, responsive behavior, screenshot fidelity.
- Logger message wording or exact call order, except where structured rejection itself is business-required.
- Exact timestamp/id format beyond presence and persistence.
- Internal function call count as the primary assertion. A callback-called-once assertion is allowed only inside P5CP-T01 as auxiliary command mapping evidence.
- Full AI candidate visual rendering beyond active checkpoint/substate projection; this needs a separate UI/projection contract if product scope expands.
- Visible comment editor/save control mapping in step1; this is deferred to step2 `P5CP-followup-comment-ui-mapping` / `P5CP-FU-T01`.

## 13. 脆弱测试警告

- 弱测试禁令：不得把 "callback 被调用一次" 当作主验收。P5CP-T01 只能证明 Container delegation；真实状态前进必须由 P5CP-T02/P5CP-T03/P5CP-T04 证明，UI 回流必须由 P5CP-T05 证明。
- 不得在 test file 内手写完整 flowService / recallCheckpointService / repository spy。Workbench wiring 中这些依赖必须通过 shared typed spy factory 或 in-memory repository fake 绑定生产接口。
- T02/T03/T04 的 Attempt 保护不能只靠 before/after field snapshot；strict fake 必须记录或拒绝任何 `updateAttempt` patch containing `userLine`、`result`、`status`，测试必须断言 protected write count/list is empty。
- P5CP-T03 不能只断言最终 `recallSubstate='normal'`；必须证明 `commentCheckpoint` 和 `resumeRecall` 两个 transition guard/effect 都发生，且中间 `checkpoint_commenting` 状态来自真实 flow/store path。
- 不得 mock `workbenchFlowService` 后声称覆盖 `CONTROLLER_STATE_TRANSITION`。
- 不得 mock `recallCheckpointService` 后声称覆盖 checkpoint persistence/runtime effects。
- 不得手动 `runtimeStore.setActiveCheckpoint(undefined)` 后声称 skip/save command 清理了 runtime；必须通过真实 command/service 链路导致清理。
- 不得只断言 `container.render().props` 后声称 rendered UI return；如果没有真实 Shell/Panel render，只能降级为 `PROJECTION_RETURN`，并改 Test ID/Layer。
- 不得按不存在的上游签名调用 handler，例如 `onRevealAI(checkpointId)` 或 `onSaveCheckpointComment(contentString)`。

## 14. 超出范围

- 重新设计 RecallCheckpointPanel visual layout、comment editor UI、AI line detailed rendering。
- 新增 checkpoint start trigger policy；major/severe trigger 和 `startCheckpoint` 已属 service baseline。
- Snapshot、Review candidate enrollment、Analysis Return restore flow。
- 重写 repository schema or migrations。
- 修复或扩展 board correctionDraft capture path；本 step assumes correctionDraft already exists in runtime.

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 否 | 本契约只根据 active tab mode/substate、runtime active checkpoint 和 repository checkpoint facts 分支。 | 禁止新增 provider/source branching。 |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 否 | Checkpoint commands 不打开新 tab。 | P5CP-T07 静态边界测试。 |
| 是否让 `snapshotService` 承担 tab opening / flow orchestration | 否 | Snapshot 不参与 Phase 5 checkpoint command path。 | P5CP-T07 静态边界测试。 |
| 是否让 Container 直接写 store，而不是通过 v0.5 指定 service | 否，目标契约禁止 | 当前代码 evidence shows direct checkpoint service lookup；contract changes it to flowService command only. | P5CP-T01/P5CP-T07 必须先红后绿。 |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 否 | Presentational panels remain callback-only. | P5CP-T07。 |
| 是否把 checkpoint 变成 WorkbenchMode | 否 | Arch v0.5 lines 153-154 and implementation plan lines 811-815. | Flow updates `recallSubstate` only; tests assert `mode='recall'`。 |
| 是否修改 source Attempt `userLine/result/status` | 否 | Implementation plan lines 813-815. | P5CP-T02/T03/T04 use strict fake to record/reject protected `updateAttempt` patches and assert zero protected writes; snapshots alone are not enough。 |
| 是否让 `modeTransitions.ts` 产生副作用 | 否 | Current file declares pure module; checkpoint events already exist. | P5CP-T07 protects no service/store imports。 |

## 16. Workbench 接线清单（如适用）

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `submit-correction-btn` | `submitCheckpointCorrection(tabId)` | panel emits callback; Container delegates; flowService owns command; checkpointService owns persistence | Plan Phase 5 lines 797-799; Arch §9.5 lines 1842-1849 | runtime draft -> checkpoint userCorrectionLine; draft cleared; substate remains checkpoint_correction; no protected Attempt update patch | runtime subscription -> `activeCheckpointId` remains; `recallOriginalLine=false`; reveal now allowed by flow guard | P5CP-T01, P5CP-T02 | tests by mode / controller |
| `查看 AI` button | `revealCheckpointAi(tabId)` | same | Plan Phase 5 lines 799, 823; Arch §9.5 lines 1851-1858 | checkpoint status ai_revealed; candidate lines persisted; tab substate checkpoint_ai_revealed; no protected Attempt update patch | workbench subscription -> `recallSubstate`; runtime active checkpoint still projects checkpoint surface | P5CP-T01, P5CP-T02 | tests by mode / controller |
| `跳过 checkpoint` button | `skipCheckpoint(tabId)` | same | Plan Phase 5 lines 801-802; Arch state machine lines 147, 153-154 | checkpoint skipped/completed; RecallSession advanced; runtime active/draft cleared; tab substate normal; no protected Attempt update patch | runtime/workbench subscriptions -> `activeCheckpointId=null`, `recallOriginalLine=true`, UI progress/original surface | P5CP-T01, P5CP-T04, P5CP-T05 | controller / rendered return |
| Shell prop `onSaveCheckpointComment({content})` | `saveCheckpointComment({tabId, content})` | Container delegates; flowService owns command; checkpointService owns save/resume | Plan Phase 5 lines 800-801, 824-825; Arch §9.5 lines 1860-1869 | `commentCheckpoint` transition to checkpoint_commenting; MoveComment created; checkpoint commented/completed; `resumeRecall` transition to normal; RecallSession advanced; runtime active cleared; no protected Attempt update patch | subscriptions -> UI exits checkpoint surface | P5CP-T01, P5CP-T03; visible editor mapping deferred to P5CP-FU-T01 | controller |
| `RecallCheckpointPanel` list item | display/select only | presentational component | Arch §10.4 lines 1986-1993 | no mutation in step1 | renders active state from `activeCheckpointId`/checkpoint projection | P5CP-T05 for active surface only | container/projection |
| `标记 checkpoint`, `校对`, `onRecallToggle` | deferred/no-op or legacy path | not in step1 command closure | current code evidence lines 617-625 only | no required state change in step1 | no required return state | DO_NOT_TEST in this step | none |
| Visible comment editor/save button | deferred | future panel callback mapping | Phase 5 comment objective | not in current in-scope panel evidence | not-covered | P5CP-T08 deferred to step2 `P5CP-followup-comment-ui-mapping` / `P5CP-FU-T01`; exit condition: editor lands | future panel callback plumbing |

订阅契约：

- `trainingRuntimeStore.subscribe` must notify on `setActiveCheckpoint` and `setCorrectionDraft`; Container already subscribes and must continue to forceUpdate.
- `workbenchStore.subscribe` must notify on `updateTab({recallSubstate})`; Container must project active tab `recallSubstate` to Shell/Panel props.
- Store setters remain store-only state mutation APIs; orchestration decisions belong to flowService/checkpointService.

命令清单：

| 语义命令 | Presentational component | `TrainingWorkbenchContainer` | controller / `workbenchFlowService` | service / repository | existing Sabaki command |
| --- | --- | --- | --- | --- | --- |
| submit checkpoint correction | callback only | activeTab guard + delegate | owns command, reads active checkpoint/draft, validates recall mode | `submitUserCorrectionLine` -> repository update, runtime draft clear; strict fake proves no protected Attempt update | none |
| reveal checkpoint AI | callback only | activeTab guard + delegate | owns command, validates `revealAi` transition, updates substate | `revealAiCandidateLines` -> repository update; strict fake proves no protected Attempt update | none |
| skip checkpoint | callback only | activeTab guard + delegate | owns command, updates substate normal after service success | `skipCheckpoint` -> checkpoint/session/runtime updates; strict fake proves no protected Attempt update | none |
| save checkpoint comment | callback only / rendered UI deferred | activeTab guard + delegate with `{content}` | owns atomic command but must apply `commentCheckpoint` then `resumeRecall` guard/effects; updates substate checkpoint_commenting then normal | `saveComment` + `resumeRecall` -> comment/checkpoint/session/runtime updates; strict fake proves no protected Attempt update | none |

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| contracts/docs | this archive file only | none | completed by this gate | none |
| test helper update | `test/workbench/shared/workbenchSpyFactories.ts` | approved contract | Can be prepared before test files, but must land before tests using new flow commands | Shared helper touches many tests; one owner only. |
| container delegation tests | `test/workbench/wiring/regression-wiring.test.js` | helper update | Does not need real flow state harness | Must not also edit same helper in parallel. |
| real flow state tests | `test/workbench/wiring/w4-recall-mode-wiring.test.js` or a new focused `phase5-checkpoint-command-path.test.js` | helper or typed repository fake | Can be authored separately after fake shape is agreed | If placed in existing W4 file, one test integrator should own file to avoid conflicts. |
| production controller implementation | `src/modules/training/workbench/workbenchFlowService.ts` | approved tests | Serial owner because it changes public service type and commands | Requires DI update if new dep is injected. |
| container/projection implementation | `src/components/TrainingWorkbenchContainer.js` | flowService command names stable | Can follow controller, but same implementation worker is safer due handler names | Risk of tests expecting names before flow type compiles. |
| DI integration | `src/modules/sabaki.js` if required to pass the existing `checkpointService` into `createWorkbenchFlowService` | flowService deps finalized | Small isolated wiring patch | Not in original lock list; implementation worker must call out this expansion before editing. |
| step2 comment UI mapping | future panel file + focused UI_COMMAND_MAPPING test | comment editor enters visible panel scope | Deferred because step1 has no visible comment editor evidence | Must not be folded into step1 state-forward tests. |
| architecture review | source diff + tests | implementation complete | Independent review gate | Blocks if Container still calls checkpoint service or source Attempt writes appear. |

Expected production write scope:

- `src/modules/training/workbench/workbenchFlowService.ts` for command API, dependency injection, transition guards, and workbenchStore substate updates.
- `src/components/TrainingWorkbenchContainer.js` for replacing direct checkpoint service lookup with flowService delegation and projecting `recallSubstate`.
- `src/modules/sabaki.js` only if needed to pass the existing `checkpointService` into `createWorkbenchFlowService`. This is a DI-only expansion and should be explicitly noted by the implementation agent.
- No production edits expected in `recallCheckpointService.ts`, `modeTransitions.ts`, presentational panels, repository, or DB schema for step1.

Expected test write scope:

- `test/workbench/shared/workbenchSpyFactories.ts` to extend typed flowService spies with checkpoint command calls.
- `test/workbench/wiring/regression-wiring.test.js` to change R-T11 from direct checkpoint service expectations to flowService delegation and no direct service calls.
- `test/workbench/wiring/w4-recall-mode-wiring.test.js` for real flowService checkpoint state-forward/state-return coverage, unless test-writer creates a narrower focused file and keeps W4 regression imports stable.
- `test/workbench/wiring/phase5-checkpoint-command-path.test.js` is acceptable if it keeps T02/T03/T04 strict fake and transition-log needs localized and avoids conflicting edits to existing W4 tests.

Downstream required_constraints:

- Contract-auditor REQUEST_CHANGES carried forward: maintain the explicit `Source Row | Required Behavior | Test ID | Layer | Status | Notes` coverage table for active state machine rows `startCheckpoint`, `revealAi`, `commentCheckpoint`, `resumeRecall` and command-path rows submit correction, reveal AI, save comment, skip.
- Contract-auditor REQUEST_CHANGES carried forward: if `saveCheckpointComment` remains atomic, P5CP-T03 must prove both transition guard/effect applications: `checkpoint_ai_revealed -> checkpoint_commenting` via `commentCheckpoint`, then `checkpoint_commenting/commented -> normal` via `resumeRecall`; asserting final `normal` alone is forbidden.
- Contract-auditor REQUEST_CHANGES carried forward: P5CP-T02/T03/T04 must use strict fake behavior that records or rejects protected `updateAttempt({userLine/result/status})` patches and asserts zero protected Attempt writes; unchanged field snapshots alone are forbidden.
- Contract-auditor REQUEST_CHANGES carried forward: P5CP-T08 is deferred to concrete downstream step2 task `P5CP-followup-comment-ui-mapping`, proposed Test ID `P5CP-FU-T01`, with exit condition that visible comment editor/save control lands in panel scope.
- Test-writer must not claim state-forward coverage from a spy flowService or spy checkpoint service.
- Test-writer must use shared typed spy factories or in-memory repository fake bound to production interfaces; no per-file handwritten full service/controller/repository mocks.
- Test-writer must invoke public shell/panel callbacks with real upstream signatures; no private handler calls and no invented checkpointId payloads.
- Implementation must keep panels presentational and must not add direct service/store/repository/Sabaki imports to them.
- Implementation must not let Container call `recallCheckpointService`, `checkpointService`, repository, store setters, documentStore, or hidden globals for checkpoint actions.
- Implementation must not mutate source Attempt `userLine`, `result`, or `status`; tests must use a protected Attempt patch recorder/rejector around real commands.
- Implementation must keep checkpoint as Recall substate and must reject invalid command ordering through flow/service guard.
- Implementation must not use `snapshotService` or source-specific tab open APIs in this path.
