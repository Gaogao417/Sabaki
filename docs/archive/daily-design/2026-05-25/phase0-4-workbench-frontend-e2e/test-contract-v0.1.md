Date: 2026-05-25
Status: pending-confirmation
Task: phase0-4-workbench-frontend-e2e

# 契约草案

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | 5.2, lines 169-197 | Workbench runtime mode 只有 Play/Problem/Recall/Analysis；`Problem` entity 与 `WorkbenchMode.problem` 必须区分；snapshot 只能从 Analysis scratch/current 派生，禁止 Play/Problem/Recall live context 直接 snapshot。 |
| `docs/product/sabaki-training-prd.md` | 6.1.2-6.1.4, lines 211-245; 11.2, lines 1152-1172 | Play 可选择 AI/player config，完成后进入 Recall；Recall 支持整盘回忆和进度；Analysis 支持 reference/current 和 snapshot 当前局面。 |
| `docs/product/sabaki-training-prd.md` | 6.5.7, lines 665-692; 10.4, lines 1081-1094 | MoveEvaluation 与 BadMove 是训练结果对象，UI 可以显示 pending/evaluated/bad move 状态，但不能把它们当作棋谱写入。 |
| `docs/architecture/workbench-architecture-overview.md` | Mode Orchestration, lines 105-124 | `WorkbenchTab.mode`、active ids、runtime companion state、Attempt mutable/frozen、overlay/engine enter/exit 由 mode orchestration owning service 管，新增功能不得绕过 `workbenchFlowService` 直接 patch store。 |
| `docs/architecture/workbench-architecture-overview.md` | Ownership, lines 378-404, 450-483 | workbenchStore owns tab/mode/player config；trainingStore/runtime owns recall/problem/progress；documentStore owns game tree；analysis/engine/overlay 分别 owning side effects。 |
| `docs/architecture/workbench-architecture-overview.md` | Workspace/Data Flow, lines 549-589, 647-653 | Play=`game-tree+playMove`，Problem=`game-tree/problem-attempt+problemAttemptMove`，Recall=`game-tree/problem-attempt+recallAnswer`，Analysis=`scratch/current+scratchEdit`；Problem submit freezes Attempt and enters Recall。 |
| `docs/architecture/position-source-mutation-contract.md` | PositionSource/WorkingPosition, lines 29-79 | `scratch/current` 与 `scratch/reference` 是 working position，不得隐式 dirty SGF tree；Problem/Recall 可读 `game-tree` 或 `scratch/problem-attempt`。 |
| `docs/architecture/position-source-mutation-contract.md` | Mutation contracts, lines 84-170, 224-232, 254-262 | `recallAnswer` 只写 RecallSession/RecallAttempt/progress，禁止写 SGF tree 或 source Attempt；`scratchEdit` 可保存 working position 为 problem snapshot，禁止写 current SGF tree。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | global/mode/right/bottom panel sections | UI/control placement only: mode bar, mode actions, left/right panels, bottom status/action bar, and visible status facts. Product and architecture still own behavior and state writes. |
| UI/source signature evidence | `src/components/Goban.js:232-243`, `src/components/Goban.js:278-282`, `src/components/TrainingWorkbenchContainer.js:692-696` | Upstream Goban calls `onVertexClick(evt)` with `evt.vertex = [number, number]`; tests that call container handler as `(vertex, event)` are false-green risk。 |
| UI/source signature evidence | `src/components/workbench/shell/ModeBar.js:47-48`, `ModeActions.js:65-68`, `BottomActionBar.js:106-109`, `OpponentControl.js:45-48` | ModeBar calls `onModeChange(key)`; ModeActions/BottomActionBar call handlers with no args; OpponentControl calls `onChange(option)`。 |

Non-gate implementation background: `docs/design/workbench-mode-orchestration-contract.md`
is used only to understand recent migration vocabulary already echoed by active product
and architecture docs. It is not a contract audit source of truth.

## 1. 用户故事

