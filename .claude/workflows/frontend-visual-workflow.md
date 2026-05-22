# Frontend Visual Workflow

Use this workflow for UI, CSS, layout, design-token, responsive, screenshot, and visual fidelity work.

Do not use the generic `contract-designer -> test-writer -> implementation-agent -> architecture-reviewer` flow for pure frontend visual work. That flow protects business and architecture contracts; it is not sufficient for UI fidelity.

Do not use this workflow for Workbench wiring. If the task is to connect finished controls to controller/service/store behavior, use `workbench-wiring-workflow.md` instead. Visual tests may verify visible regressions, but they do not prove wiring.

## When To Use

Use this workflow for:

- Workbench shell, toolbar, bottom bar, side panels, drawers, board stage.
- CSS token migration or visual token enforcement.
- UI/UX spec implementation.
- Screenshot or Figma-to-code work.
- Pure style drift audits and fixes.

## Agent Order

1. `frontend-design-source-reader`
   - Reads UI/UX spec, screenshots, design references, current CSS, and current components.
   - Produces a visual source index.

2. `frontend-contract-designer`
   - Converts the visual source index into a frontend visual contract.
   - Archives it at `docs/archive/daily-design/YYYY-MM-DD/<task>/frontend-visual-contract-v0.N.md`.

3. `visual-test-writer`
   - Converts the approved visual contract into tests.
   - Writes static token tests, computed-style tests, Playwright layout tests, screenshot tests, and manual acceptance notes.
   - Does not edit production code.

4. `frontend-implementation-agent`
   - Implements UI/CSS/components against the approved visual contract and tests.
   - Must run relevant tests and browser/screenshot checks.

5. `visual-fidelity-reviewer`
   - Reviews the final diff against UI/UX spec, token rules, responsive behavior, screenshots, and test quality.
   - Does not edit files.

## Required Acceptance Layers

Every non-trivial frontend task should classify acceptance into these layers:

- Static token checks.
- CSS static parsing checks.
- DOM copy and semantics checks.
- Computed style checks.
- Playwright layout checks.
- Playwright screenshot checks.
- Manual screenshot acceptance.

## Anti-Patterns

Do not accept these as primary frontend tests:

- Component exists.
- `data-testid` exists.
- class string exists.
- button count matches.
- callback fires.
- CSS contains a media query string.

These are allowed only as auxiliary tests. The primary tests must fail when the UI visibly violates the spec.

## Done Definition

Frontend work is done only when:

- The approved visual contract is represented in tests or manual acceptance notes.
- Relevant tests have been run.
- Browser/screenshot verification has been performed for the specified viewports.
- The implementation uses the correct design tokens and does not spread hardcoded mode colors.
- A visual-fidelity review has no blocking findings.
