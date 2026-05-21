Date: 2026-05-21
Status: pending-confirmation

# W8-P4 Contract: Dashboard Wiring + Regression (v0.2)

This contract covers two scopes:
- **Tasks 10-11**: Dashboard data loading (due review, inbox, incomplete attempts, incomplete recall sessions, recent bad-move derived tasks) and Dashboard entry-point actions (open due item, open inbox task, open incomplete attempt, open incomplete recall session, open bad-move derived task, refresh).
- **Task 12**: Regression -- prove existing board/engine/analysis/overlay wiring from W8-P1 through W8-P3 still works after dashboard wiring.

v0.2 changes (from auditor BLOCK feedback):
- BLOCK-1: Added Section 20 "TrainingDashboardDrawer Migration Path"
- BLOCK-2: D-T01 mock strategy corrected; D-T01b added for real state transition
- BLOCK-3: D-T06 split into D-T06a (CONTAINER_DELEGATION) and D-T06b (DATA_LOADING)
- BLOCK-4: D-T06b further split by GAP dependency; GREEN vs RED status clarified per sub-query
- BLOCK-5: Added Section 21 "Props Routing Path" and D-T00 (ARCHITECTURE_BOUNDARY)
- BLOCK-6: D-T07 expanded to cover both static import analysis and runtime access analysis

---

# Contract Draft

## 0. Source Alignment

| Source | Section/Lines | Constraint on This Contract |
| --- | --- | --- |
| PRD v0.5 Section 2.7 | "Review is entry, not board mode" | Dashboard must not introduce a new board mode. All "open" actions resolve to `openTask(taskId)` which enters Play or Problem. |
| PRD v0.5 Section 4.12 | ReviewSchedule type: `taskId` only, no `item_type` | Dashboard data queries must use `taskId`, not `item_type/item_id`. |
| PRD v0.5 Section 5.6 | BadMove -> `taskImportService.createTaskFromBadMove` -> TrainingTask | Dashboard listing bad-move tasks must read TrainingTask where `origin.provider = 'bad_move'`, not a separate table. |
| PRD v0.5 Section 5.7 | `reviewService.getDueItems` -> taskId -> `openTask(taskId)` | Dashboard "open due review" must go through `reviewService.openDueItem`, not through legacy `sabaki.startReviewSession` or `openProblemTab`. |
| PRD v0.5 Section 7.2.E | "Support due task list", "Support opening due task" | Dashboard must display and allow opening due items. |
| PRD v0.5 Section 8.5 | "Review shows due Task", "Review item opens normal Task" | Acceptance criteria for dashboard. |
| Arch v0.5 Section 0.3 | "UI only displays, does not write business Store" | Dashboard UI must be presentational. Data loading goes through Container -> Service -> Repository. |
| Arch v0.5 Section 1.1 | Read path: Store/Repository query -> Container -> UI | Dashboard data projection must follow this path. |
| Arch v0.5 Section 1.2 | Write path: UI -> Controller/Container -> Service -> Store/Repository/Adapter | Dashboard "open" actions must follow this path. |
| Arch v0.5 Section 3.5 | "All training DB reads/writes through trainingRepository" | Dashboard queries must not call `db.js` directly. |
| Arch v0.5 Section 5.11 | `reviewService.getDueItems`, `reviewService.openDueItem` | Dashboard uses these APIs. |
| Arch v0.5 Section 6.2 | Repository `listIncompleteAttempts`, `listIncompleteRecallSessions`, `listBadMovesByTask`, `listDueReviewItems` | Dashboard data queries via repository. |
| Arch v0.5 Section 9.9 | Review open due item command path | `ReviewInbox item click -> reviewService.openDueItem -> workbenchTabService.openTask` |
| UI/UX Spec Section 1.4 | Material library is a separate dialog, not workbench sidebar | Dashboard is not a full material library; it is a summary drawer or sidebar summary. |
| UI/UX Spec Section 12 | Component structure lists no DashboardPanel | Dashboard is PROPOSED as a new drawer/panel; UI/UX spec does not specify its exact layout. This contract covers behavioral wiring only. |

### Key Constraints from Source Alignment

1. **Dashboard uses `reviewService.getDueItems()`, NOT direct DB queries** -- per Arch v0.5 Section 5.11.
2. **Dashboard "open" actions use `workbenchTabService.openTask()`, NOT legacy `openProblemTab`** -- per Arch v0.5 Section 5.2.
3. **Review is NOT a board mode** -- per PRD v0.5 Section 2.7.
4. **ReviewSchedule references `taskId` directly** -- per PRD v0.5 Section 4.12.
5. **Panels remain presentational** -- all logic through Container/Controller/Service.
6. **No panel imports services, repositories, or db directly** -- per Arch v0.5 Section 0.3.

## 1. User Stories

### US-D1: Due Review Items
As a user, I want to see a list of tasks due for review when I open the dashboard, so that I know what needs复习.

### US-D2: Open Due Review Item
As a user, I want to click a due review item in the dashboard and have it open as a new workbench tab in the correct mode (Play or Problem based on task fields), so that I can start复习 immediately.

### US-D3: Inbox Tasks
As a user, I want to see inbox tasks in the dashboard, so that I know what new material is available.

### US-D4: Open Inbox Task
As a user, I want to click an inbox task and have it open as a new workbench tab, so that I can start working on it.

### US-D5: Incomplete Attempts
As a user, I want to see attempts I started but did not submit, so that I can resume them.

### US-D6: Resume Incomplete Attempt
As a user, I want to click an incomplete attempt and have the workbench open with that attempt loaded, so I can continue where I left off.

### US-D7: Incomplete Recall Sessions
As a user, I want to see recall sessions I started but did not complete, so that I can resume them.

### US-D8: Resume Incomplete Recall Session
As a user, I want to click an incomplete recall session and have the workbench open in recall mode with that session loaded, so I can continue recalling.

### US-D9: Recent Bad-Move Derived Tasks
As a user, I want to see tasks that were recently derived from my bad moves, so that I can practice correcting my mistakes.

### US-D10: Open Bad-Move Derived Task
As a user, I want to click a bad-move derived task and have it open in Problem mode, so I can practice the punishment.

### US-D11: Refresh Dashboard
As a user, I want to refresh the dashboard data, so that I see the latest state after completing training.

### US-R1: Board Clicks Still Work
As a user, after dashboard wiring, I expect board clicks to still play moves correctly in Play and Problem mode.

### US-R2: Engine Sync Still Works
As a user, after dashboard wiring, I expect engine analysis to still sync and display correctly.

### US-R3: Analysis Area / Overlay Still Works
As a user, after dashboard wiring, I expect overlays, analysis area selection, and AI overlays to still display correctly.

### US-R4: Existing Game Tree Operations Still Work
As a user, after dashboard wiring, I expect navigation, undo, and SGF operations to still work.

## 2. User Actions

| ID | Action | Trigger Component |
| --- | --- | --- |
| UA-D1 | Click "Due Review Item" in dashboard | `TrainingDashboardDrawer` -- per-item "Solve"/"Start Review" button |
| UA-D2 | Click "Inbox Task" in dashboard | `TrainingDashboardDrawer` -- inbox item "Solve" button |
| UA-D3 | Click "Incomplete Attempt" in dashboard | `TrainingDashboardDrawer` -- attempt item resume button |
| UA-D4 | Click "Incomplete Recall Session" in dashboard | `TrainingDashboardDrawer` -- recall session resume button |
| UA-D5 | Click "Bad-Move Derived Task" in dashboard | `TrainingDashboardDrawer` -- bad-move task "Practice" button |
| UA-D6 | Click "Refresh Dashboard" or open dashboard | `TrainingDashboardDrawer` -- open/refresh trigger |
| UA-R1 | Click board intersection | `Goban` (via `boardInteractionController`) |
| UA-R2 | Navigate game tree | `Goban` navigation controls |
| UA-R3 | Toggle analysis overlay | WorkbenchShell analysis toggle |

## 3. Current Phase

Dashboard is a cross-cutting entry point. It does not belong to any single mode. It is opened as a drawer/dialog from the workbench and can open tasks in any mode (Play, Problem, Recall, Analysis).

Phase classification: **entry-point / queue**, analogous to Review (PRD v0.5 Section 2.7).

## 4. Location Source

