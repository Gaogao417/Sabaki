---
name: frontend-visual-workflow
description: Sabaki frontend visual workflow. Use for UI, CSS, layout, design-token, responsive, screenshot, Figma/spec fidelity, and visual drift work.
---

# Frontend Visual Workflow

Use this workflow for UI, CSS, layout, design-token, responsive, screenshot, Figma/spec fidelity, and pure visual drift work.

Do not use this workflow for Workbench wiring. Visual tests can catch regressions, but they do not prove wiring.

## Role Order And Interfaces

0. `$phase-intake-slice-planner` when needed
   - Required for phase/plan/gaps/cleanup/partial/cross-boundary visual work, multi-screen work, or any visual request with separable component/CSS/responsive/test surfaces.
   - Output: executable `step1..stepN` plan. Parallel work is written as dotted substeps such as `step2.1..step2.N`.
   - The planner output is the dispatch plan. It must say what each visual step does, whether it is serial or parallel, dependencies, shared locks/owner, and the next role.
   - Do not collapse multiple ready steps into one umbrella visual contract unless the planner marks them indivisible.
   - Shared CSS/token/component files require one later integrator step; other steps must avoid those files or wait for handoff.

1. `$frontend-design-source-reader`
   - Input: user goal or one planner step payload, UI/UX specs, screenshots/Figma refs if any, current CSS/components.
   - Output: visual source index with exact source refs, dimensions, tokens, copy, states, responsive expectations, and current implementation gaps.

2. Visual contract sketch
   - Input: visual source index and one step scope.
   - Output: frontend visual contract at `docs/archive/daily-design/YYYY-MM-DD/<task-name>/frontend-visual-contract-v0.N.md` with token/style/layout/screenshot/manual acceptance rows.
   - Must protect visible behavior, not class names or `data-testid` existence.

3. `$visual-test-writer`
   - Input: visual contract sketch and allowed test scope.
   - Output: static token tests, CSS/static parsing tests, computed-style tests, Playwright layout/screenshot tests, and manual acceptance notes.
   - Does not edit production code.
   - May run in parallel only for dotted steps in the same ready group with disjoint test scope; otherwise use the named visual test integrator step.

4. `$frontend-implementation-agent`
   - Input: visual contract sketch, visual tests, required constraints, allowed write scope.
   - Output: UI/CSS/component diff plus browser/screenshot verification.
   - May run in parallel only for dotted steps in the same ready group with disjoint write scope; shared visual files require one named integrator step.

5. Visual review
   - Input: stable frontend diff, screenshots, visual tests, visual contract.
   - Output: findings, requested fixes, and residual risks.

## Acceptance Bar

Primary frontend acceptance must fail when the user-visible UI violates the spec. Component existence, callback count, class string, or `data-testid` checks are only auxiliary.
