# Workbench Final Verification Evidence Ledger v0.1

Date: 2026-05-27
Role: step11 architecture-reviewer
Verdict: REQUEST_CHANGES

## Source Truth Used

- `docs/product/sabaki-training-prd.md:237`: the only runtime Workbench modes are Play / Problem / Recall / Analysis.
- `docs/product/sabaki-training-prd.md:255`: Snapshot may be globally discoverable, but persistence must pass through Analysis scratch/current.
- `docs/product/sabaki-training-prd.md:562`: Play / Problem / Recall Snapshot must enter Analysis and use scratch/current as source before creating a Problem.
- `docs/product/sabaki-training-prd.md:1556`: material library rows must come from repository / sync service / runtime projection, not static mock.
- `docs/product/sabaki-training-prd.md:1570`: visible buttons, drawer tabs, mode segments, and shortcuts require command-map coverage.
- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:91`: UI displays; Container / Controller reads Store and calls Service; Service orchestrates; Repository owns training DB access.
- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:2177`: Analysis must not pollute Attempt.
- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:2192`: do not restore `openSnapshotProblemTab`.
- `docs/architecture/workbench-architecture-overview.md:272`: board resolver is pure and does not write state or trigger analysis.
- `docs/architecture/workbench-architecture-overview.md:558`: Problem uses `problemAttemptMove`; Recall uses `recallAnswer`; Edit Analysis uses `scratchEdit`.
- `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md:10`: components render from projected view models and do not mutate core store directly.
- `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md:67`: components must not call `window.sabaki` for training domain state.

## Commit / Step Ledger

- step10.1 implementation: `e4399896` (`implementation-agent: clean up open problem tab path`)
- step10.1 workflow mark: `187593d7`
- step10.2 implementation: `72558270` (`implementation-agent: thin training legacy globals`)
- step10.2 workflow mark: `53cffe84`
- step11 review result: REQUEST_CHANGES; upstream steps to reopen are step10.1 and step10.2.

## Verification Commands

| Command | Result | Evidence |
| --- | --- | --- |
| `git diff --stat` | inspected | Dirty worktree contains prior plan/PRD/frontend/test changes plus generated harness build; not staged by step11. |
| `git diff` | inspected | Focused on Workbench container, resolver/controller/service/store boundaries, direct imports, and legacy paths. |
| `npx mocha --require tsx test/workbench/wiring/six-screen-projection.test.js` | PASS | 8 passing. |
| `npx playwright test --project=workbench-command` | PASS | 7 passed. |
| `npx mocha --require tsx test/training/modeStateResolver.test.js test/training/workbenchFlowService.test.js test/training/snapshotService.test.js test/training/modeTransitions.test.js` | PASS | 179 passing. |
| `npx mocha --require tsx test/training/problemFlowService.test.js test/training/recallService.test.js test/training/recallCheckpointService.test.js test/training/trainingRuntimeStore.test.js test/training/workbenchTabService.test.js test/training/reviewService.test.js` | PASS | 152 passing. |
| `npx mocha --require tsx test/workbench/wiring/command-map-coverage.test.js test/workbench/wiring/w35-board-interaction-controller.test.js test/workbench/wiring/snapshot-null-taskid.test.js test/workbench/wiring/regression-wiring.test.js test/workbench/wiring/dashboard-wiring.test.js test/workbench/wiring/w8p3-task6-analysis-actions.test.ts test/workbench/wiring/w8-p3-task4-play-problem-actions.test.js` | FAIL | 171 passing, 1 failing: `test/workbench/wiring/regression-wiring.test.js:643` rejects direct `TrainingWorkbenchContainer` import of `workbenchFlowService`. |

Full `npm test` was not run because the focused architecture regression bundle already produced a blocking failure.

## Architecture Findings

### BLOCKING: Container imports a training service module directly

`src/components/TrainingWorkbenchContainer.js:6` imports `createSabakiModeEffects` from `../modules/training/workbench/workbenchFlowService.ts`.

This violates the active boundary used by the wiring workflow: Workbench container may bind projected props and call injected services from `getTrainingContext`, but it must not directly import training service modules. The focused regression suite failed on this exact boundary at `test/workbench/wiring/regression-wiring.test.js:643`.

Required upstream reopen: step10.2. Move the mode-effect factory behind a training context / adapter injection boundary so the container depends on injected capability, not a service module import.

### BLOCKING: Visible Workbench problem-list item still enters legacy problem path

Trace:

```text
LibrarySideDrawer problem row click
  -> props.onStartProblem(problem.id)
  -> TrainingWorkbenchContainer.onStartProblem
  -> sabaki.startProblem(id)
  -> tabService.openProblemTab(id, {legacyCompatibility: true})
  -> setupLegacyCompatibility()
  -> legacyAdapter.getSabaki().setMode('play')
