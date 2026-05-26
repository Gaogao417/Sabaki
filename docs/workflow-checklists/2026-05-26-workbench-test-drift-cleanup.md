# Workflow Checklist

- workflow: frontend-visual-workflow
- task: Remove obsolete Workbench six-screen visual drift tests from the phase1 integration branch.
- created: 2026-05-26
- source_truth: current six-screen Workbench UI, user direction to remove CSS atoms/text/P4 panel drift tests

## Steps

- [x] step1: Remove CSS atoms test file — role: frontend-implementation-agent — mode: serial
- [x] step2: Remove obsolete panel text and P4 status assertions that no longer match the current UI — role: frontend-implementation-agent — mode: serial — depends_on: step1
- [x] step3: Run focused panel tests and full npm test — role: verification — mode: serial — depends_on: step2
- [x] step4: Commit test cleanup on the phase1 integration branch — role: workflow-orchestrator — mode: serial — depends_on: step3

## Retries

(none)
