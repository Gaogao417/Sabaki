# Workbench Region State Machines Workflow Checklist

Date: 2026-05-27
Workflow: business-contract-workflow
Status: active

## Scope

Implement the Workbench parent state-machine / child region state-machine migration in small, audited slices. The first executable slice is overlay region transition ownership.

## Checklist

- [x] setup.docs: Update `AGENTS.md` with Workbench state-machine implementation principles — role: main session — commit: b4cebd31
- [x] workflow.classify: Classify request as business/state/architecture workflow — role: business-contract-workflow — commit: b67fd4b7
- [x] phase-intake-slice-plan: Produce slice plan with explicit serial/parallel branches — role: phase-intake-slice-planner — scope: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` — commit: 3ce058c2
- [x] step1.contract: Contract sketch for overlay child-region transition boundary — role: contract-designer — depends_on: phase-intake-slice-plan — contract: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-contract-v0.2.md` — commit: 7b4d60bd — approved by step1.contract-audit retry
- [x] step1.contract-audit: Audit overlay child-region contract — role: contract-auditor — depends_on: step1.contract — verdict: APPROVED — audit: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.2.md` — commit: 320d7b55
- [x] step1.tests: Write focused overlay child-region and flow outcome tests — role: test-writer — depends_on: step1.contract-audit — tests: `test/overlays/overlayStore.test.js`, `test/overlays/workbenchOverlayRegionBoundary.test.js`, `test/training/workbenchFlowService.test.js` — commit: 427a2898 — expected status: OVR-T01/T02 GREEN; OVR-T03/T04/T05/T06/T09 RED until production overlay region is implemented
- [ ] step1.test-audit: Audit tests for fake green / wrong-layer mocks — role: test-auditor — depends_on: step1.tests — verdict: REQUEST_CHANGES — audit: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-audit-v0.1.md` — commit: a1490211 — retry required for OVR-T09 source rows, OVR-T04 target rows, and stronger OVR-T03 public API boundary
- [ ] step1.impl: Implement overlay child-region transition boundary — role: implementation-agent — depends_on: step1.test-audit
- [ ] step1.review: Architecture review of overlay child-region implementation — role: architecture-reviewer — depends_on: step1.impl

## Notes

- Full parent/child region migration is `SPLIT_REQUIRED`; do not combine overlay, runtime, scratch, engine, and resolver diagnostics in one implementation step.
- Per AGENTS, each role/skill step must commit only its owned changes before the next step.
- Test-writer verification: `npx mocha --require tsx test/overlays/overlayStore.test.js` passed 10 tests; `npx mocha --require tsx test/overlays/workbenchOverlayRegionBoundary.test.js test/training/workbenchFlowService.test.js --grep "Workbench overlay region boundary|step1 overlay child-region transition boundary"` failed as expected on missing `src/modules/overlays/workbenchOverlayRegion.ts`.

## Retries

- retry1 step1.contract after `step1.contract-audit` REQUEST_CHANGES (`docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.1.md`): v0.1 mixes archive/design/plan into authoritative source truth, lacks the required source-row coverage table, mislabels real `workbenchFlowService` tests as `CONTROLLER_STATE_TRANSITION`, needs formal deferred rows for runtime/scratch/engine/diagnostics, and cannot enter test-writer while `Status: pending-confirmation`.
- retry1 result: revised contract submitted as `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-contract-v0.2.md` — commit: 7b4d60bd — contract-audit retry APPROVED in `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.2.md` — commit: 320d7b55.
- retry1 step1.tests after `step1.test-audit` REQUEST_CHANGES (`docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-audit-v0.1.md`): OVR-T09 must cover `play/problem/recall -> analysis`; OVR-T04 must cover `analysis -> play/problem/recall`; OVR-T03 must forbid public mode-writer API and indirect upward writers.
