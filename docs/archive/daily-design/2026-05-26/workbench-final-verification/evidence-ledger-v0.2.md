# 架构审查

Date: 2026-05-27
Role: step11 retry architecture-reviewer
Previous evidence: `docs/archive/daily-design/2026-05-26/workbench-final-verification/evidence-ledger-v0.1.md`
Verdict: REQUEST_CHANGES

## 1. 结论

REQUEST_CHANGES

v0.1 的两个阻塞已经消失：

- R-T09 direct service import: `TrainingWorkbenchContainer` 不再直接 import `workbenchFlowService`，而是通过 `sabaki.getTrainingContext().createModeEffects()` / `ctx.modeEffects` 注入到 `flowService.setModeEffects()`。
- Library problem row legacy path: visible problem row 已从 `sabaki.startProblem` / `legacyCompatibility: true` 改为 `handleOpenLibraryProblem -> taskImportService.createTaskFromLegacyProblem/loadTask -> tabService.openTask({mode: 'problem'})`。

新的阻塞是 Problem 棋盘点击的真实 Container 接线不完整：`TrainingWorkbenchContainer._tryCreateClickController()` 创建 board controller 时没有把 `ctx.problemFlowService` 放入 `getPlayServices()` 返回对象。`boardInteractionController` 对 `problemAttemptMove` 明确要求 `services.problemFlowService`，缺失时返回 `{handled:false, changed:false, reason:'missing problemFlowService'}`。因此真实 UI 的 Problem board click 可以解析到 `problemAttemptMove`，但不会写入 mutable Attempt / runtime projection。

## 2. 严重阻塞问题

### BLOCKER: Problem board click loop stops before `problemFlowService`

Source-truth basis:

- `docs/product/sabaki-training-prd.md:245`: Problem entity/task 与 `WorkbenchMode.problem` 必须区分。
- `docs/product/sabaki-training-prd.md:246`: `WorkbenchMode.problem` owns `problemView`, mutable Attempt, pending evaluations, and visible bad move projection.
- `docs/architecture/position-source-mutation-contract.md:111`: `problemAttemptMove` is used when solving a problem in `WorkbenchMode.problem`.
- `docs/architecture/position-source-mutation-contract.md:117`: it may write the mutable problem Attempt while playing.
- `docs/architecture/position-source-mutation-contract.md:118`: it must update problem runtime companion state such as `problemView`.
- `docs/architecture/position-source-mutation-contract.md:129`: reusing `playMove` as the only write path is forbidden.
- `docs/architecture/workbench-architecture-overview.md:559`: Problem workspace maps to `problemAttemptMove`.

Evidence:

- `src/modules/workbench/board-interactions/resolveBoardInteraction.ts:295` routes `workbenchMode === 'problem'`.
- `src/modules/workbench/board-interactions/resolveBoardInteraction.ts:306` returns `resolveProblemAttempt(input)`.
- `src/modules/workbench/board-interactions/resolveBoardInteraction.ts:264` rewrites play-stone to `mutationContract: 'problemAttemptMove'`.
- `src/modules/training/workbench/boardInteractionController.ts:207` reads `services.problemFlowService`.
- `src/modules/training/workbench/boardInteractionController.ts:208` returns missing-service no-op when absent.
- `src/components/TrainingWorkbenchContainer.js:1011` creates the controller.
- `src/components/TrainingWorkbenchContainer.js:1012-1018` returns play services plus attempt/monitor/repository/ai, but does not include `problemFlowService`.
- `src/modules/sabaki.js:1030` creates `problemFlowService`.
- `src/modules/sabaki.js:1059` exposes it in `_trainingServices`, so the missing edge is the Container injection, not service availability.

Impact:

```text
Problem board vertex click
  -> TrainingWorkbenchContainer boardProps.handlerProps.onVertexClick
  -> boardInteractionController.handleBoardClick
  -> resolveBoardInteraction(workbenchMode='problem')
  -> mutationContract='problemAttemptMove'
  -> executeProblemAttemptMove
  -> services.problemFlowService missing
  -> returns handled:false/changed:false
  -> no Attempt.userLine update
  -> no problemView eval/badMove projection update
  -> UI does not receive a true state return
```

