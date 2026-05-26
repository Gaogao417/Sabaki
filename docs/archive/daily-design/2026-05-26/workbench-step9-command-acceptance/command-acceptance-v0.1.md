# Workbench Step9.2 Command Acceptance v0.1

## Verdict

APPROVE

The `workbench-command` Playwright suite now checks command results through Workbench state, visible projection, and instrumentation. It no longer only checks element presence.

## Scope

- Spec: `e2e/workbench-command-acceptance.spec.js`
- Project: `workbench-command`
- Production code: unchanged
- Config: unchanged by this retry worker

## Acceptance Coverage

| Area | Evidence |
| --- | --- |
| Canonical states | Play, Problem, Recall, and Analysis each assert `workbenchStore`-projected shell mode, active segmented policy, visible top actions, bottom action-bar mode class, and absent commands for the wrong mode. |
| Library drawer | Drawer open asserts a projected history sentinel from `libraryProjection`, not a static string. |
| Edit bar | Analysis toolbar command selects the white-stone tool, mutates `editWorkspace.currentSnapshot.signMap`, and proves the source game tree position/node count did not mutate. |
| Mode commands | Enter Analysis and Return both wrap `flowService` instrumentation and assert active tab mode plus `analysisReturnTarget` changes. |
| Disabled reason/no-op | Problem -> Play segmented command exposes `aria-disabled` and title `请先提交或放弃当前题目`; DOM click plus Enter/Space activation attempts leave Workbench state and command instrumentation unchanged. |
| Keyboard shortcuts | `A`, `S`, `H`, `Enter`, and `Space` are guarded as current no-op gaps against Workbench state/service side effects; `Ctrl+Z` and `Cmd+Z` on macOS are accepted through the real App key handler by instrumenting `sabaki.undo`. |
| 101/Fox sync states | Fixture projection covers loading, empty, error, syncing, and success states. Disabled loading/error buttons prove no import/openTask side effects; success click path still reaches repository/import and `tabService.openTask`. |

## Contract Gaps Recorded

- `workbenchCommandMap.ts` declares `keyboard.snapshot` with key `S`, but the current Electron renderer has no Workbench keyboard dispatcher for that command. The Playwright test records this as a no-op guard, not a fake-green snapshot acceptance.
- `A`, `H`, `Enter`, and `Space` have no current Workbench command binding in the exercised surface. They are guarded as no-op shortcuts so future wiring must add explicit acceptance instead of inheriting accidental side effects.

## Verification

- `npm run bundle`: PASS, webpack compiled successfully.
- `npx playwright test --project=workbench-command`: PASS, 7 passed.

## Residual Risk

The disabled segmented control is a policy/projection sentinel in the redesigned topbar and is not visibly clickable in this layout. The test validates its disabled reason and no-op behavior by DOM activation, while visible topbar actions are separately covered by canonical state assertions.