作为训练用户，我可以在现有 Workbench UI 中看到 v0.5 training state 的真实回流：Recall 进度必须来自 `recallPolicy/expectedMoveIndexes` 选择后的目标手；任务打开后必须展示 Task origin trace 但不按 origin 分叉流程；Play/Problem 的 player config 与 AI pending 状态必须回显；提交后必须进入 Recall 并显示进度；Analysis 只能从 scratch/current snapshot 派生子题；pending MoveEvaluation 与 visible BadMove 必须在正确 mode 面板可见。

## 2. 用户动作

- 切换 mode、进入 Analysis、从 Analysis 返回 previous mode。
- 点击 Analysis snapshot；在 Play/Problem/Recall 中 Snapshot UI must not call the flow command and the owner service must reject/no-op if invoked directly.
- 通过 taskImportService 创建/导入 task 并用 `tabService.openTask` 打开。
- 切换黑/白/题目对手 player config。
- Play/Problem 中产生 AI pending、pending MoveEvaluation、visible BadMove。
- 提交 Play/Problem attempt 并进入 Recall。
- Recall 中查看基于 policy/index 的进度。

## 3. 当前阶段

Phase 0-4 Workbench Frontend + E2E wiring，运行态 mode 为 Play / Problem / Recall / Analysis。`problem` 不是 board mode；Play/Recall/Analysis 是 tab/workbench phase，不是 Goban low-level mode。

## 4. 位置源

| Mode/上下文 | 位置源 | 变更契约 |
| --- | --- | --- |
| Play | `game-tree` | `playMove` |
| Problem | `game-tree` 或 `scratch/problem-attempt` | `problemAttemptMove` |
| Recall | `game-tree` 或 `scratch/problem-attempt` | `recallAnswer` |
| Analysis current/reference | `scratch/current` / `scratch/reference` | `scratchEdit` |
| Analysis variation | `game-tree` | `variationMove` |

## 5. 变更契约

- `playMove`: real move/game-tree writes only through play executor/documentStore; may create pending MoveEvaluation.
- `problemAttemptMove`: mutable Attempt/problem runtime/pending eval/BadMove handoff before submit; submit freezes Attempt and enters Recall.
- `recallAnswer`: RecallSession/RecallAttempt/progress only; no source Attempt or SGF mutation.
- `scratchEdit`: Analysis working position mutation and snapshot material only; no current SGF tree mutation.
- `无变更`: origin metadata, recall policy labels, AI pending indicators, pending/bad counts are display/projection only.

## 6. 预期状态流

完整 Workbench loop:

```text
UI event
-> WorkbenchShell / panel callback prop
-> TrainingWorkbenchContainer handler
-> workbenchFlowService / workbenchTabService / taskImportService / boardInteractionController command
-> service / adapter / repository
-> runtimeStore / workbenchStore / Sabaki migration state
-> store subscription
-> container projection
-> WorkbenchShell / panel / GlobalHeader / Goban rendered state
```

重要调用签名:

- `Goban.handleVertexMouseUp:232-243,278-282 -> onVertexClick(evt)`，其中 `evt.vertex = [number, number]`；Container handler consumes `evt.vertex` at `TrainingWorkbenchContainer.js:692-696`。
- `ModeBar:47-48 -> onModeChange(key)`。
- `ModeActions:65-68` and `BottomActionBar:106-109 -> handler()` with no args。
- `OpponentControl:45-48 -> onChange(option)`，`option` is `'self' | 'ai'`。

临时迁移接缝:

- `TrainingWorkbenchContainer.ensureAnalysisWorkspace/exitAnalysisWorkspace` still calls legacy `sabaki.setMode/setState` (`TrainingWorkbenchContainer.js:104-131`) after flow service tab patches. This is allowed only as a migration seam for Analysis workspace/scratch scheduling. Exit condition: Analysis enter/leave effects move behind `workbenchFlowService` + analysis/overlay services, and container stops writing Sabaki state directly for this loop.

## 7. 允许的副作用

