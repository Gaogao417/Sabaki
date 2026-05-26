# Workflow Checklist

- workflow: workbench-wiring-workflow
- task: Repair real submit-to-recall data/projection loop so Recall UI changes without seeded fake state
- created: 2026-05-26
- source_truth: docs/product/sabaki-training-prd.md §5.2; docs/architecture/gabaki-sabaki-training-architecture-v0.5.md §§4.3, 9.4; docs/ui_ux/workbench-ui-ux-spec.md §0
- contract: docs/archive/daily-design/2026-05-26/submit-to-recall-projection/test-contract-v0.2.md

## Steps

- [x] step1: Contract for real submit-to-recall state loop and UI projection, covering service/store/projection and fake-green exclusions — role: contract-designer — mode: serial — scope: docs/archive/daily-design/2026-05-26/submit-to-recall-projection/
- [x] step2: Audit step1 contract for source-truth alignment, boundary correctness, side effects, and testability — role: contract-auditor — mode: serial — depends_on: step1
- [x] step3: Write focused failing tests for submit-to-recall service/store/projection without manually seeding recallView or recall mode — role: test-writer — mode: serial — depends_on: step2 — scope: test/training/workbenchFlowService.test.js, test/workbench/wiring/submit-to-recall-projection.test.js
- [x] step4: Audit step3 tests for callback-only fake greens, wrong-layer mocks, reverse-contract assertions, and manual asserted-state mutation — role: test-auditor — mode: serial — depends_on: step3
- [x] step5: Implement minimal submit-to-recall hydration/projection wiring — role: implementation-agent — mode: serial — depends_on: step4 — scope: src/modules/training/workbench/workbenchFlowService.ts, src/components/TrainingWorkbenchContainer.js if projection fallback is contract-approved
- [x] step6: Run targeted and full verification for submit-to-recall loop — role: implementation-agent — mode: serial — depends_on: step5
- [x] step7: Architecture review of the complete loop from visible submit command to projected Recall UI props — role: architecture-reviewer — mode: serial — depends_on: step6
- [x] step8: Update implementation-plan evidence/status for this regression repair — role: implementation-agent — mode: serial — depends_on: step7 — scope: docs/architecture/gabaki-sabaki-training-implementation-plan.md

## Retries

- step2 returned REQUEST_CHANGES on 2026-05-26 for test-contract-v0.1.md; step1 retried and produced test-contract-v0.2.md.
- step4 returned REQUEST_CHANGES on 2026-05-26 for initial tests; retry step3 to add S2R-T04 subscription outcome coverage and extend S2R-T09 to scoped `workbenchFlowService.ts` submit/mapper scan.
- step4 returned REQUEST_CHANGES on 2026-05-26 for retry tests; retry step3 to make S2R-T04 capture subscription-driven active Recall surface and add `snapshotService`/source-specific variants to scoped submit guard.