This breaks the required `event -> command -> state -> projection -> UI` loop for the core Problem board action.

## 3. 架构边界审查

| 边界 | 状态 | 证据 | 关注点 |
|---|---|---|---|
| v0.1 R-T09 direct service import | PASS | `src/components/TrainingWorkbenchContainer.js:897-912`; `npx mocha --require tsx test/workbench/wiring/regression-wiring.test.js` passed 34 tests. | Container now uses training context injection for mode effects. |
| v0.1 Library problem row legacy path | PASS | `src/components/workbench/shared/LibrarySideDrawer.js:578`; `src/components/TrainingWorkbenchContainer.js:504-540`; Playwright `visible library problem row...` passed. | `sabaki.startProblem` still exists as legacy API in `src/modules/sabaki.js:705-708`, but the visible Workbench drawer row no longer calls it. |
| Problem board resolver | PASS | `resolveBoardInteraction.ts:295-306` and `:264-267`. | Resolver stays pure and chooses `problemAttemptMove`. |
| Problem board controller injection | REQUEST_CHANGES | `TrainingWorkbenchContainer.js:1012-1018` omits `problemFlowService`; `boardInteractionController.ts:207-210` requires it. | Actual Container-created controller cannot execute Problem attempt moves. |
| Store ownership | PASS_WITH_NOTES | `workbenchStore.ts` and `trainingRuntimeStore.ts` contain no engine/DB calls; `rg` over stores found no engine/db/repository side effects. | Stores expose broad setters; acceptable for current migration, but companion-state guards remain future hardening. |
| Component/panel boundary | PASS_WITH_NOTES | Focused search found no `window.sabaki`, `getTrainingContext`, training service, store, or repository imports in Workbench panels. | `LibrarySideDrawer` still has local loading state and provider props; it does not import services or Sabaki context. |
| Hidden globals | PASS_WITH_NOTES | Focused search found `window.sabaki` only in `trainingRepository.ts` type alias under `src/modules/training`; no Workbench component global lookup. | Repository is the DB boundary; no new Workbench panel global dependency found. |
| Problem as first-class mode | REQUEST_CHANGES | Library open path is first-class; board-click write path is not complete because `problemFlowService` is not injected. | Core solving action does not update mutable Attempt/runtime state from the real UI path. |
| Recall/analysis source separation | PASS | Recall service tests and edit-bar Playwright passed; `problemFlowService`/snapshot/recall focused suites passed. | Full `npm test` not run. |

## 4. 状态和事实来源审查

True source used:

- `docs/product/sabaki-training-prd.md:237-252`: only four runtime modes; Problem entity and `WorkbenchMode.problem` are distinct.
- `docs/product/sabaki-training-prd.md:255-268`: Snapshot must enter Analysis scratch/current before creating a Problem.
- `docs/product/sabaki-training-prd.md:1008-1018`: Material Library opens materials through TrainingTask/Game/Problem flows, not a fifth mode.
- `docs/product/sabaki-training-prd.md:1556`: Library UI must come from repository/sync service/runtime projection, not static mock.
- `docs/product/sabaki-training-prd.md:1560-1564`: edit-bar writes only scratch/current and must not modify Attempt or source game tree.
- `docs/product/sabaki-training-prd.md:1570-1574`: visible commands need command-map coverage and real service/store/projection evidence.
- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:183-187`: UI -> Controller/Container -> Service -> Store/Repository/Adapter -> Core.
- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:203-207`: Store does not depend on Service; Container reads Store and calls Service.
- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:1748-1752`: Material import path is taskImportService -> repository -> openTask -> workbenchStore.
- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:1886-1891`: Snapshot path is flowService -> snapshotService -> taskImportService -> openTask.
- `docs/architecture/position-source-mutation-contract.md:109-131`: `problemAttemptMove` ownership and forbidden `playMove` reuse.
- `docs/architecture/position-source-mutation-contract.md:154-168`: `recallAnswer` must not write game tree.
- `docs/architecture/position-source-mutation-contract.md:230-231`: executor ownership boundaries.
- `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md:10-15`: components render projected view models; board clicks go through resolver/executor; visible controls need command owners and acceptance.

