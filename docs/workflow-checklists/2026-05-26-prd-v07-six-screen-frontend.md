# Workflow Checklist

- workflow: business-contract-workflow then frontend-visual-workflow
- task: Restore v0.5 Attempt/RecallCheckpoint training center in the current PRD and rebuild the six-screen Workbench frontend surface from the 2026-05-26 references.
- created: 2026-05-26
- source_truth: docs/product/sabaki-training-prd.md, docs/archive/prd-versions/gabaki-sabaki-training-prd-v0.5.md, docs/ui_ux/workbench-ref-pics/2026-05-26-six-screen/

## Steps

- [x] step1: Repair current PRD to v0.7 merged scope, preserving v0.6 product breadth while restoring Attempt-centered RecallCheckpoint correction flow — role: contract-designer — mode: serial
- [x] step2: Archive/import the six visual references and update UI source truth notes — role: frontend-design-source-reader — mode: serial
- [x] step3: Rebuild Workbench shell and mode panels to match problem, recall, play-library, analysis-library, analysis, and recall-checkpoint screenshots — role: frontend-implementation-agent — mode: serial — scope: src/components/workbench, src/components/WorkbenchShell.js, style/workbench.css
- [x] step4: Add frontend page migration and wiring plan for visual-to-domain connection — role: contract-designer — mode: serial
- [x] step5: Run focused PRD/workbench tests and bundle verification — role: verification — mode: serial

## Retries

(none)
