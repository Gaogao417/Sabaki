---
name: sabaki-workflows
description: Sabaki project contract-first workflow guardrails. Use when Codex is asked to implement, test, review, plan, split phases, triage gaps, run phase intake, or build slice plans for Sabaki business/state/architecture work, workbench wiring, or frontend UI/CSS/layout/design-token/responsive/screenshot visual work.
---

# Sabaki Workflows

Use this skill before making Sabaki changes that touch business behavior, state flow, architecture boundaries, tests, Workbench wiring, UI/CSS/layout, design tokens, responsive behavior, screenshots, or visual fidelity.

This skill is the Codex-native migration of the repository's `.claude` workflows. `.claude` remains as a historical source, but Codex should use this skill and the repository `AGENTS.md` as the active entry points.

## Authority Boundary

`AGENTS.md` is the repository bootstrap and hard-boundary file. It should not duplicate workflow order, model policy, slice planning, gate ledger rules, role prompts, or frontend/Workbench process details.

This skill is the single workflow source of truth. Keep request classification, phase intake, slice planning, role sequencing, model/subagent policy, audit gates, commit boundaries, and workflow-specific acceptance rules here and in the directly linked reference files.

## Workflow Selection

- Use `references/business-contract-workflow.md` for business behavior, state, resolver/store/service boundaries, side effects, core interactions, and architecture-sensitive implementation.
- Use `references/workbench-wiring-workflow.md` when already-drawn Workbench UI must be wired to real training business state and services.
- Use `references/frontend-visual-workflow.md` for UI, CSS, layout, design tokens, responsive behavior, Figma/screenshot/spec fidelity, and pure visual drift work.
- If a task mixes behavior and visuals, split by risk: run business or wiring workflow for state/behavior first, then frontend visual workflow for visible surface changes.

## Role Skills and References

This skill is the required workflow entry point. For Sabaki workflow work, load `$sabaki-workflows` before any role skill. Each workflow role has its own Codex skill. Use the named role skill before executing that role. When spawning a subagent, the subagent's initial prompt must explicitly mention both this workflow skill and the role skill, for example `Use $sabaki-workflows and $contract-auditor`.

The role skills load the canonical references in this skill directory. Load only the references needed for the selected workflow.

- Contract and test roles:
  - `$phase-intake-slice-planner` -> `references/phase-intake-slice-planner.md`
  - `$contract-designer` -> `references/contract-designer.md`
  - `$contract-auditor` -> `references/contract-auditor.md`
  - `$test-writer` -> `references/test-writer.md`
  - `$test-auditor` -> `references/test-auditor.md`
  - `$implementation-agent` -> `references/implementation-agent.md`
  - `$architecture-reviewer` -> `references/architecture-reviewer.md`
- Frontend visual roles:
  - `$frontend-design-source-reader` -> `references/frontend-design-source-reader.md`
  - `$frontend-contract-designer` -> `references/frontend-contract-designer.md`
  - `$visual-test-writer` -> `references/visual-test-writer.md`
  - `$frontend-implementation-agent` -> `references/frontend-implementation-agent.md`
  - `$visual-fidelity-reviewer` -> `references/visual-fidelity-reviewer.md`

## Codex Role Semantics

The migrated `*-agent` names are workflow role skills. Most roles are executed directly by the main Codex agent, but contract design and review gates must be delegated to independent Codex subagents so the workflow has a real second pass.

Always spawn a subagent for:

- `contract-designer`
- `frontend-contract-designer`
- `contract-auditor`
- `test-auditor`
- `architecture-reviewer`
- `visual-fidelity-reviewer`

Do not spawn subagents for other roles by default. The main Codex agent should execute `phase-intake-slice-planner`, `test-writer`, `visual-test-writer`, `implementation-agent`, `frontend-implementation-agent`, and `frontend-design-source-reader` directly, after loading `$sabaki-workflows` and the corresponding role skill.

## Model Policy

When delegating required role work to Codex subagents, use GPT models only.

- Required subagents use `gpt-5.5` with `reasoning_effort=xhigh`.
- Do not assign Zhipu / GLM models to subagents; they may hang in this workflow. Zhipu is allowed only as the main session model.

## Execution Rules

- Do not skip directly to implementation for business/state/architecture work. Produce or read the contract first, write tests second, then implement.
- Do not execute a Sabaki workflow role without `$sabaki-workflows` already loaded. Subagent prompts must include both `$sabaki-workflows` and the role skill.
- Do not send phase-level, plan-level, gaps, cleanup, or partial-completion requests directly to `contract-designer`. Use `$phase-intake-slice-planner` first, then contract per slice.
- Maintain a gate ledger for every workflow slice. `REQUEST_CHANGES` and `BLOCK` pause that slice until revision and re-audit. `APPROVE_WITH_NOTES` may continue only after notes are copied into downstream `required_constraints`; notes about source mismatch, scope risk, or test weakness require human confirmation.
- Architecture review verdicts are gate verdicts. A final `REQUEST_CHANGES` or `BLOCK` from `$architecture-reviewer` must be recorded and handled, not treated as a non-blocking summary.
- If any agent spends more than 10 minutes on a slice, mark `slice_too_large`; the next attempt must return to `$phase-intake-slice-planner` or split the slice before continuing.
- If one slice hits repeated harness/test infrastructure failures, return to `$test-auditor` before further implementation.
- Do not use the generic business workflow for pure frontend visual work. Use the visual workflow so acceptance is based on what users see, not on class names or `data-testid`.
- Use the Workbench wiring workflow when the task is connecting already-drawn Workbench UI to real training business state.
- Keep tests and implementation in separate commits when committing is part of the task: test contract/tests first, implementation second.
- Do not auto-commit from stop hooks. If committing is needed, do it explicitly at the workflow step.
- Preserve `.claude` files unless the user explicitly asks to remove or deprecate them.

## Acceptance Bar

- Business acceptance must protect behavior, state ownership, resolver/executor/service boundaries, side-effect placement, and test legitimacy.
- Workbench wiring acceptance must prove controls drive business state and business state drives UI, not merely that callbacks fire.
- Frontend acceptance must protect token values, computed styles, layout dimensions, copy, responsive behavior, screenshots, and visible state changes.
- Review roles must lead with blocking findings and file/line evidence. If no issues are found, say so and list residual risks or unrun tests.
