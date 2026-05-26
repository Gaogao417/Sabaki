Date: 2026-05-26
Status: pending-confirmation
Audit Status: draft/pending-audit
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
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §0.4 lines 112-148 | `RecallSubstate` 只允许 `normal`、`checkpoint_correction`、`checkpoint_ai_revealed`、`checkpoint_commenting`；`revealAi`、`commentCheckpoint`、`resumeRecall` 必须保持 `mode='recall'` 并只推进 recall substate。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §9.5 lines 1828-1869 | Recall checkpoint command path 是 recall move -> checkpoint start；correction 写 checkpoint correction；reveal 加载 AI/reference candidates 并显示 original/correction/AI lines；comment 创建 MoveComment、标记 checkpoint commented、resume recall 并清理 active checkpoint。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §10.4 lines 1986-1993 | Recall checkpoint UI 回流从 `trainingRuntimeStore.activeCheckpointId` 开始，加载 RecallCheckpoint、BadMove、MoveEvaluation、Comment 后投影给 `RecallCheckpointPanel`。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §7.2 lines 616-643 | 关闭“先复现原线”时显示 checkpoint 队列、当前 checkpoint、`提交修正图`、`查看 AI`、`跳过 checkpoint`；必须显示来源、moveNumber、局面摘要和状态；未提交修正图前不得默认暴露 AI answers；Reveal 后右栏显示原线、修正线、AI candidates 对比。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §9.4 lines 872-880 | UI 必须与 Architecture v0.5 状态机一致；Checkpoint 是 Recall substate，不是第五个 mode；进入 Analysis 时保存返回目标；Snapshot 不改变当前 tab mode/substate。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §12 Recall acceptance lines 1192-1200 | Recall 验收要求：显示 checkpoint 队列、当前 checkpoint、用户修正和 `查看 AI`；默认不直接暴露 AI candidates；系统/手动 checkpoint 来源可区分；底部显示当前进度或 checkpoint 状态。 |
| 当前生产代码证据，非真源 | `TrainingWorkbenchContainer.js` lines 57-58, 438-455, 606-610, 949-958 | 当前 Container 已订阅 runtime/workbench store，并将 submit/reveal/skip/save comment callback 代理到 `flowService`；projection 目前只把 `activeCheckpointId` 映射成 `recallOriginalLine=false`，尚未把 checkpoint substate/comment/candidates 投影成完整可见 UI。 |
| 当前生产代码证据，非真源 | `RecallModePanel.js` lines 157-187; `RecallCheckpointPanel.js` lines 11-25; `RecallRightPanel.js` lines 16-24; `RightModePanel.js` lines 36-45 | 当前 Recall 左栏已有 checkpoint 队列按钮，但 `RecallCheckpointPanel` 只显示 moveNumber/summary；右栏不接收 correction/AI/comment props；没有可见 comment editor/save control。 |
| 当前生产代码证据，非真源 | `workbenchFlowService.ts` lines 464-555; `recallCheckpointService.ts` lines 182-212, 251-279 | step1 command path 已存在：`submitCheckpointCorrection`、`revealCheckpointAi`、`skipCheckpoint`、`saveCheckpointComment`；step2 不重新定义 ownership，只要求 UI save mapping 走既有 `Container -> flowService.saveCheckpointComment({tabId, content})` 路径并验证状态回流。 |

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
| `RecallModePanel` submit correction button | `onSubmitCorrection(clickEvent)`；handler 不依赖 payload | `RecallModePanel.js` lines 175-179 | 测试按 `onSubmitCorrection(checkpointId)` 调用会掩盖真实 UI 不传 checkpointId 的事实。 |
| `RecallModePanel` reveal AI button | `onRevealAI(clickEvent)`；handler 不依赖 payload | `RecallModePanel.js` lines 180-183 | 测试按 `onRevealAI({checkpointId})` 调用是假绿。 |
| `RecallModePanel` skip checkpoint button | `onSkipCheckpoint(clickEvent)`；handler 不依赖 payload | `RecallModePanel.js` lines 184-187 | 测试按 `onSkipCheckpoint(checkpointId)` 调用是假绿。 |
| step2 comment save control | 必须实现为 `onSaveCheckpointComment({content: string})` | Container handler 已按 `{content}` 解构：`TrainingWorkbenchContainer.js` lines 453-455；Shell 透传 panel props：`WorkbenchShell.js` lines 88-90 | 当前没有 panel caller。测试直接调用 `shellProps.onSaveCheckpointComment` 只能证明 `CONTAINER_DELEGATION`，不能证明可见 comment UI mapping。 |
| `WorkbenchShell -> RecallModePanel` | `RecallModePanel({...rest, state: recallState})` | `WorkbenchShell.js` lines 88-90 | 只断言 shell prop 存在不证明 rendered panel 可见状态。 |

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
| `checkpoint_correction` before correction submitted | `activeTab.mode='recall'`; `activeTab.recallSubstate='checkpoint_correction'`; `runtime.activeCheckpointId='cp_1'`; checkpoint `status='pending_correction'`; `userCorrectionLine=[]` | `recallOriginalLine=false`; `activeCheckpointId='cp_1'`; `recallSubstate='checkpoint_correction'`; `checkpointStatus='pending_correction'`; `canRevealAi=false`; no `aiCandidateLines` visible | Left/current checkpoint shows source, moveNumber, summary, status text like `先自己摆修正图`; right panel does not reveal AI candidates; bottom status says checkpoint correction state | `提交修正图` active only if `correctionDraft.moves.length > 0`; `查看 AI` disabled/weak; `跳过 checkpoint` active |
| `checkpoint_correction` after correction submitted | Same tab/runtime; checkpoint `userCorrectionLine.length > 0`; `correctionDraft` cleared by service path if applicable | `canRevealAi=true`; `canSubmitCorrection=false` or idempotent display | User correction line visible; `查看 AI` becomes available; still no AI candidates exposed | `查看 AI` active; comment editor hidden |
| `checkpoint_ai_revealed` | `activeTab.recallSubstate='checkpoint_ai_revealed'`; checkpoint `status='ai_revealed'`; `aiCandidateLines.length >= 0`; runtime active checkpoint still set | `canEditComment=true`; original/correction/AI comparison props populated | Right panel shows original line, user correction line, AI candidate lines; comment editor is visible and focused enough for input; bottom status says AI candidates displayed / write comment | `保存备注` active when trimmed content is non-empty; `查看 AI` may be disabled or display-only |
| `checkpoint_commenting` | Flow has applied `commentCheckpoint`; `saveCheckpointComment` in progress; active checkpoint still set until resume succeeds | `isSavingComment=true`; form content preserved | UI shows saving/continuing recall state; save button disabled to prevent duplicate submit | No duplicate save; skip/reveal disabled during save |
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
- 通过既有 service path 推进 RecallSession `currentMoveIndex`。
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

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| P5S2-C01 | UI_BEHAVIOR | MUST_AUTOMATE | `checkpoint_correction` 可见：当前 checkpoint 显示 source/moveNumber/summary/status；reveal disabled/weak；AI candidates 不显示。 | 高 | 用户不知道当前处于纠错子状态，或提前看到答案。 |
| P5S2-C02 | PROJECTION_RETURN | MUST_AUTOMATE | Container projection 将 `activeCheckpointId` + tab `recallSubstate` + checkpoint read model 映射为 Recall panel/right panel props；不是只用 `recallOriginalLine=!activeCheckpointId`。 | 高 | Store 已正确推进但 UI 无法显示 comment/reveal 状态。 |
| P5S2-C03 | RENDERED_UI_RETURN | MUST_AUTOMATE | reveal 后真实渲染的 Recall UI 显示 original/correction/AI candidates 对比和 comment editor。 | 高 | 用户无法在 AI reveal 后写 checkpoint comment。 |
| P5S2-C04 | UI_COMMAND_MAPPING | MUST_AUTOMATE | 可见 comment save control 用 `onSaveCheckpointComment({content})` 调用，content 是用户输入的 trimmed text。 | 高 | 测试只调用 Container prop 会漏掉没有可见 comment UI 的缺陷。 |
| P5S2-C05 | WIRING | MUST_AUTOMATE | `TrainingWorkbenchContainer` 对 comment save 只委托 `flowService.saveCheckpointComment({tabId, content})`，不直接写 store/repository/service。 | 中 | UI save 绕过 step1 flow path 或重复业务 ownership。 |
| P5S2-C06 | RENDERED_UI_RETURN | MUST_AUTOMATE | 从可见 comment editor 保存后，经真实 service/store/subscription 回流，UI 回到 normal Recall projection，checkpoint editor 隐藏。 | 高 | 保存成功但界面卡在 checkpoint/commenting，或 active checkpoint 未清理。 |
| P5S2-C07 | SIDE_EFFECT | MUST_AUTOMATE | 从可见 UI save 触发的闭环不得更新 Attempt protected fields、game-tree、scratch 或 Problem attempt。 | 高 | checkpoint comment 污染正式棋谱或 Attempt。 |
| P5S2-C08 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Recall presentational panels 不 import service/store/repository/Sabaki；Container handler 不引入 `window.sabaki`、source-specific open APIs 或 `snapshotService` orchestration。 | 中 | 视觉接线把业务边界泄漏到 panel。 |
| P5S2-C09 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | 键盘输入 comment、多行文本、保存中按钮 disabled、焦点体验符合轻量编辑预期。 | 中 | 自动化很容易过度规定输入框细节；需要人工确认可用性。 |
| P5S2-C10 | UI_BEHAVIOR | DO_NOT_TEST | 不锁定具体 CSS class、card 顺序、精确像素、文案标点或 hover 细节。 | 低 | 脆弱测试阻碍后续视觉实现。 |

