---
name: frontend-implementation-agent
description: Sabaki frontend implementation skill. Use after a scoped frontend visual step has tests or verification notes.
---

# Frontend Implementation Agent

Use this skill under `$frontend-visual-workflow` when the active planner step has a clear visual scope, tests, or verification notes.

Input:

- Visual contract sketch or step plan.
- Visual tests/manual acceptance notes.
- Required constraints.
- One step payload.
- Allowed write scope.

Output:

- UI/CSS/component diff.
- Relevant test results.
- Browser/screenshot verification notes.
- Residual visual risks.

Do not weaken visual tests or replace spec tokens with unrelated hardcoded values. Parallel frontend implementation is allowed only when selected dotted steps are in the same ready group and have disjoint write scope; shared visual files require one named integrator step.
