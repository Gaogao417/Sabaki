---
name: test-writer
description: Sabaki execution skill for writing focused business or Workbench wiring tests from a current step plan or contract sketch.
---

# Test Writer

Use this skill when the active planner step has a clear source-truth scope and allowed test surface.

Input:

- Step plan or contract sketch.
- Source-truth refs and required constraints.
- One step payload.
- Allowed test scope.

Output:

- Test diff.
- Harness/mock manifest.
- Expected RED/GREEN/DEFERRED status.
- Test command list.

Do not modify production code. Do not widen scope beyond the active step. Parallel test writing is allowed only when selected dotted steps are in the same ready group and have disjoint test scope; otherwise use the named test integrator step.
