# B1: Container Store Write Fix — Test Contract v0.1

Date: 2026-05-21
Status: pending-audit

## 0. Source Alignment

| Source | Section | Constraint |
|---|---|---|
| Architecture v0.5 | Section 0.3 "UI only displays, does not write business Store; Container/Controller reads Store, calls Service; Service orchestrates business actions" | Container must NOT call `runtimeStore.setReviewQueueView()`. Service can write to Store. |
| Architecture v0.5 | Section 1.2 "Command write path: UI Component -> Controller/Container -> Service -> Store/Repository/Adapter" | Review queue state write must go through Service layer. |
| Architecture v0.5 | Section 1.3 "Container reads Store, calls Service" | Container's relationship to runtimeStore is read-only. |
| Architecture v0.5 | Section 5.11 ReviewService API: `getDueItems`, `openDueItem`, `updateScheduleAfterResult` | Current API lacks session management; fix extends ReviewService since session management is review business orchestration. |
| Architecture v0.5 | Section 14 "Store count controlled at 2-3" | No new Store. `reviewQueueView` stays in `trainingRuntimeStore`. |
| PRD v0.5 | Section 2.7 "Review is entry point, not board mode" | Review session queue navigation is reviewService orchestration. |
| PRD v0.5 | Section 5.7 "reviewService.getDueItems -> user clicks item -> item.taskId -> workbenchTabService.openTask(taskId)" | Core flow is getDueItems + openDueItem. |

## 1. User Story

As a user, when I click "Start Review" in the Review Inbox, the system fetches due items, initializes queue view, and opens the first item. When I click "Next", it advances to the next due item. When all items are done, it clears the queue view. The Container only delegates to reviewService; it does NOT directly write runtimeStore.

## 2. State Flow

### handleStartReviewSession

```
UI event (onStartReviewSession)
  -> Container.handleStartReviewSession
  -> reviewService.startSession()
  -> reviewService.getDueItems()
  -> reviewService.runtimeStore.setReviewQueueView({queue, currentIndex:0, totalDue})
  -> reviewService.openDueItem(queue[0])
  -> runtimeStore subscription fires
  -> Container.forceUpdate()
  -> projectFromRuntime reads rt.reviewQueueView
  -> shellProps.reviewQueue, .reviewCurrentIndex, .reviewTotalDue
```

### handleAdvanceReview

```
UI event (onAdvanceReview)
  -> Container.handleAdvanceReview
  -> reviewService.advanceReview()
  -> reads runtimeStore.reviewQueueView (via getState)
  -> if nextIndex >= queue.length: setReviewQueueView(null)
  -> else: setReviewQueueView({...rv, currentIndex: nextIndex}) + openDueItem(queue[nextIndex])
  -> runtimeStore subscription fires
  -> Container.forceUpdate()
  -> projectFromRuntime reads updated reviewQueueView
  -> shellProps updated
```

## 3. Before/After Comparison

| Caller | Before | After |
|---|---|---|
| Container ~L217 | `runtimeStore.setReviewQueueView({queue, currentIndex:0, totalDue})` | `reviewService.startSession()` |
| Container ~L234 | `runtimeStore.setReviewQueueView(null)` | `reviewService.advanceReview()` (service handles null) |
| Container ~L238 | `runtimeStore.setReviewQueueView({...rv, currentIndex: nextIndex})` | `reviewService.advanceReview()` (service handles increment) |

## 4. Allowed Side Effects

- reviewService calls `runtimeStore.setReviewQueueView()` — Service writes Store is allowed (Arch v0.5 S0.3)
- reviewService calls `runtimeStore.getState()` to read current reviewQueueView
- reviewService.openDueItem() eventually calls workbenchTabService.openTask()

## 5. Forbidden Side Effects

- Container calls `runtimeStore.setReviewQueueView()` — violates Arch v0.5 S0.3
- Container reads runtimeStore then writes it back
- Container directly depends on trainingRepository
- sabaki.js facade directly calls `runtimeStore.setReviewQueueView()`

## 6. Test Contract Table

| Test ID | Layer | Production Subject | Real Deps | Mocked Deps | Forbidden Mocks | Primary Assertion | Downstream Covered By |
|---|---|---|---|---|---|---|---|
| B1-T01 | SERVICE_REPOSITORY_TRANSITION | reviewService.startSession | real runtimeStore | spy repository (listDueReviewItems), spy workbenchTabService (openTask) | runtimeStore | After call, runtimeStore.getState().reviewQueueView equals {queue:[ids], currentIndex:0, totalDue:N} | B1-T04, B1-T07 |
| B1-T02 | SERVICE_REPOSITORY_TRANSITION | reviewService.advanceReview | real runtimeStore | spy repository, spy workbenchTabService | runtimeStore | Preset queueView, call advanceReview, currentIndex increments | B1-T05 |
| B1-T03 | SERVICE_REPOSITORY_TRANSITION | reviewService.advanceReview | real runtimeStore | spy repository, spy workbenchTabService | runtimeStore | At queue end, advanceReview sets reviewQueueView === null | B1-T05 |
| B1-T04 | CONTAINER_DELEGATION | Container.handleStartReviewSession | real runtimeStore, real Container | spy reviewService.startSession | runtimeStore | Container calls reviewService.startSession, NOT runtimeStore.setReviewQueueView | B1-T01 |
| B1-T05 | CONTAINER_DELEGATION | Container.handleAdvanceReview | real runtimeStore, real Container | spy reviewService.advanceReview | runtimeStore | Container calls reviewService.advanceReview, NOT runtimeStore.setReviewQueueView | B1-T02, B1-T03 |
| B1-T06 | ARCHITECTURE_BOUNDARY | Container source | Container JS source file | none | none | Source does not contain string `setReviewQueueView` | -- |
| B1-T07 | PROJECTION_RETURN | projectFromRuntime + Container.render | real runtimeStore, real Container | spy reviewService | runtimeStore | After reviewService.startSession(), Container.render() projects correct reviewQueue/reviewCurrentIndex/reviewTotalDue | B1-T01 |
| B1-T08 | ARCHITECTURE_BOUNDARY | sabaki.js source | sabaki.js source file | none | none | sabaki.js startReviewSession/advanceReview do not contain `setReviewQueueView` | -- |
| B1-T09 | SIDE_EFFECT_BOUNDARY | reviewService.startSession | real runtimeStore | spy repository, spy workbenchTabService | runtimeStore | startSession calls openDueItem(queue[0]) | -- |

## 7. ReviewService API Extension

Current reviewService deps: `{ repository, workbenchTabService, logger }`

After fix: `{ repository, workbenchTabService, runtimeStore, logger }`

New methods:
- `startSession(): Promise<void>` — calls getDueItems, writes reviewQueueView, calls openDueItem
- `advanceReview(): Promise<void>` — reads current view, increments or clears, calls openDueItem

## 8. Impact on Existing Tests

`test/workbench/wiring/w6-review-queue-wiring.test.js`:
- W6-T01: needs startSession spy, assert reviewService.startSession called
- W6-T02/W6-T03: needs advanceReview spy
- W6-T15: integration test update to use startSession/advanceReview
- W6-T17: sabaki.startReviewSession path update

## 9. Manual Acceptance

- Click Review Inbox "Start Review" -> UI shows progress and "第 X/N 题"
- Click "Next" -> progress updates
- All items done -> queue UI disappears

## 10. Out of Scope

- Adding explicit endSession() (no current caller)
- Refactoring sabaki.js other review code (handleReviewResult)
- Changing existing getDueItems/openDueItem/updateScheduleAfterResult signatures