| Data Source | Location Source | Notes |
| --- | --- | --- |
| Due review items | `reviewService.getDueItems()` -> `ReviewSchedule.taskId` | Reads `review_schedule` table via repository |
| Inbox tasks | `trainingRepository.listTasks({status: 'inbox'})` | Reads `training_tasks` table |
| Incomplete attempts | `trainingRepository.listIncompleteAttempts()` | Reads `training_attempts` with status in ('playing','submitted') and not completed |
| Incomplete recall sessions | `trainingRepository.listIncompleteRecallSessions()` | Reads `recall_sessions` with `completed = false` |
| Bad-move derived tasks | `trainingRepository.listTasks({originProvider: 'bad_move'})` or equivalent query | Reads `training_tasks` where origin.provider = 'bad_move', ordered by creation date descending |
| Task opening | `workbenchTabService.openTask({taskId, mode?})` | Creates new WorkbenchTab |

## 5. Change Contract

| Action | Change Type | Description |
| --- | --- | --- |
| openDueReviewItem | playMove / problemMove | Opens task via `reviewService.openDueItem(scheduleId)` which calls `workbenchTabService.openTask(taskId, inferredMode)`. Creates new tab, does NOT modify existing tabs. |
| openInboxTask | playMove / problemMove | Opens task via `workbenchTabService.openTask({taskId})`. Creates new tab. |
| openIncompleteAttempt | resumeAttempt | Opens task via `workbenchTabService.openTask({taskId})`, then restores attempt context. The attempt already exists; we resume it rather than creating a new one. PROPOSED_GAP: no explicit resume API on workbenchTabService yet. |
| openIncompleteRecallSession | resumeRecall | Opens task via `workbenchTabService.openTask({taskId, mode: 'recall'})`, then restores recall session context. PROPOSED_GAP: no explicit resume-recall API on workbenchTabService yet. |
| openBadMoveTask | problemMove | Opens task via `workbenchTabService.openTask({taskId, mode: 'problem'})`. Bad-move derived tasks have `prompt` field so default mode is Problem. |
| refreshDashboard | noChange (read-only) | Reloads dashboard data from services. No state mutation. |
| Dashboard data projection | noChange (read-only) | Queries services/repository, projects to UI props. |

## 6. Expected State Flow

### 6.1 openDueReviewItem(scheduleId)

```
TrainingDashboardDrawer "Start Review" button onClick(scheduleId)
  -> Container.handleOpenDueReviewItem(scheduleId)
  -> reviewService.openDueItem({scheduleId})
    -> repository.loadReviewSchedule(scheduleId)
    -> repository.loadTask(schedule.taskId)
    -> workbenchTabService.openTask({taskId: schedule.taskId, mode: inferDefaultMode(task)})
      -> workbenchStore.addTab(tab)
      -> workbenchStore.setActiveTab(tab.id)
  -> workbenchStore subscription fires
  -> Container.forceUpdate()
  -> projectFromWorkbench(ws) updates mode, games, activeIndex
  -> WorkbenchShell renders new tab with correct mode
```

### 6.2 openInboxTask(taskId)

```
TrainingDashboardDrawer inbox item "Solve" button onClick(taskId)
  -> Container.handleOpenInboxTask(taskId)
  -> workbenchTabService.openTask({taskId})
    -> repository.loadTask(taskId)
    -> inferDefaultMode(task)
    -> workbenchStore.addTab(tab)
    -> workbenchStore.setActiveTab(tab.id)
  -> workbenchStore subscription fires
  -> Container.forceUpdate()
  -> projectFromWorkbench(ws) updates mode, games, activeIndex
  -> WorkbenchShell renders new tab
```

### 6.3 openIncompleteAttempt(attemptId)

```
TrainingDashboardDrawer attempt item resume button onClick(attemptId)
  -> Container.handleOpenIncompleteAttempt(attemptId)
  -> repository.loadAttempt(attemptId)
  -> workbenchTabService.openTask({taskId: attempt.taskId})
    -> workbenchStore.addTab(tab)
    -> workbenchStore.setActiveTab(tab.id)
  -> runtimeStore.setActiveAttempt(attemptId)     // PROPOSED_GAP: restore attempt context
  -> runtimeStore subscription fires
  -> Container.forceUpdate()
  -> WorkbenchShell renders tab with attempt context restored
```

Note: Full attempt resume requires restoring the board position to the last played move. This is a PROPOSED_GAP. MVP can open the tab and let the user see the initial position; restoring to the exact move requires a dedicated resume API.

### 6.4 openIncompleteRecallSession(sessionId)

```
TrainingDashboardDrawer recall session resume button onClick(sessionId)
  -> Container.handleOpenIncompleteRecallSession(sessionId)
  -> repository.loadRecallSession(sessionId)
  -> workbenchTabService.openTask({taskId: session.taskId, mode: 'recall'})
    -> workbenchStore.addTab(tab with mode:'recall', activeRecallSessionId: sessionId)
    -> workbenchStore.setActiveTab(tab.id)
  -> runtimeStore.setActiveRecallSession(sessionId)  // PROPOSED_GAP: restore recall context
  -> runtimeStore subscription fires
  -> Container.forceUpdate()
  -> WorkbenchShell renders tab in recall mode with session context
```

Note: Full recall session resume requires restoring the recall move index and expected moves into runtimeStore. This is a PROPOSED_GAP.

### 6.5 openBadMoveTask(taskId)

```
TrainingDashboardDrawer bad-move task "Practice" button onClick(taskId)
  -> Container.handleOpenBadMoveTask(taskId)
  -> workbenchTabService.openTask({taskId, mode: 'problem'})
    -> repository.loadTask(taskId)
    -> workbenchStore.addTab(tab with mode:'problem')
    -> workbenchStore.setActiveTab(tab.id)
  -> workbenchStore subscription fires
  -> Container.forceUpdate()
  -> WorkbenchShell renders tab in problem mode
```

### 6.6 refreshDashboard()

```
TrainingDashboardDrawer open/refresh trigger
  -> Container.handleRefreshDashboard()
  -> Parallel queries:
     reviewService.getDueItems()
     repository.listTasks({status: 'inbox'})
     repository.listIncompleteAttempts()
     repository.listIncompleteRecallSessions()
     repository.listTasks({originProvider: 'bad_move'}) (recent, limited)
  -> Data assembled into dashboardData prop
  -> Dashboard drawer re-renders with fresh data
```

### 6.7 Dashboard Data Projection

```
Container.render() projects:
  - dashboardDueItems: ReviewSchedule[] (from reviewService.getDueItems cache)
  - dashboardInboxTasks: TrainingTask[] (from repository query cache)
  - dashboardIncompleteAttempts: TrainingAttempt[] (from repository query cache)
  - dashboardIncompleteRecallSessions: RecallSession[] (from repository query cache)
  - dashboardBadMoveTasks: TrainingTask[] (from repository query, filtered by origin.provider = 'bad_move')
  - dashboardLoading: boolean
  - dashboardError: string | null
-> TrainingDashboardDrawer receives these as props
-> TrainingDashboardDrawer renders sections with items
```

Note: Dashboard data projection is NOT stored in workbenchStore or runtimeStore per Architecture v0.5 Section 4.1 ("MVP only needs workbenchStore + trainingRuntimeStore"). Dashboard data is loaded on-demand when the drawer opens, held in Container local state, and projected as props. This is consistent with the existing `TrainingDashboardDrawer` pattern (component-level state).

## 7. Allowed Side Effects

| Side Effect | Trigger | Boundary |
| --- | --- | --- |
| `workbenchStore.addTab` | openDueReviewItem, openInboxTask, openIncompleteAttempt, openIncompleteRecallSession, openBadMoveTask | workbenchTabService calls this |
| `workbenchStore.setActiveTab` | Same as above | workbenchTabService calls this |
| `workbenchStore.updateTab` (parent childTabIds) | openTask with parentTabId | workbenchTabService calls this |
| `runtimeStore.setActiveAttempt` | openIncompleteAttempt | Container calls this (PROPOSED_GAP) |
| `runtimeStore.setActiveRecallSession` | openIncompleteRecallSession | Container calls this (PROPOSED_GAP) |
| `repository.loadTask`, `repository.loadAttempt`, etc. | All dashboard open actions | Service calls repository |
| `repository.listDueReviewItems`, `repository.listIncompleteAttempts`, etc. | refreshDashboard | Service calls repository |

## 8. Forbidden Side Effects