### 9.1 状态表展开

| 字段/事件 | Mode/State | 期望值/行为 | 测试 ID | 测试状态 | GAP/Deferred |
| --- | --- | --- | --- | --- | --- |
| `activeTab.mode` | all checkpoint substates | 始终为 `recall` | P5S2-T06 | GREEN-after-step1, keep covered | step2 复用 step1 command path。 |
| `recallSubstate` | correction | `checkpoint_correction` 投影成当前 checkpoint/correction UI | P5S2-T01, P5S2-T02 | RED | 当前 panel 未接收/显示 recallSubstate。 |
| `aiCandidateLines` | correction before reveal | 不显示；`查看 AI` disabled/weak | P5S2-T01 | RED | 当前 `查看 AI` button 无 disabled/weak guard。 |
| `aiCandidateLines` | after reveal | right panel 显示 original/correction/AI candidates 对比 | P5S2-T03 | RED | 当前 `RecallRightPanel` 无 candidate/correction props。 |
| `comment editor` | `checkpoint_ai_revealed` | 可见并可保存 `{content}` | P5S2-T04 | RED | 当前没有 comment editor/save control。 |
| `recallSubstate` | `checkpoint_commenting` | 保存中可见，防重复提交 | P5S2-T06 | RED | 当前无可见 saving/commenting state。 |
| `activeCheckpointId` | after save/resume | `null/undefined`，Recall UI 回 normal progress | P5S2-T06 | RED | command path 可清理，但 current UI 没有可见 comment save entry。 |
| `source Attempt` | after save/resume | `userLine/result/status` 不变 | P5S2-T07 | GREEN-after-step1, assert via UI loop | step2 只需从 visible save event 触发同一路径。 |

