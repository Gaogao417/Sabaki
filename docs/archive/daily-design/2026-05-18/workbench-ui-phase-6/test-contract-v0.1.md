# Phase 6: Right Panel Content — Test Contract v0.1

## Scope

Create right panel content components: PlayRightPanel, ProblemRightPanel, RecallRightPanel, AnalysisRightPanel.
All in src/components/workbench/panels/. Update RightModePanel to switch between them.

---

## T-6.1 PlayRightPanel

### T-6.1a: renders board info section
- Render with moveCount=42, captures={black:3, white:5}
- Assert move count and capture numbers appear

### T-6.1b: renders AI analysis section with EmptyStatePanel
- Assert data-testid="empty-state-panel" is present (AI analysis placeholder)

### T-6.1c: renders variation tree section with EmptyStatePanel
- Assert at least 2 EmptyStatePanel instances (one for AI, one for variation tree)

### T-6.1d: renders drawer toggle buttons
- Assert expand/drawer toggle buttons are present

---

## T-6.2 ProblemRightPanel

### T-6.2a: renders answer draft section
- Assert answer draft section exists with current variation info

### T-6.2b: renders hint card section
- Assert hint section is present

### T-6.2c: renders AI analysis section with hidden state
- Assert AI analysis section shows "hidden by default" message

### T-6.2d: renders ReferenceLineSummary
- Assert reference line summary section is present when referenceLines provided

---

## T-6.3 RecallRightPanel

### T-6.3a: renders recall hint section
- Assert recall hint text appears

### T-6.3b: renders checkpoint summary section
- Assert checkpoint counts appear (system triggered + manual)

### T-6.3c: renders result feedback section
- Assert correct/wrong counts and progress appear

### T-6.3d: renders variation tree with EmptyStatePanel
- Assert EmptyStatePanel present for variation tree

---

## T-6.4 AnalysisRightPanel

### T-6.4a: renders AI analysis section with EmptyStatePanel
- Assert EmptyStatePanel present for AI analysis

### T-6.4b: renders board evaluation section
- Render with moveCount=30, captures={black:2, white:4}
- Assert stats appear

### T-6.4c: renders variation tree section with EmptyStatePanel
- Assert at least 2 EmptyStatePanel instances

### T-6.4d: renders comparison section
- Assert comparison section with user/AI fields

### T-6.4e: renders snapshot comparison section
- Assert snapshot section with add snapshot button

---

## T-6.5 RightModePanel integration

### T-6.5a: mode=play renders PlayRightPanel
- Render RightModePanel with mode='play'
- Assert PlayRightPanel content appears

### T-6.5b: mode=problem renders ProblemRightPanel
- Render RightModePanel with mode='problem'
- Assert ProblemRightPanel content appears

### T-6.5c: mode=recall renders RecallRightPanel
- Render RightModePanel with mode='recall'
- Assert RecallRightPanel content appears

### T-6.5d: mode=analysis renders AnalysisRightPanel
- Render RightModePanel with mode='analysis'
- Assert AnalysisRightPanel content appears

---

## Test Legitimacy

- All tests import production components from src/components/workbench/panels/
- Missing component → import error → test FAILS
- Controlled dependencies: jsdom DOM via preactTestHelper
