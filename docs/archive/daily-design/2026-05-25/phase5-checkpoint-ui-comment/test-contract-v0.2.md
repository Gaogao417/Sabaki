Date: 2026-05-26
Status: pending-confirmation
Audit Status: revised after contract-auditor REQUEST_CHANGES
Workflow: workbench-wiring-workflow
Step: step2
Task: phase5-checkpoint-ui-comment
Scope: visible checkpoint substate/comment UI mapping after step1 command path

# 契约草案

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | lines 261-370 | Recall 的产品目标是先回忆/背谱，再沉淀记错手、记不住片段和关键节点。checkpoint comment UI 只能服务 Recall 训练闭环，不能把用户带入独立 checkpoint mode。 |
| `docs/product/sabaki-training-prd.md` | lines 1224-1237 | Play 完成后进入 Recall；Recall 可以进入 Analysis 并定位错误点。step2 只处理 Recall checkpoint/comment 的可见回流，不改变 Play -> Recall 或 Recall -> Analysis 主链路。 |
| `docs/architecture/gabaki-sabaki-training-implementation-plan.md` | Phase 5 lines 778-827 | Phase 5 目标是 Recall 遇到 major/severe BadMove 后进入主动纠错子流程；用户先提交 correction line，再主动 reveal AI candidates，再保存独立 comment，最后 resume Recall。step2 的 UI 必须显示 correction / reveal / comment / resume 子状态。 |
| `docs/architecture/gabaki-sabaki-training-implementation-plan.md` | lines 808-815 | Checkpoint 是 Recall substate，不是 WorkbenchMode；`correctionDraft` / `activeCheckpointId` 只能是 runtime companion state；reveal/comment/resume 只能写 RecallCheckpoint / MoveComment / RecallSession，不得改 source Attempt `userLine` / `result` / `status`。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §0.4 lines 112-158 | `RecallSubstate` 只允许 `normal`、`checkpoint_correction`、`checkpoint_ai_revealed`、`checkpoint_commenting`；`revealAi`、`commentCheckpoint`、`resumeRecall` 必须保持 `mode='recall'` 并只推进 recall substate。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §9.5 lines 1828-1869 | Recall checkpoint command path 是 recall move -> checkpoint start；correction 写 checkpoint correction；reveal 加载 AI/reference candidates 并显示 original/correction/AI lines；comment 创建 MoveComment、标记 checkpoint commented、resume recall 并清理 active checkpoint。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §10.4 lines 1986-1993 | Recall checkpoint UI 回流从 `trainingRuntimeStore.activeCheckpointId` 开始，加载 RecallCheckpoint、BadMove、MoveEvaluation、Comment 后投影给 `RecallCheckpointPanel`。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §7.2 lines 616-643 | 关闭“先复现原线”时显示 checkpoint 队列、当前 checkpoint、`提交修正图`、`查看 AI`、`跳过 checkpoint`；必须显示来源、moveNumber、局面摘要和状态；未提交修正图前不得默认暴露 AI answers；Reveal 后右栏显示原线、修正线、AI candidates 对比。`跳过 checkpoint` command/state return 已由 step1 `P5CP-T04` / `P5CP-T05` 覆盖；step2 只防止可见 UI 改动破坏 comment mapping。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §9.4 lines 872-880 | UI 必须与 Architecture v0.5 状态机一致；Checkpoint 是 Recall substate，不是第五个 mode；进入 Analysis 时保存返回目标；Snapshot 不改变当前 tab mode/substate。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §12 Recall acceptance lines 1192-1200 | Recall 验收要求：显示 checkpoint 队列、当前 checkpoint、用户修正和 `查看 AI`；默认不直接暴露 AI candidates；系统/手动 checkpoint 来源可区分；底部显示当前进度或 checkpoint 状态。 |
| 当前生产代码证据，非真源 | `src/components/TrainingWorkbenchContainer.js` lines 54-58, 436-455, 606-610, 949-958 | 当前 Container 已订阅 runtime/workbench store，并将 submit/reveal/skip/save comment callback 代理到 `flowService`；projection 目前只把 `activeCheckpointId` 映射成 `recallOriginalLine=false`，尚未把 checkpoint substate/comment/candidates 投影成完整可见 UI。 |
| 当前生产代码证据，非真源 | `src/components/workbench/panels/RecallModePanel.js` lines 157-187; `src/components/workbench/panels/RecallCheckpointPanel.js` lines 11-25; `src/components/workbench/panels/RecallRightPanel.js` lines 16-24; `src/components/workbench/shell/RightModePanel.js` lines 36-45 | 当前 Recall 左栏已有 checkpoint 队列按钮，但 `RecallCheckpointPanel` 只显示 moveNumber/summary；右栏不接收 correction/AI/comment props；没有可见 comment editor/save control。 |
| 当前生产代码证据，非真源 | `src/components/WorkbenchShell.js` lines 86-90; `src/components/workbench/shell/RightModePanel.js` lines 36-45 | Shell 左栏通过 `RecallModePanel({...rest, state: recallState})` 透传 callback/props；右栏 recall case 只向 `RecallRightPanel` 传 summary/progress props。step2 必须修正这些可见 projection/prop mapping，不得把右栏 comment UI 接到 Analysis panel。 |
| 当前生产代码证据，非真源 | `src/modules/training/workbench/workbenchFlowService.ts` checkpoint commands; `src/modules/training/recall/recallCheckpointService.ts` checkpoint service methods | step1 command path 已存在：`submitCheckpointCorrection`、`revealCheckpointAi`、`skipCheckpoint`、`saveCheckpointComment`；step2 不重新定义 ownership，只要求 visible save mapping 走既有 `Container -> flowService.saveCheckpointComment({tabId, content})` 路径并验证状态回流。 |
| Step1 派生契约，非真源 | `docs/archive/daily-design/2026-05-25/phase5-checkpoint-command-path/test-contract-v0.2.md` `P5CP-T04`, `P5CP-T05` | `跳过 checkpoint` 的 state-forward 和 rendered-return 覆盖属于 step1：`P5CP-T04` 覆盖 real flow skip command，`P5CP-T05` 覆盖 rendered skip control 回流到 normal Recall。step2 不重复定义 skip 主验收。 |

