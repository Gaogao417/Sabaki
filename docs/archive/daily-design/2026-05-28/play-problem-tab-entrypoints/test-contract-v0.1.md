# Play / Problem Tab Entrypoint Contract v0.1

Date: 2026-05-28

Status: active for the play/problem entrypoint cleanup. This contract supersedes the stale parts of earlier cleanup notes that treated `openTask` as a UI-visible entrypoint.

## Source Truth

- `AGENTS.md`: components do not directly modify core store; workbench interaction should go through resolver/executor or service boundaries.
- `AGENTS.md`: `play/recall/analysis` are tab phases; problem is not a board mode.
- Current user decision in this thread: do not expose generic `openTask` as the UI/business mode-change entrypoint; provide `openPlayTab` and `openProblemTab`.

## Public Entrypoint Semantics

- `openPlayTab({taskId, parentTabId?, playerConfig?})`
  - Opens an existing TrainingTask as a play tab.
  - May carry a player configuration for New Game and AI play setup.
  - It is the semantic public API for library games, imported games, inbox tasks, manual play tabs, and configured games.

- `openProblemTab({taskId, parentTabId?})`
  - Opens an existing TrainingTask as a problem tab.
  - It is the semantic public API for imported 101 problems, library problem rows, bad move tasks, and snapshot problem tasks that already have a TrainingTask.

- `openTaskInternal(...)`
  - Internal helper only.
  - Performs shared load/parent/link/add/activate behavior.
  - Must not be returned from `createWorkbenchTabService`, and UI/flow callers must not call it.

## Legacy / Source Adapters

- `openLegacyProblemTab(problemId, options?)`
  - Legacy adapter from old problem id/session data to a Workbench problem task/tab.
  - Owns optional legacy Sabaki board compatibility setup.
  - May internally call `openProblemTab({taskId, parentTabId})` after importing or creating the task.

- `openLegacyGameTab(gameId)`
  - Legacy/source adapter from old game id/session data to a Workbench play task/tab.
  - It is not the same concept as `openPlayTab`; it adapts a source id before opening play state.

- `openSnapshotProblemTab(problemId, {parentTabId})`
  - Compatibility wrapper for callers that still start from a legacy problem id.
  - The preferred modern path is: create/import TrainingTask, then call `openProblemTab({taskId, parentTabId})`.

## Wiring Loop

Example play loop:

```text
UI control event (New Game / library game / inbox task)
  -> TrainingWorkbenchContainer handler or Sabaki command
  -> import/create TrainingTask if needed
  -> tabService.openPlayTab({taskId, playerConfig?})
  -> WorkbenchTabService openTaskInternal({mode: 'play'})
  -> workbenchStore.addTab + setActiveTab
  -> container subscription reads active tab
  -> shell data-mode="play" and play panel projection update
```

Example problem loop:

```text
UI control event (101 / library problem / bad move / snapshot)
  -> TrainingWorkbenchContainer handler or Workbench flow service
  -> import/create TrainingTask if needed
  -> tabService.openProblemTab({taskId, parentTabId?})
  -> WorkbenchTabService openTaskInternal({mode: 'problem'})
  -> workbenchStore.addTab + setActiveTab
  -> flow/runtime starts or projects attempt/problem state
  -> shell data-mode="problem" and problem panel projection update
```

## Required Tests

- WorkbenchTabService exposes `openPlayTab` and task-object `openProblemTab`.
- WorkbenchTabService does not expose public `openTask`.
- `openPlayTab` creates an active `mode: 'play'` tab and preserves `playerConfig`.
- `openProblemTab` creates an active `mode: 'problem'` tab and links `parentTabId` children.
- Legacy problem tests call `openLegacyProblemTab`, not `openProblemTab(problemId, ...)`.
- Source/legacy game tests call `openLegacyGameTab`, and modern TrainingTask game paths call `openPlayTab`.
- `TrainingWorkbenchContainer` uses `openPlayTab` for play entries and `openProblemTab` for problem entries; it has no direct `openTask` calls.
- Flow snapshot/problem creation calls `openProblemTab({taskId, parentTabId})`.
- New Game configured play calls `openPlayTab({taskId, playerConfig})`.

## Forbidden Behavior

- UI or flow code calling `tabService.openTask(...)`.
- Public `openProblemTab(problemId, options)` overload that means legacy id import.
- Treating `openGameTab(gameId)` as a replacement for `openPlayTab`.
- Silently opening a task with inferred mode from a visible control that already knows the intended phase.

## Manual Acceptance

- Starting Workbench still enters play.
- Topbar New Game creates a play tab through `openPlayTab`.
- Problem/library/bad-move entries create problem tabs through `openProblemTab`.
- Legacy `sabaki.startProblem(problemId)` still works through `openLegacyProblemTab`.
