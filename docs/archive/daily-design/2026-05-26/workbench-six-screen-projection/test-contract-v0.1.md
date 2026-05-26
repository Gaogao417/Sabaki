Date: 2026-05-26
Status: pending-confirmation

# 契约草案

## 0. 任务范围

本契约只定义 `step1.3.contract` 的测试草案：六屏 Workbench projection 防假绿测试。

目标是让下一步 `visual-test-writer` 在一个独立文件中优先编写 focused tests：

```text
test/workbench/wiring/six-screen-projection.test.js
```

本契约不要求现在修改生产代码或测试代码。后续测试必须证明 Problem、Recall、Analysis、Library 四类可见 projection 来自真实 task / runtime / analysis / repository / sync 来源，而不是面板内部静态样例文案、硬编码数字、直接 props 造绿或 `data-testid` 存在检查。

Library 不是第五个 Workbench mode；它是 Play / Analysis 等 surface 上的材料入口或 drawer/dialog projection。

## 1. 真源对齐

| 真源 | 章节/位置 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | §4.2-4.4, §5.2 | 训练事实围绕 `TrainingAttempt.userLine`、MoveEvaluation、BadMove、RecallSession、RecallCheckpoint、Analysis/Snapshot/Review 展开；运行态 mode 只有 `play / problem / recall / analysis`；Library/Review/Punishment Problem 不是新 mode。 |
| `docs/product/sabaki-training-prd.md` | §6.2, §6.3, §6.5, §6.8 | Recall 来自 frozen Attempt 派生的 RecallSession；Analysis 来自 analysis context / scratch-current / AI candidates；Problem 来自 TrainingTask/problem-like 字段和 active Attempt/runtime evaluation；材料库必须接入 Fox、101、本地 SGF、Review/Problem inbox 等 repository/sync 数据。 |
| `docs/product/sabaki-training-prd.md` | §12.8, §12.10 | Library 的历史记录、棋谱库、对局库、错题入口必须来自 repository / sync service / runtime projection，不能只展示静态 mock；E2E/前端验收不能只检查元素存在，必须验证 UI command 到 service/store/projection 的真实结果。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §0.3, §1.1-1.3 | UI 只展示；Container/Controller 读 Store、调 Service；Service 编排业务动作；Repository 统一存取训练 DB；读路径是 `Store / Repository query -> Container / ViewModel -> UI Component`。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §4.3, §5.1-5.3, §5.8-5.10 | `trainingRuntimeStore` 只保存当前运行态和 projection/cache；完整历史事实属于 repository/service。taskImportService 标准化外部材料，workbenchFlowService 编排 tab/mode，recall/checkpoint/snapshot services 各守边界。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §9.1-9.7, §10.1-10.5 | 导入、打开 Task、Submit、Recall checkpoint、进入 Analysis、Snapshot 均有命令路径；Workbench 主工作台根据 active tab mode 选择面板；Problem/Recall/Analysis UI policy 必须由 task/runtime/repository/analysis projection 提供。 |
| `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md` | Screens, Migration Steps 2-9, Acceptance | 六屏表面已经是默认 Workbench surface；Problem/Recall/Analysis/Library 数据必须从 TrainingTask、runtime view、analysis context、repository/dashboard/sync services 接线，替换静态文字。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §0, §2-4, §6-8, §9.4, §12-15 | 六屏视觉骨架、四段 mode、左右面板和底部栏由 UI spec 定义；本契约只测试 projection fidelity，不做像素还原。每个模式必须覆盖 empty/active/success/error/loading/disabled，不允许用同一 mock 数据渲染四种 mode。 |
| `docs/architecture/gabaki-sabaki-training-implementation-plan.md` | §1, §3 step1.3/step8.*, §6 Gate Ledger | 当前缺口是多个面板仍有静态或本地 projection；step1.3 要先写防假绿测试；后续 step8.* 才实现 Problem/Recall/Analysis/Library 数据接线。 |

当前实现证据只用于定位风险，不作为真源：`ProblemModePanel` / `ProblemRightPanel` / `RecallRightPanel` / `AnalysisModePanel` / `AnalysisRightPanel` / `LibrarySideDrawer` 仍包含可见静态样例值或全局读取接缝；`TrainingWorkbenchContainer.projectFromRuntime/projectFromWorkbench` 是当前主要 projection seam；`LibrarySideDrawer` 当前存在 `window.sabaki.db` 读取接缝，后续不得把它作为新主路径。

