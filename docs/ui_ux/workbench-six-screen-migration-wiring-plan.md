# Workbench Six-Screen Migration And Wiring Plan

Source visuals: `docs/ui_ux/workbench-ref-pics/2026-05-26-six-screen/`  
Product source: `docs/product/sabaki-training-prd.md` v0.7

## Goal

Migrate the Workbench frontend to the six-screen v0.7 surface while keeping Sabaki boundaries intact:

- Components render from projected view models.
- Components do not mutate core store directly.
- Board clicks still go through resolver/executor paths.
- Snapshot remains globally visible but creates Problems only through Analysis scratch/current source.

## Screens

| Screen | Primary files | Runtime mode | Domain source |
| --- | --- | --- | --- |
| Problem page | `ProblemModePanel`, `ProblemRightPanel`, `BottomActionBar`, `ModeBar` | `problem` | `TrainingTask` / `Problem`, active `TrainingAttempt`, `problemView` |
| Recall page | `RecallRightPanel`, `MainBoardStage`, `BottomActionBar`, `ModeBar` | `recall` | `recallView`, frozen `TrainingAttempt.userLine` |
| Play + library drawer | `PlayRightPanel`, `LibrarySideDrawer`, `ModeBar` | `play` | active game tree, `Game`, dashboard/library repository |
| Analysis + library drawer | `AnalysisModePanel`, `AnalysisRightPanel`, `LibrarySideDrawer` | `analysis` | `analysisContext`, scratch/current source, AI candidates |
| Analysis page | `AnalysisModePanel`, `AnalysisRightPanel`, `BottomActionBar` | `analysis` | current/reference lines, MoveEvaluation, comments |
| Recall checkpoint | `RecallRightPanel`, `MainBoardStage`, `BottomActionBar`, `ModeBar` | `recall` substate | `activeCheckpoint`, `BadMove`, correction draft, AI candidates |

## Migration Steps

| Step | Do | Owner / lock | Verification |
| --- | --- | --- | --- |
| 1 | Keep the six-screen visual shell as the default Workbench surface. | `src/components/WorkbenchShell.js`, `style/workbench.css` | Shell/panel focused tests, screenshot smoke |
| 2 | Replace static text in top bar with projection fields: title, mode chip, move number, bad move count, hint count, save state. | `TrainingWorkbenchContainer.projectFromWorkbench`, `ModeBar` | Store projection tests |
| 3 | Wire Problem brief fields from task: `positionDescription`, `taskGoal`, `passRule`, `sideToMove`. | `ProblemModePanel`, repository projection | Problem panel tests |
| 4 | Wire Problem right cards from runtime: score lead, recent drop, hint usage, attempt path, visible bad moves. | `ProblemRightPanel`, `trainingRuntimeStore.problemView` | Problem flow and eval tests |
| 5 | Wire normal Recall page from `recallView`: progress, current player, current move, errors, skip/continue state. | `RecallRightPanel`, `BottomActionBar` | Recall service and wiring tests |
| 6 | Wire RecallCheckpoint page from `activeCheckpoint`: original move, severity, score drop, correction draft, AI candidate reveal state, comment fields. | `RecallRightPanel`, `MainBoardStage`, `flowService` checkpoint handlers | Phase 5 checkpoint tests |
| 7 | Wire Analysis left tree and issue list from analysis context, bad moves, checkpoint comments, and current/reference variation selection. | `AnalysisModePanel`, `AnalysisRightPanel` | Analysis mode wiring tests |
| 8 | Wire Library drawer tabs: 历史记录 from recent activity, 棋谱库 from persisted/imported SGF records, 对局库 from active/saved games. Keep problem inbox/review as a separate题库 surface. | `LibrarySideDrawer`, dashboard/repository services | Dashboard/library drawer tests |
| 9 | Add screenshot acceptance for the six canonical states at 1448 x 1086 and one compact breakpoint. | e2e visual smoke | Playwright screenshots |

## Wiring Matrix

| UI action | Domain command |
| --- | --- |
| Problem submit | `flowService.submit(activeTab.id)` |
| Problem abandon | `legacyTrainingFlowController.exitProblemMode()` until migrated to flow service |
| Request hint | `legacyTrainingFlowController.showRecallHint()` for Recall; Problem hint service when available |
| Recall complete | `flowService.completeRecall(activeTab.id)` |
| Save correction line | `flowService.submitCheckpointCorrection(activeTab.id)` |
| Reveal AI candidates | `flowService.revealCheckpointAi(activeTab.id)` |
| Save checkpoint comment | `flowService.saveCheckpointComment({tabId, content})` |
| Analysis snapshot | `flowService.snapshotFromCurrentContext(activeTab.id)` |
| Global Snapshot outside Analysis | `flowService.enterAnalysis(tabId)` then create scratch/current projection, then snapshot |
| Open game from library | `tabService.openTask` or legacy SGF selection adapter |
| Start review | `reviewService.startSession(runtimeStore)` |

## Non-goals

- Do not introduce a fifth Workbench mode for Review or Punishment Problem.
- Do not let components call `window.sabaki` for training domain state.
- Do not create Problems directly from Play / Problem / Recall live contexts.
- Do not let RecallCheckpoint overwrite frozen `TrainingAttempt.userLine`.

## Acceptance

- Six visual states match the 2026-05-26 references in layout, density, card hierarchy, and primary copy.
- Existing shell, mode, panel, and wiring callbacks remain intact.
- RecallCheckpoint preserves the sequence: original bad move → correction draft → reveal AI candidates → comment.
- Snapshot is visible from every mode but persists only from Analysis scratch/current.
