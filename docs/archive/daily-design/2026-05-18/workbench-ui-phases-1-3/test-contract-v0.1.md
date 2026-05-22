# Test Contract v0.1 -- Workbench UI Phases 1-3

Date: 2026-05-18
Status: pending-confirmation

## Overview

Pure frontend implementation contracts for CSS color fixes, QuietStatusChips extraction,
8 shared components, and ModeActions shell component. No store binding, no business logic.

## Contract Summary

### Phase 1.1: CSS Color Variables (6 tests, all MUST_AUTOMATE)

| ID   | Contract                                                        | Classification      |
|------|-----------------------------------------------------------------|---------------------|
| T-1.1a | `--ui-play` resolves to `#2563ff`                             | PURE_LOGIC         |
| T-1.1b | `--ui-problem` resolves to `#d97706`                          | PURE_LOGIC         |
| T-1.1c | `--ui-recall-mode` resolves to `#169b55`                      | PURE_LOGIC         |
| T-1.1d | `--ui-analysis` resolves to `#7c3aed`                         | PURE_LOGIC         |
| T-1.1e | All four `-soft` variables resolve to correct values          | PURE_LOGIC         |
| T-1.1f | ModeBar/GlobalHeader hardcoded colors align with CSS vars    | ARCHITECTURE_BOUNDARY |

### Phase 1.2: QuietStatusChips (3 tests, all MUST_AUTOMATE)

| ID     | Contract                                                    | Classification |
|--------|-------------------------------------------------------------|-----------------|
| T-1.2a | Renders chip for saveStatus='saving'                       | STATE           |
| T-1.2b | Renders chip for engineStatus='thinking'                   | STATE           |
| T-1.2c | GlobalHeader uses QuietStatusChips replacing statusChips   | PURE_LOGIC      |

### Phase 2.1: EmptyStatePanel (3 tests, all MUST_AUTOMATE)

| ID     | Contract                                                    | Classification |
|--------|-------------------------------------------------------------|-----------------|
| T-2.1a | Renders icon, title, description text                       | PURE_LOGIC      |
| T-2.1b | Renders action button when action prop provided, onClick fires | STATE       |
| T-2.1c | No action button when action prop omitted                   | PURE_LOGIC      |

### Phase 2.2: ProgressRing (5 tests, all MUST_AUTOMATE)

| ID     | Contract                                                    | Classification |
|--------|-------------------------------------------------------------|-----------------|
| T-2.2a | progress=75 produces correct stroke-dashoffset proportion  | PURE_LOGIC      |
| T-2.2b | progress=0 produces empty ring (dashoffset = circumference)| PURE_LOGIC      |
| T-2.2c | progress=100 produces full ring (dashoffset = 0)           | PURE_LOGIC      |
| T-2.2d | size prop controls container dimensions                     | PURE_LOGIC      |
| T-2.2e | label prop renders center text                              | PURE_LOGIC      |

### Phase 2.3: ModeToggle (3 tests, all MUST_AUTOMATE)

| ID     | Contract                                                    | Classification |
|--------|-------------------------------------------------------------|-----------------|
| T-2.3a | checked=true renders open state                             | STATE           |
| T-2.3b | Click when checked=true triggers onChange(false)            | STATE           |
| T-2.3c | Click when checked=false triggers onChange(true)            | STATE           |

### Phase 2.4: OpponentControl (4 tests: 3 MUST_AUTOMATE, 1 MANUAL_ACCEPTANCE)

| ID     | Contract                                                    | Classification   |
|--------|-------------------------------------------------------------|------------------|
| T-2.4a | value='self' shows self selected                            | STATE            |
| T-2.4b | Click triggers onChange('ai') when value='self'             | STATE            |
| T-2.4c | disabled=true suppresses onChange                           | STATE            |
| T-2.4d | disabled shows disabledReason tooltip                       | UI_BEHAVIOR      |

### Phase 2.5: ReferenceLineSummary (3 tests, all MUST_AUTOMATE)