## 10. 必须自动化的测试

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P5S2-T01 | RENDERED_UI_RETURN | `RecallModePanel` + `RecallCheckpointPanel` | Production Preact render; production panels | Local tiny callbacks only | `local tiny stub` for inert callbacks; checkpoint prop shape constrained by production `RecallCheckpoint`/UI projection type | Do not mock `RecallCheckpointPanel`; do not assert only callback count | Rendering `recallSubstate='checkpoint_correction'` with active checkpoint shows source/moveNumber/summary/status, hides AI candidates, and renders reveal as disabled/weak until correction is submitted | P5S2-T02, P5S2-T06 |
| P5S2-T02 | PROJECTION_RETURN | `TrainingWorkbenchContainer.projectFromRuntime/projectFromWorkbench` behavior through Container render props | Real `TrainingWorkbenchContainer`; real runtimeStore/workbenchStore; real repository read fake | WorkbenchShell can be captured as render boundary; repository in-memory fake provides checkpoint/comment/read model | `in-memory repository fake` implementing actual repository methods used by projection; service spies from `test/workbench/shared/workbenchSpyFactories.ts` if needed | Do not handwrite per-file full service/store mocks; do not manually mutate returned props after render | Given active recall tab + runtime active checkpoint + checkpoint read model, Container passes recall checkpoint UI props including `recallSubstate`, active checkpoint data, and `recallOriginalLine=false` | P5S2-T03, P5S2-T06 |
| P5S2-T03 | RENDERED_UI_RETURN | `WorkbenchShell` -> `RecallModePanel` -> `RecallRightPanel` | Production Shell and panels; real projection props from P5S2-T02 fixture | Local tiny callbacks only for commands not under test | `local tiny stub`; data shape from production types | Do not replace `RecallRightPanel` with a fake; do not assert `container.render().props` only | In `checkpoint_ai_revealed`, rendered UI shows original line, user correction line, AI candidate lines, and visible comment editor; default/correction state does not reveal AI lines | P5S2-T04, P5S2-T06 |
| P5S2-T04 | UI_COMMAND_MAPPING | The visible comment editor/save control in `RecallModePanel` or `RecallCheckpointPanel` | Production panel render and DOM event simulation | Single local callback spy for `onSaveCheckpointComment` | `local tiny stub` allowed because only one callback is being mapped | Do not invoke `onSaveCheckpointComment` directly; do not mock a service/controller here | Typing text and clicking visible save calls `onSaveCheckpointComment({content: trimmedText})` exactly in the target shape | P5S2-T05, P5S2-T06 |
| P5S2-T05 | CONTAINER_DELEGATION | `TrainingWorkbenchContainer.handleSaveCheckpointComment` | Real Container; real workbenchStore active tab selection | `flowService` typed spy; other context services minimal typed helpers | `shared typed spy factory` from `test/workbench/shared/workbenchSpyFactories.ts` for WorkbenchFlowService | Do not mock Container; do not claim repository/state transition coverage from this test | Calling the Container-exposed save callback with `{content}` delegates once to `flowService.saveCheckpointComment({tabId: activeTab.id, content})` and does not call repository/store directly | P5S2-T06 |
| P5S2-T06 | RENDERED_UI_RETURN | Visible save UI -> Container -> real `workbenchFlowService.saveCheckpointComment` -> real stores -> rendered Shell/Panels | Real Container, real Shell/Panels, real `createWorkbenchFlowService`, real `createRecallCheckpointService`, real runtimeStore/workbenchStore subscriptions | In-memory repository fake; non-involved services typed spies | `in-memory repository fake` for RecallCheckpoint/MoveComment/RecallSession/Attempt read-write methods; `shared typed spy factory` for unrelated services | Do not mock `workbenchFlowService.saveCheckpointComment`, `recallCheckpointService.saveComment`, runtimeStore, or workbenchStore | From `checkpoint_ai_revealed`, user saves visible comment; UI observes `checkpoint_commenting` saving state, then returns to normal Recall progress with editor hidden and active checkpoint cleared | P5S2-T07 |
| P5S2-T07 | SIDE_EFFECT_BOUNDARY | Same full loop as P5S2-T06 with strict repository fake | Real command path from UI through services; real stores | Strict in-memory repository fake records all writes | `in-memory repository fake` implementing actual service-called methods and write log | Do not mock repository methods that are asserted as side effects; do not use source text grep as primary proof | Write log includes MoveComment + RecallCheckpoint + RecallSession changes only; no Attempt protected fields, game-tree, scratch, Problem attempt, or SGF comment writes | not-covered; manual architecture review also checks imports |
| P5S2-T08 | ARCHITECTURE_BOUNDARY | `RecallModePanel.js`, `RecallCheckpointPanel.js`, `RecallRightPanel.js`, `TrainingWorkbenchContainer.js` | Real source files | None, static boundary check | no mocks | Do not use broad string bans that catch comments unless scoped to imports/calls; do not make CSS/testid assertions | Panels do not import service/store/repository/Sabaki/window globals; Container handlers route comment save through flowService and do not introduce `openGameTab`/`openProblemTab`/`openSnapshotProblemTab`/`snapshotService` checkpoint orchestration | not-covered |

