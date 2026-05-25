# Business Contract Workflow

Use this workflow for business behavior, state flow, resolver/store/service boundaries, side effects, core interaction contracts, and architecture-sensitive implementation.

Do not use this workflow for pure UI/CSS/layout/design-token/screenshot fidelity work. Use `frontend-visual-workflow.md` for those tasks. Do not use it for Workbench UI-to-training-business wiring; use `workbench-wiring-workflow.md`.

## Required Order

1. Contract design
   - Load `contract-designer.md`.
   - Convert the feature request into a user story, actions, phases, position sources, mutation contract, expected state flow, allowed side effects, forbidden side effects, tests, and acceptance criteria.
   - Archive the contract at `docs/design/YYYY-MM-DD/<task-name>/test-contract-v0.N.md`.

2. Contract audit
   - Load `contract-auditor.md`.
   - Fix and re-audit if the result is REQUEST_CHANGES or BLOCK.

3. Test writing
   - Load `test-writer.md`.
   - Read the archived contract as the only source of truth.
   - Write contract tests before production changes.
   - Do not modify production code in this step.

4. Test audit
   - Load `test-auditor.md`.
   - Fix and re-audit invalid, weak, or implementation-bound tests.

5. Test commit
   - Run the relevant tests when useful; expected failures are allowed if implementation is missing.
   - Commit only the contract/test changes if the user asked for commits or the task requires the repository workflow.

6. Implementation
   - Load `implementation-agent.md`.
   - Implement the smallest production change that satisfies the approved contract and tests.
   - Do not weaken approved tests or revise the contract without explicit approval.

7. Verification
   - Run the relevant tests.
   - Fix production code until the relevant tests pass, unless a test is demonstrably invalid.

8. Implementation commit
   - Commit implementation changes separately from tests when committing is part of the task.

9. Architecture review
   - Load `architecture-reviewer.md`.
   - Review the final diff for architecture boundary, side-effect, state ownership, hidden global, and test-legitimacy risks.

## Codex Delegation Guidance

These names are workflow roles. Execute them directly unless subagents are useful. When subagents are explicitly appropriate, use GPT models only:

- `contract-designer`: default `gpt-5.5` fast mode; escalate to `gpt-5.5-pro` `xhigh` for high-risk contracts.
- `contract-auditor`: default `gpt-5.5` fast mode; escalate to `gpt-5.5-pro` `xhigh` for high-risk contract audits.
- `test-writer`: default `gpt-5.5` fast mode.
- `test-auditor`: default `gpt-5.5` fast mode; escalate to `gpt-5.5-pro` `xhigh` for high-risk test audits.
- `implementation-agent`: default `gpt-5.5` fast mode.
- `architecture-reviewer`: default `gpt-5.5` fast mode; escalate to `gpt-5.5-pro` `xhigh` for high-risk reviews.

Do not delegate any role to Zhipu / GLM.

## Done Definition

Business work is done only when the approved contract is represented in tests, implementation satisfies those tests, architecture boundaries are reviewed, and any unrun checks or residual risks are reported.
