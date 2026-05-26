---
name: business-contract-workflow
description: Sabaki business/state/architecture workflow. Use for business behavior, state flow, resolver/store/service boundaries, side effects, core interaction contracts, and architecture-sensitive implementation.
---

# Business Contract Workflow

Use this workflow for business behavior, state flow, resolver/store/service boundaries, side effects, core interaction contracts, and architecture-sensitive implementation.

Do not use this workflow for pure UI/CSS/layout/design-token/screenshot fidelity work; use `$frontend-visual-workflow`. Do not use it for already-drawn Workbench UI wiring; use `$workbench-wiring-workflow`.

## Checklist-Driven Dispatch

The planner writes a task-specific checklist at `docs/workflow-checklists/<YYYY-MM-DD>-<task-slug>.md`. The main agent MUST follow this loop on every turn:

1. Read the current task's checklist file. If no path is already known, find the matching task checklist under `docs/workflow-checklists/` by task slug/title; only fall back to `docs/.workflow-checklist.md` when it is clearly a legacy pointer for the same task.
2. Find the first `- [ ]` step.
3. Dispatch the corresponding role for that step.
4. After the subagent returns, check off the step: `- [x]`.
5. If a review step returns REQUEST_CHANGES or BLOCK:
   - Add a retry entry in `## Retries`.
   - Un-check the upstream step (set back to `- [ ]`).
   - Re-dispatch the upstream step with review feedback appended.
   - Maximum 3 retries per step. After 3 retries, mark FAILED and stop.
6. Write the updated checklist back to the same task-specific checklist file.
7. If there is a next unchecked step, immediately dispatch it in the same turn. Do not stop to report progress or wait for user confirmation between steps.
8. When all steps are checked, report completion to the user.

The main agent MUST NOT stop between steps unless all steps are done or a step has FAILED after 3 retries.

Never overwrite another task's checklist. `docs/.workflow-checklist.md` is legacy-only and must not be used as a global mutable queue for new business/state tasks.

## Role Order

1. Request classifier
   - Runs in the main session from `AGENTS.md`.
   - Input: user goal and changed files.
   - Output: `workflow`, `intake_required`, `small_step_reason`.

2. `$phase-intake-slice-planner` when needed
   - Trigger for phase/plan/gaps/cleanup/partial/cross-boundary work.
   - Output: `slice-plan.md` or JSON/Markdown with `step1..stepN`. Parallel work is written as dotted substeps such as `step2.1..step2.N`.
   - The planner output is a dispatch plan: every step says what it does, whether it is serial or parallel, dependencies, shared locks/owner, and the next workflow role.
   - Does not replace normal test and implementation judgment.

3. Step dispatch
   - Runs in the main session.
   - Selects the next ready top-level step or dotted step group.
   - Fans out independent dotted steps when the user explicitly requested parallel agent work, or handles them serially in the main session.
   - Do not collapse multiple ready steps into one umbrella contract unless the planner marks them indivisible.
   - Blocks or splits any oversized step before contract design.
   - Shared write scopes require a later named integrator step.

4. Contract sketch
   - Input: exactly one step payload, unless an explicitly read-only independent set is safe.
   - Output: archived contract at `docs/archive/daily-design/YYYY-MM-DD/<task-name>/test-contract-v0.N.md`, source alignment, test rows, mock policy, RED/GREEN/DEFERRED table, downstream `required_constraints`.

5. `$test-writer`
   - Input: contract sketch, one step payload, allowed test scope.
   - Output: test diff, harness/mock manifest, expected RED/GREEN/DEFERRED status, test command list.
   - May run in parallel only when selected dotted steps are in the same ready group and have disjoint test scope; otherwise use one test integrator step.

6. Test review
   - Input: contract sketch, test diff, mock manifest.
   - Output: findings and fixes for fake-green, wrong-layer mocks, and missing state-forward/state-return coverage.

7. `$implementation-agent`
   - Input: contract sketch, tests, review notes, one step payload, allowed write scope.
   - Output: production diff, touched files, verification result, residual risk notes.
   - May run in parallel only when selected dotted steps are in the same ready group and have disjoint write scope; shared production files require one named integrator step.

8. Verification
   - Run step tests first, then related regressions, then necessary smoke.

9. Architecture review
   - Input: stable implementation diff, contracts, tests.
   - Output: boundary findings, requested fixes, and residual risks.

Archived, draft, superseded, or `pending-confirmation` contracts are background only.
