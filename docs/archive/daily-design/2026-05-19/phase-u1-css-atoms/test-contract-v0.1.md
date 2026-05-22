# Phase U1: CSS Design Atom Supplement — Test Contract v0.1

**Date**: 2026-05-19
**Branch**: `codex-ui-ux-frontend`
**Scope**: Append-only additions to `style/workbench.css`
**Agent**: `ui-design-atom-writer`

---

## 1. Deliverables

Five families of CSS design atoms added to `style/workbench.css` (append-only, no modification to existing rules):

| # | Class Family | Members | Purpose |
|---|-------------|---------|---------|
| 1 | `.wb-card` | base, `--flat`, `--compact` | Reusable card container for panel content |
| 2 | `.wb-segmented-control` | container, `__item`, `__item--active` | Segmented control used by ModeBar and future controls |
| 3 | `.wb-stone-indicator` | base, `--black`, `--white`, `--inline` | Small stone icon for captures / status display |
| 4 | `.wb-status-text` | base, `__label`, `__value`, `__divider` | Inline status line (label + value pairs) |
| 5 | `.wb-panel-title`, `.wb-panel-body`, `.wb-panel-caption` | (standalone) | Panel typography atoms |

---

## 2. Acceptance Criteria

### 2.1 Global Constraints

| ID | Criterion | Classification |
|----|-----------|----------------|
| G-01 | All new class names follow BEM convention with `wb-` prefix | MUST_AUTOMATE |
| G-02 | No hardcoded hex colors in new rules (except gradient stops in `.wb-stone-indicator`) | MUST_AUTOMATE |
| G-03 | All colors reference CSS custom properties (`var(--ui-*)`) | MUST_AUTOMATE |
| G-04 | Existing rules in `style/workbench.css` are unchanged (append-only) | MUST_AUTOMATE |

### 2.2 `.wb-card`

| ID | Criterion | Classification |
|----|-----------|----------------|
| C-01 | Background uses `var(--ui-card)` | MUST_AUTOMATE |
| C-02 | Border uses `var(--ui-border)` | MUST_AUTOMATE |
| C-03 | Border-radius uses `var(--radius-md)` | MUST_AUTOMATE |
| C-04 | Box-shadow uses `var(--ui-shadow-sm)` | MUST_AUTOMATE |
| C-05 | Padding is between 18px and 22px | MUST_AUTOMATE |
| C-06 | `--flat` variant removes box-shadow and border | MUST_AUTOMATE |
| C-07 | `--compact` variant reduces padding to <= 10px | MUST_AUTOMATE |

### 2.3 `.wb-segmented-control`

| ID | Criterion | Classification |
|----|-----------|----------------|
| S-01 | Container uses `display: inline-flex` | MUST_AUTOMATE |
| S-02 | Container has rounded corners (border-radius >= 6px) | MUST_AUTOMATE |
| S-03 | `__item` children have no visible border by default | MANUAL_ACCEPTANCE |
| S-04 | `__item--active` has solid background via `var(--segment-color)` | MUST_AUTOMATE |
| S-05 | `__item` has cursor: pointer and reasonable padding (6-14px) | MUST_AUTOMATE |

### 2.4 `.wb-stone-indicator`

| ID | Criterion | Classification |
|----|-----------|----------------|
| I-01 | Default size is 24px (width and height) | MUST_AUTOMATE |
| I-02 | `--inline` variant size is 16px | MUST_AUTOMATE |
| I-03 | `--black` uses radial-gradient for realistic black stone texture | MUST_AUTOMATE |
| I-04 | `--white` uses radial-gradient for realistic white stone texture | MUST_AUTOMATE |
| I-05 | Border-radius is 50% (circular) | MUST_AUTOMATE |
| I-06 | Gradient stops may use hardcoded hex values (allowed exception to G-02) | MANUAL_ACCEPTANCE |

### 2.5 `.wb-status-text`

| ID | Criterion | Classification |
|----|-----------|----------------|
| T-01 | Container uses `display: inline-flex` | MUST_AUTOMATE |
| T-02 | `__label` is 14px, font-weight bold | MUST_AUTOMATE |
| T-03 | `__value` is 13px, uses secondary color (`var(--ui-text-secondary)`) | MUST_AUTOMATE |
| T-04 | `__divider` renders as a vertical line (width 1px, height 12-16px) | MUST_AUTOMATE |
| T-05 | Children are vertically centered (align-items: center) | MUST_AUTOMATE |

### 2.6 Panel Typography

| ID | Criterion | Classification |
|----|-----------|----------------|
| P-01 | `.wb-panel-title` is 14px, font-weight bold | MUST_AUTOMATE |
| P-02 | `.wb-panel-body` is 12-13px, uses secondary color | MUST_AUTOMATE |
| P-03 | `.wb-panel-caption` is 12px, uses tertiary color (`var(--ui-text-tertiary)`) | MUST_AUTOMATE |

---

## 3. Test Strategy

### 3.1 Automated Tests (MUST_AUTOMATE)

Contract tests parse the CSS file and assert the presence and values of declarations for each class selector. Tests are located in `test/workbench-ui/`.

**Approach**: Parse `style/workbench.css` as text, use regex to extract rule blocks for each class, then assert expected property-value pairs.

```
describe('Phase U1 — CSS Design Atoms')
  describe('Global constraints')
    - G-01: all new selectors match /^\.wb-[a-z](-[a-z0-9]+)*$/
    - G-02: no hex colors except inside gradient stops
    - G-03: all color-like properties use var(--ui-*)
    - G-04: existing rule count unchanged (snapshot baseline)

  describe('.wb-card')
    - C-01 through C-07

  describe('.wb-segmented-control')
    - S-01, S-02, S-04, S-05

  describe('.wb-stone-indicator')
    - I-01 through I-05

  describe('.wb-status-text')
    - T-01 through T-05

  describe('Panel typography')
    - P-01 through P-03
```

### 3.2 Manual Acceptance Tests (MANUAL_ACCEPTANCE)

| ID | What to Verify | How |
|----|---------------|-----|
| S-03 | Segmented control items have no visible border by default | Visual inspection in storybook / dev mode |
| I-06 | Stone indicator gradients look realistic | Visual inspection, compare with design spec |

---

## 4. Fragility Warnings

| Warning | Explanation |
|---------|-------------|
| **CSS text parsing is fragile** | Tests parse raw CSS text with regex. If the formatter reorders properties or changes whitespace, tests may break without functional regression. Mitigation: use flexible regex patterns, assert property presence not exact line order. |
| **Append-only assumption** | G-04 asserts existing rules are unchanged by comparing rule count. If another phase modifies the same file concurrently, the test will fail. Mitigation: this phase is the sole owner of the appended section. |
| **Gradient stop hex exemption** | G-02 exempts gradient stops from the "no hardcoded hex" rule. The test must specifically allow hex values inside `radial-gradient(...)` declarations. If gradient syntax changes, exemption logic may need updating. |
| **Custom property existence** | Tests assert `var(--ui-*)` usage but do NOT verify those custom properties are defined elsewhere. A missing custom property will not be caught by these tests. Mitigation: separate global custom-property existence test. |

---

## 5. Out of Scope

- Component implementation using these atoms (Phase U2-U4)
- Integration with Preact components
- Storybook stories for visual regression
- JavaScript/TypeScript logic
- Modification of any existing CSS rules

---

## 6. Sign-off

| Role | Status |
|------|--------|
| Contract design | Approved for implementation |
| Test writing | Pending |
| Implementation | Pending |
| Spec audit | Pending |
| Architecture review | Pending |