## 1. 用户故事

作为正在 Recall checkpoint 子流程中的用户，我在 AI candidates reveal 后能看见当前 checkpoint 的来源、手数、修正图、AI 对比和备注输入区。我保存备注后，备注通过既有 `TrainingWorkbenchContainer -> workbenchFlowService.saveCheckpointComment({tabId, content})` 路径写入 MoveComment，checkpoint 被 resume，界面回到普通 Recall 进度，而不会修改正式棋谱或 source Attempt。

## 2. 用户动作

1. 用户在 Recall checkpoint correction 子状态查看当前 checkpoint 卡片。
2. 用户提交修正图后，界面仍停留在 checkpoint surface，并把 `查看 AI` 显示为可用。
3. 用户点击 `查看 AI` 后，界面显示 original line、user correction line、AI candidate lines 对比。
4. 用户在 reveal 后的 comment editor 中输入内容并点击保存。
5. UI 通过 `onSaveCheckpointComment({content})` 进入 Container handler，再调用既有 flow path。
6. 保存完成后，runtime active checkpoint 清空，tab `recallSubstate` 回到 `normal`，UI 返回普通 Recall projection。

真实调用签名必须锁定：

| 上游调用方 | 真实/目标调用签名 | 证据 | 假绿风险 |
| --- | --- | --- | --- |
| `RecallModePanel` submit correction button | `onSubmitCorrection(clickEvent)`；handler 不依赖 payload | `src/components/workbench/panels/RecallModePanel.js` lines 175-179 | 测试按 `onSubmitCorrection(checkpointId)` 调用会掩盖真实 UI 不传 checkpointId 的事实。 |
| `RecallModePanel` reveal AI button | `onRevealAI(clickEvent)`；handler 不依赖 payload | `src/components/workbench/panels/RecallModePanel.js` lines 180-183 | 测试按 `onRevealAI({checkpointId})` 调用是假绿。 |
| `RecallModePanel` skip checkpoint button | `onSkipCheckpoint(clickEvent)`；handler 不依赖 payload；state-forward/rendered-return 已由 step1 `P5CP-T04` / `P5CP-T05` 覆盖 | `src/components/workbench/panels/RecallModePanel.js` lines 184-187 | step2 测试不得把 skip callback 当作 comment UI 主验收；如覆盖，只能证明 visible UI 改动未破坏 Step1-covered route。 |
| step2 comment save control | 必须实现为 `onSaveCheckpointComment({content: string})` | Container handler 已按 `{content}` 解构：`src/components/TrainingWorkbenchContainer.js` lines 453-455；Shell 透传 panel props：`src/components/WorkbenchShell.js` lines 86-90 | 当前没有 panel caller。测试直接调用 `shellProps.onSaveCheckpointComment` 只能证明 `CONTAINER_DELEGATION`，不能证明可见 comment UI mapping。 |
| `WorkbenchShell -> RecallModePanel` | `RecallModePanel({...rest, state: recallState})` | `src/components/WorkbenchShell.js` lines 86-90 | 只断言 shell prop 存在不证明 rendered panel 可见状态。 |
| `RightModePanel -> RecallRightPanel` | `RecallRightPanel({hintMessage, systemCheckpoints, manualCheckpoints, correctCount, wrongCount, progress, totalMoves})` 当前目标需扩展等价 checkpoint comparison/comment props | `src/components/workbench/shell/RightModePanel.js` lines 36-45 | 测试若把 comment UI 挂到 Analysis right panel 会假绿；Recall mode 必须在 Recall right/panel surface 可见。 |

## 3. 当前阶段

Workbench 当前阶段必须保持：

```text
activeTab.mode = 'recall'
activeTab.recallSubstate in [
  'checkpoint_correction',
  'checkpoint_ai_revealed',
  'checkpoint_commenting',
  'normal'
]
```

step2 只接线 Recall checkpoint/comment 的可见 state return。不得新增 `mode='checkpoint'`，不得把 checkpoint 当成 Problem mode，也不得把 comment editor 接到 SGF comment box。

## 4. 位置源

| 位置源 | 本 step 用法 | 写入权限 |
| --- | --- | --- |
| `game-tree` | 只作为 original/reference line 的只读来源。 | 禁止写入。comment 保存不得写 SGF comment 或正式棋谱节点。 |
| `scratch` | 本 step 不使用；Analysis scratch 与 Recall checkpoint comment UI 无关。 | 禁止写入。 |
| `problem-attempt` | 本 step 不使用；checkpoint correction/comment 不是 Problem answer。 | 禁止写入。 |
| `reference/current` | reveal 后可读取 original/correction/AI candidates 并投影到右栏对比。 | 只读。 |
| runtime checkpoint companion state | `activeCheckpointId`、`correctionDraft` 决定 checkpoint UI 是否显示及按钮状态。 | 只能由 service/flow 既有命令推进；panel 不写，container 不直接写。 |

## 5. 变更契约

