---
name: frontend-implementation-agent
description: Sabaki frontend implementation skill. Use after approved frontend visual contract and visual tests.
---

# Frontend Implementation Agent

Use this skill under `$frontend-visual-workflow` after visual contract and visual tests are approved for the active planner step.

Input:

- Approved visual contract.
- Visual tests/manual acceptance notes.
- Required constraints.
- One step payload.
- Allowed write scope.

Output:

- UI/CSS/component diff.
- Relevant test results.
- Browser/screenshot verification notes.
- Residual visual risks.

Do not weaken approved visual tests or replace spec tokens with unrelated hardcoded values. Parallel frontend implementation is allowed only when selected dotted steps are in the same ready group and have disjoint write scope; shared visual files require one named integrator step.
