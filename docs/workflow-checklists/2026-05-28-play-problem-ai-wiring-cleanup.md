# Workflow Checklist

- workflow: workbench-wiring-workflow
- task: Clean up play/problem entry API and AI reply wiring from the previous implementation
- created: 2026-05-28
- source_truth: docs/architecture/gabaki-sabaki-training-architecture-v0.5.md SS5.2, SS5.7, SS8.1; docs/ui_ux/workbench-six-screen-migration-wiring-plan.md; docs/ui_ux/workbench-ui-ux-spec.md Play AI auto-reply requirements; current user review notes in thread

## Steps

- [x] step1: Write cleanup contract sketch for TabService API, configured play setup, AI reply ownership, and test boundaries — role: contract-designer — mode: serial — result: wrote `docs/archive/daily-design/2026-05-28/play-problem-ai-wiring-cleanup/test-contract-v0.1.md`; commit: eb068381
- [x] step2: Rewrite focused tests and E2E harnesses so they protect source-truth behavior rather than temporary openPlayTab/openProblemTask/startConfiguredGame wrappers — role: test-writer — mode: serial — depends_on: step1 — scope: test/training/workbenchTabService.test.js, test/training/configuredGamePlayerConfig.test.js, e2e/golden-path-smoke.spec.js, e2e/workbench-command-acceptance.spec.js, e2e/new-game-dialog.spec.js, command-map coverage — result: focused tests now fail on exposed temporary wrappers and container calls that do not use `openTask({mode})`; removed pure helper test that locked implementation shape; commit: b6defe76
- [x] step3: Implement cleanup: remove temporary TabService wrappers, route UI/configured play through openTask, remove odd playerConfig helper file, preserve AI post-move reply behavior — role: implementation-agent — mode: serial — depends_on: step2 — scope: workbenchTabService, TrainingWorkbenchContainer, sabaki configured game setup, AI reply wiring as needed — result: removed `openPlayTab`/`openProblemTask` public API, routed configured game and UI entries through `openTask({mode})`, removed standalone playerConfig helper, focused tests pass; commits: 1156ff29, b414e0fe
- [x] step4: Run targeted and full verification, update any drifted tests without changing contracts — role: verification — mode: serial — depends_on: step3 — result: focused unit `101 passing`; `npm test` `1912 passing`; webpack development build passed; Playwright smoke/workbench-command/new-game-dialog `19 passed`; commit: c2b9647d
- [x] step5: Architecture review of event loop and ownership boundaries, with no-code or minimal doc evidence — role: architecture-reviewer — mode: serial — depends_on: step4 — result: PASS review recorded in `docs/archive/daily-design/2026-05-28/play-problem-ai-wiring-cleanup/architecture-review-v0.1.md`; commit: 93daa7ac

## Retries

- retry1 step3 from step4 verification: focused command-map tests found `TrainingWorkbenchContainer` still called local `openPlayTask` / `openProblemTask` wrappers; retry removes those wrapper calls and routes handlers directly through `tabService.openTask({mode})`.
