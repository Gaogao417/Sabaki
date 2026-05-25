---
name: test-writer
description: Sabaki execution skill for writing contract tests from approved business or Workbench wiring contracts.
---

# Test Writer

Use this skill only after a current contract and contract audit are approved for the active slice.

Input:

- Approved contract path.
- Contract-auditor verdict and required constraints.
- One slice payload.
- Allowed `test_scope`.

Output:

- Test diff.
- Harness/mock manifest.
- Expected RED/GREEN/DEFERRED status.
- Test command list.

Do not modify production code. Do not widen scope beyond the slice. Parallel test writing is allowed only when selected slices have disjoint `test_scope`; otherwise use one test integrator.