## 2. 视觉/组件源索引

| 来源 | 用途 | 本契约结论 |
| --- | --- | --- |
| `docs/ui_ux/workbench-ref-pics/2026-05-26-six-screen/` | 六个 canonical states 的视觉参考 | 只用于截图/人工验收的布局、密度、卡片层级；不得反推业务数据真源。 |
| `src/components/TrainingWorkbenchContainer.js` | active tab + runtime/repository projection seam | 下一步测试应通过 Container 或真实 Shell render 验证 projection return，不能直接给 panel 塞最终 props 作为主验收。 |
| `src/components/workbench/panels/*ModePanel.js` and `*RightPanel.js` | Problem/Recall/Analysis 可见字段 | 面板必须展示 props；测试要证明 props 来自 upstream source，不接受面板内部 fallback fake data。 |
| `src/components/workbench/shared/LibrarySideDrawer.js` | Library tabs / 101 / Fox 可见 surface | Library projection 必须来自 repository/dashboard/sync props or Container view model，不得直接读 `window.sabaki.db` 或渲染固定列表作为 active data state。 |
| `test/workbench/wiring/*` | 现有 Workbench wiring harness | 可复用真实 store、Container render、typed fake repository 的模式；不要把旧测试里的手动 projection seed 当作 step1.3 主验收方式。 |

## 3. 必须命名的 UI event / state return loop

### 3.1 Problem Projection Loop

```text
UI event or state trigger:
  open problem-like TrainingTask / activate problem tab / problem runtime evaluation update
  -> WorkbenchShell / ModeBar / tab callback prop
  -> TrainingWorkbenchContainer active-tab render/projection
  -> repository.loadTask(taskId) for TrainingTask fields
  -> trainingRuntimeStore.problemView + pendingMoveEvaluations + visibleBadMoveIds
  -> MoveEvaluation / BadMove facts from runtime/repository projection
  -> container subscription / task cache invalidation
  -> projection into WorkbenchShell props
  -> ProblemModePanel + ProblemRightPanel visible text and numbers update
```

State before:

```text
activeTab.mode = 'problem'
activeTab.taskId = high-entropy task id
repository has high-entropy TrainingTask problem-like fields
runtimeStore has high-entropy problemView/evalCache/badMoves/hint/attempt path
```

State after:

```text
No presentational component writes business state.
Problem left/right panels show high-entropy task/runtime/evaluation values.
No static active-state fallback such as generic prompt, hardcoded 3.6 lead,
hardcoded 0.0 drop, hardcoded 1/5 hint usage, or fixed path steps is visible.
```

### 3.2 Recall Projection Loop

```text
UI event or state trigger:
  submit attempt -> recall, submit recall move, start checkpoint, reveal AI, save comment, resume
  -> WorkbenchShell / panel callback prop
  -> TrainingWorkbenchContainer handler
  -> workbenchFlowService / recallService / recallCheckpointService
  -> trainingRepository stores RecallSession / RecallAttempt / RecallCheckpoint / comment
  -> trainingRuntimeStore.activeRecallSessionId / recallView / activeCheckpointId / correctionDraft
  -> container subscription
  -> repository-backed checkpoint projection when activeCheckpointId exists
  -> projection into WorkbenchShell props
  -> RecallModePanel + RecallRightPanel visible progress/checkpoint fields update
```

State before:

```text
activeTab.mode = 'recall'
activeTab.activeRecallSessionId = high-entropy session id
runtimeStore.recallView matches active session and contains high-entropy expectedMoves/userAttempts
optional runtimeStore.activeCheckpointId points to a repository checkpoint
```

State after:

```text
Recall normal page shows progress/current/total/correct/wrong from active recallView.
Recall checkpoint page shows moveNumber/source/severity/originalLine/correctionDraft/
aiCandidateLines/comment status from active checkpoint + BadMove + MoveEvaluation + comment sources.
No static active-state fallback such as 23/180, 22 correct, 1 wrong, R10,
-11.2, or fake "已摆 3 手" is visible when source data exists.
```