变更契约类型：`其他: recallCheckpointVisibleUiMapping`。

它不是 `playMove`、不是 `scratchEdit`、不是 `recallAnswer`、不是 `variationMove`。step1 已覆盖 command path；step2 只补齐 store/repository 状态到可见 Recall UI 的 projection，以及可见 comment editor 到既有 save comment command 的 UI mapping。

必须新增或完善的 projection 字段建议：

```ts
type RecallCheckpointUiState = {
  activeCheckpointId: string | null
  recallSubstate: RecallSubstate
  checkpointStatus: 'pending_correction' | 'ai_revealed' | 'commented' | 'skipped' | null
  activeCheckpoint?: {
    id: string
    moveNumber: number
    sourceLabel: string
    severityLabel?: string
    summary: string
    userCorrectionLine: string[]
    aiCandidateLines: ReferenceLine[]
    userCommentContent?: string
  }
  canSubmitCorrection: boolean
  canRevealAi: boolean
  canEditComment: boolean
  isSavingComment: boolean
}
```

字段名称可按现有代码风格调整，但必须表达同等语义。`TrainingWorkbenchContainer` 可以读 repository 做 projection，但不得在 projection 阶段写 store；若 repository loading 当前是同步 fake/缓存限制，可使用临时迁移接缝并标明退出条件：当 repository read model 支持 async subscription/cache 后移除本地 fallback。

## 6. 预期状态流

完整闭环：

```text
UI control event
-> WorkbenchShell / RecallModePanel / RecallCheckpointPanel callback prop
-> TrainingWorkbenchContainer handler
-> workbenchFlowService existing checkpoint command
-> recallCheckpointService / repository
-> runtimeStore / workbenchStore / Sabaki state
-> runtimeStore/workbenchStore subscription
-> TrainingWorkbenchContainer projection
-> WorkbenchShell props
-> RecallModePanel / RecallCheckpointPanel / RecallRightPanel rendered UI
```

### 6.1 Before / After store projection

| State | Store/repository before | Required projection | Required visible UI | User controls |
| --- | --- | --- | --- | --- |
| `checkpoint_correction` before correction submitted | `activeTab.mode='recall'`; `activeTab.recallSubstate='checkpoint_correction'`; `runtime.activeCheckpointId='cp_1'`; checkpoint `status='pending_correction'`; `userCorrectionLine=[]` | `recallOriginalLine=false`; `activeCheckpointId='cp_1'`; `recallSubstate='checkpoint_correction'`; `checkpointStatus='pending_correction'`; `canRevealAi=false`; no `aiCandidateLines` visible | Left/current checkpoint shows source, moveNumber, summary, status text like `先自己摆修正图`; right panel does not reveal AI candidates; bottom status says checkpoint correction state | `提交修正图` active only if `correctionDraft.moves.length > 0`; `查看 AI` disabled/weak; `跳过 checkpoint` may remain visible but its command/state path is Step1-covered by `P5CP-T04` / `P5CP-T05` |
| `checkpoint_correction` after correction submitted | Same tab/runtime; checkpoint `userCorrectionLine.length > 0`; `correctionDraft` cleared by service path if applicable | `canRevealAi=true`; `canSubmitCorrection=false` or idempotent display | User correction line visible; `查看 AI` becomes available; still no AI candidates exposed | `查看 AI` active; comment editor hidden |
| `checkpoint_ai_revealed` | `activeTab.recallSubstate='checkpoint_ai_revealed'`; checkpoint `status='ai_revealed'`; `aiCandidateLines.length >= 0`; runtime active checkpoint still set | `canEditComment=true`; original/correction/AI comparison props populated | Right panel shows original line, user correction line, AI candidate lines; comment editor is visible and focused enough for input; bottom status says AI candidates displayed / write comment | `保存备注` active when trimmed content is non-empty; `查看 AI` may be disabled or display-only |
| `checkpoint_commenting` | Flow has applied `commentCheckpoint`; `saveCheckpointComment` in progress; active checkpoint still set until resume succeeds | `isSavingComment=true`; form content preserved | UI shows saving/continuing recall state; save button disabled to prevent duplicate submit | No duplicate save; reveal disabled during save; skip behavior remains Step1-covered and should not be newly asserted in step2 except as non-regression |
| `normal` after save/resume | `activeTab.mode='recall'`; `activeTab.recallSubstate='normal'`; `runtime.activeCheckpointId` undefined/null; checkpoint `status='commented'` and `completedAt` set; MoveComment exists | `activeCheckpointId=null`; `recallOriginalLine=true`; checkpoint editor hidden; progress props from `recallView` | Left panel returns to Recall progress/original line surface; bottom status returns to progress/waiting text | No comment editor visible for the completed checkpoint |

### 6.2 Comment save loop

```text
User types content in visible checkpoint comment editor
-> Save button invokes onSaveCheckpointComment({content})
-> TrainingWorkbenchContainer.handleSaveCheckpointComment({content})
-> flowService.saveCheckpointComment({tabId: activeTab.id, content})
-> flowService applies commentCheckpoint guard and sets recallSubstate='checkpoint_commenting'
-> recallCheckpointService.saveComment creates MoveComment target {kind:'checkpoint', checkpointId}
-> repository.updateRecallCheckpoint({status:'commented', userCommentId})
-> recallCheckpointService.resumeRecall(checkpointId)
-> repository.updateRecallSession({currentMoveIndex: previous + 1})
-> runtimeStore.setActiveCheckpoint(undefined)
-> workbenchStore.updateTab({recallSubstate:'normal'})
-> runtime/workbench subscriptions force container projection
-> rendered UI hides checkpoint comment surface and shows normal Recall progress
```

