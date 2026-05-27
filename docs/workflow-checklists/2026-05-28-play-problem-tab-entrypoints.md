# Play / Problem Tab Entrypoints Workflow

Date: 2026-05-28

Scope: correct the Workbench play/problem tab entrypoint API after the AI wiring cleanup. Public UI and flow callers should express user-visible intent through `openPlayTab` and `openProblemTab`; `openTask` is only an internal primitive.

## Steps

- [x] step1 contract-designer: define corrected tab entrypoint contract. commit: pending
- [x] step2 test-writer: add focused tests for semantic play/problem entrypoints and legacy adapters. commit: pending
- [x] step3 implementation-agent: implement tab service API cleanup and update production callers. commit: pending
- [x] step4 verification: run focused tests, type/build checks, and relevant e2e smoke. commit: pending
- [x] step5 architecture-reviewer: review entrypoint boundaries and state loop. commit: pending

## Result Log

- step1: wrote `docs/archive/daily-design/2026-05-28/play-problem-tab-entrypoints/test-contract-v0.1.md`.
- step2: updated focused unit/static tests for `openPlayTab`, task-object `openProblemTab`, legacy adapters, and no container `openTask` calls.
- step3: removed public `openTask`, added semantic play/problem APIs, renamed legacy adapters, and migrated production callers plus stale test harnesses.
- step3 retry: migrated Playwright harness instrumentation from `openTask` to `openPlayTab`/`openProblemTab`.
- step4: verified `npm test` (1914 passing), `npx webpack --mode development`, and Playwright smoke/workbench-command/new-game-dialog (19 passing).
- step5: wrote architecture review with PASS verdict and event-loop traces.

## Retries

- step4 verification failed once: Playwright e2e harness still bound removed public `openTask`; retry step3 to migrate e2e harness instrumentation to `openPlayTab`/`openProblemTab`.