### 3.3 Analysis Projection Loop

```text
UI event or state trigger:
  enter analysis / return to analysis tab / select issue or branch /
  engine overlay update / scratch-current edit / snapshot status update
  -> WorkbenchShell / ModeActions / BottomActionBar callback prop
  -> TrainingWorkbenchContainer handler
  -> workbenchFlowService.enterAnalysis or scratch-current command path
  -> workbenchStore.analysisContext + analysisReturnTarget
  -> trainingRuntimeStore.explorationBranches / activeExplorationBranchId /
     visibleBadMoveIds / pendingMoveEvaluations
  -> repository loads BadMove / MoveEvaluation / RecallCheckpoint / comments /
     reference or correction lines
  -> overlay/engine projection supplies AI status/candidates when available
  -> container subscription
  -> projection into WorkbenchShell props
  -> AnalysisModePanel + AnalysisRightPanel visible tree/issues/comparison/snapshot state update
```

State before:

```text
activeTab.mode = 'analysis'
activeTab.analysisContext identifies source attempt/checkpoint/snapshot/current position
runtimeStore has active exploration branch or explicit empty/disabled reason
repository/engine projection has high-entropy bad moves, candidate lines, comments, engine status
```

State after:

```text
Analysis panels show source context, current move, issue list, comparison lines,
AI/engine status, snapshot count/disabled reason from analysis sources.
No hardcoded variation rows, fixed Leela Zero label, fixed candidate table,
fixed "来自 Recall 修正", or generic note text appears in active sourced state.
```

### 3.4 Library Projection Loop

```text
UI event or state trigger:
  open library drawer/dialog / switch Library tab / request Fox or 101 sync /
  open/import library item
  -> WorkbenchShell / LibrarySideDrawer callback prop
  -> TrainingWorkbenchContainer library handler
  -> dashboard/repository query or Fox/101 sync service
  -> repository persists or loads TrainingTask/Game/Problem projection
  -> Container dashboard/library view model or sync-status store updates
  -> drawer props/state projection
  -> LibrarySideDrawer visible tab rows/status update
```

State before:

```text
Library surface is open while Workbench mode remains play/analysis/etc.
repository/dashboard/sync fake contains high-entropy recent activity, kifu,
game records, 101 wrong problems, Fox games, and sync statuses.
```

State after:

```text
Library tabs render high-entropy repository/sync data and loading/empty/error/
syncing/success states. Opening/importing an item goes through taskImportService
and workbenchTabService/openTask path. Workbench mode is not set to "library".
No static active-state list such as "黑方 vs 白方 #1" or fixed sample games
is visible when source data exists.
```

## 4. Field Source Contract