## 7. 允许的副作用

- 读取 `trainingRepository.loadRecallCheckpoint`、相关 BadMove / MoveEvaluation / MoveComment read model，用于 projection。
- 通过既有 step1 command path 写 RecallCheckpoint `status`、`userCommentId`、`completedAt`。
- 通过既有 step1 command path 创建独立 `MoveComment`，target 必须是 `{kind:'checkpoint', checkpointId}`。
- 通过既有 step1 command path 推进 RecallSession `currentMoveIndex`。
- 通过 `workbenchStore.updateTab` 推进 `recallSubstate`，通过 runtime service path 清理 `activeCheckpointId`。
- Panel 内部可以持有临时 comment input text；该局部状态不得成为业务事实来源。

## 8. 禁止的副作用

- 禁止修改 source Attempt `userLine`、`result`、`status`。
- 禁止写正式 SGF/game-tree、SGF comment、scratch edit workspace、Problem attempt 或 hidden global state。
- 禁止 `RecallModePanel`、`RecallCheckpointPanel`、`RecallRightPanel` import service/store/repository/Sabaki。
- 禁止 Container 在 step2 handler 中直接写 runtimeStore/workbenchStore；必须调用 existing flowService command。
- 禁止 reveal 前默认显示 AI candidates 或完整答案。
- 禁止使用 `origin.provider`、旧 `source/kind` 或 source-specific tab APIs 作为流程分支。
- 禁止 `snapshotService` 承担 tab opening、checkpoint orchestration 或 comment save。
- 禁止把 `跳过 checkpoint` 重新定义为 step2 主验收；该 command/state-forward/rendered-return 已由 step1 `P5CP-T04` / `P5CP-T05` 覆盖。step2 只能验证新的 visible comment UI 不破坏 Step1-covered route。

## 9. 测试/验收契约表

`P5S2-Cxx` 是 acceptance row，不声明正式测试层。正式 Layer 只在 `P5S2-Txx` 自动化表中声明。

| ID | 类型 | 分类 | Mapped Test IDs | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | --- | -------- | -------------- | --------------- |
| P5S2-C01 | UI_BEHAVIOR | MUST_AUTOMATE | P5S2-T01 | `checkpoint_correction` 可见：当前 checkpoint 显示 source/moveNumber/summary/status；reveal disabled/weak；AI candidates 不显示。 | 高 | 用户不知道当前处于纠错子状态，或提前看到答案。 |
| P5S2-C02 | STATE | MUST_AUTOMATE | P5S2-T02 | Container projection 将 `activeCheckpointId` + tab `recallSubstate` + checkpoint read model 映射为 Recall panel/right panel props；不是只用 `recallOriginalLine=!activeCheckpointId`。 | 高 | Store 已正确推进但 UI 无法显示 comment/reveal 状态。 |
| P5S2-C03 | UI_BEHAVIOR | MUST_AUTOMATE | P5S2-T03 | reveal 后真实渲染的 Recall UI 显示 original/correction/AI candidates 对比和 comment editor。 | 高 | 用户无法在 AI reveal 后写 checkpoint comment。 |
| P5S2-C04 | WIRING | MUST_AUTOMATE | P5S2-T04 | 可见 comment save control 用 `onSaveCheckpointComment({content})` 调用，content 是用户输入的 trimmed text。 | 高 | 测试只调用 Container prop 会漏掉没有可见 comment UI 的缺陷。 |
| P5S2-C05 | WIRING | MUST_AUTOMATE | P5S2-T05 | `TrainingWorkbenchContainer` 对 comment save 只委托 `flowService.saveCheckpointComment({tabId, content})`，不直接写 store/repository/service。 | 中 | UI save 绕过 step1 flow path 或重复业务 ownership。 |
| P5S2-C06 | UI_BEHAVIOR | MUST_AUTOMATE | P5S2-T06 | 从可见 comment editor 保存后，经真实 service/store/subscription 回流，UI 回到 normal Recall projection，checkpoint editor 隐藏。 | 高 | 保存成功但界面卡在 checkpoint/commenting，或 active checkpoint 未清理。 |
| P5S2-C07 | SIDE_EFFECT | MUST_AUTOMATE | P5S2-T07 | 从可见 UI save 触发的闭环不得更新 Attempt protected fields、game-tree、scratch 或 Problem attempt。 | 高 | checkpoint comment 污染正式棋谱或 Attempt。 |
| P5S2-C08 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | P5S2-T08 | Recall presentational panels 不 import service/store/repository/Sabaki；Container handler 不引入 `window.sabaki`、source-specific open APIs 或 `snapshotService` orchestration。 | 中 | 视觉接线把业务边界泄漏到 panel。 |
| P5S2-C09 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | P5S2-M01/P5S2-M02 | 键盘输入 comment、多行文本、保存中按钮 disabled、焦点体验符合轻量编辑预期。 | 中 | 自动化很容易过度规定输入框细节；需要人工确认可用性。 |
| P5S2-C10 | UI_BEHAVIOR | DO_NOT_TEST | none | 不锁定具体 CSS class、card 顺序、精确像素、文案标点或 hover 细节。 | 低 | 脆弱测试阻碍后续视觉实现。 |

### 9.1 Source Row / State Table Coverage

