# Architecture Review v0.1

Date: 2026-05-28

Result: PASS

## Scope

Reviewed cleanup of the previous play/problem entry and configured-game AI reply implementation.

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Temporary task wrappers removed | PASS | `rg` over `src/` finds no `openPlayTab`, `openProblemTask`, or `createConfiguredGamePlayerConfig`. |
| Tab opening source truth | PASS | `TrainingWorkbenchContainer` opens imported/resolved tasks through `tabService.openTask({taskId, mode:'play'|'problem'})`; configured New Game uses `tabService.openTask({mode:'play', playerConfig})`. |
| AI ownership boundary | PASS | `boardInteractionController` triggers AI after a changed play move; `aiMoveService` decides whether AI should move and calls `engineService.requestMove`; `engineService` only generates a move for the requested engine/tree position. |
| No legacy active-attempt overwrite | PASS | Configured Workbench game setup creates the active attempt through `flowService.startAttempt(tab.id)` and does not start a second legacy training monitor when Workbench setup succeeds. |
| Tests protect behavior, not temporary API shape | PASS | E2E records `openTask` modes and visible board result; New Game E2E no longer wraps `startConfiguredGame`. |

## Event Loop Trace

```text
New Game button
  -> ModeBar onNewGame
  -> TrainingWorkbenchContainer handleNewGame
  -> NewGameDialog submit
  -> sabaki.startConfiguredGame
  -> syncConfiguredGameWorkbench
  -> taskImportService.createManualTask
  -> tabService.openTask({mode:'play', playerConfig})
  -> flowService.startAttempt(tab.id)
  -> workbenchStore/runtimeStore active play attempt
  -> board click
  -> boardInteractionController playMove
  -> documentStore.playMove(human)
  -> attemptService.appendMove(human)
  -> aiMoveService.maybePlayAiMove({treePosition: postHumanMove})
  -> engineService.requestMove
  -> documentStore.playMove(ai)
  -> attemptService.appendMove(ai)
  -> projected board/UI state shows black move and white AI reply
```

## Residual Risk

Legacy `openProblemTab` and `openGameTab` still exist for older compatibility paths. They were not expanded in this cleanup; current tests only ensure the new visible Workbench paths do not depend on the temporary wrappers or legacy problem start path.
