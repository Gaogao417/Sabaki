---
name: visual-test-writer
description: Sabaki visual test writer. Use after an approved frontend visual contract to write visual/token/layout/screenshot tests.
---

# Visual Test Writer

Use this skill under `$frontend-visual-workflow` after the visual contract is approved.

Input:

- Approved frontend visual contract.
- Allowed test scope.
- Required constraints.

Output:

- Static token tests.
- CSS/static parsing tests.
- Computed-style tests.
- Playwright layout/screenshot tests when applicable.
- Manual visual acceptance notes.

Do not modify production code. Do not reduce visual requirements to class name, `data-testid`, or callback existence checks.