| Source Row | Required Behavior | Test ID | Layer | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| UI/UX §7.2 current checkpoint row | In `checkpoint_correction`, current checkpoint card shows source, moveNumber, summary, and status, while AI candidates remain hidden. | P5S2-T01 | RENDERED_UI_RETURN | RED | Current `RecallCheckpointPanel` only shows moveNumber/summary and has no substate/status props. |
| Architecture §10.4 projection row | `activeCheckpointId` + repository checkpoint facts project into Recall panel/right panel props; projection is read-only and not just `recallOriginalLine=false`. | P5S2-T02 | PROJECTION_RETURN | RED | Current Container projection exposes `activeCheckpointId` and `recallOriginalLine` only. |
| Architecture §0.4 `revealAi` UI return | In `checkpoint_correction` before correction submit, `查看 AI` is disabled/weak and does not reveal answer data. | P5S2-T01 | RENDERED_UI_RETURN | RED | Current rendered button has no disabled/weak guard. |
| Architecture §9.5 reveal display row | In `checkpoint_ai_revealed`, Recall right/panel surface shows original line, user correction line, AI candidate lines, and visible comment editor. | P5S2-T03 | RENDERED_UI_RETURN | RED | Current `src/components/workbench/shell/RightModePanel.js` recall branch does not pass these props to `RecallRightPanel`. |
| Comment editor save mapping | Visible save action calls `onSaveCheckpointComment({content: trimmedText})` from the panel/editor; it is not tested by directly invoking Shell/Container props. | P5S2-T04 | UI_COMMAND_MAPPING | RED | Current code has Container/Shell prop only; no visible editor caller. |
| Container save delegation | Container save handler delegates to `flowService.saveCheckpointComment({tabId, content})` and does not write store/repository directly. | P5S2-T05 | CONTAINER_DELEGATION | GREEN | Current code evidence at `src/components/TrainingWorkbenchContainer.js` lines 453-455 already delegates; test protects regression. |
| `checkpoint_commenting` visible return | During save, UI exposes saving/continuing state and prevents duplicate save without mocking the flow service under test. | P5S2-T06 | RENDERED_UI_RETURN | RED | May require async in-memory repository fake to hold the save promise; current UI lacks visible state. |
| `resumeRecall` after comment | After visible save completes, `activeCheckpointId` is cleared, tab remains `mode='recall'`, `recallSubstate='normal'`, and comment editor disappears. | P5S2-T06 | RENDERED_UI_RETURN | RED | Step1 proves command path; step2 must prove visible comment UI triggers and observes return. |
| Side-effect boundary after visible save | Visible save path writes MoveComment/RecallCheckpoint/RecallSession only; source Attempt, game-tree, scratch, Problem attempt, and SGF comment remain untouched. | P5S2-T07 | SIDE_EFFECT_BOUNDARY | RED | Must use strict in-memory repository fake/write log; do not infer from callback count. |
| Architecture boundary row | Presentational Recall panels stay service/store/repository/Sabaki-free; Container avoids `window.sabaki`, `openGameTab`, `openProblemTab`, `openSnapshotProblemTab`, and `snapshotService` checkpoint orchestration. | P5S2-T08 | ARCHITECTURE_BOUNDARY | RED | Static/source boundary check. |
| UI/UX §7.2 `跳过 checkpoint` command | Skip control may remain visible in checkpoint UI, but its command transition is Step1-covered. | P5CP-T04 | CONTROLLER_STATE_TRANSITION | GREEN | Step1 `P5CP-T04` covers real skip command. Step2 does not duplicate this command contract. |
| UI/UX §7.2 `跳过 checkpoint` rendered return | Skip control may remain visible in checkpoint UI, but its rendered return to normal Recall is Step1-covered. | P5CP-T05 | RENDERED_UI_RETURN | GREEN | Step1 `P5CP-T05` covers rendered skip UI returning to normal. Step2 only ensures new visible comment/substate props do not remove or remap this route. |

## 10. 必须自动化的测试

