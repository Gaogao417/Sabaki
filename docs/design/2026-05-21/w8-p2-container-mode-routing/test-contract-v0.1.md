# W8-P2 Container + Mode Routing — Wiring Contract v0.2

```
Date: 2026-05-21
Phase: W8-P2 (Container + Mode Routing Wiring)
Status: pending-confirmation
Predecessor: W8-P1 (boardInteractionController + gobanDataAdapter)
Revised: v0.2 — addresses contract-auditor REQUEST_CHANGES (5 blocking issues)
```

---

## Key Findings

### 1. GAP-Coord (HIGH — blocking bug)
`boardInteractionController.ts` line 196 sends `userMove = \`${vertex[0]},${vertex[1]}\`` (e.g. `"3,3"`),
but `recallService.ts` line 128 compares `input.userMove === expectedMove` against `expectedMoves`
derived from SGF parsing (e.g. `"dd"`). This causes **every recall comparison to return `isCorrect = false`**.

**Fix**: Replace template literal with `String.fromCharCode(97 + vertex[0]) + String.fromCharCode(97 + vertex[1])`.

### 2. Hardcoded Demo Data (HIGH)
`TrainingWorkbenchContainer.js` lines 294–321 contain a 30+ line hardcoded fallback object used when
adapter snapshot is unavailable. This should be replaced so that (a) adapter is always created before
first render, or (b) `projectGobanProps` handles missing data gracefully without fabricating board state.

### 3. Mode Routing Connected but Data-Starved (MEDIUM)
`WorkbenchShell`, `ModeBar`, `ModeActions`, `BottomActionBar`, `RightModePanel` all receive `mode` prop.
Container projects `activeTab.mode` via `projectFromWorkbench(ws).mode`. However, data sources like
`currentPlayer`, `blackCaptures`, `whiteCaptures`, `moveNumber`, `engineStatus` still use default prop
values because adapter snapshot data is not yet projected into these shell props.

### 4. Interface Boundary Signature
`Goban.js:282` calls `onVertexClick(evt)` with single arg where `evt.vertex = [number, number]`.
Container handler at line 328 receives this single evt and extracts `evt.vertex`, `evt.button`,
`evt.ctrlKey`, `evt.metaKey` to pass to controller. This signature is correct and verified in W8-P1.

---

## Task 2: Container Adapter Wiring

### Full Chain: Board Click → State Change → UI Update

```
Goban.onVertexClick(evt)
  → Container.handleBoardClick(evt)
    → boardInteractionController.handleBoardClick(evt.vertex, evt.button, evt.ctrlKey, evt.metaKey, context)
      → [play mode] aiMoveService.requestMove(vertex) → workbenchStore update
      → [recall mode] recallService.checkMove(vertex) → recallSession update
      → [problem mode] attemptService.submitAnswer(vertex) → attempt update
      → [analysis mode] sabaki.makeMove(vertex) → gameTree update
    → gobanDataAdapter.snapshot() → Container.forceUpdate()
      → projectGobanProps(snapshot) → WorkbenchShell boardProps
```

### Full Chain: Store Update → UI Projection

```
workbenchStore.updateTab(tabId, { mode })
  → Container subscription callback
    → Container re-derives activeTab
      → projectFromWorkbench(ws).mode → shellProps.mode
        → WorkbenchShell renders correct leftPanel/rightPanel
        → ModeBar renders correct segmented state
        → BottomActionBar renders correct action set
```

---

## Layering Table