```

Evidence:

- `src/components/workbench/shared/LibrarySideDrawer.js:576` renders the problem item button and calls `onStartProblem(problem.id)`.
- `src/components/TrainingWorkbenchContainer.js:684` wires `onStartProblem` to `sabaki.startProblem(id)`.
- `src/modules/sabaki.js:704` implements `startProblem` as `tabService.openProblemTab(..., {legacyCompatibility: true})`.
- `src/modules/training/workbench/workbenchTabService.ts:151` runs legacy compatibility when that flag is true.
- `src/modules/training/workbench/workbenchTabService.ts:124` sets legacy Sabaki mode to `play`.

This conflicts with the PRD distinction between Problem entity and `WorkbenchMode.problem`, and it keeps a visible Workbench control on the `play + legacy problem` branch. It also lacks explicit command-map / Playwright acceptance coverage for the problem-list row.

Required upstream reopen: step10.1. The visible problem-list path should open a `TrainingTask` through `tabService.openTask({mode: 'problem'})` or route through a service that creates/loads the task first. If legacy Problem rows must remain, they should be hidden behind an explicit compatibility adapter and tested as legacy-only, not as the Workbench main path.

## Boundary Review

| Boundary | Status | Evidence | Concern |
| --- | --- | --- | --- |
| Resolver purity | PASS | `resolveBoardInteraction.ts` imports only intents/contracts and receives input snapshots. | No state writes or global lookups found in resolver. |
| Board controller dispatch | PASS_WITH_NOTES | `boardInteractionController.ts` routes `problemAttemptMove` to `problemFlowService`, `recallAnswer` to recall adapter, and `scratchEdit` to scratch executor. | The controller is injected, but container imports the controller factory lazily; acceptable as transition wiring. |
| Store ownership | PASS_WITH_NOTES | `trainingRuntimeStore` owns `problemView`, `recallView`, `correctionDraft`; `workbenchStore` owns tabs. | Container keeps projection caches for task/checkpoint async loads; acceptable as UI projection cache, but should not become durable state. |
| Service/repository ownership | REQUEST_CHANGES | Direct `workbenchFlowService` import in container and visible legacy problem open path. | Service module import and legacy path breach the intended injection/command boundary. |
| Hidden globals | PASS_WITH_NOTES | No new `window.sabaki` in Workbench panels; global lookups remain in legacy/core files. | `src/modules/training/repository/trainingRepository.ts` still types DB as `typeof window.sabaki.db`, but repository is the DB boundary. |
| Position source separation | PASS | Snapshot/service tests pass; edit-bar Playwright verifies scratch/current mutation without source game-tree mutation. | Full npm test not run. |
| Problem as first-class mode | REQUEST_CHANGES | Board clicks route to `problemAttemptMove`, but problem-list UI still calls `legacyCompatibility: true`. | Visible Workbench problem row can still activate legacy `setMode('play')`. |

## UI Event To Projection Loop Trace

| Control / Command | Event | Container | Controller | Service / Store | Projection / UI | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Library Fox / 101 buttons | `LibrarySideDrawer.renderExternalSourceButton` click | `handleOpenFoxGames` / `handleOpenOneOhOneWeiqi` | n/a | `taskImportService.importFoxGame` or `import101Problem`; existing synced task lookup via repository; `tabService.openTask` writes `workbenchStore` | container subscribes to `workbenchStore`, `projectFromWorkbench` updates `mode`, `games`, `activeIndex`, and task projection | PASS, verified by `workbench-command` Playwright. |
| Analysis edit bar tool | edit-bar click / tool selection | `onAnnotationToolChange` updates selected tool; board click routes through controller | `boardInteractionController -> resolveBoardInteraction -> scratchEditInteractionExecutor` | scratch/current result committed through edit workspace boundary | `projectGobanProps` reprojects board props; Playwright confirms source game tree unchanged | PASS, verified by `workbench-command`. |
| Problem library row | problem row click | `onStartProblem -> sabaki.startProblem` | legacy path | `openProblemTab(... legacyCompatibility: true)` and legacy `setMode('play')` | tab may still become `WorkbenchMode.problem`, but legacy board setup is activated | REQUEST_CHANGES. |

## Residual Risks

- The worktree remains dirty with earlier uncommitted PRD/architecture/frontend/test changes and generated `.harness-build`; step11 does not stage them.
- Full `npm test` was skipped after a focused architecture suite failed.
- `LibrarySideDrawer` still has local loading state and legacy fallback provider calls for problem/game lists; this is acceptable for visual surface compatibility only if visible command paths are routed through current services.
- `openProblemTab`, `openGameTab`, and `openSnapshotProblemTab` remain as compatibility APIs. The blocking issue is not their existence; it is visible Workbench UI routing to `legacyCompatibility: true`.

## Required Actions

1. Reopen step10.2 to remove `TrainingWorkbenchContainer`'s direct `workbenchFlowService` import and inject the mode effects through the training context or an adapter boundary.
2. Reopen step10.1 to move `LibrarySideDrawer` problem item opening off `sabaki.startProblem` / `openProblemTab(... legacyCompatibility: true)` and onto `TrainingTask -> tabService.openTask({mode: 'problem'})`.
3. Add or update focused coverage so the problem-list row is included in command-map / wiring acceptance and cannot regress to `sabaki.startProblem`.

修复阻塞问题前不要继续。