## 11. 仅手动验收

| ID | 验收项 | 理由 |
| --- | --- | --- |
| P5S2-M01 | 在真实 app 中走一次 correction -> reveal -> type comment -> save -> resume，确认用户能理解当前处于“写备注/继续回忆”状态。 | 自动化能证明状态闭环，但不能充分判断文案和交互是否“足够可写”。 |
| P5S2-M02 | 多行 comment、空白 comment、保存中重复点击、保存失败提示的人机体验。 | 需要人工确认轻量输入体验；自动化只锁定语义命令和状态回流。 |
| P5S2-M03 | reveal 后右栏 original/correction/AI candidates 的阅读密度。 | UI/UX 细节属于视觉/可用性验收，不由本 contract 过度指定 CSS。 |

## 12. 不测试

- 不测试具体 CSS class、颜色、像素、card 顺序、hover 样式或动画。
- 不测试 Preact 内部 state 更新顺序，除非它影响可见 `checkpoint_commenting -> normal` 状态。
- 不测试 logger 调用顺序。
- 不测试 `RecallCheckpointPanel` 的每个简单 getter/label 拼接。
- 不把 `data-testid` 是否存在作为主验收。
- 不在 step2 重新测试 step1 已覆盖的 `workbenchFlowService` command guards，除非从可见 save UI 触发完整闭环。

