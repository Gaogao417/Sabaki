# Workbench Region State Machines Workflow Checklist

Date: 2026-05-27
Workflow: business-contract-workflow
Status: step2.1-active

## Scope

Implement the Workbench parent state-machine / child region state-machine migration in small, audited slices. The first executable slice is overlay region transition ownership.

## Checklist

- [x] setup.docs: Update `AGENTS.md` with Workbench state-machine implementation principles — role: main session — commit: b4cebd31
- [x] workflow.classify: Classify request as business/state/architecture workflow — role: business-contract-workflow — commit: b67fd4b7
- [x] phase-intake-slice-plan: Produce slice plan with explicit serial/parallel branches — role: phase-intake-slice-planner — scope: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` — commit: 3ce058c2
- [x] step1.contract: Contract sketch for overlay child-region transition boundary — role: contract-designer — depends_on: phase-intake-slice-plan — contract: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-contract-v0.2.md` — commit: 7b4d60bd — approved by step1.contract-audit retry
- [x] step1.contract-audit: Audit overlay child-region contract — role: contract-auditor — depends_on: step1.contract — verdict: APPROVED — audit: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.2.md` — commit: 320d7b55
- [x] step1.tests: Write focused overlay child-region and flow outcome tests — role: test-writer — depends_on: step1.contract-audit — tests: `test/overlays/overlayStore.test.js`, `test/overlays/workbenchOverlayRegionBoundary.test.js`, `test/training/workbenchFlowService.test.js` — commit: c5599ec0 — retry1 submitted after test-audit REQUEST_CHANGES; expected status: OVR-T01/T02 GREEN; OVR-T03/T04/T05/T06/T09 RED until production overlay region is implemented
- [x] step1.test-audit: Audit tests for fake green / wrong-layer mocks — role: test-auditor — depends_on: step1.tests — verdict: APPROVED — audit: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-audit-v0.2.md` — commit: 3d210ff5
- [x] step1.impl: Implement overlay child-region transition boundary — role: implementation-agent — depends_on: step1.test-audit — production: `src/modules/overlays/workbenchOverlayRegion.ts`, `src/modules/training/workbench/workbenchFlowService.ts`, `src/modules/sabaki.js` — commit: 38880948 — retry1 submitted after architecture-review REQUEST_CHANGES
- [x] step1.review: Architecture review of overlay child-region implementation — role: architecture-reviewer — depends_on: step1.impl — verdict: APPROVED — audit: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/architecture-review-v0.2.md` — commit: 8e09a3ce
- [ ] step2.1.contract: Contract sketch for runtime companion child-region cleanup — role: contract-designer — depends_on: step1.review — scope: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/test-contract-v0.1.md`
- [ ] step2.1.contract-audit: Audit runtime companion child-region contract — role: contract-auditor — depends_on: step2.1.contract
- [ ] step2.1.tests: Write focused runtime companion region and flow outcome tests — role: test-writer — depends_on: step2.1.contract-audit
- [ ] step2.1.test-audit: Audit runtime companion tests for fake green / wrong-layer mocks — role: test-auditor — depends_on: step2.1.tests
- [ ] step2.1.impl: Implement runtime companion child-region cleanup boundary — role: implementation-agent — depends_on: step2.1.test-audit
- [ ] step2.1.review: Architecture review of runtime companion implementation — role: architecture-reviewer — depends_on: step2.1.impl

## Notes

- Full parent/child region migration is `SPLIT_REQUIRED`; do not combine overlay, runtime, scratch, engine, and resolver diagnostics in one implementation step.
- Per AGENTS, each role/skill step must commit only its owned changes before the next step.
- Test-writer retry verification: `npx mocha --require tsx test/overlays/overlayStore.test.js` passed 10 tests; `npx mocha --require tsx test/overlays/workbenchOverlayRegionBoundary.test.js test/training/workbenchFlowService.test.js --grep "Workbench overlay region boundary|step1 overlay child-region transition boundary"` failed as expected on missing `src/modules/overlays/workbenchOverlayRegion.ts` after expanding OVR-T04/T09 matrix.
- Implementation verification: `npx mocha --require tsx test/overlays/overlayStore.test.js test/overlays/workbenchOverlayRegionBoundary.test.js test/training/workbenchFlowService.test.js test/training/modeTransitions.test.js test/training/modeStateResolver.test.js` passed 168 tests before production composition retry.
- Final step1 verification: `npx mocha --require tsx test/overlays/overlayStore.test.js test/overlays/workbenchOverlayRegionBoundary.test.js test/training/workbenchFlowService.test.js test/training/modeTransitions.test.js test/training/modeStateResolver.test.js` passed 170 tests; architecture review retry approved.

## Retries

- retry1 step1.contract after `step1.contract-audit` REQUEST_CHANGES (`docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.1.md`): v0.1 mixes archive/design/plan into authoritative source truth, lacks the required source-row coverage table, mislabels real `workbenchFlowService` tests as `CONTROLLER_STATE_TRANSITION`, needs formal deferred rows for runtime/scratch/engine/diagnostics, and cannot enter test-writer while `Status: pending-confirmation`.
- retry1 result: revised contract submitted as `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-contract-v0.2.md` — commit: 7b4d60bd — contract-audit retry APPROVED in `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.2.md` — commit: 320d7b55.
- retry1 step1.tests after `step1.test-audit` REQUEST_CHANGES (`docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-audit-v0.1.md`): OVR-T09 must cover `play/problem/recall -> analysis`; OVR-T04 must cover `analysis -> play/problem/recall`; OVR-T03 must forbid public mode-writer API and indirect upward writers.
- retry1 result: expanded overlay transition matrix and API boundary assertions in `test/overlays/workbenchOverlayRegionBoundary.test.js` and `test/training/workbenchFlowService.test.js` — commit: c5599ec0 — test-audit retry APPROVED in `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-audit-v0.2.md` — commit: 3d210ff5.
- retry1 step1.impl after `step1.review` REQUEST_CHANGES (`docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/architecture-review-v0.1.md`): production `getTrainingContext().flowService` must receive `overlayRegion`, and Workbench mode effects must not re-enable territory through legacy `sabaki.setMode('analysis')`.
- retry1 test result: added production composition and mode-effect isolation tests in `test/overlays/workbenchOverlayRegionBoundary.test.js` and `test/training/workbenchFlowService.test.js` — commit: 6d898777 — expected RED until production composition is wired.
- retry1 implementation result: injected `createWorkbenchOverlayRegion({overlayStore: this.getOverlayStore(), logger})` into production `createWorkbenchFlowService` deps and isolated `createSabakiModeEffects` from legacy territory auto-enable — commit: 38880948.
- retry1 verification: `npx mocha --require tsx test/overlays/overlayStore.test.js test/overlays/workbenchOverlayRegionBoundary.test.js test/training/workbenchFlowService.test.js test/training/modeTransitions.test.js test/training/modeStateResolver.test.js` passed 170 tests.
- retry1 review result: architecture-review retry APPROVED in `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/architecture-review-v0.2.md` — commit: 8e09a3ce.
