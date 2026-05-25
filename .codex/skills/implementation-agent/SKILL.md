---
name: implementation-agent
description: Sabaki execution skill for implementing approved business/state/architecture or Workbench wiring contracts after tests and test audit.
---

# Implementation Agent

Use this skill only after contract, contract audit, tests, and test audit are approved for the active planner step.

Input:

- Approved contract path.
- Approved tests and test-auditor verdict.
- Required constraints.
- One step payload.
- Allowed write scope.

Output:

- Production diff.
- Touched files.
- Verification results.
- Residual risk notes.

Do not weaken approved tests or reinterpret the contract. Parallel implementation is allowed only when selected dotted steps are in the same ready group and have disjoint write scope; shared production files require one named integrator step.
