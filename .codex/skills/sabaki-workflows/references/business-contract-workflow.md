# Business Contract Workflow

Use this workflow for business behavior, state flow, resolver/store/service boundaries, side effects, core interaction contracts, and architecture-sensitive implementation.

Do not use this workflow for pure UI/CSS/layout/design-token/screenshot fidelity work. Use `frontend-visual-workflow.md` for those tasks. Do not use it for Workbench UI-to-training-business wiring; use `workbench-wiring-workflow.md`.

## Required Order

0. Request classification and slice intake
   - If the request is phase-level, plan-level, gaps, cleanup remaining, contract gaps remaining, partial, or likely to cross data/service/state/UI/legacy boundaries, use `$sabaki-workflows` and `$phase-intake-slice-planner` in the main Codex session before contract design.
   - The intake is lightweight and read-only. It outputs `SINGLE_SLICE` for small tasks, or a slice graph with contract seeds for larger tasks.
   - `contract-designer` must receive one slice, or an explicitly independent set of slices safe for parallel contracts. Do not pass a whole `Phase N gaps` bundle downstream.

1. Contract design per slice
   - Spawn a subagent with `model=gpt-5.5`, `reasoning_effort=xhigh`, and an initial prompt that explicitly says `Use $sabaki-workflows and $contract-designer`.
   - Pass the selected slice id, source refs, write scope, test scope, dependencies, and acceptance contract seed from the slice plan.
   - Convert the feature request into a user story, actions, phases, position sources, mutation contract, expected state flow, allowed side effects, forbidden side effects, tests, and acceptance criteria.
   - Archive the contract at `docs/design/YYYY-MM-DD/<task-name>/test-contract-v0.N.md`.

2. Contract audit
   - Spawn a subagent with `model=gpt-5.5`, `reasoning_effort=xhigh`, and an initial prompt that explicitly says `Use $sabaki-workflows and $contract-auditor`.
   - Fix and re-audit if the result is REQUEST_CHANGES or BLOCK.
   - Copy APPROVE_WITH_NOTES constraints into the slice gate ledger before test writing.

3. Test writing
   - Use `$sabaki-workflows` and `$test-writer` in the main Codex session.
   - Read the archived contract as the only source of truth.
   - Write contract tests before production changes.
   - Do not modify production code in this step.

4. Test audit
   - Spawn a subagent with `model=gpt-5.5`, `reasoning_effort=xhigh`, and an initial prompt that explicitly says `Use $sabaki-workflows and $test-auditor`.
   - Fix and re-audit invalid, weak, or implementation-bound tests.
   - Copy APPROVE_WITH_NOTES constraints into downstream implementation prompts. Notes about source mismatch, scope risk, or test weakness require human confirmation.

5. Test commit
   - Run the relevant tests when useful; expected failures are allowed if implementation is missing.
   - Commit only the contract/test changes if the user asked for commits or the task requires the repository workflow.

6. Implementation
   - Use `$sabaki-workflows` and `$implementation-agent` in the main Codex session.
   - Implement the smallest production change that satisfies the approved contract and tests.
   - Do not weaken approved tests or revise the contract without explicit approval.

7. Verification
   - Run the relevant tests.
   - Fix production code until the relevant tests pass, unless a test is demonstrably invalid.

8. Implementation commit
   - Commit implementation changes separately from tests when committing is part of the task.

9. Architecture review
   - Spawn a subagent with `model=gpt-5.5`, `reasoning_effort=xhigh`, and an initial prompt that explicitly says `Use $sabaki-workflows and $architecture-reviewer`.
   - Review the final diff for architecture boundary, side-effect, state ownership, hidden global, and test-legitimacy risks.
   - Record the verdict in the gate ledger. REQUEST_CHANGES and BLOCK are blocking verdicts.

## Codex Delegation Guidance

These names are workflow roles. Delegate only the contract design and review gates; execute test writing and implementation directly in the main Codex session.

- `$phase-intake-slice-planner`: do not spawn; main Codex agent runs this lightweight read-only gate after loading `$sabaki-workflows` and `$phase-intake-slice-planner`.
- `$contract-designer`: spawn a Codex subagent with `model=gpt-5.5`, `reasoning_effort=xhigh`, and prompt `Use $sabaki-workflows and $contract-designer`.
- `$contract-auditor`: spawn a Codex subagent with `model=gpt-5.5`, `reasoning_effort=xhigh`, and prompt `Use $sabaki-workflows and $contract-auditor`.
- `$test-writer`: do not spawn; main Codex agent writes tests after loading `$sabaki-workflows` and `$test-writer`.
- `$test-auditor`: spawn a Codex subagent with `model=gpt-5.5`, `reasoning_effort=xhigh`, and prompt `Use $sabaki-workflows and $test-auditor`.
- `$implementation-agent`: do not spawn; main Codex agent implements after loading `$sabaki-workflows` and `$implementation-agent`.
- `$architecture-reviewer`: spawn a Codex subagent with `model=gpt-5.5`, `reasoning_effort=xhigh`, and prompt `Use $sabaki-workflows and $architecture-reviewer`.

Do not delegate any role to Zhipu / GLM.

## Gate Ledger

- `REQUEST_CHANGES` / `BLOCK`: pause the affected slice, revise the relevant artifact, and re-audit before continuing downstream.
- `APPROVE_WITH_NOTES`: continue only after the notes are added to downstream `required_constraints`; require human confirmation for source mismatch, scope risk, or test weakness.
- User takeover resumes only the current slice's next minimal action. Do not widen scope after takeover.
- Any agent over 10 minutes marks `slice_too_large`; split before the next attempt.
- Repeated harness/test infrastructure failures return to `$test-auditor`.

## Done Definition

Business work is done only when any required phase intake has produced a slice graph or `SINGLE_SLICE`, each selected slice has an approved contract represented in tests, implementation satisfies those tests, architecture boundaries are reviewed, and any gate ledger entries, unrun checks, or residual risks are reported.
