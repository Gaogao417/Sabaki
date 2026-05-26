# Workbench Wiring Implementation Checklist

## Meta

- task: Run the current PRD/architecture-driven Workbench wiring implementation plan from step1 through step11 without stopping between ready steps
- source plan: docs/architecture/gabaki-sabaki-training-implementation-plan.md
- source truth:
  - docs/product/sabaki-training-prd.md
  - docs/architecture/gabaki-sabaki-training-architecture-v0.5.md
  - docs/design/workbench-mode-orchestration-contract.md
  - docs/architecture/position-source-mutation-contract.md
  - docs/ui_ux/workbench-six-screen-migration-wiring-plan.md

## Steps

- [x] step1.1: Snapshot contract alignment tests and current regression verification — role: test-writer — mode: parallel-ready — scope: test/training/modeTransitions.test.js, test/training/workbenchFlowService.test.js, test/training/snapshotService.test.js
- [x] step1.4: Workbench command map coverage and visible command wiring guard — role: visual-test-writer — mode: parallel-ready — scope: src/modules/training/workbench/workbenchCommandMap.ts, test/workbench/wiring/command-map-coverage.test.js — retry result: owner-dispatch fake green removed; focused run RED as expected on legacy `toggleThirdPartyPanel` path (4 passing, 1 failing) — commit: 51367f07
- [x] step1.5: Playwright command E2E scaffold for mode/library/edit-bar paths — role: visual-test-writer — mode: parallel-ready — scope: playwright.config.js, e2e/workbench-command-acceptance.spec.js — retry result: legacy library toggle acceptance removed; focused Playwright run RED as expected on Fox/101 import/openTask path (2 passing, 1 failing); edit-bar scoped as tool-selection smoke with scratch mutation deferred — commit: 97c30ff9
- [x] step1.2.contract: Contract sketch for read-only ModeState / companion state resolver — role: contract-designer — mode: parallel — scope: docs/archive/daily-design/2026-05-26/workbench-mode-state-resolver/
- [x] step1.3.contract: Contract sketch for six-screen projection anti-fake-green tests — role: frontend-contract-designer — mode: parallel — scope: docs/archive/daily-design/2026-05-26/workbench-six-screen-projection/
- [x] step1.2.tests: Write focused ModeState / companion state resolver tests — role: test-writer — mode: parallel — depends_on: step1.2.contract — scope: test/training/modeStateResolver.test.js — result: focused resolver tests added; focused run RED as expected because production resolver is absent (0 passing, 16 failing) — commit: 2bed1ef1
- [x] step1.3.tests: Write six-screen projection anti-fake-green tests — role: visual-test-writer — mode: parallel — depends_on: step1.3.contract — scope: test/workbench/wiring/six-screen-projection.test.js — result: focused projection tests added; focused run RED as expected against static panel/container fallbacks (1 passing, 7 failing) — commit: 6bc2c246
- [x] step1.review: Review step1 tests for fake green, wrong-layer mocks, and source-truth drift — role: test-auditor — mode: serial — depends_on: step1.2.tests, step1.3.tests — verdict: APPROVE after retry1; step2 may proceed — commit: e3cfa1c2
- [x] step2: Audit and merge step1 tests, remove stale snapshot assumptions, preserve null-task crash guard as enter-analysis guard — role: test-auditor — mode: serial — scope: test files only — verdict: APPROVE; expected REDs remain legitimate implementation gaps — commit: eb27c6ae
- [x] step3.1: Implement read-only ModeState / companion resolver — role: implementation-agent — mode: parallel — depends_on: step2 — scope: src/modules/training/workbench/modeStateResolver.ts — result: focused resolver tests pass (16 passing) — commit: 10f27832
- [x] step3.2.contract: Contract sketch for ModeEnterEffect / ModeExitEffect orchestration boundary — role: contract-designer — mode: parallel — depends_on: step2 — scope: docs/archive/daily-design/2026-05-26/workbench-mode-effects/ — result: mode enter/exit effects contract added — commit: eccc6b52
- [ ] step3.2.tests: Write flow effect tests — role: test-writer — mode: serial-lock — depends_on: step3.2.contract — scope: test/training/workbenchFlowService.test.js
- [ ] step3.2.impl: Implement ModeEnterEffect / ModeExitEffect dependency interface in flow service — role: implementation-agent — mode: serial-lock — depends_on: step3.2.tests — scope: src/modules/training/workbench/workbenchFlowService.ts
- [ ] step4: Integrate mode effects into TrainingWorkbenchContainer and remove container-owned analysis workspace decisions — role: implementation-agent — mode: serial-lock — depends_on: step3.1, step3.2.impl — scope: src/components/TrainingWorkbenchContainer.js, src/modules/training/workbench/workbenchFlowService.ts
- [ ] step5.1: Tighten snapshot persistence to analysis scratch/current source — role: implementation-agent — mode: parallel — depends_on: step4 — scope: src/modules/training/modeTransitions.ts, src/modules/training/workbench/workbenchFlowService.ts, src/modules/training/snapshotService.ts
- [ ] step5.2: Adjust UI snapshot command to enter analysis first outside analysis mode — role: frontend-implementation-agent — mode: parallel — depends_on: step4 — scope: src/components/TrainingWorkbenchContainer.js, src/components/workbench/shell/BottomActionBar.js, src/components/workbench/shell/ModeActions.js
- [ ] step6.1: Implement problemAttemptMove executor and board dispatch path — role: implementation-agent — mode: parallel — depends_on: step4 — scope: src/modules/training/resolveBoardInteraction.ts, src/modules/training/boardInteractionController.ts
- [ ] step6.2: Move problem submit/undo/abandon off legacy controller path — role: implementation-agent — mode: parallel — depends_on: step4 — scope: src/modules/training/problemFlowService.ts, src/modules/training/workbench/workbenchFlowService.ts, src/components/TrainingWorkbenchContainer.js
- [ ] step7.1: Refresh recallView / activeCheckpoint / recallSubstate after recall board answers — role: implementation-agent — mode: parallel — depends_on: step6.1, step6.2 — scope: src/modules/training/recallService.ts, src/modules/training/recallCheckpointService.ts, src/modules/training/boardInteractionController.ts
- [ ] step7.2: Wire checkpoint correctionDraft board source and cleanup lifecycle — role: implementation-agent — mode: parallel — depends_on: step6.1, step6.2 — scope: src/components/TrainingWorkbenchContainer.js, src/modules/training/recallCheckpointService.ts, src/modules/training/trainingRuntimeStore.ts
- [ ] step8.1: Wire Problem six-screen data from task/runtime/evaluation — role: frontend-implementation-agent — mode: parallel — depends_on: step5.1, step5.2, step6.1, step6.2 — scope: src/components/workbench/*Problem*
- [ ] step8.2: Wire Recall / Checkpoint six-screen data from recall/checkpoint projection — role: frontend-implementation-agent — mode: parallel — depends_on: step7.1, step7.2 — scope: src/components/workbench/*Recall*
- [ ] step8.3: Wire Analysis six-screen data from analysis context and overlay/engine projection — role: frontend-implementation-agent — mode: parallel — depends_on: step5.1, step5.2 — scope: src/components/workbench/*Analysis*, src/modules/training/workbench/projectGobanProps.ts
- [ ] step8.4: Wire Library / external data from repository and 101/Fox sync services — role: frontend-implementation-agent — mode: parallel — depends_on: step4 — scope: src/components/workbench/shared/LibrarySideDrawer.js, src/modules/training/taskImportService.ts
- [ ] step8.5: Wire Analysis edit bar to scratch/current working position and shared command path — role: frontend-implementation-agent — mode: parallel — depends_on: step5.1, step5.2 — scope: src/components/workbench/shell/BottomActionBar.js, src/components/workbench/shared/AnnotationToolbar.js, src/components/TrainingWorkbenchContainer.js
- [ ] step9.1: Integrate six-screen projection mapper and compact breakpoint screenshot guard — role: visual-fidelity-reviewer — mode: serial — depends_on: step8.1, step8.2, step8.3, step8.4, step8.5
- [ ] step9.2: Expand Playwright command acceptance for canonical states, disabled reasons, shortcuts, 101/Fox sync states — role: visual-fidelity-reviewer — mode: serial — depends_on: step9.1
- [ ] step10.1: Legacy cleanup A for openProblemTab / review open-due main path — role: implementation-agent — mode: parallel — depends_on: step9.1, step9.2
- [ ] step10.2: Legacy cleanup B for training-domain legacy controller and window.sabaki lookup thinning — role: implementation-agent — mode: parallel — depends_on: step9.1, step9.2
- [ ] step11: Final verification and evidence ledger update — role: architecture-reviewer — mode: serial — depends_on: step10.1, step10.2

## Retries

- retry1 step1.4 / step1.5 after `step1.review` BLOCK (`docs/archive/daily-design/2026-05-26/workbench-step1-test-review/test-audit-v0.1.md`): command-map and Playwright tests were fake green because 101/Fox library commands could still pass through legacy `toggleThirdPartyPanel` instead of `taskImportService -> tabService.openTask`; edit-bar E2E was only a tool-selection smoke and must either be scoped as such or assert scratch/current mutation.
