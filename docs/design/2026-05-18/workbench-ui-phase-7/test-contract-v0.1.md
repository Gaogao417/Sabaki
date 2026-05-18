# Phase 7: Responsive + State Overlay — Test Contract v0.1

## Scope

1. CSS responsive media queries for workbench layout
2. State overlay support on panel components (empty/active/success/error/loading/disabled)
3. CSS soft color alignment to match mode primary colors

---

## T-7.1 Responsive CSS

### T-7.1a: workbench CSS contains 1279px breakpoint
- Assert workbench.css contains @media (max-width: 1279px) rule

### T-7.1b: workbench CSS contains 999px breakpoint
- Assert workbench.css contains @media (max-width: 999px) rule

### T-7.1c: right panel becomes drawer class at medium breakpoint
- Assert 1279px breakpoint contains right panel drawer class modification

### T-7.1d: left panel becomes drawer class at small breakpoint
- Assert 999px breakpoint contains left panel drawer class modification

---

## T-7.2 State Overlay on Panels

### T-7.2a: PlayModePanel state=empty renders EmptyStatePanel
- Render PlayModePanel with state='empty'
- Assert data-testid="empty-state-panel" is present instead of normal content

### T-7.2b: PlayModePanel state=loading renders loading indicator
- Render PlayModePanel with state='loading'
- Assert loading indicator element is present

### T-7.2c: PlayModePanel state=disabled renders disabled overlay
- Render PlayModePanel with state='disabled'
- Assert disabled class or overlay is present

### T-7.2d: PlayModePanel state=active renders normal content
- Render PlayModePanel with state='active'
- Assert normal panel content is present

### T-7.2e: ProblemModePanel state=empty renders EmptyStatePanel
- Render ProblemModePanel with state='empty'
- Assert data-testid="empty-state-panel" is present

### T-7.2f: RecallModePanel state=error renders error overlay
- Render RecallModePanel with state='error'
- Assert error indicator is present

### T-7.2g: AnalysisModePanel state=success renders success indicator
- Render AnalysisModePanel with state='success'
- Assert success indicator is present

---

## T-7.3 CSS Soft Color Alignment

### T-7.3a: --ui-play-soft uses blue tint
- Assert workbench.css contains --ui-play-soft: #eef4ff (or similar blue tint)

### T-7.3b: --ui-problem-soft uses amber tint
- Assert workbench.css contains --ui-problem-soft: #fff7ed (or similar amber tint)

### T-7.3c: --ui-recall-mode-soft uses green tint
- Assert workbench.css contains --ui-recall-mode-soft: #eaf8f0 (or similar green tint)

### T-7.3d: --ui-analysis-soft uses purple tint
- Assert workbench.css contains --ui-analysis-soft: #f2edff (or similar purple tint)

---

## Test Legitimacy

- Panel tests import production components and test state prop behavior
- CSS tests read production CSS file and assert content
- Missing components/CSS → tests FAIL
- Controlled dependencies: jsdom DOM, fs.readFileSync for CSS
