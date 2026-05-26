Date: 2026-05-25
Role: test-auditor
Status: APPROVE_WITH_NOTES
Subject: Phase 3 tests against test-contract-v0.2.md

# Phase 3 Test Audit v0.1

## Verdict

The Phase 3 tests satisfy the approved contract rows P3-T01 through P3-T08. They use real runtime/workbench stores where required, typed helper fakes from `test/training/phase3TypedFakes.ts`, and focused service tests for stale AI responses, frozen Attempt protection, Recall completion, Problem undo rollback, and submit ordering.

## Coverage Map

- P3-T01: `test/training/trainingRuntimeStore.test.js`
- P3-T02 and P3-T03a-e: `test/training/aiMoveService.test.js`
- P3-T04: `test/training/trainingRepositoryFrozenAttempt.test.js`
- P3-T05: `test/training/attemptService.test.js`
- P3-T06: `test/training/recallService.test.js`
- P3-T07: `test/training/problemFlowService.test.js`
- P3-T08: `test/training/workbenchFlowService.test.js`
- Production wiring regression checks: `test/training/phase3Integration.test.js`

## Verification

- `npx mocha --require tsx test/training/trainingRuntimeStore.test.js test/training/aiMoveService.test.js test/training/trainingRepositoryFrozenAttempt.test.js test/training/attemptService.test.js test/training/recallService.test.js test/training/problemFlowService.test.js test/training/workbenchFlowService.test.js test/training/phase3Integration.test.js`
  - Result: 172 passing.
- `npm test`
  - Result: 1786 passing, 4 failing.
  - Failing tests are existing Workbench container wiring failures in `test/workbench/TrainingWorkbenchContainer.test.js` and `test/workbench/wiring/w35-container-wiring.test.js`; they are not in the Phase 3 dirty diff.

## Notes

- P3-T04 proves frozen Attempt protected writes are rejected before DB update. A future hardening test should also assert that a `playing` Attempt can still update the same protected fields through the real repository wrapper, so the guard cannot become over-restrictive unnoticed.
- The TS helper file gives typed method picks and explicit return types, but the current `npm test` command transpiles through `tsx` rather than running a dedicated typecheck. This is acceptable for the current repo test strategy, with residual type-enforcement risk.
