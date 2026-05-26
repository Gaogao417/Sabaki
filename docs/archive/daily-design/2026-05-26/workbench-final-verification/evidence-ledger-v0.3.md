# 架构审查

Date: 2026-05-27
Role: step11 retry2 architecture-reviewer
Previous evidence:
- `docs/archive/daily-design/2026-05-26/workbench-final-verification/evidence-ledger-v0.1.md`
- `docs/archive/daily-design/2026-05-26/workbench-final-verification/evidence-ledger-v0.2.md`
Verdict: APPROVE

## 1. 结论

APPROVE

v0.2 blocker 已消失：真实 `TrainingWorkbenchContainer` 创建的 board controller 现在把 `ctx.problemFlowService` 注入到 `getPlayServices()`，Problem 棋盘点击可以经 resolver/controller 到达 `problemFlowService.appendProblemMove`，并通过 `runtimeStore.problemView` 回投影到 Container UI。`test/workbench/wiring/w35-container-wiring.test.js` 的 Container 级回归覆盖了该路径，并验证没有落回 `documentStore.playMove` 或 legacy `clickVertex`。

v0.1 两个 blocker 仍保持修复：

- `TrainingWorkbenchContainer` 没有直接 import `workbenchFlowService`，mode effects 通过 training context 注入到 `flowService.setModeEffects()`。
- visible Library problem row 走 `taskImportService.createTaskFromLegacyProblem` / `repository.loadTask` 后 `tabService.openTask({mode:'problem'})`，不调用 `sabaki.startProblem` / `openProblemTab(..., {legacyCompatibility:true})`。

Full `npm test` 未运行；本轮执行了 final focused verification、Workbench command Playwright、以及 flow/problem/recall/tab/snapshot/mode/controller 相关 focused suites。

## 2. 严重阻塞问题

无。

## 3. 架构边界审查

| 边界 | 状态 | 证据 | 关注点 |
|---|---|---|---|
| v0.2 Problem board service injection | PASS | `src/components/TrainingWorkbenchContainer.js:1011-1018` 注入 `problemFlowService: ctx.problemFlowService`；`src/modules/training/workbench/boardInteractionController.ts:207-224` 调用 `appendProblemMove`；`w35-container-wiring` 19 passing。 | `positionBeforeHash` 仍来自 controller 构造的 resolver state；当前验证重点是 no missing-service no-op。 |
| v0.1 direct service import | PASS | `src/components/TrainingWorkbenchContainer.js:1-7` 没有 `workbenchFlowService` import；R-T09 通过。 | Container 仍通过 `getTrainingContext()` 读取 service，这是允许的绑定边界。 |
| v0.1 Library problem row path | PASS | `LibrarySideDrawer.js:576-579` 发出 `onStartProblem(problem.id, problem)`；`TrainingWorkbenchContainer.js:504-540` 解析/创建 task 后 `tabService.openTask({taskId, mode:'problem'})`；Playwright row test 通过。 | `sabaki.startProblem` 和 `openProblemTab` 仍作为 legacy API 存在，但 visible Workbench row 不再使用。 |
| Resolver purity | PASS | `resolveBoardInteraction.ts:1-8` 声明纯 resolver；风险搜索未发现 store/service/global import。 | 无。 |
| Controller/executor ownership | PASS | Problem -> `problemFlowService`; Recall -> recall adapter; Scratch -> scratch executor; Play -> documentStore/play executor。相关 controller/executor suites 65 passing。 | Container 内的 recall checkpoint adapter 仍有迁移期 store adapter 逻辑，作为 residual risk 记录。 |
| Store ownership | PASS | `workbenchStore` / `trainingRuntimeStore` 风险搜索未发现 engine/DB/IPC/window 依赖。 | Store setters 仍较宽，后续可继续收紧 companion-state guard。 |
| Panels / Workbench component imports | PASS_WITH_NOTES | Workbench panel/shell/shared 搜索未发现 direct service/store/global imports；`LibrarySideDrawer` 只通过 props 使用 `libraryDataProvider` / `repository`。 | `repository` prop 是数据 provider seam，不是 panel import。 |
| Problem first-class mode | PASS | PRD line 245-247 要求 `WorkbenchMode.problem` 拥有 mutable Attempt/runtime projection；resolver lines 295-306 routing problem; tab open uses `mode:'problem'`。 | 无 blocker。 |
| Recall/analysis source separation | PASS | Recall executor tests prove no `documentStore.playMove`; Playwright edit-bar test proves scratch/current mutation and source game tree unchanged。 | Full npm test 未跑。 |