| Forbidden Side Effect | Reason |
| --- | --- |
| Dashboard UI directly calling `db.js` or `window.sabaki.db` | Must go through repository (Arch v0.5 Section 3.5) |
| Dashboard UI directly importing `reviewService`, `workbenchTabService`, or `repository` | Panels must be presentational (Arch v0.5 Section 0.3) |
| Dashboard UI accessing `window.sabaki.db`, `sabaki.db`, `window.sabaki.startReviewSession()`, `sabaki.closeDrawer()`, `sabaki.startProblem()` at runtime | These are legacy global access patterns that bypass the service layer |
| Container directly calling `sabaki.startReviewSession` or legacy global functions | Must use v0.5 service path |
| Container calling `workbenchTabService.openProblemTab` or `openGameTab` | Must use `openTask` (Arch v0.5 Section 5.2) |
| Container writing to `workbenchStore` directly for open actions | Must go through `workbenchTabService.openTask` |
| Dashboard creating new ReviewSchedule entries | Dashboard is read-only for data; only training results update schedules |
| Dashboard modifying existing Attempt or RecallSession records | Dashboard only opens/resumes; does not mutate |
| Using `origin.provider` as a flow branch to decide mode | Mode is inferred from task fields (prompt/goal/etc), not origin (PRD v0.5 Section 2.3) |

## 9. Test/Acceptance Contract Table

### 9.1 Dashboard Wiring Tests

| ID | Type | Classification | Contract | Importance | Missing Risk |
| --- | --- | --- | --- | --- | --- |
| D-T00 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Props routing path verified: Container shellProps include dashboard handlers and dashboardData; DrawerManager receives and forwards them to TrainingDashboardDrawer | HIGH | Handlers/data never reach the drawer |
| D-T01 | CONTAINER_DELEGATION | MUST_AUTOMATE | Container.handleOpenDueReviewItem(scheduleId) delegates to reviewService.openDueItem; Container does NOT call workbenchTabService directly (it is an internal dependency of reviewService) | HIGH | Users cannot start复习 from dashboard |
| D-T01b | CONTROLLER_STATE_TRANSITION | MUST_AUTOMATE | reviewService.openDueItem -> workbenchTabService.openTask results in workbenchStore state change: new tab with correct taskId and inferred mode | HIGH | Service chain does not produce store state |
| D-T02 | CONTAINER_DELEGATION | MUST_AUTOMATE | Container.handleOpenInboxTask(taskId) delegates to workbenchTabService.openTask | HIGH | Users cannot open inbox tasks |
| D-T03 | CONTAINER_DELEGATION | MUST_AUTOMATE | Container.handleOpenIncompleteAttempt(attemptId) delegates to workbenchTabService.openTask with the attempt's taskId | MEDIUM | Users cannot resume attempts |
| D-T04 | CONTAINER_DELEGATION | MUST_AUTOMATE | Container.handleOpenIncompleteRecallSession(sessionId) delegates to workbenchTabService.openTask with mode:'recall' | MEDIUM | Users cannot resume recall sessions |
| D-T05 | CONTAINER_DELEGATION | MUST_AUTOMATE | Container.handleOpenBadMoveTask(taskId) delegates to workbenchTabService.openTask; mode defaults to 'problem' | HIGH | Users cannot practice punishments |
| D-T06a | CONTAINER_DELEGATION | MUST_AUTOMATE | Container.handleRefreshDashboard invokes each service/repo method (reviewService.getDueItems, repository queries); each called with correct arguments | HIGH | Dashboard data loading broken |
| D-T06b | DATA_LOADING | MUST_AUTOMATE | Real services + in-memory repo fake assemble correct dashboardData object from multiple sources | HIGH | Dashboard shows stale or no data |
| D-T06b-1 | DATA_LOADING | MUST_AUTOMATE | dashboardData.dueItems populated from reviewService.getDueItems (GREEN: method exists) | HIGH | Due items missing |
| D-T06b-2 | DATA_LOADING | MUST_AUTOMATE | dashboardData.incompleteAttempts populated from repository.listIncompleteAttempts (GREEN: method exists) | MEDIUM | Incomplete attempts missing |
| D-T06b-3 | DATA_LOADING | MUST_AUTOMATE | dashboardData.incompleteRecallSessions populated from repository.listIncompleteRecallSessions (GREEN: method exists) | MEDIUM | Incomplete recall sessions missing |
| D-T06b-4 | DATA_LOADING | MUST_AUTOMATE | dashboardData.inboxTasks populated from repository.listTasksByStatus('inbox') (RED: GAP-D4, method does not exist yet) | HIGH | Inbox tasks missing |
| D-T06b-5 | DATA_LOADING | MUST_AUTOMATE | dashboardData.recentBadMoveTasks populated from repository.listTasksByOriginProvider('bad_move') (RED: GAP-D3, method does not exist yet) | HIGH | Bad-move tasks missing |
| D-T07 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | TrainingDashboardDrawer has no static import of reviewService, repository, workbenchTabService, db.js AND no runtime access to window.sabaki.db, sabaki.db, sabaki.startReviewSession(), sabaki.startProblem(), sabaki.closeDrawer(), or any direct database access pattern | HIGH | Architecture violation |
| D-T08 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Container open actions do NOT call openProblemTab, openGameTab, openSnapshotProblemTab, or legacy sabaki.startReviewSession | HIGH | v0.5 violation |
| D-T09 | STORE_SUBSCRIPTION | MUST_AUTOMATE | After openDueReviewItem, workbenchStore.activeTabId points to the newly created tab | HIGH | Tab opens but is not active |
| D-T10 | PROJECTION_RETURN | MUST_AUTOMATE | After openBadMoveTask, projectFromWorkbench returns mode:'problem' for bad-move task with prompt | HIGH | Wrong mode opened |
| D-T11 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | refreshDashboard does not modify workbenchStore or runtimeStore | MEDIUM | Read-only operation has write side effects |
| D-T12 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Dashboard data queries use reviewService.getDueItems, NOT direct repository.listDueReviewItems or db.getDueReviews | MEDIUM | Bypassing service layer |

### 9.2 Regression Tests

| ID | Type | Classification | Contract | Importance | Missing Risk |
| --- | --- | --- | --- | --- | --- |
| R-T01 | WIRING | MUST_AUTOMATE | Board click in Play mode still routes through boardInteractionController and produces correct move | HIGH | Board interaction broken |
| R-T02 | WIRING | MUST_AUTOMATE | Board click in Problem mode still routes through boardInteractionController | HIGH | Problem mode broken |
| R-T03 | STATE | MUST_AUTOMATE | modeBarPolicy computed correctly for all four modes after dashboard handler wiring | HIGH | Mode bar shows wrong state |
| R-T04 | STATE | MUST_AUTOMATE | handleSubmit still calls flowService.submit and freezes attempt, transitions to recall | HIGH | Submit broken |
| R-T05 | STATE | MUST_AUTOMATE | handleEnterAnalysis still calls flowService.enterAnalysis and updates tab mode | MEDIUM | Analysis entry broken |
| R-T06 | STATE | MUST_AUTOMATE | handleSnapshot still calls flowService.snapshotFromCurrentContext | MEDIUM | Snapshot broken |
| R-T07 | STATE | MUST_AUTOMATE | handleModeChange still routes through getModeTransitionAction for enterAnalysis/returnFromAnalysis | MEDIUM | Mode switching broken |
| R-T08 | WIRING | MUST_AUTOMATE | Player config handlers (handleBlackPlayerChange, handleWhitePlayerChange, handleProblemOpponentChange) still route to flowService.updatePlayerConfig | MEDIUM | Player config broken |
| R-T09 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Container still does NOT import services/repositories/db directly (static analysis) | HIGH | Architecture regression |
| R-T10 | STATE | MUST_AUTOMATE | projectFromWorkbench still correctly projects mode, games, activeIndex, blackPlayer, whitePlayer, problemOpponent after dashboard handlers are added | HIGH | Projection broken by new state |
| R-T11 | WIRING | MUST_AUTOMATE | Recall checkpoint handlers (handleSubmitCorrection, handleRevealAI, handleSkipCheckpoint, handleSaveCheckpointComment) still work | MEDIUM | Recall checkpoint broken |
| R-T12 | WIRING | MUST_AUTOMATE | Review queue handlers (handleStartReviewSession, handleAdvanceReview, handleReviewResult) still work | MEDIUM | Review queue broken |

## 10. Must-Automate Tests (Detailed)

