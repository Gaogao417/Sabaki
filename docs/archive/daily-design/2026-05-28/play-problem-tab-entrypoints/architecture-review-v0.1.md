# Architecture Review: Play / Problem Tab Entrypoints

Date: 2026-05-28

Verdict: PASS

## Findings

- No blocking boundary issue found.
- `WorkbenchTabService` no longer exposes public `openTask`; callers use `openPlayTab` or task-object `openProblemTab`.
- Legacy id adapters are named as adapters: `openLegacyProblemTab` and `openLegacyGameTab`.
- `TrainingWorkbenchContainer` has no `tabService.openTask(...)` calls.

## Event Loop Trace

New manual play tab:

```text
WorkbenchShell onAddGame
  -> TrainingWorkbenchContainer.handleAddTask
  -> taskImportService.createManualTask
  -> tabService.openPlayTab({taskId, playerConfig})
  -> WorkbenchTabService.openTaskInternal({mode: 'play'})
  -> workbenchStore.addTab + setActiveTab
  -> flowService.startAttempt(tab.id)
  -> container subscription/projectFromWorkbench
  -> shell data-mode="play" and play panel state
```

Problem/library tab:

```text
Library row / 101 command / bad move command
  -> TrainingWorkbenchContainer handler
  -> import or resolve TrainingTask
  -> tabService.openProblemTab({taskId, parentTabId?})
  -> WorkbenchTabService.openTaskInternal({mode: 'problem'})
  -> workbenchStore.addTab + setActiveTab
  -> container subscription/projectFromWorkbench
  -> shell data-mode="problem" and problem panel state
```

Legacy problem:

```text
sabaki.startProblem(problemId) or legacy review queue
  -> tabService.openLegacyProblemTab(problemId, {legacyCompatibility: true})
  -> legacy problem import/compat setup
  -> tabService.openProblemTab({taskId})
  -> workbenchStore active problem tab
```

## Residual Risk

- `openSnapshotProblemTab(problemId, ...)` remains as a compatibility wrapper for legacy problem ids. It now calls `openLegacyProblemTab`; modern snapshot creation in flow/phase services opens a task through `openProblemTab({taskId, parentTabId})`.
- Some older test names still mention historical contracts, but their assertions now guard the semantic entrypoints.

## Verification

- `npm test` => 1914 passing.
- `npx webpack --mode development` => compiled successfully.
- `npx playwright test --project=smoke --project=workbench-command --project=new-game-dialog` => 19 passing.