## 4. 状态和事实来源审查

真源 PRD / Architecture / UI 证据：

- `docs/product/sabaki-training-prd.md:237-247`: runtime mode 只有 Play / Problem / Recall / Analysis，`WorkbenchMode.problem` owns `problemView`, mutable Attempt, pending evaluations, visible bad move projection。
- `docs/product/sabaki-training-prd.md:255-269`: Snapshot 可全局发现，但持久化必须先进入 Analysis scratch/current。
- `docs/product/sabaki-training-prd.md:1008-1018`: 101/Fox/local materials must enter `TrainingTask` / Game / Problem loop; Library 不是第五个 mode。
- `docs/product/sabaki-training-prd.md:1560-1574`: edit bar 只改 scratch/current，visible commands 需要 command-map 和真实 E2E/service/store/projection evidence。
- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:183-207`: UI -> Container/Controller -> Service -> Store/Repository/Adapter; Container reads Store and calls Service。
- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:1748-1763`: material import / open task path is taskImportService -> repository -> openTask -> workbenchStore。
- `docs/architecture/position-source-mutation-contract.md:109-131`: `problemAttemptMove` writes mutable problem Attempt/runtime and must not reuse `playMove` as the only path。
- `docs/architecture/position-source-mutation-contract.md:154-168`: `recallAnswer` must not write current SGF game tree。
- `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md:8-15`: components project view models, no direct store mutation, board clicks go through resolver/executor, visible controls need command owners and acceptance。

派生产物冲突：未发现 active PRD / architecture / ui_ux 与当前实现、测试结论发生新的冲突。当前工作区仍有未提交 PRD/plan/frontend/style/generated harness 改动；本审查只记录和提交 v0.3 evidence ledger 与 checklist 状态，不把这些改动纳入本 agent commit。

## 5. 副作用审查

- Resolver：PASS。`resolveBoardInteraction` 未写状态、未调 engine/DB/UI/global。
- Problem board click：PASS。真实 Container click -> controller -> `problemAttemptMove` -> `problemFlowService.appendProblemMove`; tests assert no `documentStore.playMove` and no legacy click fallback。
- Recall board click：PASS。`recallInteractionExecutor` delegates to recall adapter and does not call documentStore/engine/analysis.
- Analysis edit bar：PASS。scratch executor / edit workspace path verified by Playwright; source game tree unchanged。
- Store：PASS。Store files do not call engine, DB, IPC, repository, or `window.sabaki` in the scanned focused paths。
- Library external data：PASS。Fox/101 commands resolve/import tasks then call `tabService.openTask`; Playwright verifies no legacy third-party panel calls and disabled states are no-op。
- Snapshot：PASS。Focused flow/snapshot suites verify non-analysis snapshot enters Analysis first and direct persistence from Play/Problem/Recall is rejected.

## 6. 测试质量审查

| Command | Result |
| --- | --- |
| `git diff --stat` | inspected; current dirty worktree includes unrelated docs/frontend/test/generated changes. |
| `git diff` | inspected. |
| `git diff --check` | PASS. |
| risk searches for `window.sabaki`, `getTrainingContext`, service/store imports, legacy problem APIs, `origin.provider`, `snapshotService`, `runtimeStore.`, `workbenchStore.` | inspected; no new blocker in Workbench wiring scope. |
| `npx mocha --require tsx test/workbench/wiring/regression-wiring.test.js` | PASS, 34 passing. |
| `npx mocha --require tsx test/workbench/wiring/w35-container-wiring.test.js` | PASS, 19 passing. |
| `npx mocha --require tsx test/workbench/wiring/six-screen-projection.test.js` | PASS, 8 passing. |
| `npx mocha --require tsx test/training/workbenchFlowService.test.js test/training/problemFlowService.test.js test/training/recallService.test.js test/training/recallCheckpointService.test.js test/training/workbenchTabService.test.js test/training/snapshotService.test.js test/training/modeTransitions.test.js` | PASS, 284 passing. |
| `npx mocha --require tsx test/workbench/wiring/command-map-coverage.test.js test/workbench/wiring/w35-board-interaction-controller.test.js test/workbench/wiring/w8-p1-board-interaction-controller.test.js test/workbench/wiring/w8-p2-executor-routing.test.js` | PASS, 65 passing. |
| `npx mocha --require tsx test/workbench/TrainingWorkbenchContainer.test.js` | PASS, 5 passing. |
| `npx playwright test --project=workbench-command` | PASS, 8 passed. |

Test quality judgment:

- The v0.2 fake-green gap is now covered by a Container-level test that executes production `TrainingWorkbenchContainer`, production controller, and asserts service/state/projection return.
- Library problem row coverage includes both Mocha Container wiring and Playwright command acceptance with negative assertions for legacy `startProblem` / legacy `setMode('play')`.
- Command-map coverage protects visible command ownership and rejects legacy controller ownership.

Full `npm test` skipped because requested focused suites plus necessary flow/problem/recall/tab/controller/Playwright verification passed and the worktree includes unrelated local changes.

## 7. 范围控制审查

- step6.1 retry change is scoped to Container board-controller deps and Container regression evidence.
- v0.1 cleanup remains scoped: no visible problem row legacy route, no Container direct service import.
- Existing legacy APIs (`startProblem`, `openProblemTab`, `legacyCompatibility`) remain in compatibility code; they are not promoted back into the visible Workbench path.
- No new fifth Workbench mode was introduced. Review/Punishment Problem/Library remain inputs or queues, not runtime modes.
- No unrelated PRD/plan/frontend/generated-harness changes will be staged by this review commit.

## 8. 需要手动检查的文件或行

- `src/components/TrainingWorkbenchContainer.js:835-846`: real board click handler passes click data into `_clickController.handleBoardClick`.
- `src/components/TrainingWorkbenchContainer.js:1011-1018`: board controller deps include `ctx.problemFlowService`.
- `src/modules/training/workbench/boardInteractionController.ts:207-224`: `executeProblemAttemptMove` calls `problemFlowService.appendProblemMove`.
- `test/workbench/wiring/w35-container-wiring.test.js:432-535`: Container-level regression asserts `appendProblemMove`, no `documentStore.playMove`, no legacy click, and projected `problemAttempt.userLine`.
- `src/components/TrainingWorkbenchContainer.js:504-540`: visible Library problem row opens a Workbench problem task.
- `src/components/TrainingWorkbenchContainer.js:1052-1094`: recall adapter still contains checkpoint correction-draft routing in Container. Not blocking this gate, but it is the next cleanup candidate if tightening "Container only binds/projection" further.

## 9. 建议操作

可以继续。

建议后续单独开 cleanup slice：

- Move recall checkpoint correction-draft board-write orchestration out of `TrainingWorkbenchContainer` into a typed service/adapter boundary.
- Replace the controller's hardcoded resolver `treePosition: 'node_root'` with the live snapshot/document tree position before relying on pre-move engine analysis hashes for production problem evaluation.

## 10. Workbench 接线闭环追踪（如适用）

| 控件/命令 | Event | Container | Controller | Service/Store | Projection/UI | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Problem board vertex click | Goban `onVertexClick({vertex:[3,3]})` | `boardProps.handlerProps.onVertexClick` calls `_clickController.handleBoardClick` with active Problem tab, board snapshot, task, runtimeState | `resolveBoardInteraction(workbenchMode:'problem')` -> `problemAttemptMove`; controller routes to `executeProblemAttemptMove` | `problemFlowService.appendProblemMove({move:'dd', vertex:[3,3], ...})` updates `runtimeStore.problemView`; no `documentStore.playMove`, no legacy click | Container subscribes to `runtimeStore`; `projectFromRuntime` returns `problemAttempt.userLine:['dd']`; test re-renders and observes projection | PASS |
| Visible Library problem row | Problem row button click | `LibrarySideDrawer.onStartProblem(problem.id, problem)` -> `handleOpenLibraryProblem` | n/a | `repository.loadTask` or `taskImportService.createTaskFromLegacyProblem`, then `tabService.openTask({taskId, mode:'problem'})` writes workbench tab state | Container subscribes to `workbenchStore`; Playwright verifies `openTask({mode:'problem'})` and no legacy `startProblem` / `setMode('play')` | PASS |
| Analysis edit-bar tool | Edit-bar tool click + board interaction | Container selects analysis tool and ensures Analysis scratch workspace | resolver/controller routes scratch edit to `scratchEditInteractionExecutor` | edit workspace/scratch current result committed through approved compatibility boundary | Playwright verifies scratch/current changed and source game tree unchanged | PASS |
| Snapshot outside Analysis | Snapshot click from Play/Problem/Recall | `handleSnapshot` calls `flowService.enterAnalysis` first; service guard also enforces this | n/a | `workbenchFlowService.snapshotFromCurrentContext` refuses direct non-analysis persistence; Analysis snapshot uses `snapshotService` and `openTask({mode:'problem'})` | focused flow/snapshot tests verify no direct Play/Problem/Recall persistence | PASS |

## 11. 真源冲突清单（如适用）

无。

可以继续。
