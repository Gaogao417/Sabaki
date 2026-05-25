---
name: implementation-agent
description: Sabaki execution skill for implementing business/state/architecture or Workbench wiring steps after focused tests exist.
---

# Implementation Agent

Use this skill after the active planner step has a clear scope and focused tests or verification notes.

Input:

- Contract sketch or step plan.
- Focused tests and review notes.
- Required constraints.
- One step payload.
- Allowed write scope.

Output:

- Production diff.
- Touched files.
- Verification results.
- Residual risk notes.

Do not weaken tests or reinterpret the step scope. Parallel implementation is allowed only when selected dotted steps are in the same ready group and have disjoint write scope; shared production files require one named integrator step.