### Test Layer Classification

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D-T00 | ARCHITECTURE_BOUNDARY | Props routing: Container -> DrawerManager -> TrainingDashboardDrawer | DrawerManager source code, Container source code | none | N/A | N/A | Container includes dashboard handlers in shellProps; DrawerManager passes dashboard-related props (dashboardData, onOpenDueReviewItem, onOpenInboxTask, onOpenIncompleteAttempt, onOpenIncompleteRecallSession, onOpenBadMoveTask, onRefreshDashboard) to TrainingDashboardDrawer | D-T01 |
| D-T01 | CONTAINER_DELEGATION | Container.handleOpenDueReviewItem | real workbenchStore, real runtimeStore | mock reviewService (whole object with `openDueItem` spy) | real production interface `ReviewService` | Do NOT mock workbenchTabService, workbenchStore, or runtimeStore | reviewService.openDueItem was called with correct scheduleId | D-T01b, D-T09 |
| D-T01b | CONTROLLER_STATE_TRANSITION | reviewService.openDueItem -> workbenchTabService.openTask -> store change | real workbenchStore, real runtimeStore, real reviewService, real workbenchTabService | in-memory repository fake | in-memory repository fake implementing loadReviewSchedule, loadTask | Do not mock workbenchStore, workbenchTabService, or reviewService | workbenchStore has new tab with correct taskId and mode | D-T09 |
| D-T02 | CONTAINER_DELEGATION | Container.handleOpenInboxTask | real workbenchStore, real runtimeStore | mock workbenchTabService | real production interface `WorkbenchTabService` | Do not mock workbenchStore | workbenchTabService.openTask called with {taskId} | not-covered |
| D-T03 | CONTAINER_DELEGATION | Container.handleOpenIncompleteAttempt | real workbenchStore, real runtimeStore | mock workbenchTabService, mock repository (loadAttempt spy) | real production interfaces | Do not mock workbenchStore | workbenchTabService.openTask called with attempt's taskId | not-covered |
| D-T04 | CONTAINER_DELEGATION | Container.handleOpenIncompleteRecallSession | real workbenchStore, real runtimeStore | mock workbenchTabService, mock repository (loadRecallSession spy) | real production interfaces | Do not mock workbenchStore | workbenchTabService.openTask called with {taskId, mode:'recall'} | not-covered |
| D-T05 | CONTAINER_DELEGATION | Container.handleOpenBadMoveTask | real workbenchStore, real runtimeStore | mock workbenchTabService | real production interface `WorkbenchTabService` | Do not mock workbenchStore | workbenchTabService.openTask called with {taskId, mode inferred as 'problem'} | D-T10 |
| D-T06a | CONTAINER_DELEGATION | Container.handleRefreshDashboard | real runtimeStore | mock reviewService, mock repository | real production interfaces | Do not mock workbenchStore for state checks | reviewService.getDueItems called; repository.listIncompleteAttempts called; repository.listIncompleteRecallSessions called; repository.listTasksByStatus('inbox') called; repository.listTasksByOriginProvider('bad_move') called | D-T06b |
| D-T06b | DATA_LOADING | refreshDashboard data assembly | real reviewService, real workbenchTabService | in-memory repository fake | in-memory repository fake implementing all query methods | Do not mock services | dashboardData object has correct shape: {dueItems, inboxTasks, incompleteAttempts, incompleteRecallSessions, recentBadMoveTasks, loading:false, error:null} | not-covered |
| D-T06b-1 | DATA_LOADING | dashboardData.dueItems from reviewService.getDueItems | real reviewService | in-memory repository fake | in-memory repository fake | Do not mock reviewService | dashboardData.dueItems is the array returned by reviewService.getDueItems() | GREEN |
| D-T06b-2 | DATA_LOADING | dashboardData.incompleteAttempts from repository.listIncompleteAttempts | real repository | in-memory repository fake pre-populated with attempts | in-memory repository fake | Do not mock repository | dashboardData.incompleteAttempts is the array from listIncompleteAttempts() | GREEN |
| D-T06b-3 | DATA_LOADING | dashboardData.incompleteRecallSessions from repository.listIncompleteRecallSessions | real repository | in-memory repository fake pre-populated with sessions | in-memory repository fake | Do not mock repository | dashboardData.incompleteRecallSessions is the array from listIncompleteRecallSessions() | GREEN |
| D-T06b-4 | DATA_LOADING | dashboardData.inboxTasks from repository.listTasksByStatus | none (method does not exist) | N/A | N/A | N/A | repository.listTasksByStatus('inbox') returns inbox tasks | RED (GAP-D4) |
| D-T06b-5 | DATA_LOADING | dashboardData.recentBadMoveTasks from repository.listTasksByOriginProvider | none (method does not exist) | N/A | N/A | N/A | repository.listTasksByOriginProvider('bad_move') returns bad-move tasks | RED (GAP-D3) |
| D-T07 | ARCHITECTURE_BOUNDARY | TrainingDashboardDrawer static imports AND runtime access patterns | TrainingDashboardDrawer source code (static analysis) | none | N/A | N/A | (1) No `import`/`require` of reviewService, repository, workbenchTabService, db.js; (2) No `window.sabaki.db`, `sabaki.db`, `window.sabaki.startReviewSession()`, `sabaki.startProblem()`, `sabaki.closeDrawer()`, or any `window.sabaki.*` database/session access pattern in the source; (3) No `getDashboardSummary`, `getProblemsByStatus` calls | none |
| D-T08 | ARCHITECTURE_BOUNDARY | Container handler implementations | Container source code analysis | none | N/A | N/A | No call to openProblemTab, openGameTab, sabaki.startReviewSession in dashboard handlers | none |
| D-T09 | STORE_SUBSCRIPTION | workbenchStore after openDueReviewItem | real workbenchStore | mock reviewService.openDueItem to call real workbenchTabService internally | shared typed spy factory | Do not mock workbenchStore | workbenchStore.getState().activeTabId === new tab id; tab.taskId matches | D-T10 |
| D-T10 | PROJECTION_RETURN | projectFromWorkbench after openBadMoveTask | real workbenchStore | none | N/A | Do not mock workbenchStore | projected mode === 'problem' for bad-move task with prompt | not-covered |
| D-T11 | SIDE_EFFECT_BOUNDARY | refreshDashboard | real workbenchStore, real runtimeStore | mock reviewService, mock repository | real production interfaces | none | workbenchStore state unchanged after refreshDashboard | none |
| D-T12 | CONTAINER_DELEGATION | Container.refreshDashboard vs direct repo | Container source code | none | N/A | N/A | refreshDashboard calls reviewService.getDueItems, not repository.listDueReviewItems directly | none |
| R-T01 | CONTROLLER_STATE_TRANSITION | boardInteractionController in Play mode | real workbenchStore, real boardInteractionController | mock playServices | real production interface | Do not mock workbenchStore | Click still routes through controller; move appended | not-covered |
| R-T02 | CONTROLLER_STATE_TRANSITION | boardInteractionController in Problem mode | real workbenchStore, real boardInteractionController | mock playServices | real production interface | Do not mock workbenchStore | Click still routes through controller | not-covered |
| R-T03 | PROJECTION_RETURN | computeModeBarPolicy for all modes | real workbenchStore | none | N/A | Do not mock workbenchStore | modeBarPolicy correct for play/problem/recall/analysis | not-covered |
| R-T04 | CONTAINER_DELEGATION | Container.handleSubmit | real workbenchStore, real runtimeStore | mock flowService | real production interface `WorkbenchFlowService` | Do not mock workbenchStore | flowService.submit called with activeTab.id | not-covered |
| R-T05 | CONTAINER_DELEGATION | Container.handleEnterAnalysis | real workbenchStore | mock flowService | real production interface | Do not mock workbenchStore | flowService.enterAnalysis called | not-covered |
| R-T06 | CONTAINER_DELEGATION | Container.handleSnapshot | real workbenchStore | mock flowService | real production interface | Do not mock workbenchStore | flowService.snapshotFromCurrentContext called | not-covered |
| R-T07 | CONTAINER_DELEGATION | Container.handleModeChange | real workbenchStore | mock flowService | real production interface | Do not mock workbenchStore | Correct action dispatched for analysis transitions | not-covered |
| R-T08 | CONTAINER_DELEGATION | Player config handlers | real workbenchStore | mock flowService | real production interface | Do not mock workbenchStore | flowService.updatePlayerConfig called with correct patches | not-covered |
| R-T09 | ARCHITECTURE_BOUNDARY | Container imports | static file analysis | none | N/A | N/A | No direct import of services/repositories/db | none |
| R-T10 | PROJECTION_RETURN | projectFromWorkbench | real workbenchStore | none | N/A | Do not mock workbenchStore | Correct projection of mode, games, activeIndex, blackPlayer, whitePlayer, problemOpponent | not-covered |
| R-T11 | CONTAINER_DELEGATION | Recall checkpoint handlers | real workbenchStore, real runtimeStore | mock recallCheckpointService | real production interface | Do not mock stores | Correct service calls for each checkpoint handler | not-covered |
| R-T12 | CONTAINER_DELEGATION | Review queue handlers | real workbenchStore, real runtimeStore | mock reviewService | real production interface | Do not mock stores | Correct service calls for each review handler | not-covered |

