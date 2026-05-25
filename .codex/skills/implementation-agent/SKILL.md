---
name: implementation-agent
description: Sabaki execution skill for implementing approved business/state/architecture or Workbench wiring contracts after tests and test audit.
---

# Implementation Agent

Use this skill only after contract, contract audit, tests, and test audit are approved for the active slice.

Input:

- Approved contract path.
- Approved tests and test-auditor verdict.
- Required constraints.
- One slice payload.
- Allowed `write_scope`.

Output:

- Production diff.
- Touched files.
- Verification results.
- Residual risk notes.

Do not weaken approved tests or reinterpret the contract. Parallel implementation is allowed only when selected slices have disjoint `write_scope`; shared production files require one integrator.