- `workbenchFlowService.submit`: finalize/freeze Attempt, create RecallSession, patch active tab to `recall`, clear `problemView`, set active recall id.
- `workbenchFlowService.enterAnalysis/returnFromAnalysis`: patch tab `mode`, `previousMode`/`analysisReturnTarget`; Analysis scratch/overlay effects may occur through the temporary migration seam above.
- `workbenchFlowService.snapshotFromCurrentContext`: only when active tab is `analysis`; create child Task/Problem/tab via repository/tabService; source tab/Attempt/tree unchanged.
- `taskImportService`: create TrainingTask with `origin` metadata; `tabService.openTask` opens by explicit mode or task problem fields, not by origin provider.
- `workbenchFlowService.updatePlayerConfig`: patch active tab `playerConfig`.
- `aiMoveService`/monitor/attemptService: set/clear `pendingAiMove`, upsert/remove pending MoveEvaluation, create BadMove, update `visibleBadMoveIds`.

## 8. 禁止的副作用

- UI components must not import or call service/store/repository/Sabaki directly.
- Container must not add new direct runtime/workbench store writes for this scope; use owner service commands.
- Snapshot from Play/Problem/Recall must not create Task/Problem/tab.
- `snapshotService` must not open tabs or orchestrate mode flow.
- Recall board action/progress must not mutate source Attempt `userLine/result/status` or SGF tree.
- Origin display must not branch workflow on `origin.provider` or legacy `source/kind`.
- Tests must not treat "callback called once" as state-forward proof.

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| P04-E2E-T01 | UI_BEHAVIOR | MUST_AUTOMATE | Recall UI projection must show policy-aware total/current/progress from `recallPolicy` + `expectedMoveIndexes`, not raw Attempt `userLine.length`. | Phase 0 visible contract | Users recall wrong move subset with green UI. |
| P04-E2E-T02 | WIRING | MUST_AUTOMATE | Presentational controls emit their real semantic signatures: mode key, no-arg action handlers, opponent option, Goban single `evt`. | Prevents false green callback tests | Runtime handler receives undefined event/vertex. |
| P04-E2E-T03a | UI_BEHAVIOR | MUST_AUTOMATE | Rendered Snapshot controls are disabled/absent/no-call outside Analysis and delegate to owner flow only in Analysis. | Phase 1 UI guard | Non-analysis UI creates child tasks or bypasses owner flow. |
| P04-E2E-T03b | SIDE_EFFECT | MUST_AUTOMATE | Direct Snapshot service invocation rejects/no-ops outside Analysis with no repository/tab writes; Analysis creates child task/tab and preserves source. | Phase 1 pollution guard | Live Attempt/Recall context copied into derived problem. |
| P04-E2E-T04 | UI_BEHAVIOR | MUST_AUTOMATE | Task import -> `openTask` -> rendered header/panel displays origin metadata as display-only trace. | Phase 2 E2E proof | Imported/snapshot/bad-move tasks become indistinguishable or branch incorrectly. |
| P04-E2E-T05 | STATE | MUST_AUTOMATE | Store setters notify subscribers for player config, AI pending, recall view, pending eval, visible bad move state. | Required return loop | State changes do not repaint existing Workbench UI. |
| P04-E2E-T06 | WIRING | MUST_AUTOMATE | Container delegates player config, submit, enter/return analysis, snapshot, and openTask commands to owner services with active tab id. | Prevents UI owning business writes | Container mutates stores or Sabaki directly outside migration seam. |
| P04-E2E-T07 | UI_BEHAVIOR | MUST_AUTOMATE | Submit from Play/Problem enters Recall and rendered Recall panel/bottom bar shows initial filtered progress. | Phase 3 closed loop | Attempt freezes but user sees stale Problem/Play UI. |
| P04-E2E-T08 | UI_BEHAVIOR | MUST_AUTOMATE | Pending MoveEvaluation and visible BadMove counts project only for the active attempt and render in relevant Play/Problem/Analysis panels. | Phase 4 visible contract | Pending/bad counts leak across tabs or stay hidden. |
| P04-M01 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | Slow-engine walkthrough: AI pending appears, clears on accepted/stale result, and no stale AI move appears after tab/mode switch. | Async confidence | Hard to fully prove with compact unit/E2E tests. |
| P04-M02 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | Full happy path: import/open task, configure players, play/problem submit, Recall progress, enter/return Analysis, Analysis snapshot child tab. | Product confidence | Cross-panel workflow may regress despite focused tests. |
| P04-D01 | UI_BEHAVIOR | DO_NOT_TEST | Pure visual spacing, colors, card structure, CSS selectors, and copy exactness outside required status facts. | Not business wiring | Brittle visual tests in behavior contract. |