| Status | Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RED | P5S2-T01 | RENDERED_UI_RETURN | `RecallModePanel` + `RecallCheckpointPanel` | Production Preact render; production panels | Local tiny callbacks only | `local tiny stub` for inert callbacks; checkpoint prop shape constrained by production `RecallCheckpoint`/UI projection type | Do not mock `RecallCheckpointPanel`; do not assert only callback count | Rendering `recallSubstate='checkpoint_correction'` with active checkpoint shows source/moveNumber/summary/status, hides AI candidates, and renders reveal as disabled/weak until correction is submitted. Skip control presence is allowed but its command path is Step1-covered by `P5CP-T04` / `P5CP-T05`. | P5S2-T02, P5S2-T06 |
| RED | P5S2-T02 | PROJECTION_RETURN | `TrainingWorkbenchContainer` projection behavior through Container render props | Real `TrainingWorkbenchContainer`; real runtimeStore/workbenchStore; real repository read fake | WorkbenchShell can be captured as render boundary; repository in-memory fake provides checkpoint/comment/read model | `in-memory repository fake` implementing actual repository methods used by projection; service spies from `test/workbench/shared/workbenchSpyFactories.ts` if needed | Do not handwrite per-file full service/store mocks; do not manually mutate returned props after render | Given active recall tab + runtime active checkpoint + checkpoint read model, Container passes recall checkpoint UI props including `recallSubstate`, active checkpoint data, and `recallOriginalLine=false`. | P5S2-T03, P5S2-T06 |
| RED | P5S2-T03 | RENDERED_UI_RETURN | `src/components/WorkbenchShell.js` -> `RecallModePanel` / `src/components/workbench/shell/RightModePanel.js` -> `RecallRightPanel` | Production Shell and panels; real projection props from P5S2-T02 fixture | Local tiny callbacks only for commands not under test | `local tiny stub`; data shape from production types | Do not replace `RecallRightPanel` with a fake; do not assert `container.render().props` only; do not render the Analysis right panel for Recall checkpoint assertions | In `checkpoint_ai_revealed`, rendered Recall UI shows original line, user correction line, AI candidate lines, and visible comment editor; default/correction state does not reveal AI lines. | P5S2-T04, P5S2-T06 |
| RED | P5S2-T04 | UI_COMMAND_MAPPING | The visible comment editor/save control in `RecallModePanel`, `RecallCheckpointPanel`, or `RecallRightPanel` as implemented for Recall mode | Production panel render and DOM event simulation | Single local callback spy for `onSaveCheckpointComment` | `local tiny stub` allowed because only one callback is being mapped | Do not invoke `onSaveCheckpointComment` directly; do not mock a service/controller here; do not use Shell prop calls as proof of visible editor mapping | Typing text and clicking visible save calls `onSaveCheckpointComment({content: trimmedText})` exactly in the target shape. | P5S2-T05, P5S2-T06 |
| GREEN | P5S2-T05 | CONTAINER_DELEGATION | `TrainingWorkbenchContainer.handleSaveCheckpointComment` | Real Container; real workbenchStore active tab selection | `flowService` typed spy; other context services minimal typed helpers | `shared typed spy factory` from `test/workbench/shared/workbenchSpyFactories.ts` for WorkbenchFlowService | Do not mock Container; do not claim repository/state transition coverage from this test | Calling the Container-exposed save callback with `{content}` delegates once to `flowService.saveCheckpointComment({tabId: activeTab.id, content})` and does not call repository/store directly. | P5S2-T06 |
| RED | P5S2-T06 | RENDERED_UI_RETURN | Visible save UI -> Container -> real `workbenchFlowService.saveCheckpointComment` -> real stores -> rendered Shell/Panels | Real Container, real Shell/Panels, real `createWorkbenchFlowService`, real `createRecallCheckpointService`, real runtimeStore/workbenchStore subscriptions | In-memory repository fake; non-involved services typed spies | `in-memory repository fake` for RecallCheckpoint/MoveComment/RecallSession/Attempt read-write methods; `shared typed spy factory` for unrelated services | Do not mock `workbenchFlowService.saveCheckpointComment`, `recallCheckpointService.saveComment`, runtimeStore, or workbenchStore | From `checkpoint_ai_revealed`, user saves visible comment; UI observes `checkpoint_commenting` saving state when test harness can hold the async boundary, then returns to normal Recall progress with editor hidden and active checkpoint cleared. | P5S2-T07 |
| RED | P5S2-T07 | SIDE_EFFECT_BOUNDARY | Same full loop as P5S2-T06 with strict repository fake | Real command path from UI through services; real stores | Strict in-memory repository fake records all writes | `in-memory repository fake` implementing actual service-called methods and write log | Do not mock repository methods that are asserted as side effects; do not use source text grep as primary proof | Write log includes MoveComment + RecallCheckpoint + RecallSession changes only; no Attempt protected fields, game-tree, scratch, Problem attempt, or SGF comment writes. | not-covered; manual architecture review also checks imports |
| RED | P5S2-T08 | ARCHITECTURE_BOUNDARY | `src/components/workbench/panels/RecallModePanel.js`, `src/components/workbench/panels/RecallCheckpointPanel.js`, `src/components/workbench/panels/RecallRightPanel.js`, `src/components/TrainingWorkbenchContainer.js`, `src/components/WorkbenchShell.js`, `src/components/workbench/shell/RightModePanel.js` | Real source files | None, static boundary check | no mocks | Do not use broad string bans that catch comments unless scoped to imports/calls; do not make CSS/testid assertions | Panels do not import service/store/repository/Sabaki/window globals; Container handlers route comment save through flowService and do not introduce `openGameTab`/`openProblemTab`/`openSnapshotProblemTab`/`snapshotService` checkpoint orchestration; Recall checkpoint comment UI is not wired through Analysis right panel. | not-covered |

Step1-covered, not re-automated here:

| Covered Behavior | Step1 Test ID | Layer | Status | Step2 Treatment |
| --- | --- | --- | --- | --- |
| `跳过 checkpoint` real command marks checkpoint skipped/completed, advances RecallSession, clears runtime, and returns tab to `recallSubstate='normal'`. | P5CP-T04 | CONTROLLER_STATE_TRANSITION | GREEN | Do not duplicate as a step2 primary test. |
| Rendered skip control runs the full chain and re-renders with `activeCheckpointId=null`, `recallOriginalLine=true`, `recallSubstate='normal'`, and checkpoint controls absent/inactive. | P5CP-T05 | RENDERED_UI_RETURN | GREEN | Step2 may include a non-regression assertion only if panel edits touch the same visible control. |

## 11. 仅手动验收

| ID | 验收项 | 理由 |
| --- | --- | --- |
| P5S2-M01 | 在真实 app 中走一次 correction -> reveal -> type comment -> save -> resume，确认用户能理解当前处于“写备注/继续回忆”状态。 | 自动化能证明状态闭环，但不能充分判断文案和交互是否“足够可写”。 |
| P5S2-M02 | 多行 comment、空白 comment、保存中重复点击、保存失败提示的人机体验。 | 需要人工确认轻量输入体验；自动化只锁定语义命令和状态回流。 |
| P5S2-M03 | reveal 后右栏 original/correction/AI candidates 的阅读密度。 | UI/UX 细节属于视觉/可用性验收，不由本 contract 过度指定 CSS。 |
| P5S2-M04 | `跳过 checkpoint` 可见控件在 step2 UI 改动后仍可被找到并不与 comment editor 冲突。 | Step1 `P5CP-T04` / `P5CP-T05` 已覆盖 skip state path；这里仅做可见 non-regression 人工检查。 |