| Area | Required fields | Must come from | Static fallback forbidden in active sourced state |
| --- | --- | --- | --- |
| Problem left panel | title, prompt/positionDescription, goal/taskGoal, passRule summary, sideToMove, problemArea status, referenceLines summary/count/labels | `TrainingTask` loaded through repository/task cache or standardized task projection | Generic "局部战斗中的局面", hardcoded rule list, fake "已收录 3 条参考线", task id as title when task title exists |
| Problem right panel | score lead, recent score drop, hint usage, attempt path/userLine, pending eval count, visible bad move count/severity, submitted/result state | `trainingRuntimeStore.problemView`, `pendingMoveEvaluations`, `visibleBadMoveIds`, `TrainingAttempt`, `MoveEvaluation`, `BadMove` | Hardcoded `3.6 目`, `0.0 目`, `1/5`, fixed sparkline/sample path rows, fake bad move badge |
| Recall normal | current move, total expected moves, progress, correct/wrong counts, current side/status, hint state, checkpoint summary | `runtimeStore.recallView` derived from active `RecallSession.expectedMoves` and `RecallAttempt` rows; active IDs must match tab/runtime session id | Hardcoded `23 / 180`, `13%`, `22` correct, `1` wrong, generic "黑方落子" when source says otherwise |
| Recall checkpoint | source system/manual, moveNumber, original move/line, severity, scoreDrop, correction draft length/moves, AI reveal state, candidate lines, comment state/content | `runtimeStore.activeCheckpointId`, `runtimeStore.correctionDraft`, `trainingRepository.loadRecallCheckpoint`, BadMove, MoveEvaluation, MoveComment, AI candidates | Hardcoded `R10`, `severe`, `-11.2`, fake 3-move draft, static AI lines, default reveal state that ignores checkpoint status |
| Analysis left | analysis source label, current move, move tree/branch list, issue/bad move list, filters, note state, snapshot count/status | `activeTab.analysisContext`, `runtimeStore.explorationBranches`, repository bad moves/evaluations/comments, snapshot/scratch projection | Hardcoded variation rows like `黑 R10`, fixed issue list/statuses, generic note/snapshot counts |
| Analysis right | AI status/candidates, current/reference score/evaluation, user original line, user correction, AI candidates, comments, engine/overlay status, snapshot disabled reason | analysis context + overlay/engine projection + repository MoveEvaluation/BadMove/RecallCheckpoint/comment/candidate data | Fixed `Leela Zero (v0.19)`, fixed candidate table, hardcoded `来自 Recall 修正`, `更新于 10-24`, generic comparison `--` when source exists |
| Library history | recent activity, recently opened/trained/synced items | dashboard/repository/runtime projection | Fixed visual list "黑方 vs 白方 #1", fake dates/statuses |
| Library kifu | local SGF, imported Fox records, saved review/analysis SGF metadata | repository/dashboard query | Static empty unless repository returns empty; fixed source/result rows |
| Library game records | active/saved games, unfinished Recall/Analysis entries | active game tree projection plus repository/dashboard records | Static sample games unrelated to source |
| Library 101/Fox | synced 101 wrong problems, Fox public/imported games, loading/empty/error/syncing/success/retry states | 101/Fox sync services + taskImportService + repository task projection | `window.sabaki.db` global fallback as new path, fixed "暂无错题" while sync source has rows, buttons with no source status |

Empty/loading/error states are allowed only when the corresponding source is empty/loading/error. They must be explicit state projection, not plausible fake active data.

## 5. 允许的副作用

1. Container may read repository/dashboard/sync sources and cache task/library projections for render.
2. Container/store subscriptions may call `forceUpdate` or equivalent render invalidation after source data changes.
3. Library open/import commands may call `taskImportService` and `workbenchTabService.openTask` in command tests, but projection tests should keep this as a separate assertion.
4. Analysis projection may read overlay/engine adapter state; it must not start engine analysis solely to make projection tests pass.
5. Static negative tests may inspect touched Workbench projection/panel files as auxiliary anti-fallback guards.

## 6. 禁止的副作用

1. Presentational panels import or call service, store, repository, DB, IPC, `window.sabaki`, or training globals.
2. Tests directly render `ProblemModePanel`, `RecallModePanel`, `AnalysisModePanel`, or `LibrarySideDrawer` with final source props and claim Container projection coverage.
3. Tests assert only `data-testid`, class name, component existence, or callback invocation as the main anti-fake-green proof.
4. Tests manually set final panel props, manually mutate `workbenchStore.updateTab({mode: ...})` after action, or seed unrelated runtime views to bypass the intended source loop.
5. Problem/Recall/Analysis projection modifies frozen Attempt, formal game tree, scratch workspace, source task, or repository facts during a read test.
6. Library projection creates a fifth `library` mode or routes by old `source_kind` / `openProblemTab` / `openSnapshotProblemTab` APIs.
7. Active sourced state falls back to sample copy/numbers when source fields are missing individually; missing required fields should produce explicit disabled/error/empty reason.

## 7. 测试/验收契约表