## 10. 必须自动化的测试

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P04-E2E-T01 | PROJECTION_RETURN | `TrainingWorkbenchContainer` projection from runtime/recall session facts into Recall props | real container projection, real runtime/workbench stores | typed in-memory repository fake for active RecallSession/task/attempt lookup if projection loads it | in-memory repository fake; production `RecallSession`/`TrainingTask`/`WorkbenchTab` types | container projection function; runtime/workbench stores | Given `recallPolicy:'humanMovesOnly'` and `expectedMoveIndexes:[0,2]`, projected Recall props/render inputs use total `2`, current filtered index, and do not expose raw line length `4`. Test status: RED until projection carries policy/index facts. | P04-E2E-T07 |
| P04-E2E-T02 | UI_COMMAND_MAPPING | `ModeBar`, `ModeActions`, `BottomActionBar`, `OpponentControl`, `Goban` | real presentational components | local tiny callback stubs only | local tiny stub allowed for callbacks; source signatures cited in §6 | store/service/repository mocks claiming state proof | ModeBar calls `onModeChange(key)`; ModeActions/BottomActionBar call no-arg handlers; OpponentControl calls `onChange('self'|'ai')`; Goban click calls `onVertexClick(evt)` with `evt.vertex`. Test status: GREEN. | P04-E2E-T06 |
| P04-E2E-T03a | RENDERED_UI_RETURN | Rendered Snapshot action plumbing in `TrainingWorkbenchContainer -> ModeActions/BottomActionBar` | real container, real workbench/runtime stores, real ModeActions/BottomActionBar | typed flowService spy only for command observation; typed in-memory repository if active task lookup is needed | shared typed spy factory or real production interface/type; in-memory repository fake | mocked action components; direct handler invocation as render proof | Non-analysis rendered Snapshot action is disabled/absent/no-call; Analysis rendered Snapshot action delegates once to owner flow path. Test status: RED for non-analysis UI no-call. | P04-M02 |
| P04-E2E-T03b | SIDE_EFFECT_BOUNDARY | `workbenchFlowService.snapshotFromCurrentContext` | real flowService, real workbench/runtime stores | typed in-memory repository, typed snapshotService spy, typed tabService spy | shared typed spy factory or real production interface/type; in-memory repository fake | flowService under test; workbenchStore/runtimeStore | Direct non-analysis service invocation rejects/no-ops with no task/tab writes; Analysis snapshot creates one child problem task/tab, parent/source Attempt unchanged; returnFromAnalysis only returns to `analysisReturnTarget`. Test status: RED for non-analysis service restriction. | P04-M02 |
| P04-E2E-T04 | RENDERED_UI_RETURN | `taskImportService -> workbenchTabService.openTask -> TrainingWorkbenchContainer -> WorkbenchShell/GlobalHeader` | real taskImportService, real tabService, real repository fake with persisted tasks, real stores, real rendered Shell/Header | SGF/file/101 adapters as typed stubs where needed | in-memory repository fake; adapter stubs typed from service deps | mocked container; mocked Shell/Header | Opening manual/local/101/snapshot/bad_move tasks renders origin trace as display-only title/chip/panel metadata and keeps mode determined by explicit `openTask` opts or task problem fields, not `origin.provider`. Test status: RED until origin projection exists. | P04-M02 |
| P04-E2E-T05 | STORE_SUBSCRIPTION | `createWorkbenchStore` and `createTrainingRuntimeStore` | real stores | none | none | store under test | `updateTab(playerConfig)`, `setAiMovePending/clearAiMovePending`, `setRecallView`, `upsert/removePendingMoveEvaluation`, and `setVisibleBadMoveIds` each notify subscribers exactly enough to trigger UI return without manual `forceUpdate` in tests. Test status: GREEN for store notify methods. | P04-E2E-T06/P04-E2E-T07/P04-E2E-T08 |
| P04-E2E-T06 | CONTAINER_DELEGATION | `TrainingWorkbenchContainer` handlers | real container with real workbench/runtime stores | shared typed flow/tab/taskImport spies; no state-forward claims | `test/workbench/shared/workbenchSpyFactories.ts` typed factories | per-file handwritten WorkbenchFlowService/TabService/TaskImportService spies | With active tab, player controls call `flowService.updatePlayerConfig(tabId, patch)`, submit calls `flowService.submit(tabId)`, analysis/return/snapshot call owner flow commands, add task calls `taskImportService.createManualTask` then `tabService.openTask({mode:'play', playerConfig})`. Test status: RED until non-analysis snapshot no-call is explicit. | P04-E2E-T03a/P04-E2E-T07 |
| P04-E2E-T07 | RENDERED_UI_RETURN | `workbenchFlowService.submit -> stores -> TrainingWorkbenchContainer -> RecallModePanel/BottomActionBar` | real flowService, real stores, real rendered Shell/Panels | typed in-memory repository, typed attemptService/recallService if not using full services | real production interface/type or shared typed spy factory; repository fake records state | mocked RecallModePanel; mocked store setters | Submit freezes/finalizes attempt, creates active RecallSession, active tab renders mode `recall`, `problemView` is gone, and Recall progress shows `0 / filteredTotal` from T01 contract. Test status: RED until submit initializes recallView/progress projection. | P04-M02 |
| P04-E2E-T08 | RENDERED_UI_RETURN | `TrainingWorkbenchContainer -> RightModePanel -> Play/Problem/Analysis right panels` | real container, real stores, real rendered right panels | typed repository fake only if active task/attempt lookup needed | in-memory repository fake; production runtime store types | mocked panels; global runtime mutation outside store APIs | Active attempt pending evaluations count and visible bad move count render in Play, Problem, and Analysis surfaces; counts are filtered to active attempt and disappear when switching to another attempt/tab. Test status: RED until Problem/Analysis receive count props and visible ids are attempt-scoped. | P04-M01 |