| Test ID | Layer | Production Subject | Real Dependencies | Mock Dependencies | Forbidden Mocks | Primary Assertion | Downstream Coverage |
|---------|-------|-------------------|-------------------|-------------------|-----------------|-------------------|---------------------|
| T2-01 | STORE_SUBSCRIPTION | Container.render() boardProps derivation | real workbenchStore (seeded with tab), real projectGobanProps | mock adapter with snapshot() returning test fixture (width=9) | Container itself (must be real), projectGobanProps (must be real import) | projectGobanProps called with adapter snapshot data, NOT hardcoded fallback object | T2-02 validates subscription mechanism |
| T2-02 | STORE_SUBSCRIPTION | Container subscription lifecycle | real workbenchStore, real Container | mock adapter with subscribe() + getSnapshot(); sabaki mock providing board state change | Container (must be real), projectGobanProps (must be real import) | Container re-renders with updated boardProps after adapter emits snapshot change | T2-01 validates initial render; T2-03 validates cleanup |
| T2-03 | SIDE_EFFECT_BOUNDARY | Container.componentWillUnmount() | real Container | mock adapter with destroy() spy | Container lifecycle (must use real componentWillUnmount) | adapter.destroy() called; no subscription callback fires after unmount | N/A (terminal) |
| T2-04 | SIDE_EFFECT_BOUNDARY | boardInteractionController.handleBoardClick() | real boardInteractionController | mock recallService.submitRecallMove (spy on arg), mock context | controller itself (must be real), vertex-to-SGF conversion (that IS what we're testing) | recallService.submitRecallMove called with userMove="dd" (SGF format) | Supersedes W8-P1-T11 coord format assertion |
| T2-05 | SIDE_EFFECT_BOUNDARY | boardInteractionController.handleBoardClick() | real boardInteractionController | mock recallService.submitRecallMove (spy on arg), mock context | controller itself | userMove="aa" for [0,0], userMove="ss" for [18,18] | Companion to T2-04 |
| T2-06 | SIDE_EFFECT_BOUNDARY | boardInteractionController.handleBoardClick() | real boardInteractionController | mock recallService.submitRecallMove (spy on arg), mock context | controller itself | userMove="as" for [0,18], userMove="sa" for [18,0] | Companion to T2-04 |
| T2-07 | ARCHITECTURE_BOUNDARY | Container.render() boardProps derivation | real Container, real projectGobanProps, real workbenchStore | mock adapter returning null (simulating unavailable snapshot) | projectGobanProps (must be real) | When adapter returns null, Container does NOT fabricate a 19x19 zero-filled signMap; projectGobanProps receives null/undefined and handles gracefully | Replaces source-code-reading approach from v0.1 |
| T2-08 | STORE_SUBSCRIPTION | Container mode projection | real workbenchStore (seeded with tab mode='play'), real projectFromWorkbench | none | Container (must be real), projectFromWorkbench (must be real import) | After store.updateTab(id, {mode:'recall'}), Container's derived shellProps.mode === 'recall' | T2-09, T2-10 cover other modes |
| T2-09 | STORE_SUBSCRIPTION | Container mode projection | real workbenchStore (seeded with tab mode='play'), real projectFromWorkbench | none | Container, projectFromWorkbench | After store.updateTab(id, {mode:'analysis'}), shellProps.mode === 'analysis' | Companion to T2-08 |
| T2-10 | STORE_SUBSCRIPTION | Container mode projection | real workbenchStore (seeded with tab mode='play'), real projectFromWorkbench | none | Container, projectFromWorkbench | After store.updateTab(id, {mode:'problem'}), shellProps.mode === 'problem' | Companion to T2-08 |
| T2-11 | STORE_SUBSCRIPTION | Container tab list projection | real workbenchStore, real projectFromWorkbench | none | Container, projectFromWorkbench | After store.addTab(...), Container's projected games array has length 2 | Companion to T2-12 |
| T2-12 | STORE_SUBSCRIPTION | Container active tab projection | real workbenchStore (2 tabs), real projectFromWorkbench | none | Container, projectFromWorkbench | After store.setActiveTab(1), Container's projected activeIndex === 1 | Companion to T2-11 |

---

## Test Contracts

### Must Automate (12 items)

#### T2-01: Container uses adapter snapshot, not hardcoded fallback
- **Precondition**: gobanDataAdapter is initialized; workbenchStore seeded with one tab; adapter.snapshot() returns a test fixture with board width=9
- **Action**: Instantiate Container with real store + mock adapter; trigger render
- **Assert**: projectGobanProps (real import) is called with the adapter's snapshot data; the resulting boardProps has width=9, NOT the hardcoded width=19 fallback
- **Named consumer**: `WorkbenchShell` receives `boardProps`

#### T2-02: Adapter subscription triggers Container re-render
- **Precondition**: Container mounted with real gobanDataAdapter (constructed with mock sabaki providing board state); subscription active
- **Action**: Change sabaki board state (e.g. place a stone); trigger adapter's internal subscription to emit new snapshot
- **Assert**: Container re-renders; new boardProps reflects the stone placement (signMap changed)
- **Named consumer**: `WorkbenchShell` receives updated boardProps

#### T2-03: Unmount cleans up adapter subscription
- **Precondition**: Container mounted with real gobanDataAdapter
- **Action**: Call Container.componentWillUnmount()
- **Assert**: adapter.destroy() called; subsequent board state changes do NOT trigger any Container update
- **Named consumer**: Container internal lifecycle

#### T2-04: GAP-Coord — vertex [3,3] → SGF "dd"
- **Precondition**: real boardInteractionController initialized with mode='recall'; mock recallService.submitRecallMove installed as spy
- **Action**: handleBoardClick([3,3], 0, false, false, context)
- **Assert**: recallService.submitRecallMove called; first call's userMove argument === "dd" (not "3,3")
- **Named consumer**: `recallService.submitRecallMove()`
- **Note**: Supersedes W8-P1-T11's coord format expectation. W8-P1-T11 tested that submitRecallMove was called; T2-04 additionally verifies the coord format is SGF. W8-P1-T11 remains valid and does NOT need updating — it tests invocation, T2-04 tests format.

#### T2-05: GAP-Coord — vertex [0,0] → SGF "aa", [18,18] → "ss"
- **Precondition**: real boardInteractionController in recall mode
- **Action**: handleBoardClick([0,0], ...) then handleBoardClick([18,18], ...)
- **Assert**: userMove values are "aa" and "ss" respectively

#### T2-06: GAP-Coord — vertex [0,18] → "as", [18,0] → "sa"
- **Precondition**: real boardInteractionController in recall mode
- **Action**: handleBoardClick([0,18], ...) then handleBoardClick([18,0], ...)
- **Assert**: userMove values are "as" and "sa" respectively

#### T2-07: Container does not fabricate board state when adapter unavailable
- **Precondition**: Container with mock adapter whose snapshot() returns null; real workbenchStore seeded with tab
- **Action**: Trigger Container render
- **Assert**: projectGobanProps receives null/undefined (NOT a fabricated 19x19 signMap); no `Array(19).fill(null).map(() => Array(19).fill(0))` pattern in the data flow to WorkbenchShell
- **Named consumer**: `WorkbenchShell` receives safe boardProps (or empty/null handled by shell)
- **Classification**: ARCHITECTURE_BOUNDARY — runtime behavioral test proving no fabricated state leaks to UI

#### T2-08: Store updateTab mode='recall' → Container projects mode='recall'
- **Precondition**: real workbenchStore seeded with tab {id:'t1', mode:'play'}; Container subscribed to store; real projectFromWorkbench
- **Action**: store.updateTab('t1', { mode: 'recall' })
- **Assert**: Container's derived shellProps.mode === 'recall'
- **Named consumer**: `WorkbenchShell` → renders `RecallModePanel`

#### T2-09: Store updateTab mode='analysis' → Container projects mode='analysis'
- **Precondition**: same setup as T2-08
- **Action**: store.updateTab('t1', { mode: 'analysis' })
- **Assert**: shellProps.mode === 'analysis'
- **Named consumer**: `WorkbenchShell` → renders `AnalysisModePanel`

#### T2-10: Store updateTab mode='problem' → Container projects mode='problem'
- **Precondition**: same setup as T2-08
- **Action**: store.updateTab('t1', { mode: 'problem' })
- **Assert**: shellProps.mode === 'problem'
- **Named consumer**: `WorkbenchShell` → renders `ProblemModePanel`

#### T2-11: Store addTab → Container reflects new tab in games array
- **Precondition**: real workbenchStore with 1 tab; Container subscribed; real projectFromWorkbench
- **Action**: store.addTab({ mode: 'play', name: 'Test 2' })
- **Assert**: Container's projected games array has length 2
- **Named consumer**: `GameTabBar` receives updated games

#### T2-12: Store setActiveTab → Container projects updated activeIndex
- **Precondition**: real workbenchStore with 2 tabs; Container subscribed; real projectFromWorkbench
- **Action**: store.setActiveTab(1)
- **Assert**: Container's projected activeIndex === 1
- **Named consumer**: `GameTabBar` highlights correct tab

---

### Deferred Tests (with approved rationale)

| Handler/Flow | Reason for Deferral | Exit Condition | Covered In |
|-------------|--------------------|-----------------|------------|
| ModeBar click → handleModeChange → flowService.enterAnalysis/returnFromAnalysis → store.updateTab → projection | State-forward path requires flowService fully wired with mode transition logic. flowService.enterAnalysis is not yet implemented (only a stub). Testing it now would mock the entire chain, producing false-green risk. | W8-P3 implements flowService mode transitions. Then T-deferred-01 covers: ModeBar click → Container.handleModeChange → flowService call → store mutation → Container re-projection. | W8-P3 Task 3 |
| handleSubmit → flowService.submit → workbenchStore.updateTab({mode:'recall'}) | Core flow "Submit → Freeze → Recall" (PRD SS5.2) requires flowService.submit fully wired. Currently stub. | W8-P3 implements submit flow. | W8-P3 Task 4 |
| handleSnapshot → flowService.snapshotFromCurrentContext | Snapshot creation requires context assembly (board + attempt state). Not yet implemented. | W8-P3 implements snapshot. | W8-P3 Task 4/5/6 |
| handleEndRecall → flowService.completeRecall | Recall completion requires recall session state machine. Not yet implemented. | W8-P3 implements recall completion. | W8-P3 Task 5 |
| handleResign / handleAbandon (GAP-01, GAP-02) | Placeholder handlers that only log warnings. No business logic to test. | W8-P3 implements resign/abandon with real flow. | W8-P3 Task 4 |
| handleRestartAttempt | Attempt restart requires attempt state machine. Not yet implemented. | W8-P3 implements attempt restart. | W8-P3 Task 4 |
| Checkpoint handlers (submitCorrection, revealAI, skipCheckpoint, saveComment) | All checkpoint operations require recall session + checkpoint state machine. Not yet implemented. | W8-P3 implements checkpoint operations. | W8-P3 Task 5 |

---

### Manual Verification Only (13 items)

#### T3-01: Left panel renders PlayModePanel when mode='play'
- Visual verification: Left panel shows play-specific controls (human/AI selectors, etc.)

#### T3-02: Left panel renders ProblemModePanel when mode='problem'
- Visual verification: Left panel shows problem-specific controls (opponent selector, problemArea)

#### T3-03: Left panel renders RecallModePanel when mode='recall'
- Visual verification: Left panel shows recall move list and progress

#### T3-04: Left panel renders AnalysisModePanel when mode='analysis'
- Visual verification: Left panel shows analysis tools

#### T3-05: Right panel renders mode-specific content per mode
- Visual verification per mode

#### T3-06: ModeBar segmented control highlights active mode
- Visual verification

#### T3-07: ModeBar shows correct mode availability per modeBarPolicy
- Visual verification: disabled modes are visually distinct

#### T3-08: BottomActionBar shows Play actions (悔棋/Pass/认输) in play mode
- Visual verification

#### T3-09: BottomActionBar shows Problem actions (提交答案/放弃) in problem mode
- Visual verification

#### T3-10: BottomActionBar shows Recall actions (Recall move/Checkpoint/Complete/Enter Analysis/Snapshot) in recall mode
- Visual verification

#### T3-11: BottomActionBar shows Analysis actions (Snapshot/Return) in analysis mode
- Visual verification

#### T3-12: StoneStatus shows correct player turn indicator per mode
- Visual verification

#### T3-13: Mode switch triggers smooth panel transition without flicker
- Visual verification

---

### Not Tested (3 items)
- WorkbenchShell CSS class existence (W0 legacy)
- computeModeBarPolicy pure function (already covered)
- projectFromRuntime/projectFromWorkbench field-level (already covered)

---

## Relationship to W8-P1 Tests

| W8-P1 Test | W8-P2 Relationship |
|------------|-------------------|
| W8-P1-T11 (SIDE_EFFECT_BOUNDARY: controller calls recallService.submitRecallMove when recall resolved) | **Unchanged.** W8-P1-T11 tests that submitRecallMove IS called. T2-04 tests the FORMAT of the userMove argument. Both remain valid independently. No update to W8-P1-T11 required. |

---

## Parallel Execution Plan

| Batch | Tasks | Write Scope |
|-------|-------|-------------|
| Batch A | GAP-Coord fix + tests (T2-04, T2-05, T2-06) | `boardInteractionController.ts`, `test/workbench/wiring/w8-p2-coord-fix.test.js` |
| Batch B (parallel with A) | Mode routing tests (T2-08 to T2-12) | `test/workbench/wiring/w8-p2-mode-routing.test.js` (test only, no production code) |
| Batch C (after A) | Container adapter wiring + tests (T2-01, T2-02, T2-03) | `TrainingWorkbenchContainer.js`, `test/workbench/wiring/w8-p2-container-adapter.test.js` |
| Batch D (after C) | Hardcoded data removal + test (T2-07) | `TrainingWorkbenchContainer.js render()` |

---

## Key Production Files

| File | Change Scope |
|------|-------------|
| `src/components/TrainingWorkbenchContainer.js` | Adapter subscription, hardcoded fallback removal, mode projection |
| `src/modules/training/workbench/boardInteractionController.ts` | GAP-Coord fix at line 196 |
| `src/modules/training/recall/recallService.ts` | SGF comparison at line 128 (read-only reference) |
| `src/components/WorkbenchShell.js` | Mode routing leftPanel switch (read-only reference) |
| `src/modules/workbenchStore.js` | Tab CRUD operations (read-only reference) |

---

## Evidence References

- PRD v0.5: `docs/design/gabaki-sabaki-training-prd-v0.5.md`
- Architecture v0.5: `docs/design/gabaki-sabaki-training-architecture-v0.5.md`
- UI/UX Spec: `docs/design/workbench-ui-ux-spec.md`
- Wiring Workflow: `.claude/workflows/workbench-wiring-workflow.md`
- W8-P1 Contract: `docs/design/2026-05-21/w8-p1-board-interaction-controller/test-contract-v0.1.md`
- W8-P1 Architecture Review: GAP-Coord finding (HIGH priority)