Derived artifact conflict:

- `test/workbench/wiring/w35-container-wiring.test.js:412-427` and `:630-652` only assert the Container `onVertexClick` handler exists and does not throw. They do not prove `problemFlowService.appendProblemMove` is reachable from the real Container-created controller.
- `test/workbench/wiring/w35-board-interaction-controller.test.js` proves a directly constructed controller works when `problemFlowService` is provided. That does not prove `TrainingWorkbenchContainer` provides it.

No active PRD/architecture/ui_ux conflict was found for the two v0.1 blockers. The remaining conflict is implementation/test evidence versus the source-truth `problemAttemptMove` ownership contract.

## 5. 副作用审查

- Resolver purity: PASS. `resolveBoardInteraction.ts` is pure and receives all data through `ResolverInput`.
- Store side effects: PASS. `trainingRuntimeStore.ts` and `workbenchStore.ts` do not call engine, DB, repository, IPC, or `window.sabaki`.
- Engine/analysis effects: PASS_WITH_NOTES. Engine calls remain in services/adapters/controller deps, not stores. `boardInteractionController` can read pre-move analysis through injected `engineService`.
- Problem board side effect: REQUEST_CHANGES. The expected service-side effect is absent because Container does not inject `problemFlowService`.
- Library 101/Fox side effects: PASS. `handleOpenFoxGames` and `handleOpenOneOhOneWeiqi` use `taskImportService` / `repository.findTaskBySource` then `tabService.openTask`; Playwright verifies no legacy third-party panel path.
- Snapshot side effects: PASS. Focused flow/snapshot tests passed; non-analysis snapshot enters Analysis first.

## 6. 测试质量审查

Commands run:

| Command | Result |
| --- | --- |
| `git diff --stat` | inspected |
| `git diff` | inspected |
| `git diff --check` | PASS |
| `npx mocha --require tsx test/workbench/wiring/regression-wiring.test.js` | PASS, 34 passing |
| `npx mocha --require tsx test/workbench/wiring/six-screen-projection.test.js` | PASS, 8 passing |
| `npx mocha --require tsx test/training/workbenchFlowService.test.js test/training/problemFlowService.test.js test/training/recallService.test.js test/training/recallCheckpointService.test.js test/training/workbenchTabService.test.js test/training/snapshotService.test.js test/training/modeTransitions.test.js` | PASS, 284 passing |
| `npx mocha --require tsx test/workbench/wiring/command-map-coverage.test.js test/workbench/wiring/w35-board-interaction-controller.test.js test/workbench/wiring/w35-container-wiring.test.js test/workbench/wiring/w8-p3-task4-play-problem-actions.test.js test/workbench/wiring/dashboard-wiring.test.js test/workbench/wiring/w6-review-queue-wiring.test.js` | PASS, 160 passing |
| `npx playwright test --project=workbench-command` | PASS, 8 passed |
| `node -e "...problemFlowService..."` static inspection | `problemFlowService missing from Container board-controller injection` |

Full `npm test` was not run because focused architecture verification already found a blocking wiring defect and the requested focused suites passed.

Test quality concern:

- Current controller tests prove `boardInteractionController` works with a provided `problemFlowService`.
- Current Container tests prove `onVertexClick` is present and non-throwing.
- No test proves real Container `Problem` click reaches `ctx.problemFlowService.appendProblemMove`, advances Attempt/runtime state, and reprojects the UI. This is a fake-green risk for the central Problem solving action.

Required test fix:

- Add a focused Container wiring test with real `TrainingWorkbenchContainer`, active `mode:'problem'`, injected `problemFlowService.appendProblemMove` spy, and a board click that asserts:
  - `problemFlowService.appendProblemMove` is called.
  - `documentStore.playMove` is not called for the problem attempt.
  - the returned/runtime projection changes enough for UI re-render evidence, or the spy mutates `runtimeStore.problemView` and Container projection observes it.