| ID | 区域 | 类型 | 分类 | 契约 | 验证方式 | 重要性 | 弱测试风险 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S6P-C01 | Problem left | PROJECTION_RETURN | DATA_SOURCE | active problem tab must project task prompt/goal/passRule/sideToMove/problemArea/reference summary from repository task data. | MUST_AUTOMATE | P0 | Rendering `ProblemModePanel({prompt})` directly proves only panel display, not task projection. |
| S6P-C02 | Problem right | PROJECTION_RETURN | DATA_SOURCE | eval monitor, hint usage, attempt path, pending eval, bad move count/severity must come from runtime/evaluation sources. | MUST_AUTOMATE | P0 | Checking that "评估监控" exists lets hardcoded `3.6` pass. |
| S6P-C03 | Recall normal | PROJECTION_RETURN | DATA_SOURCE | recall progress/current/total/correct/wrong/status must come from active recallView/RecallSession projection with matching session ids. | MUST_AUTOMATE | P0 | Seeding final panel props or only checking `recall-mode-panel` misses stale/static progress. |
| S6P-C04 | Recall checkpoint | PROJECTION_RETURN | DATA_SOURCE | checkpoint visible fields must join activeCheckpoint, BadMove, MoveEvaluation, correctionDraft, AI candidates, and comment. | MUST_AUTOMATE | P0 | A test that sees "问题手" can pass with fixed `R10` and `-11.2`. |
| S6P-C05 | Analysis left/right | PROJECTION_RETURN | DATA_SOURCE | analysis context, tree/issues/comparison/AI/snapshot states must come from analysisContext/runtime/repository/overlay-engine projection. | MUST_AUTOMATE | P0 | Static Analysis panel rows make screenshots look rich while disconnected. |
| S6P-C06 | Library drawer/dialog | PROJECTION_RETURN | DATA_SOURCE | history/kifu/game-records/101/Fox rows and sync states must come from repository/dashboard/sync services; Workbench mode remains unchanged. | MUST_AUTOMATE | P0 | Switching tabs and checking tab labels does not prove data is wired. |
| S6P-C07 | Shared projection | ARCHITECTURE_BOUNDARY | BOUNDARY | presentational panel files do not import/call service/store/repository/DB/window.sabaki for training projection. | MUST_AUTOMATE_STATIC | P1 | A source scan alone cannot prove projection data, but catches boundary leaks. |
| S6P-C08 | Shared tests | ARCHITECTURE_BOUNDARY | ANTI_FAKE_GREEN | new test file must use high-entropy sentinel source data and must assert those exact values appear while known static fallback values do not. | MUST_AUTOMATE_STATIC | P0 | Without sentinel values, a generic source and static fallback may accidentally match. |
| S6P-C09 | Six-screen smoke | UI_BEHAVIOR | MANUAL_SCREENSHOT | after implementation, desktop six-screen screenshots show sourced values for Problem, Recall, RecallCheckpoint, Play+Library, Analysis, Analysis+Library. | MANUAL_SCREENSHOT_ACCEPTANCE | P1 | Screenshots without sentinel data can bless a visually polished fake surface. |

## 8. 必须自动化的测试

All tests below belong in `test/workbench/wiring/six-screen-projection.test.js` unless a helper already exists and can be safely reused. The file should be disjoint from panel snapshot tests and command-map tests.