## 13. 脆弱测试警告

- “callback 被调用一次”只能证明 `UI_COMMAND_MAPPING` 或 `CONTAINER_DELEGATION`，不能证明 checkpoint comment 被保存、store 改变或 UI 回 normal。
- 直接调用 `shellProps.onSaveCheckpointComment({content})` 是有用的 Container delegation 测试，但不能替代可见 comment editor 的渲染测试。
- 测试不得手动设置 asserted after-state 后再断言 UI；after-state 必须来自 production command/store subscription。
- 如果 test writer 需要 fake `WorkbenchFlowService`、`RecallCheckpointService`、repository ports，必须使用生产 interface/type 或 shared typed spy factory；禁止在测试文件内临时手写完整 service mock。
- `checkpoint_commenting` 可能是短暂状态；自动化若无法稳定观察可见 saving state，可用 fake async repository promise 卡住保存过程，但不得 mock 被测 service。
- 不要锁定中文文案的标点或全部句子；应断言语义级可见状态，如 “当前 checkpoint / 先自己摆修正图 / AI candidates / 备注保存”。

## 14. 超出范围

- 不重新设计 `workbenchFlowService` command ownership；step1 已覆盖。
- 不实现 manual checkpoint creation。
- 不实现 Analysis Return 回到 checkpoint substate；只保持不破坏该契约。
- 不接线 Review enrollment for skipped checkpoint。
- 不改变 board click / correctionDraft capture path。
- 不做视觉还原、CSS token、响应式或截图验收；若发现纯视觉偏差，交给 `frontend-visual-workflow`。

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 禁止，step2 不需要 source-specific branching | Architecture v0.5 禁止根据 `origin.provider` 分叉主流程；本契约只使用 active tab + activeCheckpointId + repository read model | Test P5S2-T08 静态边界检查。 |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 禁止 | step2 不打开 tab；当前 user action 是 comment save/resume | Test P5S2-T08 禁止新增这些调用。 |
| 是否让 `snapshotService` 承担 tab opening / flow orchestration | 禁止 | UI spec §9.4 说明 Snapshot 是全局命令；本 step 不涉及 snapshot | Test P5S2-T08 禁止 checkpoint/comment path 调用 `snapshotService`。 |
| 是否让 Container 直接写 store，而不是通过 v0.5 指定 service | 禁止 | 当前 Container handlers lines 438-455 已委托 flowService；step2 必须保持 | Test P5S2-T05/T08 验证 save comment 只通过 flowService。 |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 禁止 | 当前 panels 只 import Preact/local UI components；step2 必须保持 presentational | Test P5S2-T08。 |
| 是否把 checkpoint 变成第五个 mode | 禁止 | Architecture v0.5 lines 119-126, 144-147；UI spec lines 872-880 | P5S2-T06 断言 active tab mode 仍为 `recall`。 |
| 是否默认 reveal AI answers | 禁止 | UI/UX §7.2 lines 641-643 and §12 line 1197 | P5S2-T01/T03 断言 correction/default state 不显示 AI candidates。 |
| 是否把 comment 嵌入 Attempt | 禁止 | implementation plan lines 800, 813-814 | P5S2-T07 断言 write log只写 MoveComment/RecallCheckpoint/RecallSession。 |