## 7. 范围控制审查

- The two v0.1 fixes are scoped and do not reintroduce direct service imports or visible Library problem legacy open path.
- Current worktree still contains unrelated/uncommitted PRD/plan/frontend/style/test/harness changes. They were inspected for architecture risk but must not be staged by this review except the v0.2 ledger and checklist update.
- `openProblemTab`, `openSnapshotProblemTab`, `sabaki.startProblem`, and legacy controller APIs still exist. Their existence is acceptable as compatibility debt; visible Workbench problem rows no longer use them. The newly blocking problem is the first-class board-click service loop.

## 8. 需要手动检查的文件或行

- `src/components/TrainingWorkbenchContainer.js:1011-1018`: inject `problemFlowService: ctx.problemFlowService` into the board controller's `getPlayServices()` return object.
- `src/modules/training/workbench/boardInteractionController.ts:207-210`: missing `problemFlowService` currently becomes a silent no-op result; consider whether this should be surfaced in tests/logging for Workbench problem mode.
- `test/workbench/wiring/w35-container-wiring.test.js:412-427` and `:630-652`: strengthen from non-throwing click to service/state/projection proof.

## 9. 建议操作

1. Reopen the problem board dispatch/container wiring implementation slice.
2. Inject `ctx.problemFlowService` into `TrainingWorkbenchContainer._tryCreateClickController()`'s board controller deps.
3. Add a Container-level Problem board click regression that fails when `problemFlowService` is not injected.
4. Re-run:
   - `npx mocha --require tsx test/workbench/wiring/w35-container-wiring.test.js test/workbench/wiring/w35-board-interaction-controller.test.js`
   - `npx mocha --require tsx test/workbench/wiring/regression-wiring.test.js`
   - `npx playwright test --project=workbench-command`

## 10. Workbench 接线闭环追踪（如适用）

| 控件/命令 | Event | Container | Controller | Service/Store | Projection/UI | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Library visible problem row | row button click | `onStartProblem -> handleOpenLibraryProblem` | n/a | `taskImportService.createTaskFromLegacyProblem` or `repository.loadTask`, then `tabService.openTask({mode:'problem'})` writes `workbenchStore` | Container subscribes to `workbenchStore`; `projectFromWorkbench` projects `mode:'problem'`; Playwright verifies no legacy `startProblem` | PASS |
| Mode effects install | Container construction/render | `_tryInstallModeEffects` reads `getTrainingContext()` | n/a | `flowService.setModeEffects(ctx.createModeEffects())` | Mode transitions use injected effects | PASS |
| Problem board vertex click | Goban vertex click | `boardProps.handlerProps.onVertexClick` calls `_clickController.handleBoardClick` | `resolveBoardInteraction -> problemAttemptMove -> executeProblemAttemptMove` | `problemFlowService` missing from injected services, returns no-op | No Attempt/runtime/projection update | REQUEST_CHANGES |
| Analysis edit-bar tool | edit-bar click + board click | selected tool stored in edit workspace | `boardInteractionController -> scratchEditInteractionExecutor` | scratch/current edit result committed through Sabaki edit workspace boundary | Playwright verifies source game tree unchanged | PASS |

## 11. 真源冲突清单（如适用）

| 冲突产物 | 冲突内容 | 统一真源 | 处理建议 |
| --- | --- | --- | --- |
| `test/workbench/wiring/w35-container-wiring.test.js` | Treats non-throwing `onVertexClick` as enough for Container click-chain evidence | `docs/architecture/position-source-mutation-contract.md:109-131`; `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md:12` | Add Container-level `problemFlowService.appendProblemMove` and projection assertion |
| Current step11 verification tests | All pass while actual Container-created Problem click cannot reach `problemFlowService` | PRD `WorkbenchMode.problem` mutable Attempt/runtime ownership | Do not approve until missing injection and regression test are fixed |

请先审查标注的风险后再继续。