### Mock Contract Source Justification

- **mock reviewService**: Constrained by `ReviewService` type from `src/modules/training/review/reviewService.ts`. Must implement `getDueItems`, `openDueItem`, `updateScheduleAfterResult`, `addToReviewQueue`, `startSession`, `advanceReview`. Tests should use a shared typed spy factory, not per-file hand-written mocks.
- **mock workbenchTabService**: Constrained by `WorkbenchTabService` type from `src/modules/training/workbench/workbenchTabService.ts`. Must implement `openTask`, `closeTab`, `switchTab`. For state-transition tests (D-T01b), use the real `createWorkbenchTabService` with in-memory repository fake.
- **mock repository**: For tests that only need `loadAttempt`/`loadRecallSession`, use a local tiny stub that returns test fixture data. For tests that need full repository behavior, use an in-memory repository fake.
- **mock flowService**: Constrained by `WorkbenchFlowService` type. Must implement `submit`, `enterAnalysis`, `returnFromAnalysis`, `completeRecall`, `snapshotFromCurrentContext`, `restartAttempt`, `updatePlayerConfig`.
- **mock recallCheckpointService**: Constrained by `RecallCheckpointService` type. Must implement `submitUserCorrectionLine`, `revealAiCandidateLines`, `skipCheckpoint`, `saveComment`, `resumeRecall`.

### D-T01 Mock Strategy Rationale (BLOCK-2 fix)

D-T01 is CONTAINER_DELEGATION: it must only mock what Container directly calls. Container calls `reviewService.openDueItem(scheduleId)`. `workbenchTabService` is an internal dependency of `reviewService`, not of Container. Therefore:

- D-T01 mocks ONLY `reviewService` (the whole object). Asserts `reviewService.openDueItem` was called with the correct scheduleId.
- D-T01 does NOT mock `workbenchTabService`. If `reviewService.openDueItem` internally calls `workbenchTabService`, that is invisible to D-T01. D-T01 only proves Container delegation.
- D-T01b uses real `reviewService` + real `workbenchTabService` + in-memory repository fake to prove the full service chain produces the correct store state change.

### Upstream Caller Signature Evidence

- `TrainingDashboardDrawer` line 73: `onClick: startReview` -- single argument `scheduleId` is passed via closure in dashboard button onClick. The callback signature is `onStartReview()` (no args) in current legacy code, but the new wiring should accept `scheduleId` for per-item opening.
- `TrainingDashboardDrawer` line 101: `onClick: () => startProblem(p.id)` -- passes `taskId` as single string arg.
- **IMPORTANT**: The existing `TrainingDashboardDrawer` uses `onStartReview`, `onStartProblem`, `onStartRecall` props which are coarse-grained. The new wiring needs per-item callbacks. These new callback prop names must be added to TrainingDashboardDrawer. The contract specifies the new prop names below.

### New Dashboard Handler Props for TrainingDashboardDrawer

| Prop Name | Signature | UI Trigger | Description |
| --- | --- | --- | --- |
| `onOpenDueReviewItem` | `(scheduleId: string) => void` | Per-item "Start Review" button | Opens a specific due review item |
| `onOpenInboxTask` | `(taskId: string) => void` | Inbox item "Solve" button | Opens a specific inbox task |
| `onOpenIncompleteAttempt` | `(attemptId: string) => void` | Attempt item "Resume" button | Resumes an incomplete attempt |
| `onOpenIncompleteRecallSession` | `(sessionId: string) => void` | Recall session "Resume" button | Resumes an incomplete recall session |
| `onOpenBadMoveTask` | `(taskId: string) => void` | Bad-move task "Practice" button | Opens a bad-move derived task |
| `onRefreshDashboard` | `() => void` | Drawer open / refresh button | Reloads all dashboard data |
| `dashboardData` | `DashboardData \| null` | N/A (data prop) | Contains all dashboard sections |

Where:
```ts
type DashboardData = {
  dueItems: ReviewSchedule[]
  inboxTasks: TrainingTask[]
  incompleteAttempts: TrainingAttempt[]
  incompleteRecallSessions: RecallSession[]
  recentBadMoveTasks: TrainingTask[]
  loading: boolean
  error: string | null
}
```

### PROPOSED_GAP Items

| GAP ID | Description | Impact | Exit Condition |
| --- | --- | --- | --- |
| GAP-D1 | `openIncompleteAttempt` cannot fully restore board position to last played move. `workbenchTabService.openTask` creates a new tab but does not load the attempt's board state. | User sees initial position, not where they left off. | A `workbenchTabService.resumeAttempt(taskId, attemptId)` API is added that sets up the board position from `attempt.userLine`. |
| GAP-D2 | `openIncompleteRecallSession` cannot fully restore recall state (expected moves, current move index). `workbenchTabService.openTask` with mode:'recall' does not set up the recall session view model. | User enters recall mode but without the session context loaded. | A `workbenchTabService.resumeRecall(taskId, sessionId)` API is added that restores `RecallView` in runtimeStore. |
| GAP-D3 | `listTasks` with `originProvider` filter is not yet in repository API. Need a query for "recent bad-move derived tasks". | Cannot list bad-move tasks in dashboard. | Add `listTasksByOriginProvider(provider: string, limit?: number)` to repository, or add a generic `listTasks(filter)` with origin filter support. |
| GAP-D4 | `listTasks` with `status` filter is not yet in repository API. Need a query for "inbox tasks". | Cannot list inbox tasks in dashboard. | Add `listTasksByStatus(status: string, limit?: number)` to repository. |

## 11. Manual Acceptance Only

| ID | What to Verify | How |
| --- | --- | --- |
| MA-D01 | Dashboard drawer opens and shows sections with correct data | Open dashboard in running app; verify due items, inbox, incomplete attempts, incomplete recall sessions, and bad-move tasks are listed |
| MA-D02 | Clicking a due review item opens a new workbench tab with correct mode and board position | Click each due item; verify tab opens in Play or Problem mode with correct initial position |
| MA-D03 | Clicking an inbox task opens a new workbench tab | Click inbox task; verify tab opens |
| MA-D04 | Dashboard data refreshes when reopened | Complete a training session, close and reopen dashboard; verify data updated |
| MA-D05 | Dashboard empty states display correctly | With no data, verify dashboard shows appropriate empty messages |

## 12. Do Not Test

| ID | What | Reason |
| --- | --- | --- |
| NT-D01 | TrainingDashboardDrawer CSS styling | Visual/layout concern; belongs to frontend visual workflow |
| NT-D02 | Dashboard drawer open/close animation | UI interaction concern |
| NT-D03 | Specific item count display formatting | Display concern |
| NT-D04 | Dashboard drawer position relative to workbench | Layout concern |
| NT-D05 | Legacy `onStartReview`, `onStartProblem`, `onStartRecall` handlers | These are legacy fallbacks; new wiring uses per-item handlers. Legacy handlers will be removed when dashboard is fully migrated. |

## 13. Fragile Test Warnings

| Risk | Description | Mitigation |
| --- | --- | --- |
| Mock drift for reviewService | If reviewService API changes (e.g., openDueItem signature), per-file mocks will silently pass | Use shared typed spy factory constrained by `ReviewService` type |
| Mock drift for workbenchTabService | Same risk | Use shared typed spy factory constrained by `WorkbenchTabService` type |
| Over-specified callback assertion | Testing "callback called exactly once" is fragile | Assert the end state (new tab in store, correct mode) rather than call count |
| Container render testing with all dashboard data | Rendering Container with full dashboard data requires too many mocks | Test dashboard data projection separately from Container render |
| GAP-D1/D2 resume tests | Testing "resume attempt" with incomplete API will create tests that assert incomplete behavior | Mark GAP tests as RED with clear exit conditions; do not assert current incomplete behavior as GREEN |
| D-T06b-4/D-T06b-5 partial assembly | When GAP-D3/D4 are unresolved, dashboardData.inboxTasks and dashboardData.recentBadMoveTasks will be empty arrays, not populated. Test must assert the expected method was called, not that data is present. | Split into sub-tests per data source with independent GREEN/RED status |

## 14. Out of Scope

| Item | Reason |
| --- | --- |
| Full material library dialog | Separate feature; PRD v0.5 Section 6.2 / UI/UX Spec Section 1.4 |
| Dashboard statistics/charts | Not in MVP scope |
| Dashboard filtering/sorting beyond basic lists | Not in MVP scope |
| Dashboard data persistence/caching | Dashboard reloads on each open; no caching layer needed |
| Full attempt resume with board position restore | GAP-D1; deferred |
| Full recall session resume with move index restore | GAP-D2; deferred |
| Batch dashboard operations (mark all done, etc.) | Not in MVP scope |

