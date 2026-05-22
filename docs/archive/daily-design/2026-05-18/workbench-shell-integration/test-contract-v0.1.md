# Workbench Shell Integration — Test Contract v0.1

## Scope

1. New GameTabBar component — browser-style tab bar for multi-game switching
2. WorkbenchShell rewrite — replace legacy class component with functional layout using new workbench components
3. index.js export update — add GameTabBar to public API
4. CSS for GameTabBar — tab bar styles

---

## User Stories

- US-1: As a user, I see browser-style tabs above the board so I can switch between multiple open games
- US-2: As a user, the workbench shell shows new UI components (GlobalHeader, ModeBar, ModePanels, BottomActionBar) replacing old bars
- US-3: As a user, I can click mode tabs to switch between Play/Problem/Recall/Analysis and the left panel changes accordingly
- US-4: As a user, the board continues to render in the center column through MainBoardStage

---

## T-1 GameTabBar

### T-1.1a: renders tab items from games prop
- Render GameTabBar with games=[{index:0, title:'Game 1', active:true}, {index:1, title:'Game 2', active:false}]
- Assert data-testid="game-tab-bar" root exists
- Assert 2 child elements with data-testid="game-tab-item"

### T-1.1b: highlights active tab
- Render GameTabBar with games having one active=true
- Assert active tab has class containing 'active'
- Assert inactive tab does NOT have 'active' class

### T-1.1c: fires onSelect on tab click
- Render GameTabBar with onSelect spy
- Click a tab item
- Assert spy called with correct index

### T-1.1d: fires onClose on close button click
- Render GameTabBar with onClose spy
- Click close button on a tab
- Assert spy called with correct index
- Assert event does NOT propagate to onSelect

### T-1.1e: fires onAdd on add button click
- Render GameTabBar with onAdd spy
- Click add button (data-testid="game-tab-add")
- Assert spy called once

### T-1.1f: renders with empty games array
- Render GameTabBar with games=[]
- Assert component renders without error
- Assert add button is still present

---

## T-2 WorkbenchShell Rewrite

### T-2.1a: renders GlobalHeader with expected props
- Render WorkbenchShell with minimal props
- Assert data-testid="global-header" exists inside shell

### T-2.1b: renders GameTabBar when games prop provided
- Render WorkbenchShell with games=[{index:0, title:'Test', active:true}]
- Assert data-testid="game-tab-bar" exists

### T-2.1c: renders ModeBar with mode
- Render WorkbenchShell with mode='play'
- Assert data-testid="mode-bar" exists

### T-2.1d: renders correct left panel per mode
- Render with mode='play' → assert data-testid="play-mode-panel" exists
- Render with mode='problem' → assert data-testid="problem-mode-panel" exists
- Render with mode='recall' → assert data-testid="recall-mode-panel" exists
- Render with mode='analysis' → assert data-testid="analysis-mode-panel" exists

### T-2.1e: renders MainBoardStage in center
- Render WorkbenchShell
- Assert data-testid="main-board-stage" exists

### T-2.1f: renders RightModePanel
- Render WorkbenchShell
- Assert data-testid="right-mode-panel" exists

### T-2.1g: renders BottomActionBar
- Render WorkbenchShell
- Assert data-testid="bottom-action-bar" exists

### T-2.1h: does NOT render legacy components
- Render WorkbenchShell
- Assert NO element with class 'workbench-shell__left' that contains LeftSidebar
- Assert NO BoardToolbar rendered

---

## T-3 Index Export

### T-3.1a: GameTabBar exported from workbench/index.js
- Import from src/components/workbench/index.js
- Assert GameTabBar is a function

---

## T-4 CSS

### T-4.1a: workbench.css contains .wb-game-tab-bar styles
- Read workbench.css
- Assert .wb-game-tab-bar class exists

### T-4.1b: workbench.css contains .wb-game-tab-bar__tab styles
- Assert .wb-game-tab-bar__tab class exists

### T-4.1c: workbench.css contains .wb-game-tab-bar__tab--active styles
- Assert .wb-game-tab-bar__tab--active class exists

---

## Test Legitimacy

- GameTabBar tests import production component and test prop-driven behavior
- WorkbenchShell tests import production component and test structural layout
- CSS tests read production CSS file
- Missing components/CSS → tests FAIL (tryImport pattern)
- No mocks of internal modules — only props and DOM assertions
