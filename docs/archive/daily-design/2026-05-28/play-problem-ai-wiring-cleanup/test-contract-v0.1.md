# Play / Problem Entry And AI Reply Cleanup Contract v0.1

Date: 2026-05-28

## Source Truth

- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` SS5.2: `workbenchTabService` opens, closes, and switches tabs through `openTask({taskId, mode?, parentTabId?})`; source-specific tab APIs are not the main path.
- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` SS8.1: AI move generation uses the current tab player config, records pending AI move state, and rejects stale replies.
- `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md`: Library Fox and 101 entries import or resolve `TrainingTask`, then open through `tabService.openTask`.
- `docs/ui_ux/workbench-ui-ux-spec.md`: Play supports black/white human or AI players; ordinary play, AI auto-reply, analysis updates, and move evaluation must not freeze the active Attempt.
- Current review note: do not preserve temporary `openPlayTab` / `openProblemTask` APIs or tests that only prove those wrappers were called.

## Required Loop

```text
UI control event
  -> WorkbenchShell / panel callback prop
  -> TrainingWorkbenchContainer handler
  -> task import / configured game setup / board interaction controller
  -> workbenchTabService.openTask or aiMoveService
  -> workbenchStore / runtimeStore / Sabaki document state
  -> container subscription
  -> projected Workbench shell / board state
  -> UI state update
```

## Contract Rows

| ID | User action / event | Boundary | Store before | Store after | Allowed side effects | Forbidden side effects | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | Library Fox / kifu / saved game entry opens a playable task | Container resolves/imports task and calls `tabService.openTask({taskId, mode:'play'})` | Any active Workbench tab | New active tab has `mode:'play'` | Load task, add/switch tab | Calling `openPlayTab`, calling `sabaki.setMode('play')`, asserting wrapper calls as the contract | E2E command harness records `openTask` with play mode |
| C02 | Library 101 / visible problem / bad-move entry opens problem task | Container resolves/imports task and calls `tabService.openTask({taskId, mode:'problem'})` | Any active Workbench tab | New active tab has `mode:'problem'` | Load/create task, add/switch tab | Calling `openProblemTask`, legacy `startProblem`, legacy `openProblemTab(...legacyCompatibility:true)` | E2E command harness records `openTask` with problem mode and no legacy calls |
| C03 | Configured New Game with human black / AI white starts a Workbench play session | `startConfiguredGame` creates/imports task, opens `openTask({mode:'play', playerConfig})`, then `flowService.startAttempt(tab.id)` | No required active attempt | Active tab has `mode:'play'`, active attempt, `playerConfig.white:'ai'`, AI engine id | Create manual task, create attempt, set engine syncer ids | Starting a second legacy training attempt that supersedes runtime active attempt; exposing test-only helper APIs | E2E inspects active tab state after UI submit |
| C04 | Human black plays first move in configured play session | `boardInteractionController` writes the human move, then delegates AI decision to `aiMoveService` | Active play tab has active attempt and white AI config | Board contains human black move and AI white reply; Attempt records both actors when services exist | `aiMoveService.maybePlayAiMove({treePosition: postHumanMove})`; `engineService.requestMove` | `engineService` deciding Workbench mode/player config; AI request based only on root position | Unit board interaction + AI service test; E2E board stones |
| C05 | TabService public API | `workbenchTabService` | N/A | Public API exposes `openTask` for task tabs; no temporary `openPlayTab` / `openProblemTask` | Existing legacy compatibility APIs may remain for legacy-only callers | New source-specific wrappers used as primary UI contract | Tab service unit/source test |

## Test Boundary

- E2E may stub engine move generation, but it must not wrap `startConfiguredGame` only to prove it was called.
- E2E may inspect Workbench state after a UI action because this workflow proves state-forward and state-return wiring.
- Unit tests should protect `aiMoveService` ownership and post-human-move `treePosition`.
- Tests must not make `openPlayTab` or `openProblemTask` permanent contracts.

## Manual Acceptance

- Open Workbench and start New Game with black human / white AI.
- Submit the dialog; current Workbench tab remains Play and has an active attempt.
- Click a legal black move; white AI replies on the board without switching modes.
- Open Library Fox/kifu entries and 101/problem entries; tabs open as Play/Problem via task mode, not legacy problem setup.