| ID     | Contract                                                    | Classification |
|--------|-------------------------------------------------------------|-----------------|
| T-2.5a | Renders each line's label and length                        | PURE_LOGIC      |
| T-2.5b | Renders totalCount                                          | PURE_LOGIC      |
| T-2.5c | lines=[] renders totalCount=0 only                          | PURE_LOGIC      |

### Phase 2.6: RightDrawer (5 tests, all MUST_AUTOMATE)

| ID     | Contract                                                    | Classification   |
|--------|-------------------------------------------------------------|------------------|
| T-2.6a | open=true renders visible panel                             | STATE            |
| T-2.6b | open=false renders hidden panel                             | STATE            |
| T-2.6c | Close button click triggers onClose                         | STATE            |
| T-2.6d | Escape key triggers onClose                                 | SIDE_EFFECT      |
| T-2.2e | Renders title and children                                  | PURE_LOGIC       |

### Phase 2.7: AnnotationToolbar (5 tests, all MUST_AUTOMATE)

| ID     | Contract                                                    | Classification |
|--------|-------------------------------------------------------------|-----------------|
| T-2.7a | Renders all 10 tool buttons                                 | STATE           |
| T-2.7b | activeTool button has selected state                        | STATE           |
| T-2.7c | Click non-active tool triggers onToolChange(newTool)        | STATE           |
| T-2.7d | disabled=true suppresses onToolChange                       | STATE           |
| T-2.7e | Click activeTool does not trigger onToolChange              | PURE_LOGIC      |

### Phase 2.8: MaterialLibraryDialog (3 tests, all MUST_AUTOMATE)

| ID     | Contract                                                    | Classification |
|--------|-------------------------------------------------------------|-----------------|
| T-2.8a | open=true renders visible dialog                            | STATE           |
| T-2.8b | open=false renders hidden dialog                            | STATE           |
| T-2.8c | Close action triggers onClose                               | STATE           |

### Phase 3: ModeActions (8 tests, all MUST_AUTOMATE)

| ID     | Contract                                                    | Classification         |
|--------|-------------------------------------------------------------|------------------------|
| T-3a   | mode='play' renders 4 buttons (new game, settings, end, resign) | STATE             |
| T-3b   | mode='problem' renders 4 buttons (submit, abandon, settings, analysis) | STATE |
| T-3c   | mode='recall' renders 3 buttons (analysis, end, snapshot)   | STATE                  |
| T-3d   | mode='analysis' renders 3 buttons (snapshot, settings, return) | STATE              |
| T-3e   | Play resign button has danger style                         | STATE                  |
| T-3f   | Each button click fires corresponding callback              | SIDE_EFFECT            |
| T-3g   | ModeBar integrates ModeActions with mode and callback props | WIRING                |
| T-3h   | Switching mode fully replaces button set                    | PURE_LOGIC             |
| T-INDEX| index.js exports all new components                         | WIRING                 |

## Total: 51 contracts (46 MUST_AUTOMATE, 5 MANUAL_ACCEPTANCE)

## Fragility Warnings

1. CSS parsing tests (T-1.1a-e): Use a CSS parser, not regex. Fragile against formatting changes.
2. JS/CSS color alignment (T-1.1f): This test becomes unnecessary if JS uses CSS custom properties.
3. ProgressRing SVG calculation (T-2.2a-c): Assert proportional relationship, not exact pixels.
4. AnnotationToolbar button count (T-2.7a): Drive from a tool-list constant, not hardcoded 10.
5. ModeActions button text (T-3a-d): Use data-testid or role, not button text as selector.
6. GlobalHeader child detection (T-1.2c): Assert characteristic output, not component instance.

## Out of Scope

- Phase 4 (BottomActionBar mode化)
- Phase 5 (left panel completion)
- Phase 6 (right panel content)
- Phase 7 (responsive + state overlays)
- Goban/board integration
- Store binding
- Engine sync
- Business logic