## 15. v0.5 Conflict Check

| Check | Conclusion | Evidence | Action |
| --- | --- | --- | --- |
| Does dashboard use `origin.provider` as flow branch? | NO | Dashboard uses `workbenchTabService.openTask` which infers mode from task fields (prompt/goal/etc). `origin.provider` is only used for filtering/display, not mode decision. | Pass |
| Does dashboard introduce `openGameTab`/`openProblemTab`/`openSnapshotProblemTab`? | NO | All open actions go through `workbenchTabService.openTask`. | Pass |
| Does dashboard let `snapshotService` open tabs? | NO | Dashboard does not involve snapshotService. | Pass |
| Does Container directly write to workbenchStore for dashboard open actions? | NO | All writes go through workbenchTabService.openTask. | Pass |
| Does TrainingDashboardDrawer import services/repositories directly? | NO (contract enforces) | D-T07 test verifies no direct imports AND no runtime global access. | Must enforce in test |
| Does dashboard query db.js directly? | NO (contract enforces) | All queries go through reviewService or repository. D-T12 test verifies. | Must enforce in test |
| Does dashboard introduce a new board mode for "review"? | NO | PRD v0.5 Section 2.7: "Review is entry, not board mode." Dashboard opens tasks in existing modes. | Pass |
| Does ReviewSchedule use `item_type`/`item_id` instead of `taskId`? | NO | PRD v0.5 Section 4.12 and Arch v0.5 Section 5.11: ReviewSchedule references taskId. | Pass |
| Does dashboard data go into a new store? | NO | Dashboard data is held in Container local state, consistent with existing pattern. Arch v0.5 Section 4.1 says MVP only needs workbenchStore + trainingRuntimeStore. | Pass |
| Does Container call workbenchTabService directly for openDueReviewItem? | NO | Container calls reviewService.openDueItem only. workbenchTabService is an internal dependency of reviewService (Arch v0.5 Section 9.9). D-T01 enforces this. | Pass |
| Does the old window.sabaki.db code remain in TrainingDashboardDrawer? | NO (contract requires removal) | Section 20 Migration Path specifies the old code MUST be removed. D-T07 enforces no runtime access. | Must enforce in implementation |

## 16. Workbench Wiring Checklist

### Control Inventory

| Control/Area | Command | Owner | v0.5 Source | State Forward | State Return | Test Strategy | Parallel Group |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TrainingDashboardDrawer "Start Review" button | `onOpenDueReviewItem(scheduleId)` | TrainingWorkbenchContainer -> reviewService.openDueItem -> workbenchTabService.openTask | PRD 5.7, Arch 9.9 | workbenchStore.addTab + setActiveTab | Container re-renders with new active tab | D-T01 + D-T01b + D-T09 | tests/dashboard |
| TrainingDashboardDrawer inbox "Solve" button | `onOpenInboxTask(taskId)` | TrainingWorkbenchContainer -> workbenchTabService.openTask | PRD 5.1, Arch 9.2 | workbenchStore.addTab + setActiveTab | Container re-renders | D-T02 | tests/dashboard |
| TrainingDashboardDrawer attempt "Resume" button | `onOpenIncompleteAttempt(attemptId)` | TrainingWorkbenchContainer -> repository.loadAttempt -> workbenchTabService.openTask | Arch 6.2 (listIncompleteAttempts) | workbenchStore.addTab + setActiveTab + runtimeStore.setActiveAttempt (GAP-D1) | Container re-renders with attempt context | D-T03 | tests/dashboard |
| TrainingDashboardDrawer recall "Resume" button | `onOpenIncompleteRecallSession(sessionId)` | TrainingWorkbenchContainer -> repository.loadRecallSession -> workbenchTabService.openTask(mode:'recall') | Arch 6.2 (listIncompleteRecallSessions) | workbenchStore.addTab + setActiveTab + runtimeStore.setActiveRecallSession (GAP-D2) | Container re-renders in recall mode | D-T04 | tests/dashboard |
| TrainingDashboardDrawer bad-move "Practice" button | `onOpenBadMoveTask(taskId)` | TrainingWorkbenchContainer -> workbenchTabService.openTask | PRD 5.6, Arch 9.8 | workbenchStore.addTab + setActiveTab | Container re-renders in problem mode | D-T05 + D-T10 | tests/dashboard |
| TrainingDashboardDrawer open/refresh | `onRefreshDashboard()` | TrainingWorkbenchContainer -> reviewService.getDueItems + repository queries | Arch 5.11, 6.2 | No store mutation (read-only) | dashboardData prop updated, drawer re-renders | D-T06a + D-T06b | tests/dashboard |
| Props routing path | Container shellProps -> DrawerManager -> TrainingDashboardDrawer | TrainingWorkbenchContainer + DrawerManager | Arch 0.3, 1.1 | N/A | N/A | D-T00 | tests/arch |
| Architecture boundary | No direct service/repo import from drawer + no runtime global access | Static + runtime analysis | Arch 0.3 | N/A | N/A | D-T07 + D-T08 | tests/arch |
| No legacy tab APIs | No openProblemTab/openGameTab in dashboard handlers | Static analysis | Arch 5.2 | N/A | N/A | D-T08 | tests/arch |
| Dashboard uses reviewService for due items | reviewService.getDueItems, not direct repo | Container delegation | Arch 5.11 | N/A | N/A | D-T12 | tests/dashboard |
| Board click (regression) | boardInteractionController | boardInteractionController | W8-P1 wiring | Same as before | Same as before | R-T01 + R-T02 | tests/regression |
| Mode bar (regression) | computeModeBarPolicy | workbenchUiPolicy | W8-P2 wiring | Same as before | Same as before | R-T03 | tests/regression |
| Submit (regression) | handleSubmit -> flowService.submit | Container handler | W8-P2 wiring | Same as before | Same as before | R-T04 | tests/regression |
| Analysis entry (regression) | handleEnterAnalysis -> flowService.enterAnalysis | Container handler | W8-P2 wiring | Same as before | Same as before | R-T05 | tests/regression |
| Snapshot (regression) | handleSnapshot -> flowService.snapshotFromCurrentContext | Container handler | W8-P2 wiring | Same as before | Same as before | R-T06 | tests/regression |
| Mode change (regression) | handleModeChange -> getModeTransitionAction | Container handler | W8-P2 wiring | Same as before | Same as before | R-T07 | tests/regression |
| Player config (regression) | handleBlackPlayerChange/handleWhitePlayerChange/handleProblemOpponentChange -> flowService.updatePlayerConfig | Container handler | W8-P3 wiring | Same as before | Same as before | R-T08 | tests/regression |
| Container imports (regression) | No service/repo/db import | Static analysis | Arch 0.3 | N/A | N/A | R-T09 | tests/regression |
| Projection (regression) | projectFromWorkbench | Container projection | W8-P2 wiring | Same as before | Same as before | R-T10 | tests/regression |
| Recall checkpoint (regression) | handleSubmitCorrection/handleRevealAI/handleSkipCheckpoint/handleSaveCheckpointComment | Container handler | W8-P3 wiring | Same as before | Same as before | R-T11 | tests/regression |
| Review queue (regression) | handleStartReviewSession/handleAdvanceReview/handleReviewResult | Container handler | W8-P2 wiring | Same as before | Same as before | R-T12 | tests/regression |

### Subscription Contract

| Store | Subscription | Triggers | UI Update |
| --- | --- | --- | --- |
| workbenchStore | Container._unsubWorkbench | addTab, updateTab, removeTab, setActiveTab | Container.forceUpdate() -> re-project mode, games, activeIndex, playerConfig |
| runtimeStore | Container._unsubRuntime | setActiveAttempt, setActiveRecallSession, setActiveCheckpoint, setRecallView, setProblemView, setReviewQueueView | Container.forceUpdate() -> re-project recall, problem, review data |

No new subscriptions needed for dashboard. Dashboard data is loaded on-demand and held in Container local state.

### State Forward Contract

| Handler | workbenchStore Change | runtimeStore Change | Repository Read | Repository Write |
| --- | --- | --- | --- | --- |
| handleOpenDueReviewItem | addTab + setActiveTab | none | loadReviewSchedule, loadTask | none |
| handleOpenInboxTask | addTab + setActiveTab | none | loadTask | none |
| handleOpenIncompleteAttempt | addTab + setActiveTab | setActiveAttempt (GAP-D1) | loadAttempt, loadTask | none |
| handleOpenIncompleteRecallSession | addTab + setActiveTab | setActiveRecallSession (GAP-D2) | loadRecallSession, loadTask | none |
| handleOpenBadMoveTask | addTab + setActiveTab | none | loadTask | none |
| handleRefreshDashboard | none | none | listDueReviewItems, listIncompleteAttempts, listIncompleteRecallSessions, listTasks (inbox + bad-move) | none |

