---
name: business-contract-workflow
description: Sabaki business/state/architecture workflow. Use for business behavior, state flow, resolver/store/service boundaries, side effects, core interaction contracts, and architecture-sensitive implementation.
---

# Business Contract Workflow

Use this workflow for business behavior, state flow, resolver/store/service boundaries, side effects, core interaction contracts, and architecture-sensitive implementation.

Do not use this workflow for pure UI/CSS/layout/design-token/screenshot fidelity work; use `$frontend-visual-workflow`. Do not use it for already-drawn Workbench UI wiring; use `$workbench-wiring-workflow`.

## Role Order

1. Request classifier
   - Runs in the main session from `AGENTS.md`.
   - Input: user goal, changed files, current gate ledger.
   - Output: `workflow`, `intake_required`, `small_task_reason`.

2. `$phase-intake-slice-planner` when needed
   - Trigger for phase/plan/gaps/cleanup/partial/cross-boundary work.
   - Output: `slice-plan.md` or JSON with `slices[]`, `dependencies`, `parallel_batches[]`, `serial_blockers`, `write_scope`, `test_scope`, `acceptance_contract_seed`, and `verdict_ledger_seed`.
   - Does not unlock test or production edits.

3. Slice gate
   - Runs in the main session.
   - Selects the next ready batch from `parallel_batches[]`.
   - Fans out independent slices by spawning multiple instances of the same downstream gate agent.
   - Blocks or splits any slice bundle before contract design.

4. `agent:contract-designer`
   - Independent custom agent at `.codex/agents/contract-designer.toml`.
   - Input: exactly one slice payload, unless an explicitly read-only independent set is safe.
   - Output: archived contract at `docs/archive/daily-design/YYYY-MM-DD/<task-name>/test-contract-v0.N.md`, source alignment, test rows, mock policy, RED/GREEN/DEFERRED table, downstream `required_constraints`.

5. `agent:contract-auditor`
   - Input: contract path, source truth refs, slice payload, gate ledger.
   - Output: `APPROVE | APPROVE_WITH_NOTES | REQUEST_CHANGES | BLOCK`.
   - `REQUEST_CHANGES` / `BLOCK` pauses that slice. `APPROVE_WITH_NOTES` must be copied into downstream constraints.

6. `$test-writer`
   - Input: approved contract, audit constraints, one slice payload, allowed `test_scope`.
   - Output: test diff, harness/mock manifest, expected RED/GREEN/DEFERRED status, test command list.
   - May run in parallel only when selected slices have disjoint `test_scope`; otherwise use one test integrator.

7. `agent:test-auditor`
   - Input: approved contract, test diff, mock manifest, ledger constraints.
   - Output: `APPROVE | APPROVE_WITH_NOTES | REQUEST_CHANGES | BLOCK`.
   - Implementation remains blocked until approval and edit gate check.

8. `$implementation-agent`
   - Input: approved contract, approved tests, test-audit constraints, one slice payload, allowed `write_scope`.
   - Output: production diff, touched files, verification result, residual risk notes.
   - May run in parallel only with disjoint `write_scope`; shared production files require one integrator.

9. Verification
   - Run slice tests first, then related regressions, then necessary smoke.

10. `agent:architecture-reviewer`
   - Input: stable implementation diff, contracts, tests, gate ledger.
   - Output: gate verdict, blocking findings, residual risks.

## Edit Gate

Before test edits, contract and contract audit must be approved and the current role must be `$test-writer`.

Before production edits, contract, contract audit, tests, and test audit must be approved and the current role must be `$implementation-agent`.

Archived, draft, superseded, or `pending-confirmation` contracts are background only.
