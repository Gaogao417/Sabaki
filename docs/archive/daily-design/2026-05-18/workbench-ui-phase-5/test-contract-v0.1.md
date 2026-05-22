# Phase 5: Left Panel Rebuild — Test Contract v0.1

## Scope

Rebuild reverted left panel components: PlayModePanel, ProblemModePanel, RecallModePanel,
RecallCheckpointPanel, AnalysisModePanel. All in src/components/workbench/panels/.

---

## T-5.1 PlayModePanel

### T-5.1a: renders task info card
- Render with taskTitle, taskDescription, moveCount, captures
- Assert taskTitle appears in output
- Assert taskDescription appears in output

### T-5.1b: renders move count and captures
- Render with moveCount=42, captures={black: 3, white: 5}
- Assert "42" and "3" and "5" appear

### T-5.1c: fires onMarkDoubtful callback
- Click mark-doubtful button → assert onMarkDoubtful called

### T-5.1d: fires onEnterAnalysis callback
- Click enter-analysis button → assert onEnterAnalysis called

---

## T-5.2 ProblemModePanel

### T-5.2a: renders prompt and goal
- Assert prompt and goal text appear

### T-5.2b: renders pass rule summary
- Assert passRuleSummary text appears

### T-5.2c: renders OpponentControl component
- Assert data-testid="opponent-control" is present

### T-5.2d: renders ReferenceLineSummary component
- Assert reference line summary section is present

### T-5.2e: fires onRequestHint callback
- Click request-hint button → assert onRequestHint called

---

## T-5.3 RecallModePanel

### T-5.3a: renders ModeToggle for recall original line
- Assert data-testid="mode-toggle" is present

### T-5.3b: with recallOriginalLine=true renders progress view
- Render recallOriginalLine=true
- Assert ProgressRing is present (data-testid="progress-ring")
- Assert progress stats are shown

### T-5.3c: with recallOriginalLine=false renders checkpoint view
- Render recallOriginalLine=false
- Assert checkpoint list is rendered

### T-5.3d: fires callbacks in progress view
- Click mark-checkpoint → assert onMarkCheckpoint called
- Click verify → assert onVerify called

### T-5.3e: fires callbacks in checkpoint view
- Render with checkpoints, click submit-correction → assert onSubmitCorrection called

---

## T-5.4 RecallCheckpointPanel

### T-5.4a: renders checkpoint info
- Render with checkpoint={id:'cp1', moveNumber:42, source:'system', summary:'关键变化'}
- Assert moveNumber and summary text appear

### T-5.4b: active state has active class
- Render with isActive=true → assert active class present
- Render with isActive=false → assert no active class

### T-5.4c: fires onSelect callback
- Click → assert onSelect called

---

## T-5.5 AnalysisModePanel

### T-5.5a: renders move count and captures
- Assert move count and capture numbers appear

### T-5.5b: renders evaluation when provided
- Render with evaluation="黑优 72%" → assert text appears

### T-5.5c: fires onSnapshot callback
- Click snapshot button → assert onSnapshot called

### T-5.5d: no evaluation section when null
- Render with evaluation=null → assert no evaluation section rendered

---

## Test Legitimacy

- All tests import production components from src/components/workbench/panels/
- Missing component → import error → test FAILS
- Controlled dependencies: jsdom DOM via preactTestHelper