### State Return Contract

| Store Change | Projection | UI Effect |
| --- | --- | --- |
| workbenchStore.addTab | projectFromWorkbench: games array gains new entry | Tab bar shows new tab |
| workbenchStore.setActiveTab | projectFromWorkbench: activeIndex changes, mode derived from new active tab | Mode bar shows correct mode, panels switch |
| runtimeStore.setActiveAttempt | projectFromRuntime: may affect problemView or attempt context | Problem panel shows attempt data |
| runtimeStore.setActiveRecallSession | projectFromRuntime: may set recallView if session loaded | Recall panel shows session data |

## 17. Parallel Task Suggestions

| Parallel Task | Write Scope | Dependencies | Parallelism Reason | Merge Risk |
| --- | --- | --- | --- | --- |
| Dashboard contract + tests (D-T00 through D-T12) | test/workbench/wiring/w8-p4-dashboard-wiring.test.js, Container handler additions | Container, reviewService, workbenchTabService, workbenchStore | No overlap with regression tests | Low: new handlers added to Container, existing handlers untouched |
| Regression tests (R-T01 through R-T12) | test/workbench/wiring/w8-p4-regression.test.js | Container, all existing wiring | Tests existing behavior, no new code | Low: read-only verification |
| Container handler implementation | Container.handleOpenDueReviewItem, handleOpenInboxTask, etc. | Contract confirmed | New handler functions, no modification to existing | Low: additive only |
| DrawerManager props forwarding | DrawerManager.js: pass dashboard props to TrainingDashboardDrawer | Container, DrawerManager | New props, existing pass-through pattern | Low: additive props |
| GAP-D3/D4 repository additions | repository.listTasksByStatus, repository.listTasksByOriginProvider | repository | Independent of Container wiring | Medium: adds new repository methods |
| Dashboard data projection in Container | Container dashboardData state management, refreshDashboard handler | repository, reviewService | Independent of open handlers | Low: new state, no existing state modified |
| TrainingDashboardDrawer migration | Remove window.sabaki.db calls, accept dashboardData prop | Container, DrawerManager | Rewrites data loading in drawer | Medium: replaces existing code |

## 18. Summary of PROPOSED_GAP Items

| GAP ID | Command/State | v0.5 Status | Proposed Resolution | Test Status |
| --- | --- | --- | --- | --- |
| GAP-D1 | `openIncompleteAttempt` full resume (board position restore) | No explicit resume API in Arch v0.5 | Add `workbenchTabService.resumeAttempt(taskId, attemptId)` or handle in Container | RED |
| GAP-D2 | `openIncompleteRecallSession` full resume (recall context restore) | No explicit resume-recall API in Arch v0.5 | Add `workbenchTabService.resumeRecall(taskId, sessionId)` or handle in Container | RED |
| GAP-D3 | `repository.listTasks` with `originProvider` filter | Not in Arch v0.5 Section 6.2 Repository API | Add `listTasksByOriginProvider` to repository | RED |
| GAP-D4 | `repository.listTasks` with `status` filter | Not in Arch v0.5 Section 6.2 Repository API (listTasks with filter mentioned but not detailed) | Add `listTasksByStatus` to repository | RED |

These GAPs are marked RED. Test-writer must write red tests that document the expected behavior. When the GAP is resolved, the test turns green.

Exit conditions:
- GAP-D1/D2: When `workbenchTabService` gains resume APIs, or Container gains explicit resume logic that restores board/recall context.
- GAP-D3/D4: When `trainingRepository` gains the filtering query methods.

## 19. Existing W8 Wiring State (for Regression Reference)

The following handlers were wired in previous phases and must continue to work:

| Phase | Handlers | Store Mutations |
| --- | --- | --- |
| W8-P1 | boardInteractionController creation, gobanDataAdapter creation | None directly (controller delegates) |
| W8-P2 | handleModeChange, handleSubmit, handleEnterAnalysis, handleReturnFromAnalysis, handleEndRecall, handleSnapshot, handleSelectTab, handleCloseTab, handleAddTask, handleNewGame, handleResign, handleAbandon, handleRestartAttempt, handleStartReviewSession, handleAdvanceReview, handleReviewResult, handleCreateTaskFromBadMove | workbenchStore: addTab, updateTab, setActiveTab, removeTab; runtimeStore: setReviewQueueView |
| W8-P3 | handleBlackPlayerChange, handleWhitePlayerChange, handleProblemOpponentChange, handleSubmitCorrection, handleRevealAI, handleSkipCheckpoint, handleSaveCheckpointComment, onHint, onSkip, onEndRecall, onMarkCheckpoint (no-op), onVerify (no-op), onRecallToggle (no-op) | workbenchStore: updateTab (playerConfig); runtimeStore: setActiveCheckpoint, setCorrectionDraft |

Regression tests must verify that these handlers still function correctly after dashboard handlers are added to the same Container.

## 20. TrainingDashboardDrawer Migration Path (BLOCK-1)

### Current State

The current `TrainingDashboardDrawer.js` (source: `src/components/drawers/TrainingDashboardDrawer.js`) directly calls:

- `window.sabaki.db.getDashboardSummary()` (line 22)
- `window.sabaki.db.getProblemsByStatus('inbox', 10)` (line 23)
- `sabaki.closeDrawer()` (lines 36, 45, 53)
- `sabaki.startReviewSession()` (line 36, fallback)
- `sabaki.startProblem(id)` (line 37, fallback)
- `sabaki.startRecallSession(gameId)` (line 38, fallback)

All of these are forbidden by Architecture v0.5 (Section 0.3, Section 3.5).

### Required Migration

This migration is IN SCOPE for W8-P4. Implementation MUST:

1. **Remove `window.sabaki.db` calls entirely**. The `componentWillReceiveProps` lifecycle method currently loads data via `window.sabaki.db`. This must be replaced by receiving `dashboardData` as a prop from Container. The drawer becomes fully presentational: it receives data, renders it, and fires callback props.

2. **Remove `sabaki.closeDrawer()`, `sabaki.startReviewSession()`, `sabaki.startProblem()`, `sabaki.startRecallSession()` calls**. Replace with callback props: `onOpenDueReviewItem`, `onOpenInboxTask`, `onOpenIncompleteAttempt`, `onOpenIncompleteRecallSession`, `onOpenBadMoveTask`, `onRefreshDashboard`.

3. **Remove `componentWillReceiveProps` data loading logic**. The drawer no longer loads its own data. It receives `dashboardData` as a prop. Data loading is triggered by `onRefreshDashboard` callback (which Container handles).

4. **Remove `this.state` management for summary/loading/inboxProblems**. All display state comes from `dashboardData` prop.

5. **Remove the `import sabaki from '../../modules/sabaki.js'` statement** (line 2). The drawer must have zero imports from non-presentational modules.

6. **Replace legacy fallback handlers**. The current code at lines 36-38 defines fallback handlers that call sabaki globals. These are replaced by the new callback props listed in the "New Dashboard Handler Props" section.

### Migration Steps for Implementation Agent

1. In `TrainingDashboardDrawer.js`:
   - Remove `import sabaki from '../../modules/sabaki.js'`
   - Remove `componentWillReceiveProps` method entirely
   - Remove `this.state` initialization in constructor
   - Change `render()` to destructure new props: `dashboardData`, `onOpenDueReviewItem`, `onOpenInboxTask`, `onOpenIncompleteAttempt`, `onOpenIncompleteRecallSession`, `onOpenBadMoveTask`, `onRefreshDashboard`
   - Use `dashboardData.loading`, `dashboardData.error`, `dashboardData.dueItems`, etc. instead of `this.state`
   - Wire button onClick handlers to the new callback props
   - Close drawer via a new `onCloseDrawer` callback prop (or keep `sabaki.closeDrawer` as a TEMPORARY MIGRATION SEAM with exit condition: when drawer open/close is managed by Container)

2. In `DrawerManager.js`:
   - Import `sabaki` is already present
   - Add forwarding of dashboard props: `dashboardData`, `onOpenDueReviewItem`, `onOpenInboxTask`, `onOpenIncompleteAttempt`, `onOpenIncompleteRecallSession`, `onOpenBadMoveTask`, `onRefreshDashboard`
   - See Section 21 for the exact routing path