## 16. Workbench 接线清单（如适用）

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 当前 checkpoint card | display checkpoint substate/source/move/summary/status | presentational component | UI/UX §7.2 lines 630-640; Arch §10.4 | 无业务写入 | repository/runtime/workbench projection -> panel props -> visible card | P5S2-T01/T02 | panel callback plumbing |
| `提交修正图` | `onSubmitCorrection(clickEvent)` -> existing `flowService.submitCheckpointCorrection(tabId)` | panel emits; Container delegates; flowService owns command | Arch §9.5 lines 1842-1849 | checkpoint correction line saved; substate remains correction | `canRevealAi=true`, user correction line visible | P5S2-T01/T02; command internals from step1 | panel callback plumbing |
| `查看 AI` | `onRevealAI(clickEvent)` -> existing `flowService.revealCheckpointAi(tabId)` | panel emits; Container delegates; flowService owns command | Arch §9.5 lines 1851-1858; UI/UX §7.2 lines 641-643 | checkpoint status `ai_revealed`, tab substate `checkpoint_ai_revealed` | right panel shows original/correction/AI candidates; comment editor visible | P5S2-T03 | container/projection + panel |
| comment textarea | local text input only | presentational component | Implementation plan lines 799-825 | No business write until save | Text visible locally; does not write store | P5S2-T04 + manual P5S2-M02 | panel callback plumbing |
| `保存备注` | `onSaveCheckpointComment({content})` -> `flowService.saveCheckpointComment({tabId, content})` | panel emits; Container delegates; flowService/service owns write | Arch §9.5 lines 1860-1869 | `checkpoint_ai_revealed -> checkpoint_commenting -> normal`; MoveComment created; checkpoint commented/resumed; active checkpoint cleared | UI hides checkpoint editor and returns to normal Recall progress | P5S2-T04/T05/T06/T07 | controller/container/projection |
| `保存中/继续回忆` visible state | display-only transition | presentational component | Arch §0.4 comment/resume rows | No independent command; reflects in-flight save | `checkpoint_commenting` displays saving, disables duplicate save | P5S2-T06 | panel + container/projection |
| `跳过 checkpoint` | `onSkipCheckpoint(clickEvent)` -> existing `flowService.skipCheckpoint(tabId)` | panel emits; Container delegates; flowService owns command | implementation plan lines 801-802; Arch §9.5 resume path | checkpoint skipped/resumed | active checkpoint cleared, normal Recall projection | Existing step1 plus optional rendered smoke; not primary step2 comment path | deferred unless regression found |
| Bottom Recall status | display checkpoint/normal status | presentational shell | UI/UX §12 line 1200 | 无业务写入 | `checkpoint_correction` -> correction text; `checkpoint_ai_revealed` -> AI displayed/write comment; `normal` -> progress/waiting | P5S2-T06 + manual P5S2-M01 | container/projection |