| Test ID | Layer | Production subject | Real dependencies | Controlled fakes | Forbidden setup | Primary assertion |
| --- | --- | --- | --- | --- | --- | --- |
| S6P-T01 | PROJECTION_RETURN | `TrainingWorkbenchContainer` -> `WorkbenchShell` -> `ProblemModePanel` | real Container, real workbench/runtime stores, real Shell render path | typed/in-memory repository with one high-entropy `TrainingTask` | no direct `ProblemModePanel` final props; no static task title only | active problem render shows source prompt/goal/passRule/sideToMove/problemArea/reference summary and does not show generic problem fallback copy. |
| S6P-T02 | PROJECTION_RETURN | `TrainingWorkbenchContainer` -> `ProblemRightPanel` | real runtime store and Container projection | runtime problemView/evalCache/visibleBadMoveIds with high-entropy values; typed repository for evaluations if needed | no hardcoded panel props; no asserting only card title | right panel shows source score lead/drop/hint usage/attempt path/bad move count and excludes hardcoded `3.6`, `0.0`, `1/5`, fixed path rows. |
| S6P-T03 | PROJECTION_RETURN | `TrainingWorkbenchContainer` -> `RecallModePanel` / `RecallRightPanel` normal state | real runtime store, active recall tab, real Shell render | high-entropy recallView matching active tab/runtime session id | no direct panel props; no mismatched recallView success path | panels show source progress `current / total`, correct/wrong counts, status, and no `23 / 180` or static counts. |
| S6P-T04 | PROJECTION_RETURN | `TrainingWorkbenchContainer` checkpoint projection -> `RecallRightPanel` / `RecallCheckpointPanel` | real Container, stores, async checkpoint projection path | typed repository fake for checkpoint, bad move, move evaluation, comment, AI candidates; runtime activeCheckpointId/correctionDraft | no direct `activeCheckpoint` final props in success path | checkpoint UI shows source moveNumber, original move, severity, scoreDrop, correction length/moves, AI candidates, comment status; static `R10`, `-11.2`, fake 3-hand draft absent. |
| S6P-T05 | PROJECTION_RETURN | `TrainingWorkbenchContainer` -> `AnalysisModePanel` / `AnalysisRightPanel` | real Container, stores, Shell render | analysisContext, runtime exploration branch, repository bad moves/evaluations/comments/candidates, overlay/engine projection fake with high-entropy engine status | no direct `AnalysisRightPanel` final props; no fixed candidate rows | analysis UI shows source context/tree/issues/comparison/engine/snapshot status and excludes fixed variation/candidate/note strings. |
| S6P-T06 | PROJECTION_RETURN | Library surface via Container/Drawer projection | real drawer component and state transitions, preferably through Container library props | dashboard/repository/sync fakes for history/kifu/game-records/101/Fox with loading/empty/error/syncing/success states | no `window.sabaki.db` as source; no static visual sample list | each library tab shows source rows/status; mode is not `library`; fixed sample games absent when source rows exist. |
| S6P-T07 | ARCHITECTURE_BOUNDARY | panel/static source guard | source scanner over relevant touched files and new test file | none | no broad grep-only test as the only guard; ignore comments when possible | touched panel/projection code does not add service/store/repository/window imports in presentational panels and new tests do not assert only component existence. |
| S6P-T08 | ANTI_FAKE_GREEN | test-file guard | source scanner over `six-screen-projection.test.js` | none | no direct final panel props in tests claiming Container projection; no `contains data-testid` as sole assertion | the suite contains high-entropy sentinel values per area and negative assertions for known fallback literals. |

Minimum sentinel pattern:

```text
Problem task prompt: "S6P task prompt ko-shape-742"
Problem runtime score drop: "-8.75 from S6P eval"
Recall session total: 17, current: 6, wrong: 4
Checkpoint original move: "Q16-S6P", scoreDrop: "-12.4"
Analysis engine label/status: "S6P Engine loading candidate H17"
Library Fox game title: "S6P Fox imported game 2026-05-26"
Library 101 problem title: "S6P 101 wrong problem ladder"
```

Do not reuse current sample strings as sentinel values.

## 9. Test Harness / Mock Manifest

| Dependency | Required strategy | Notes |
| --- | --- | --- |
| `WorkbenchStore` / `TrainingRuntimeStore` | use real stores | Projection tests should observe real subscription/render flow where feasible. |
| `TrainingWorkbenchContainer` | use real component for primary projection tests | Direct panel tests are allowed only as secondary display tests, not as anti-fake-green proof. |
| Repository | typed in-memory fake constrained to methods used by the production projection path | Seed high-entropy task, move evaluation, bad move, checkpoint, comment, library/dashboard rows. |
| Runtime projection | real runtime store seeded with source-level runtime views | Seeding `runtimeStore.problemView` or `recallView` is allowed because those are defined runtime sources; do not seed final panel props. |
| Analysis/engine projection | typed fake adapter or projected source object matching production interface | It may report loading/empty/error/success; do not start real engine in unit tests. |
| Fox/101 sync | typed fake sync state/service | Must include loading/empty/error/syncing/success and imported/open task IDs. |
| `window.sabaki.db` | forbidden as new Library data source | If legacy code still uses it, the new test should fail until implementation moves to injected repository/sync projection. |

## 10. 必须截图/人工验收

After implementation, update or run the six-screen acceptance harness with sentinel data:

1. Problem page: task prompt/goal/passRule/reference summary and runtime eval cards show sentinel task/runtime values.
2. Recall page: progress and counts match sentinel RecallSession/review state.
3. Recall checkpoint: original/correction/AI/comment fields match checkpoint repository/runtime source.
4. Play + Library drawer: Library rows/statuses come from repository/sync data and Workbench remains in play.
5. Analysis page: issue list, candidates, comparison, note/snapshot state come from analysis projection.
6. Analysis + Library drawer: same Library data source contract while Workbench remains in analysis.