3. In `TrainingWorkbenchContainer.js`:
   - Add `handleRefreshDashboard` handler that calls services/repository
   - Add `handleOpenDueReviewItem`, `handleOpenInboxTask`, etc. handlers
   - Add `dashboardData` to Container local state
   - Include these handlers in the props passed to DrawerManager (via `shellHandlers` or a new `dashboardHandlers` object)

### Temporary Migration Seams

| Seam | Current Usage | Exit Condition |
| --- | --- | --- |
| `sabaki.closeDrawer()` | May remain in TrainingDashboardDrawer's close button | When Container manages drawer open/close state, closeDrawer becomes a callback prop `onCloseDrawer` |

All other `window.sabaki.*` usage must be removed in W8-P4. No other temporary seams are allowed.

## 21. Props Routing Path (BLOCK-5)

### Current Architecture

```
App.js render()
  -> h(DrawerManager, { ...state, ...engineProps })   [line 742]
     -> h(TrainingDashboardDrawer, { show: openDrawer === 'training' })  [DrawerManager.js line 167]
```

Currently `DrawerManager` only passes `show` to `TrainingDashboardDrawer`. No other props reach the drawer.

### Required Routing Path

```
TrainingWorkbenchContainer.render()
  -> builds shellHandlers including dashboard handlers:
       onOpenDueReviewItem, onOpenInboxTask, onOpenIncompleteAttempt,
       onOpenIncompleteRecallSession, onOpenBadMoveTask, onRefreshDashboard
  -> builds dashboardData from Container local state
  -> h(WorkbenchShell, { ...shellHandlers, ...dashboardData })
     -> WorkbenchShell passes ...rest to DrawerManager (via children or separate prop)
        NOTE: WorkbenchShell currently does NOT render DrawerManager.
              DrawerManager is rendered by App.js, not by WorkbenchShell.
```

**Chosen Path**: Since `DrawerManager` is rendered by `App.js` (not by `WorkbenchShell`), and `TrainingWorkbenchContainer` renders `WorkbenchShell`, the props must reach `DrawerManager` via a different mechanism. Two options:

**Option A (RECOMMENDED)**: Have `DrawerManager` read dashboard context from `sabaki.getTrainingContext()`. Container stores dashboard state in a shared context that DrawerManager can access. This avoids prop drilling through App.js.

**Option B**: Move `TrainingDashboardDrawer` rendering into `WorkbenchShell`. DrawerManager stays in App.js for legacy drawers; TrainingDashboardDrawer moves to WorkbenchShell for training-specific drawers.

**Option C**: Pass dashboard props through App.js. App.js reads from TrainingWorkbenchContainer or sabaki state and forwards to DrawerManager. This adds coupling in App.js.

### Decision: Option B

Move `TrainingDashboardDrawer` rendering into `WorkbenchShell` (or a training-specific wrapper within WorkbenchShell). This is the cleanest path because:

1. `TrainingDashboardDrawer` is a training-specific component. It does not belong in the legacy `DrawerManager`.
2. `WorkbenchShell` already receives all training context props from Container via `...rest`.
3. No changes needed in `App.js`.
4. `DrawerManager` continues to manage legacy drawers (info, score, preferences, etc.) without training coupling.

### Implementation Path

1. **Remove** `TrainingDashboardDrawer` from `DrawerManager.js` (lines 13, 167-169).
2. **Add** `TrainingDashboardDrawer` rendering to `WorkbenchShell.js`, within the shell layout. It receives props via `...rest` spread, which includes all dashboard handlers and `dashboardData` from Container.
3. **Container** includes dashboard props in the object returned from `render()`:
   ```
   return h(WorkbenchShell, {
     ...shellProps,
     ...projected,
     ...workbenchProjected,
     ...legacyHandlers,
     ...shellHandlers,
     ...dashboardHandlers,   // NEW
     dashboardData,           // NEW
     boardProps,
   })
   ```
4. **WorkbenchShell** receives these as `...rest` and can either render TrainingDashboardDrawer directly or pass to a sub-component.

### Prop Responsibility Table

| Prop | Source (who sets it) | Transport (how it travels) | Consumer (who reads it) |
| --- | --- | --- | --- |
| `dashboardData` | Container local state (from handleRefreshDashboard) | Container -> WorkbenchShell via render props -> TrainingDashboardDrawer | TrainingDashboardDrawer |
| `onOpenDueReviewItem` | Container handler function | Container -> WorkbenchShell via shellHandlers -> TrainingDashboardDrawer | TrainingDashboardDrawer "Start Review" button |
| `onOpenInboxTask` | Container handler function | Same path | TrainingDashboardDrawer "Solve" button |
| `onOpenIncompleteAttempt` | Container handler function | Same path | TrainingDashboardDrawer "Resume" button |
| `onOpenIncompleteRecallSession` | Container handler function | Same path | TrainingDashboardDrawer "Resume" button |
| `onOpenBadMoveTask` | Container handler function | Same path | TrainingDashboardDrawer "Practice" button |
| `onRefreshDashboard` | Container handler function | Same path | TrainingDashboardDrawer open/refresh |
| `show` (drawer visibility) | `sabaki.state.openDrawer === 'training'` | App.js -> DrawerManager (legacy) OR Container state (new) | TrainingDashboardDrawer |

### D-T00 Test Specification

D-T00 verifies the props routing path:

1. Read `WorkbenchShell.js` source code. Assert that TrainingDashboardDrawer is rendered (imported and used in the render function).
2. Read `DrawerManager.js` source code. Assert that TrainingDashboardDrawer is NOT rendered (no import, no `h(TrainingDashboardDrawer, ...)` call).
3. Read `TrainingWorkbenchContainer.js` source code. Assert that dashboard handler names (`onOpenDueReviewItem`, `onOpenInboxTask`, etc.) appear in the props passed to `WorkbenchShell`.
4. Read `WorkbenchShell.js` source code. Assert that dashboard-related props are forwarded to TrainingDashboardDrawer (either via spread or explicit props).

## 22. D-T07 Detailed Test Specification (BLOCK-6)

D-T07 must verify TWO categories of violations:

### 22.1 Static Import Analysis

Assert that `TrainingDashboardDrawer.js` source contains NO:

- `import ... from ...reviewService` or `require('...reviewService')`
- `import ... from ...repository` or `require('...repository')`
- `import ... from ...workbenchTabService` or `require('...workbenchTabService')`
- `import ... from .../db` or `require('.../db')`
- `import ... from .../sabaki` or `require('.../sabaki')`
- `import ... from .../logger` (logger is borderline; allowed only if logger is pure utility)

### 22.2 Runtime Access Analysis

Assert that `TrainingDashboardDrawer.js` source contains NO patterns matching:

- `window.sabaki.db` (direct DB access)
- `sabaki.db` (via imported sabaki module)
- `window.sabaki.startReviewSession`
- `sabaki.startReviewSession`
- `window.sabaki.startProblem`
- `sabaki.startProblem`
- `window.sabaki.startRecallSession`
- `sabaki.startRecallSession`
- `sabaki.closeDrawer`
- `window.sabaki.closeDrawer`
- `getDashboardSummary` (old DB query method)
- `getProblemsByStatus` (old DB query method)
- `componentWillReceiveProps` (self-loading lifecycle, must be removed)

### 22.3 Test Implementation Guidance

```javascript
// D-T07: Architecture boundary - no direct imports or runtime access
const fs = require('fs')
const path = require('path')
const source = fs.readFileSync(
  path.resolve(__dirname, '../../../../src/components/drawers/TrainingDashboardDrawer.js'),
  'utf8'
)

// Static import analysis
const forbiddenImports = [
  'reviewService', 'repository', 'workbenchTabService',
  '/db.js', '/sabaki.js', 'modules/sabaki',
]
for (const pattern of forbiddenImports) {
  assert(!source.includes(pattern), `TrainingDashboardDrawer must not import ${pattern}`)
}

// Runtime access analysis
const forbiddenRuntime = [
  'window.sabaki.db', 'sabaki.db',
  'sabaki.startReviewSession', 'window.sabaki.startReviewSession',
  'sabaki.startProblem', 'window.sabaki.startProblem',
  'sabaki.startRecallSession', 'window.sabaki.startRecallSession',
  'sabaki.closeDrawer', 'window.sabaki.closeDrawer',
  'getDashboardSummary', 'getProblemsByStatus',
  'componentWillReceiveProps',
]
for (const pattern of forbiddenRuntime) {
  assert(!source.includes(pattern), `TrainingDashboardDrawer must not use ${pattern}`)
}
```

---

End of contract.