订阅契约：

| Store subscription | 必须触发的 UI 更新 | 证据/要求 |
| --- | --- | --- |
| `runtimeStore.subscribe` | `activeCheckpointId` 清空后，Container 重新投影 `recallOriginalLine=true` 并隐藏 checkpoint editor | Current Container subscribes at `TrainingWorkbenchContainer.js` lines 57-58；P5S2-T06 必须走真实 subscription。 |
| `workbenchStore.subscribe` | `recallSubstate` 从 `checkpoint_ai_revealed` 到 `checkpoint_commenting` 到 `normal` 时，UI 状态变化可见 | Current Container subscribes at lines 57-58；P5S2-T06 不得 mock workbenchStore。 |
| repository/read model update | MoveComment/Checkpoint 更新后，projection 能读取完成状态 | 如果当前 repository 无 async subscription，可在 command completion后由 workbench/runtime subscription触发 reload；否则标记临时迁移接缝，退出条件是 repository read model subscription/cache 完成。 |

弱测试禁令：不得把 “`onSaveCheckpointComment` 被调用一次” 作为主验收。它只能覆盖 P5S2-T04 或 P5S2-T05 的局部层；完整用户价值必须由 P5S2-T06 证明。

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| step2.1 contract/docs | `docs/archive/daily-design/2026-05-25/phase5-checkpoint-ui-comment/test-contract-v0.1.md` | active source truth | 只写派生契约 | 无生产冲突。 |
| step2.2 tests by mode | `test/workbench/panels/RecallModePanel.test.js`, `test/workbench/panels/RecallCheckpointPanel.test.js`, `test/workbench/panels/RecallRightPanel.test.js` | contract P5S2-T01/T03/T04 | panel tests可先写红，不触碰 container/service tests | 与 panel implementation 同文件需串行合并。 |
| step2.3 container/projection tests | `test/workbench/wiring/phase5-checkpoint-ui-comment.test.js` 或同级 wiring file | contract P5S2-T02/T05/T06/T07 | 使用 real stores/flow service，与 panel render tests逻辑分离 | 需要共享 in-memory repository fake；不要每文件手写 drift fake。 |
| step2.4 panel callback plumbing implementation | `src/components/workbench/panels/RecallModePanel.js`, `src/components/workbench/panels/RecallCheckpointPanel.js`, `src/components/workbench/panels/RecallRightPanel.js` | red panel tests | presentational-only edits，不写 services/stores | 与 visual/CSS agent可能冲突；本 step不做纯视觉还原。 |
| step2.5 container/projection implementation | `src/components/TrainingWorkbenchContainer.js` and optional projection helper | red projection/full-loop tests | 单 owner 处理 repository/read model到 props | 与 any other Container wiring edits 冲突，需 serial integrator。 |
| step2.6 architecture review | source files + tests read-only | implementation complete | 可独立审查 boundary/import/mock drift | 若发现 service ownership regression，退回 step2.5。 |
