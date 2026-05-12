# Workbench Test Writing Conduct

本文规定 workbench 新行为、迁移行为和 legacy fallback 的测试写法。目标是让测试和架构边界使用同一套语言：`PositionSource`、`MutationContract` 和 `BoardInteractionIntent`。

## Required Contract Header

每个新增或迁移的 workbench 棋盘行为，都必须在 PR 描述、测试注释或测试用例附近说明：

```txt
Workbench behavior:
PositionSource:
MutationContract:
BoardInteractionIntent:
Executor owner:
Legacy fallback:
Tests:
```

示例：

```txt
Workbench behavior: Analysis black-stone placement
PositionSource: scratch/current
MutationContract: scratchEdit
BoardInteractionIntent: place-black-stone
Executor owner: scratchEditInteractionExecutor
Legacy fallback: existing sabaki.scratchEdit path until Phase 5
Tests: Playwright baseline + working-position helper tests
```

这不是要求每个小 commit 都写长说明，而是要求每个新增行为或迁移 PR 必须能清楚回答：读哪里、写哪里、这次输入是什么意思、谁拥有副作用、未迁移时回退到哪里。

## Test Type Selection

Use Playwright when the behavior is user-observable and crosses UI, Sabaki state, and board rendering:

- Clicking the board places a visible stone.
- Recall progress changes after a user answer.
- Scoring dimmed stones update on the rendered board.
- A workspace tab or dock changes what the board displays.

Use unit tests when the behavior is pure or can be isolated:

- `PositionSource` and `MutationContract` mapping.
- `resolveBoardInteraction()` matrix cases.
- Working-position create, clone, place, erase, and board conversion helpers.
- Overlay input composition rules.

Use focused integration tests when a module has side effects but does not need the full Electron UI:

- Executor writes to a state-like object.
- Scratch analysis context converts a working position to an analysis input.
- Save-as-problem payload serialization.

Do not use Playwright to exhaustively test every resolver matrix row. Playwright should protect critical user paths; resolver unit tests should protect combinations.

## Naming Rules

Test names should include the scenario and the write boundary:

```txt
play mode places a real move in the game tree
analysis stone_1 writes only the current working position
analysis eraser does not dirty the SGF tree
recall wrong answer records an attempt without free-editing the board
```

Avoid names that only describe UI gestures:

```txt
clicking the board works
stone button works
analysis test
```

## Assertion Rules

Every workbench behavior test should include three kinds of assertions where practical:

- Expected write: the intended state changed.
- Forbidden write: unrelated durable state did not change.
- Visible result: the board or UI reflects the intended behavior.

Examples:

```txt
Play move
Expected write: game tree changes and treePosition advances.
Forbidden write: editWorkspace is not created or mutated.
Visible result: clicked vertex shows a stone.
```

```txt
Scratch edit
Expected write: currentSnapshot.signMap changes.
Forbidden write: game tree and treePosition do not change.
Visible result: board shows the edited working-position stone.
```

```txt
Recall answer
Expected write: recallUserAttempts changes.
Forbidden write: no scratch edit state changes and no free SGF edit occurs.
Visible result: progress, wrong state, or completion updates.
```

When an existing behavior intentionally changes `treePosition`, document it. For example, a correct recall answer currently navigates to the next node, so the forbidden write should not assert that `treePosition` is stable.

## State Snapshot Rules

Prefer capturing state before and after the action inside `page.evaluate()`:

```js
const before = await page.evaluate(() => ({
  treePosition: window.__sabaki.state.treePosition,
  editWorkspace: window.__sabaki.state.editWorkspace,
  recallMoveIndex: window.__sabaki.state.recallMoveIndex,
}))
```

For forbidden writes, compare stable signatures instead of object identity. Good signatures include:

- `treePosition`
- tree node count or serialized tree data
- `currentSnapshot.signMap`
- `referenceSnapshot.signMap`
- `recallMoveIndex`
- `recallUserAttempts.length`

Avoid asserting large unrelated state objects wholesale. They are noisy and make tests brittle.

## Playwright Conduct

- Use existing helpers from `e2e/helpers.js` when available.
- Prefer direct `window.__sabaki` setup for deterministic workbench state.
- Wait for the specific state or DOM condition caused by the action.
- Avoid fixed sleeps.
- Prefer selecting board vertices by known dataset coordinates when possible.
- Keep each test focused on one contract boundary.
- Avoid relying on localized text unless the test is specifically about copy or layout.
- Do not require engines, network, or long analysis runs for Phase 0 behavior baselines.

## Resolver Test Conduct

Once `resolveBoardInteraction()` exists, resolver tests should be table-driven. Each row should specify:

```txt
workspace/mode
selected tool
mouse button and modifiers
point state
active PositionSource
active MutationContract
expected BoardInteractionIntent
expected legacy/deferred reason, if any
```

The resolver must remain side-effect free. Resolver tests should not need a real `sabaki` instance, real game tree mutation, dialogs, menus, engines, or DOM.

## Executor Test Conduct

Executor tests should prove ownership:

- `scratchEditInteractionExecutor` writes working positions and edit workspace state only.
- `playInteractionExecutor` writes game tree, history, player state, and play analysis effects only.
- `recallInteractionExecutor` writes recall attempt/session/progress state only.
- `variationInteractionExecutor` writes variation state only.
- `legacyInteractionExecutor` does not become the home for new workbench behavior.

When an executor needs a side effect such as analysis refresh, prefer asserting an explicit returned effect or a narrow service call over inspecting broad global state.

## Legacy Fallback Rules

Unmigrated behavior should be explicit:

```txt
BoardInteractionIntent: legacy-toggle-dead-stone
MutationContract: null or legacy
Legacy fallback: existing scoring click branch
```

Do not silently route a legacy behavior through a new executor unless the PR is intentionally migrating that behavior and includes tests for the new write boundary.

## Review Checklist

Before merging a workbench behavior change, check:

- Does the change state `PositionSource`, `MutationContract`, and `BoardInteractionIntent`?
- Is the owner executor named?
- Is there a legacy or deferred fallback for unmigrated behavior?
- Does the test assert expected writes?
- Does the test assert forbidden writes?
- Does at least one user-visible result get verified when the behavior is UI-facing?
- Are resolver combinations covered by unit tests instead of oversized Playwright suites?
- Did the change avoid adding new workbench behavior directly to legacy `mode` branches?
