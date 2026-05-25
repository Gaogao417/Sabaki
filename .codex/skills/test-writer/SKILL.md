---
name: test-writer
description: Sabaki execution skill for writing contract tests from approved business or Workbench wiring contracts.
---

# Test Writer

Use this skill only after a current contract and contract audit are approved for the active planner step.

Input:

- Approved contract path.
- Contract-auditor verdict and required constraints.
- One step payload.
- Allowed test scope.

Output:

- Test diff.
- Harness/mock manifest.
- Expected RED/GREEN/DEFERRED status.
- Test command list.

Do not modify production code. Do not widen scope beyond the approved step. Parallel test writing is allowed only when selected dotted steps are in the same ready group and have disjoint test scope; otherwise use the named test integrator step.