## 12. 不测试

- 不测试具体 CSS class、颜色、像素、card 顺序、hover 样式或动画。
- 不测试 Preact 内部 state 更新顺序，除非它影响可见 `checkpoint_commenting -> normal` 状态。
- 不测试 logger 调用顺序。
- 不测试 `RecallCheckpointPanel` 的每个简单 getter/label 拼接。
- 不把 `data-testid` 是否存在作为主验收。
- 不在 step2 重新测试 step1 已覆盖的 `workbenchFlowService` command guards，除非从可见 save UI 触发完整闭环。
- 不在 step2 重新测试 `跳过 checkpoint` command/state-forward 主路径；该路径 Step1-covered by `P5CP-T04` / `P5CP-T05`。

## 13. 脆弱测试警告

- “callback 被调用一次”只能证明 `UI_COMMAND_MAPPING` 或 `CONTAINER_DELEGATION`，不能证明 checkpoint comment 被保存、store 改变或 UI 回 normal。
- 直接调用 `shellProps.onSaveCheckpointComment({content})` 是有用的 Container delegation 测试，但不能替代可见 comment editor 的渲染测试。
- 测试不得手动设置 asserted after-state 后再断言 UI；after-state 必须来自 production command/store subscription。
- 如果 test writer 需要 fake `WorkbenchFlowService`、`RecallCheckpointService`、repository ports，必须使用生产 interface/type 或 shared typed spy factory；禁止在测试文件内临时手写完整 service mock。
- `checkpoint_commenting` 可能是短暂状态；自动化若无法稳定观察可见 saving state，可用 fake async repository promise 卡住保存过程，但不得 mock 被测 service。
- 不要锁定中文文案的标点或全部句子；应断言语义级可见状态，如 “当前 checkpoint / 先自己摆修正图 / AI candidates / 备注保存”。
- `跳过 checkpoint` 只作为 Step1-covered route 的 non-regression 触点出现；不要用它替代 comment save UI mapping，也不要把 Step1-covered P5CP-T04/P5CP-T05 重写成 P5S2 主断言。

## 14. 超出范围

- 不重新设计 `workbenchFlowService` command ownership；step1 已覆盖。
- 不实现 manual checkpoint creation。
- 不实现 Analysis Return 回到 checkpoint substate；只保持不破坏该契约。
- 不接线 Review enrollment for skipped checkpoint；skip completion route Step1-covered by `P5CP-T04` / `P5CP-T05`。
- 不改变 board click / correctionDraft capture path。
- 不做视觉还原、CSS token、响应式或截图验收；若发现纯视觉偏差，交给 `frontend-visual-workflow`。

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 禁止，step2 不需要 source-specific branching | Architecture v0.5 禁止根据 `origin.provider` 分叉主流程；本契约只使用 active tab + activeCheckpointId + repository read model | Test P5S2-T08 静态边界检查。 |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 禁止 | step2 不打开 tab；当前 user action 是 visible comment save/resume | Test P5S2-T08 禁止新增这些调用。 |
| 是否让 `snapshotService` 承担 tab opening / flow orchestration | 禁止 | UI spec §9.4 说明 Snapshot 是全局命令；本 step 不涉及 snapshot | Test P5S2-T08 禁止 checkpoint/comment path 调用 `snapshotService`。 |
| 是否让 Container 直接写 store，而不是通过 v0.5 指定 service | 禁止 | 当前 Container handlers `src/components/TrainingWorkbenchContainer.js` lines 438-455 已委托 flowService；step2 必须保持 | Test P5S2-T05/T08 验证 save comment 只通过 flowService。 |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 禁止 | 当前 panels 只 import Preact/local UI components；step2 必须保持 presentational | Test P5S2-T08。 |
| 是否把 checkpoint 变成第五个 mode | 禁止 | Architecture v0.5 lines 119-126, 144-147；UI spec lines 872-880 | P5S2-T06 断言 active tab mode 仍为 `recall`。 |
| 是否默认 reveal AI answers | 禁止 | UI/UX §7.2 lines 641-643 and §12 line 1197 | P5S2-T01/T03 断言 correction/default state 不显示 AI candidates。 |
| 是否把 comment 嵌入 Attempt | 禁止 | implementation plan lines 800, 813-814 | P5S2-T07 断言 write log 只写 MoveComment/RecallCheckpoint/RecallSession。 |
| 是否把 `跳过 checkpoint` 重新归入 step2 command contract | 禁止 | Step1 contract v0.2 `P5CP-T04` / `P5CP-T05` 已覆盖 skip command and rendered return | step2 只做 visible UI non-regression，不新增 P5S2 skip primary test。 |