Screenshots alone are not sufficient unless the test fixture data uses unmistakable source-specific values.

## 11. 不测试

| ID | Scope | Reason |
| --- | --- | --- |
| S6P-N01 | CSS pixel fidelity, exact card radius/shadow/gap | Already covered by visual acceptance workflow; step1.3 is projection anti-fake-green. |
| S6P-N02 | Full board move executor behavior | Board write paths belong to later step6/step7 wiring. |
| S6P-N03 | Snapshot persistence from non-analysis modes | Covered by step1.1 and later step5. |
| S6P-N04 | Complete Fox/101 network integration | Use typed sync fakes now; network/import correctness belongs to external data implementation steps. |
| S6P-N05 | Exact coordinate/sign conversion for every move string | Assert source values and counts; detailed SGF coordinate mapping belongs to board/goban contracts. |

## 12. 禁止的弱测试写法

1. `renders problem-mode-panel` / `renders recall-right-panel` / `contains library-side-drawer`.
2. `queryByTestId(...)` as the only assertion for a projection field.
3. Directly rendering a panel with `prompt`, `progress`, `evaluation`, or `libraryItems` props and claiming Container/store/repository projection coverage.
4. Checking that a callback was called once as proof that data returned to the UI.
5. Snapshot tests with generic mock data that coincidentally matches static fallback strings.
6. Source tests that only grep for one forbidden string while allowing all other hardcoded sample values.
7. Tests that seed `workbenchStore` or `runtimeStore` after the action to manufacture the expected final UI.
8. Tests that let Library read `window.sabaki.db` or global `window.sabaki` and treat that as repository/sync compliance.

## 13. 超出范围

1. Implementing the projection mapper.
2. Editing production Workbench panels.
3. Writing or editing `test/workbench/wiring/six-screen-projection.test.js` in this step.
4. Changing command-map coverage or Playwright E2E files.
5. Resolving `step1.2.contract`.
6. Updating snapshot, ModeState resolver, problem executor, recall checkpoint executor, analysis edit bar, or Fox/101 import services.

## 14. Workbench 接线清单

| Surface | Event / trigger | Container handler / owner | Service / repository boundary | Store before/after | Projection result | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| Problem | active problem task / runtime eval update | `TrainingWorkbenchContainer` active-tab projection | `trainingRepository.loadTask`; runtime/evaluation facts from store/repository | before: active problem tab + task/runtime data; after: no read-side mutation except cache/render invalidation | Problem left/right panels show task/runtime/eval values | S6P-T01, S6P-T02 |
| Recall normal | submit-to-recall or recallView update | `TrainingWorkbenchContainer` projection | `RecallSession`/`RecallAttempt` owned by recall service/repository; runtime holds active view | before: active recall session IDs match; after: active progress props | Recall panels show source progress and counts | S6P-T03 |
| Recall checkpoint | start/reveal/comment checkpoint state | `TrainingWorkbenchContainer` checkpoint projection | repository joins RecallCheckpoint, BadMove, MoveEvaluation, MoveComment; runtime holds activeCheckpointId/correctionDraft | before: checkpoint id/substate; after: loaded checkpoint projection | checkpoint cards show source original/correction/AI/comment state | S6P-T04 |
| Analysis | enter/select/update analysis state | `TrainingWorkbenchContainer` analysis projection | workbenchFlowService owns mode entry; repository/engine/overlay supply analysis facts | before: active analysis context + runtime branch; after: no Attempt mutation | Analysis panels show source tree/issues/candidates/comparison/snapshot reason | S6P-T05 |
| Library | open drawer, switch tab, sync/import/open source | Container library handlers + LibrarySideDrawer callbacks | dashboard/repository/Fox/101 sync services; taskImportService/openTask for commands | before: drawer open + source state; after: library view model/status updates, mode unchanged | Library tabs show source rows/statuses; no fifth mode | S6P-T06 |

## 15. 并行建议

`step1.3.tests` can be written independently from `step1.2.tests` because it should use a disjoint test file and focus on UI projection data sources. Shared helpers for typed repository/sync fakes may be added only if they do not mutate production files and do not force ModeState resolver tests to import visual-specific fixtures.

前端视觉契约已归档。请交给 visual-test-writer 编写测试。
