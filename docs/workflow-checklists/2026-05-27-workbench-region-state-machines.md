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
- [ ] step1.contract: Contract sketch for overlay child-region transition boundary — role: contract-designer — depends_on: phase-intake-slice-plan — contract: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-contract-v0.1.md` — commit: c413c4ab — retry required after step1.contract-audit REQUEST_CHANGES
- [x] step1.contract-audit: Audit overlay child-region contract — role: contract-auditor — depends_on: step1.contract — verdict: REQUEST_CHANGES — audit: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.1.md` — commit: 867f5f45
- [ ] step1.tests: Write focused overlay child-region and flow outcome tests — role: test-writer — depends_on: step1.contract-audit
- [ ] step1.test-audit: Audit tests for fake green / wrong-layer mocks — role: test-auditor — depends_on: step1.tests
- [ ] step1.impl: Implement overlay child-region transition boundary — role: implementation-agent — depends_on: step1.test-audit
- [ ] step1.review: Architecture review of overlay child-region implementation — role: architecture-reviewer — depends_on: step1.impl

## Notes

- Full parent/child region migration is `SPLIT_REQUIRED`; do not combine overlay, runtime, scratch, engine, and resolver diagnostics in one implementation step.
- Per AGENTS, each role/skill step must commit only its owned changes before the next step.

## Retries

- retry1 step1.contract after `step1.contract-audit` REQUEST_CHANGES (`docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.1.md`): v0.1 mixes archive/design/plan into authoritative source truth, lacks the required source-row coverage table, mislabels real `workbenchFlowService` tests as `CONTROLLER_STATE_TRANSITION`, needs formal deferred rows for runtime/scratch/engine/diagnostics, and cannot enter test-writer while `Status: pending-confirmation`.
