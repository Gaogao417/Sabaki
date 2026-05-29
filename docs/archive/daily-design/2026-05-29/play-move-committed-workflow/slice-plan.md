# Play Move Commit Workflow Slice Plan

Date: 2026-05-29

## Source Truth Refs

- `docs/design/play-move-committed-architecture.md`
- `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md`
- `docs/product/sabaki-training-prd.md`
- `src/modules/training/workbench/boardInteractionController.ts`
- `src/modules/workbench/board-interactions/executors/playInteractionExecutor.js`
- `src/modules/training/ai/aiMoveService.ts`
- `test/workbench/wiring/w8-p1-board-interaction-controller.test.js`

## Current State / Remaining Gaps

- Play human move writes SGF game tree through `executePlayInteraction`.
- Human post-write side effects are inline in `boardInteractionController`.
- AI reply currently returns a move string to the controller, and the controller directly calls
  `documentStore.playMove` for the AI move.
- AI move append skips the same named post-commit pipeline used by human moves.
- AI move does not schedule analysis / monitor callbacks / AI-vs-AI continuation through the same
  lifecycle point.
- Problem / Recall / Analysis already route to separate executors and are out of this slice except
  for guard tests that they remain separate.

## Out Of Scope

- Snapshot Analysis scratch implementation.
- New persistent event bus or exported `PlayMoveCommitted` event type.
- Problem AI opponent behavior.
- Overlay rendering changes.
- Engine implementation changes beyond the injected `aiMoveService` contract.

## Step List

| Step | Do | Mode | Depends on | Can run with | Locks / owner | Next role |
| --- | --- | --- | --- | --- | --- | --- |
| step1 | Define Play move post-commit contract for `boardInteractionController` and the injected AI/Attempt/monitor seams. | serial | docs fixed | none | `docs/archive/daily-design/2026-05-29/play-move-committed-workflow/test-contract-v0.1.md` | contract-designer |
| step2 | Audit contract against the three source docs and current code boundary. | serial | step1 | none | contract artifact | contract-auditor |
| step3 | Add focused wiring tests proving human and AI moves both flow through the same post-commit pipeline, stale/null AI reply does not write, and non-Play modes do not use Play commit. | serial | step2 approved | none | `test/workbench/wiring/w8-p1-board-interaction-controller.test.js` | test-writer |
| step4 | Audit tests for source alignment and false-green risk. | serial | step3 | none | test file | test-auditor |
| step5 | Implement the local `afterPlayMoveCommitted` helper and route AI-generated commands back through the same Play move executor path without direct Attempt/overlay writes from `aiMoveService`. | serial | step4 approved | none | `src/modules/training/workbench/boardInteractionController.ts` | implementation-agent |
| step6 | Verify focused tests, then run related AI/attempt/play interaction regressions. | serial | step5 | none | test commands | main session |
| step7 | Review final diff against architecture boundaries. | serial | step6 | none | final diff | architecture-reviewer |

## Shared Locks / Integrators

- No parallel write branches. `boardInteractionController.ts` is the sole production lock.
- Tests stay in the existing Workbench controller wiring test file to avoid a split harness.
- Main session integrates all gate outputs and owns git commits after each role.

## Gate Ledger Seed

- docs alignment: committed in `af65237b`.
- planner: this file.
- contract: ready for audit; commit: 51ebfbbc.
- contract audit: pending.
- tests: pending.
- test audit: approved in `3f67a7d3`; request-changes addendum test audit REQUEST_CHANGES:
  T13/T14 source-boundary scans must also cover monitor/analysis/UI dependencies,
  source-specific tab APIs, `origin.provider`, and Snapshot orchestration before implementation.
  retry approved after `608b9e2e`; implementation may proceed in the v0.2 scope.
- implementation: pending.
- verification: pending.
- architecture review: REQUEST_CHANGES; blockers are terminal AI continuation stop and treePosition freshness for stale AI responses.
- contract addendum v0.2 request-changes: `test-contract-v0.2-request-changes.md`; commit: pending.

## Retries

- retry1 test-writer after request-changes addendum test audit: strengthen T13/T14 source-boundary scans for
  `aiMoveService` monitor/analysis/UI dependencies and forbidden Snapshot/source-specific API/event shortcuts.
  Focused source-boundary tests pass; T10/T11/T12 remain expected RED before implementation.
