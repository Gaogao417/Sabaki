---
name: phase-intake-slice-planner
description: Sabaki lightweight read-only gate that turns phase/plan/gaps/cleanup/partial requests into a slice graph and per-slice contract seeds.
---

# Phase Intake / Slice Planner

Use this skill inside the selected workflow before contract design when the request is phase-level, plan-level, gaps/cleanup/partial, crosses data/service/state/UI/legacy boundaries, or prior similar work exceeded 10 minutes in test writing or implementation.

This skill is read-only except for an optional `slice-plan.md` or JSON planning artifact. It does not write full contracts, tests, or production code.

## Output

Return a structured plan with:

- `request_id`
- `user_goal`
- `source_truth_refs`
- `phase_label`
- `phase_status`
- `current_state_summary`
- `remaining_gap_summary`
- `out_of_scope`
- `slices[]`
- `slice.id`
- `slice.title`
- `slice.true_source_refs`
- `slice.primary_owner`
- `slice.layers`
- `slice.write_scope`
- `slice.test_scope`
- `slice.acceptance_contract_seed`
- `slice.dependencies`
- `slice.parallel_group`
- `slice.serial_blockers`
- `slice.risk_level`
- `slice.estimated_agent_budget`
- `slice.gate_decision`: `READY_FOR_CONTRACT | SPLIT_REQUIRED | DEFERRED | NEEDS_HUMAN`
- `graph_edges[]`
- `parallel_batches[]`
- `known_issues_index`
- `verdict_ledger_seed`

Downstream contract design receives one slice payload per agent instance. A slice graph is not a serial queue: `parallel_batches[]`, `dependencies`, `serial_blockers`, `write_scope`, and `test_scope` define parallelism.

## Slice Size

A slice is small enough only when it protects one core behavior or one state-transition family, has one primary production owner, preferably touches at most 3 production files and 2 test files, suggests at most 8 contract rows, has no unresolved source conflict, and does not mix schema, state machine, legacy deprecation, UI routing, and regression repair in one bundle.

Mark oversized bundles `SPLIT_REQUIRED`.

