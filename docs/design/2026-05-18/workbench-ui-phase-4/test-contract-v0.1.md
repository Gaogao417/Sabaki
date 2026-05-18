# Phase 4: Shell Skeleton Rebuild — Test Contract v0.1

## Scope

Rebuild reverted shell components: MainBoardStage, TrainingTabBar, BottomActionBar, RightModePanel.
All components are Preact functional components using `h()`, props-driven, no store access.

---

## T-4.1 MainBoardStage

### T-4.1a: renders placeholder with mode label
- Render with mode='play'
- Assert container shows mode label text "对局"
- Assert container shows board placeholder text "棋盘区域"

### T-4.1b: renders mode-specific labels
- For each mode (play/problem/recall/analysis), verify the Chinese mode label appears

### T-4.1c: renders children when provided
- Render with mode='play' and children=h('div', {'data-testid': 'child'}, 'test')
- Assert child element is rendered inside the board area

### T-4.1d: applies mode color to mode chip
- Render with mode='problem'
- Assert the mode chip element has style containing problem color #d97706

---

## T-4.2 TrainingTabBar

### T-4.2a: renders 4 mode tabs
- Render with activeTab='play'
- Assert 4 tab buttons exist (play, problem, recall, analysis)

### T-4.2b: highlights active tab
- Render with activeTab='problem'
- Assert problem tab has active class
- Assert other tabs do not have active class

### T-4.2c: fires onTabChange on tab click
- Render with activeTab='play', track onTabChange calls
- Click problem tab
- Assert onTabChange called with 'problem'

### T-4.2d: renders badge counts when provided
- Render with badgeCounts={play: 3, recall: 1}
- Assert play tab shows badge "3"
- Assert recall tab shows badge "1"

### T-4.2e: no badge when count is 0 or undefined
- Render with badgeCounts={play: 0}
- Assert play tab does NOT render a badge element

---

## T-4.3 BottomActionBar

### T-4.3a: play mode renders correct buttons
- Render mode='play'
- Assert buttons: undo, pass, resign, end-attempt, mark-doubtful + common tools (select, hand-shape, zoom-in, zoom-out, fullscreen)

### T-4.3b: problem mode renders correct buttons
- Render mode='problem'
- Assert buttons: undo, redo, pass, request-hint, submit-answer, abandon-answer + common tools

### T-4.3c: recall mode renders correct buttons
- Render mode='recall'
- Assert buttons: mark-checkpoint, hint, verify-skip, enter-analysis + common tools

### T-4.3d: analysis mode renders correct buttons
- Render mode='analysis'
- Assert buttons: annotation tool group + undo, redo, clear, edit-position, snapshot + common tools

### T-4.3e: button clicks fire callbacks
- Render mode='play' with tracked callbacks
- Click undo button → assert onUndo fired
- Click pass button → assert onPass fired

### T-4.3f: analysis annotation tools render
- Render mode='analysis'
- Assert annotation tool buttons exist: black, white, cross, triangle, square, circle, line, arrow, label-A, label-1

### T-4.3g: active annotation tool is highlighted
- Render mode='analysis', activeAnnotationTool='triangle'
- Assert triangle tool button has active class

---

## T-4.4 RightModePanel

### T-4.4a: renders placeholder per mode
- Render mode='play'
- Assert container shows right panel placeholder
- Repeat for problem, recall, analysis

### T-4.4b: switches content on mode change
- Render mode='play', then re-render mode='analysis'
- Assert content changes

---

## Test Legitimacy

- All tests import production components from src/components/workbench/shell/
- Missing component → import error → test FAILS, no silent pass
- Controlled dependencies: jsdom DOM via preactTestHelper
