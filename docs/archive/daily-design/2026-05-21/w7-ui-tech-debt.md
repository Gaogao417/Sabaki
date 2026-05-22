# W7 Known Tech Debt: CSS/UI Test Failures

Date: 2026-05-21
Status: open
Origin: W7 Architecture Review discovered 34 pre-existing CSS/UI test failures

## Summary

34 tests fail in `test/workbench/` subdirectories. These failures are from previous UI phases and are NOT related to W7 wiring work. They were hidden because `npm test` previously used a non-recursive glob that missed `test/workbench/` subdirectories.

## Failure Breakdown

| Category | Count | Test Files | Root Cause |
|---|---|---|---|
| CSS Design Atoms (G-02, C-03, C-04, S-02, S-04, T-02) | 6 | `test/workbench/css-design-atoms.test.js` | CSS variables/classes not matching test expectations after CSS refactoring |
| CSS Color Variables (T-1.1a-f) | 7 | `test/workbench/css-colors.test.js` | CSS custom properties defined in `[data-mode="..."]` blocks, not `:root`; hardcoded color alignment |
| Component Rendering (panels, toolbars, headers) | 19 | `test/workbench/panels/*.test.js`, `test/workbench/shell/*.test.js` | Component rendering results don't match test expectations (Chinese labels, button counts, CSS class structures) |
| Phase 0 Migration (T-14, T-15) | 2 | `test/training/*.test.js` | Repository roundtrip with real SQLite — possibly schema changes |

## Impact on W7

None. W7 wiring tests (W2-W6, W35, B1, B2) all pass. The 34 failures are:
- UI visual/CSS tests from UI phases 1-7
- Not architecture boundary tests
- Not wiring tests
- Not blocking W7 acceptance

## Recommended Resolution

- CSS/UI failures should be addressed in a dedicated CSS/UI tech debt cleanup sprint
- Phase 0 migration failures should be investigated separately
- None block W7 completion

## Test Command

```bash
npx mocha --require tsx --recursive "test/**/*.test.js" 2>&1 | grep "failing"
# Current: 1420 passing, 34 failing
```
