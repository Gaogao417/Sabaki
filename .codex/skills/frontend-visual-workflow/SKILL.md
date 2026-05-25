---
name: frontend-visual-workflow
description: Sabaki frontend visual workflow. Use for UI, CSS, layout, design-token, responsive, screenshot, Figma/spec fidelity, and visual drift work.
---

# Frontend Visual Workflow

Use this workflow for UI, CSS, layout, design-token, responsive, screenshot, Figma/spec fidelity, and pure visual drift work.

Do not use this workflow for Workbench wiring. Visual tests can catch regressions, but they do not prove wiring.

## Role Order And Interfaces

1. `$frontend-design-source-reader`
   - Input: user goal, UI/UX specs, screenshots/Figma refs if any, current CSS/components.
   - Output: visual source index with exact source refs, dimensions, tokens, copy, states, responsive expectations, and current implementation gaps.

2. `agent:frontend-contract-designer`
   - Input: visual source index and task scope.
   - Output: frontend visual contract at `docs/archive/daily-design/YYYY-MM-DD/<task-name>/frontend-visual-contract-v0.N.md` with token/style/layout/screenshot/manual acceptance rows.
   - Must protect visible behavior, not class names or `data-testid` existence.

3. `$visual-test-writer`
   - Input: approved visual contract and allowed test scope.
   - Output: static token tests, CSS/static parsing tests, computed-style tests, Playwright layout/screenshot tests, and manual acceptance notes.
   - Does not edit production code.

4. `$frontend-implementation-agent`
   - Input: approved visual contract, visual tests, required constraints, allowed write scope.
   - Output: UI/CSS/component diff plus browser/screenshot verification.

5. `agent:visual-fidelity-reviewer`
   - Input: stable frontend diff, screenshots, visual tests, visual contract.
   - Output: `APPROVE | APPROVE_WITH_NOTES | REQUEST_CHANGES | BLOCK`.

## Acceptance Bar

Primary frontend acceptance must fail when the user-visible UI violates the spec. Component existence, callback count, class string, or `data-testid` checks are only auxiliary.