## 11. 仅手动验收

| ID | 验收 | 通过标准 |
| --- | --- | --- |
| P04-M01 | Slow-engine / stale AI walkthrough | While engine response is pending, UI shows pending; after switching tab/mode before response, pending clears and no AI move or bad count appears in the new context. |
| P04-M02 | Cross-phase happy path | Create/open task, see origin trace, configure players, submit into Recall, see policy-aware progress, enter/return Analysis, and snapshot only from Analysis. |

## 12. 不测试

- CSS/layout fidelity, visual spacing, color/token exactness, and screenshot matching in this behavior contract.
- Exact wording except stable domain facts (`origin` trace, progress numbers, pending/bad counts, disabled/rejected state).
- One-line getters, component existence, class names, or `data-testid` presence without state-forward/state-return proof.

## 13. 脆弱测试警告

- "callback called once" is only valid for P04-E2E-T02/P04-E2E-T06 mapping/delegation; it must not claim store/service state changed.
- Do not call Goban/Container vertex handlers as `(vertex, event)`; upstream is `onVertexClick(evt)` with `evt.vertex`.
- Do not mock the production subject for `STORE_SUBSCRIPTION`, `PROJECTION_RETURN`, `RENDERED_UI_RETURN`, or `SIDE_EFFECT_BOUNDARY` rows.
- Avoid asserting source-specific APIs (`openProblemTab`, `openSnapshotProblemTab`) as the new main path; they may exist only as legacy compatibility.
- Do not assert current known-gap behavior as green. RED rows define target behavior.

## 14. 超出范围

