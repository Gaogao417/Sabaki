# Workbench Coding Conduct

This guide applies to new or changed workbench board behavior: board clicks,
dragging, tools, training answers, edit-analysis actions, variation actions, and
overlay interactions that affect how a user reads or edits a position.

The goal is to keep the migration incremental. New workbench behavior must make
its read source, write boundary, and input intent explicit before it changes
runtime behavior.

## Required Behavior Contract

Every new workbench board behavior must include this contract in the PR
description, implementation note, or adjacent design note:

```txt
Workbench behavior:
PositionSource:
MutationContract:
BoardInteractionIntent:
Executor owner:
Legacy fallback:
Tests:
```

Use `N/A` only when a field truly does not apply. If one PR introduces several
behaviors, group them when they share the same source, contract, executor, and
tests; otherwise list one contract per behavior.

Example:

```txt
Workbench behavior: Analysis workspace black-stone placement
PositionSource: scratch/current
MutationContract: scratchEdit
BoardInteractionIntent: place-black-stone
Executor owner: scratchEditInteractionExecutor
Legacy fallback: existing sabaki.scratchEdit path until clickVertex is migrated
Tests: working-position unit test, resolver matrix test, Playwright placement regression
```

## Compatibility Baseline

Before redirecting an existing behavior, add or identify a regression test that
describes the current observable behavior.

Prefer this split:

- Use Playwright for user-visible workflows: clicking a board point, changing a
  selected tool, dragging a stone, submitting a recall answer, or checking that a
  board render changed as expected.
- Use unit tests for pure contracts, resolver matrices, working-position helpers,
  and executor write boundaries.
- Keep legacy-mode tests narrow. They should lock compatibility during migration,
  not grow legacy products.

Compatibility means the same user action in the same mode or workspace keeps the
same observable result unless the PR explicitly declares a product behavior
change.

## Workbench Boundaries

New workbench behavior must not be added directly to the legacy `mode` branches
in `sabaki.clickVertex()`.

Allowed changes in legacy branches:

- Compatibility fixes.
- Regression tests.
- Thin fallback calls while a behavior is being migrated.
- Temporary wrappers that preserve existing behavior.

Disallowed changes in legacy branches:

- New workbench tool semantics.
- New training-answer semantics.
- New edit-analysis behavior.
- New overlay behavior that depends on raw `mode` instead of a source/contract
  boundary.

Unmigrated behavior should return or use an explicit legacy or deferred path
rather than being partially migrated.

## Resolver and Executor Rules

The board interaction resolver must stay side-effect free:

- No state writes.
- No menus or dialogs.
- No engine analysis refresh.
- No overlay mutation.
- No dependency on a global interaction state as the primary dispatch key.

Executors own writes and follow mutation contracts:

- `playInteractionExecutor` writes real game-tree moves and play-side effects.
- `scratchEditInteractionExecutor` writes working positions and edit-analysis
  effects.
- `recallInteractionExecutor` writes answer attempts, session state, hints,
  skips, and progress.
- `variationInteractionExecutor` writes variation state.
- `legacyInteractionExecutor` keeps unmigrated scoring, estimator, find, guess,
  autoplay, and native SGF edit behavior isolated.

Do not route one contract through another contract's write path. For example,
recall answers must not call play-move helpers, and scratch edit must not write
the current SGF tree.

## Overlay Rules

Overlays consume positions and analysis data. They must not mutate game trees,
working positions, or training attempts.

If an overlay interaction needs to affect behavior, route that action through a
normal `BoardInteractionIntent` and executor boundary.

## PR Checklist

For workbench behavior changes, confirm:

- The behavior contract is present.
- Existing behavior has a Playwright or unit-test baseline where practical.
- New resolver behavior has matrix coverage when it is pure.
- New UI-visible behavior has Playwright coverage or a documented reason why it
  does not.
- Legacy fallback is explicit for unmigrated paths.
- No new behavior was added to the old `mode` branch without a migration note.

