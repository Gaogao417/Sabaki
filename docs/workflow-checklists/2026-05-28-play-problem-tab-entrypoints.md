# Play / Problem Tab Entrypoints Workflow

Date: 2026-05-28

Scope: correct the Workbench play/problem tab entrypoint API after the AI wiring cleanup. Public UI and flow callers should express user-visible intent through `openPlayTab` and `openProblemTab`; `openTask` is only an internal primitive.

## Steps

- [x] step1 contract-designer: define corrected tab entrypoint contract. commit: pending
- [ ] step2 test-writer: add focused tests for semantic play/problem entrypoints and legacy adapters. commit: pending
- [ ] step3 implementation-agent: implement tab service API cleanup and update production callers. commit: pending
- [ ] step4 verification: run focused tests, type/build checks, and relevant e2e smoke. commit: pending
- [ ] step5 architecture-reviewer: review entrypoint boundaries and state loop. commit: pending

## Result Log

- step1: wrote `docs/archive/daily-design/2026-05-28/play-problem-tab-entrypoints/test-contract-v0.1.md`.

## Retries

- None.