- Full Problem mode resolver/executor migration away from legacy `play + problemView`.
- Visual fidelity fixes for cards, spacing, responsive layout, or screenshots.
- Engine strength configuration UI beyond `playerConfig` values and visible pending state.
- Review queue scheduling beyond origin/bad_move task visibility.
- New repository schema migrations unless needed by implementation to satisfy these contracts.

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 不允许 | Architecture says mode orchestration/source contracts own flow; task origin is display metadata in this slice. | P04-E2E-T04 must assert display-only origin; mode uses explicit `openTask` opts or task problem fields. |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 不允许 | v0.5 flow is `taskImportService -> openTask`; source-specific APIs exist in `workbenchTabService` as legacy/compatibility. | Tests should prefer `openTask`; source-specific APIs only as legacy fixtures. |
| 是否让 `snapshotService` 承担 tab opening / flow orchestration | 不允许 | PRD lines 186-197 and architecture workspace/data-flow rows 549-589 keep capture/persistence/tab effects behind Workbench flow ownership. | P04-E2E-T03a/T03b require flowService + tabService owner path. |
| 是否让 container 直接写 store，而不是通过 v0.5 指定 service | 新增不允许；legacy Analysis seam documented | Container subscribes to stores and delegates handlers; `ensureAnalysisWorkspace` legacy seam writes Sabaki state. | No new direct store writes; exit seam when Analysis effects move to services. |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 不允许 | Workbench panels/shell consume props/callbacks only. | P04-E2E-T02 locks presentational callback signatures. |
| 是否把 Play/Recall/Analysis 当作 board mode 或把 `problem` 当 board mode | 不允许 | PRD lines 169-184 and architecture lines 105-124. | Tests must talk about Workbench tab mode and mutation contracts, not Goban modes. |
| 是否让 Recall/Analysis mutate source Attempt | 不允许 | Position contract lines 154-170; PRD Recall/Analysis mode constraints; architecture mutation/owner rows 580-589. | P04-E2E-T03b/T07 side-effect assertions must include no source Attempt pollution. |

## 16. Workbench 接线清单

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ModeBar segmented buttons | `onModeChange(key)` | presentational -> Container -> `workbenchFlowService` | mode orchestration lines 34-47 | tab mode/return target patch | `mode`, `modeBarPolicy`, active panel | P04-E2E-T02/T06 | panel callback plumbing |
| ModeActions Analysis snapshot button | `onSnapshot()` | Container -> `workbenchFlowService.snapshotFromCurrentContext` | PRD lines 186-197; architecture workspace/data-flow rows | Analysis creates child task/tab; non-analysis UI no-call + service guard | child tab active/header; parent unchanged | P04-E2E-T03a/T03b | controller/service |
| Recall snapshot action | disabled/no-call | UI policy + flow guard | PRD lines 196-197; architecture mutation contracts | no state write | disabled/absent UI and rejected owner-service direct call | P04-E2E-T03a/T03b | container/projection |
| Add/import task | `taskImportService.*` then `tabService.openTask` | Container orchestrates UI command; services own writes | task/persistence writes lines 428-438 | Task persisted with origin; tab opened | GlobalHeader/status trace | P04-E2E-T04 | service/container |
| Player controls | `onChange(option)` -> `updatePlayerConfig` | Component -> Container -> flowService -> workbenchStore | PRD lines 217-219; tab type `playerConfig` | active tab `playerConfig` patch | selected self/AI controls | P04-E2E-T02/T06 | panel callback plumbing |
| AI pending indicator | display-only | aiMoveService/runtimeStore own state; UI projects | Architecture runtime owner table lines 105-124; training runtime store facts | `pendingAiMove` set/clear | pending chip/status, no business write | P04-E2E-T05/T08/M01 | container/projection |
| Submit answer/end attempt | `submit(tabId)` | Container -> flowService -> attempt/recall services | PRD Play/Problem to Recall flow; architecture lines 580-589 | Attempt finalize/freeze; RecallSession; tab recall; runtime recall active | Recall panel progress and bottom status | P04-E2E-T07 | controller/service |
| Recall progress | display-only | recallService/runtimeStore/repository own facts | PRD lines 1159-1165; recallAnswer contract lines 154-170 | none | policy-aware progress/current/total | P04-E2E-T01/T07 | container/projection |
| Pending eval / BadMove panels | display-only | monitor/attemptService/repository/runtimeStore own facts | PRD lines 665-692, 1081-1094; architecture lines 227-230 and 432-433 | pending/evaluated/bad move runtime facts | counts in Play/Problem/Analysis scoped to active attempt | P04-E2E-T08 | container/projection |

