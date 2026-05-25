---
name: sabaki-workflows
description: Sabaki project contract-first workflow guardrails. Use when Codex is asked to implement, test, review, or plan Sabaki business/state/architecture work, workbench wiring, or frontend UI/CSS/layout/design-token/responsive/screenshot visual work that should follow the migrated Claude workflows.
---

# Sabaki Workflows

Use this skill before making Sabaki changes that touch business behavior, state flow, architecture boundaries, tests, Workbench wiring, UI/CSS/layout, design tokens, responsive behavior, screenshots, or visual fidelity.

This skill is the Codex-native migration of the repository's `.claude` workflows. `.claude` remains as a historical source, but Codex should use this skill and the repository `AGENTS.md` as the active entry points.

## Workflow Selection

- Use `references/business-contract-workflow.md` for business behavior, state, resolver/store/service boundaries, side effects, core interactions, and architecture-sensitive implementation.
- Use `references/workbench-wiring-workflow.md` when already-drawn Workbench UI must be wired to real training business state and services.
- Use `references/frontend-visual-workflow.md` for UI, CSS, layout, design tokens, responsive behavior, Figma/screenshot/spec fidelity, and pure visual drift work.
- If a task mixes behavior and visuals, split by risk: run business or wiring workflow for state/behavior first, then frontend visual workflow for visible surface changes.

## Role References

Load only the references needed for the selected workflow.

- Contract and test roles:
  - `references/contract-designer.md`
  - `references/contract-auditor.md`
  - `references/test-writer.md`
  - `references/test-auditor.md`
  - `references/implementation-agent.md`
  - `references/architecture-reviewer.md`
- Frontend visual roles:
  - `references/frontend-design-source-reader.md`
  - `references/frontend-contract-designer.md`
  - `references/visual-test-writer.md`
  - `references/frontend-implementation-agent.md`
  - `references/visual-fidelity-reviewer.md`

## Codex Role Semantics

The migrated `*-agent` names are workflow role references. Most roles are executed directly by the main Codex agent, but contract design and review gates must be delegated to independent Codex subagents so the workflow has a real second pass.

Always spawn a subagent for:

- `contract-designer`
- `frontend-contract-designer`
- `contract-auditor`
- `test-auditor`
- `architecture-reviewer`
- `visual-fidelity-reviewer`

Do not spawn subagents for other roles by default. The main Codex agent should execute `test-writer`, `visual-test-writer`, `implementation-agent`, `frontend-implementation-agent`, and `frontend-design-source-reader` directly.

## Model Policy

When delegating required role work to Codex subagents, use GPT models only.

- Required subagents use `gpt-5.5` with `reasoning_effort=xhigh`.
- Do not assign Zhipu / GLM models to subagents; they may hang in this workflow. Zhipu is allowed only as the main session model.

## Execution Rules

- Do not skip directly to implementation for business/state/architecture work. Produce or read the contract first, write tests second, then implement.
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