## 16. Workbench 接线清单（如适用）

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 当前 checkpoint card | display checkpoint substate/source/move/summary/status | presentational component | UI/UX §7.2 lines 630-640; Arch §10.4 | 无业务写入 | repository/runtime/workbench projection -> panel props -> visible card | P5S2-T01/T02 | panel callback plumbing |
| `提交修正图` | `onSubmitCorrection(clickEvent)` -> existing `flowService.submitCheckpointCorrection(tabId)` | panel emits; Container delegates; flowService owns command | Arch §9.5 lines 1842-1849 | checkpoint correction line saved; substate remains correction | `canRevealAi=true`, user correction line visible | P5S2-T01/T02; command internals from step1 | panel callback plumbing |
| `查看 AI` | `onRevealAI(clickEvent)` -> existing `flowService.revealCheckpointAi(tabId)` | panel emits; Container delegates; flowService owns command | Arch §9.5 lines 1851-1858; UI/UX §7.2 lines 641-643 | checkpoint status `ai_revealed`, tab substate `checkpoint_ai_revealed` | right panel shows original/correction/AI candidates; comment editor visible | P5S2-T03 | container/projection + panel |
| comment textarea | local text input only | presentational component | Implementation plan lines 799-825 | No business write until save | Text visible locally; does not write store | P5S2-T04 + manual P5S2-M02 | panel callback plumbing |
| `保存备注` | `onSaveCheckpointComment({content})` -> `flowService.saveCheckpointComment({tabId, content})` | panel emits; Container delegates; flowService/service owns write | Arch §9.5 lines 1860-1869 | `checkpoint_ai_revealed -> checkpoint_commenting -> normal`; MoveComment created; checkpoint commented/resumed; active checkpoint cleared | UI hides checkpoint editor and returns to normal Recall progress | P5S2-T04/T05/T06/T07 | controller/container/projection |
| `保存中/继续回忆` visible state | display-only transition | presentational component | Arch §0.4 comment/resume rows | No independent command; reflects in-flight save | `checkpoint_commenting` displays saving, disables duplicate save | P5S2-T06 | panel + container/projection |
| `跳过 checkpoint` | `onSkipCheckpoint(clickEvent)` -> existing `flowService.skipCheckpoint(tabId)` | panel emits; Container delegates; flowService owns command | implementation plan lines 801-802; Arch §0.4 line 147 | checkpoint skipped/resumed | active checkpoint cleared, normal Recall projection | Step1-covered by `P5CP-T04` / `P5CP-T05`; step2 only checks visible comment UI does not regress route | none / non-regression only |
| Bottom Recall status | display checkpoint/normal status | presentational shell | UI/UX §12 line 1200 | 无业务写入 | `checkpoint_correction` -> correction text; `checkpoint_ai_revealed` -> AI displayed/write comment; `normal` -> progress/waiting | P5S2-T06 + manual P5S2-M01 | container/projection |

订阅契约：

| Store subscription | 必须触发的 UI 更新 | 证据/要求 |
| --- | --- | --- |
| `runtimeStore.subscribe` | `activeCheckpointId` 清空后，Container 重新投影 `recallOriginalLine=true` 并隐藏 checkpoint editor | Current Container subscribes at `src/components/TrainingWorkbenchContainer.js` lines 54-58；P5S2-T06 必须走真实 subscription。 |
| `workbenchStore.subscribe` | `recallSubstate` 从 `checkpoint_ai_revealed` 到 `checkpoint_commenting` 到 `normal` 时，UI 状态变化可见 | Current Container subscribes at `src/components/TrainingWorkbenchContainer.js` lines 54-58；P5S2-T06 不得 mock workbenchStore。 |
| repository/read model update | MoveComment/Checkpoint 更新后，projection 能读取完成状态 | 如果当前 repository 无 async subscription，可在 command completion 后由 workbench/runtime subscription 触发 reload；否则标记临时迁移接缝，退出条件是 repository read model subscription/cache 完成。 |

弱测试禁令：不得把 “`onSaveCheckpointComment` 被调用一次” 作为主验收。它只能覆盖 P5S2-T04 或 P5S2-T05 的局部层；完整用户价值必须由 P5S2-T06 证明。

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| step2.1 contract/docs | `docs/archive/daily-design/2026-05-25/phase5-checkpoint-ui-comment/test-contract-v0.2.md` | active source truth + audit blockers | 只写派生契约 | 无生产冲突。 |
| step2.2 tests by mode | `test/workbench/panels/RecallModePanel.test.js`, `test/workbench/panels/RecallCheckpointPanel.test.js`, `test/workbench/panels/RecallRightPanel.test.js` or focused equivalents | contract P5S2-T01/T03/T04 | panel tests 可先写红，不触碰 container/service tests | 与 panel implementation 同文件需串行合并。 |
| step2.3 container/projection tests | `test/workbench/wiring/phase5-checkpoint-ui-comment.test.js` 或同级 wiring file | contract P5S2-T02/T05/T06/T07 | 使用 real stores/flow service，与 panel render tests 逻辑分离 | 需要共享 in-memory repository fake；不要每文件手写 drift fake。 |
| step2.4 panel callback plumbing implementation | `src/components/workbench/panels/RecallModePanel.js`, `src/components/workbench/panels/RecallCheckpointPanel.js`, `src/components/workbench/panels/RecallRightPanel.js`, `src/components/workbench/shell/RightModePanel.js` | red panel tests | presentational-only edits，不写 services/stores | 与 visual/CSS agent 可能冲突；本 step 不做纯视觉还原。 |
| step2.5 container/projection implementation | `src/components/TrainingWorkbenchContainer.js` and optional projection helper | red projection/full-loop tests | 单 owner 处理 repository/read model 到 props | 与 any other Container wiring edits 冲突，需 serial integrator。 |
| step2.6 Step1-covered skip non-regression check | read-only or minimal panel assertions if same files touched | P5CP-T04/P5CP-T05 already green/owned by step1 | 可作为 implementation review checklist，不占 step2 primary command tests | 不得转成重复 skip command contract。 |
| step2.7 architecture review | source files + tests read-only | implementation complete | 可独立审查 boundary/import/mock drift | 若发现 service ownership regression，退回 step2.5。 |
