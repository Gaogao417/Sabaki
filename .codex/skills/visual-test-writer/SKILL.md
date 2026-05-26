---
name: visual-test-writer
description: Sabaki visual test writer. Use after a frontend visual step plan or contract sketch to write visual/token/layout/screenshot tests.
---

# Visual Test Writer

Use this skill under `$frontend-visual-workflow` when the active planner step has visual source refs and an allowed test surface.

Input:

- Frontend visual contract sketch or step plan.
- One step payload.
- Allowed test scope.
- Required constraints.

Output:

- Static token tests.
- CSS/static parsing tests.
- Computed-style tests.
- Playwright layout/screenshot tests when applicable.
- Manual visual acceptance notes.

Do not modify production code. Do not widen scope beyond the active step. Do not reduce visual requirements to class name, `data-testid`, or callback existence checks. Parallel visual test writing is allowed only when selected dotted steps are in the same ready group and have disjoint test scope; otherwise use the named visual test integrator step.