## 17. 任务并行建议

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| contracts/docs | this contract only | none | Read-only except archive file | none after this file lands |
| tests by mode | `test/workbench/wiring/phase0-4-*.test.*` split Recall/Analysis/Projection | approved contract | Disjoint test files | Shared typed fixtures naming |
| controller/service | `workbenchFlowService`, `taskImportService`, `workbenchTabService` | RED tests T03/T04/T07 | Service behavior independent from panels | Shared flow service serial lock |
| container/projection | `TrainingWorkbenchContainer`, projection helpers, right panel prop plumbing | T01/T04/T08 | UI projection can be isolated from service internals | Container is shared integration point |
| panel callback plumbing | Workbench panels/shell only | T02/T06 | Presentational callback signatures are isolated | Avoid visual/style churn |
| architecture review | no writes or review file only | after tests/implementation | Boundary audit can run independently | Must not approve callback-only fake greens |

## 18. 状态矩阵展开（in-scope）

| Source Row | Required Behavior | Test ID | Layer | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `submit`, Play/Problem active attempt | Attempt frozen/finalized; RecallSession created; tab mode `recall`; `problemView=null`; progress rendered from filtered total | P04-E2E-T07 | RENDERED_UI_RETURN | RED | submit currently may not initialize rendered recall progress. |
| `enterAnalysis`, Play/Problem/Recall | tab mode `analysis`; previous/return target recorded; Analysis workspace seam may initialize scratch | P04-E2E-T06 | CONTAINER_DELEGATION | DEFERRED | Approved deferred for scratch workspace/overlay side effects because this slice only wires visible facts and handler delegation; exit when Analysis enter/leave effects move behind `workbenchFlowService` plus analysis/overlay services; follow-up `P04-FU-ANALYSIS-EFFECTS`. |
| `returnFromAnalysis`, Analysis + return target | returns only to target previous mode; clears return target | P04-E2E-T03b | SIDE_EFFECT_BOUNDARY | RED | Covered with same owner-service row as snapshot restriction. |
| `snapshot`, Analysis rendered action | visible Snapshot command delegates to owner flow path | P04-E2E-T03a | RENDERED_UI_RETURN | RED | Must render the action only as an owner-service command, not as direct task/tab writes. |
| `snapshot`, Analysis service effect | child task/tab; source tab/Attempt/tree unchanged | P04-E2E-T03b | SIDE_EFFECT_BOUNDARY | RED | Must keep source unchanged and persist/open only the derived child task. |
| `snapshot`, Play/Problem/Recall rendered action | rendered UI does not call snapshot flow | P04-E2E-T03a | RENDERED_UI_RETURN | RED | This is in-scope automatic coverage, not deferred. |
| `snapshot`, Play/Problem/Recall service guard | direct service path rejects/no-ops; no Task/Problem/tab write | P04-E2E-T03b | SIDE_EFFECT_BOUNDARY | RED | This is in-scope automatic coverage, not deferred. |
| `pendingMoveEvaluations`, active Play/Problem/Analysis context | active attempt pending count visible; not leaked across tabs | P04-E2E-T08 | RENDERED_UI_RETURN | RED | Current right-panel prop pass-through incomplete for Problem/Analysis. |
| `visibleBadMoveIds`, active Play/Problem/Analysis context | active attempt bad count visible; not leaked across tabs | P04-E2E-T08 | RENDERED_UI_RETURN | RED | Projection must scope to active attempt/repository facts instead of global count. |
| `recallPolicy/expectedMoveIndexes`, Recall | progress/current/total based on selected expected indexes | P04-E2E-T01 | PROJECTION_RETURN | RED | Current UI projection has no explicit policy/index display contract. |
