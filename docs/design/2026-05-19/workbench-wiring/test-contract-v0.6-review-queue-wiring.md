# W6 Test Contract: Review Queue and Derived Task Wiring

Date: 2026-05-21
Status: pending

## Source of Truth

- PRD v0.5 Section 2.7: Review is entry point, not board mode
- PRD v0.5 Section 5.6: BadMove derived task flow
- PRD v0.5 Section 5.7: Review opens Task via openTask
- PRD v0.5 Section 7.2.E: MVP Review requirements
- PRD v0.5 Section 8.5: Review acceptance criteria
- Arch v0.5 Section 4.4: reviewQueueStore optional, can query DB directly
- Arch v0.5 Section 5.11: reviewService API
- Arch v0.5 Section 9.8: BadMove derived task command
- Arch v0.5 Section 9.9: Review open due task command
- Phase 7 test contract: docs/design/2026-05-18/phase7-review-badmove-derived-task/test-contract-v0.1.md

## Target Wiring Loop

```
onStartReviewSession
  -> reviewService.getDueItems()
  -> runtimeStore.setReviewQueueView({queue: scheduleIds, currentIndex: 0, totalDue: N})
  -> reviewService.openDueItem(firstScheduleId)
  -> workbenchTabService.openTask({taskId})
  -> UI shows ProblemBar with "复习 1/N"

onAdvanceReview
  -> read reviewQueueView from runtimeStore
  -> advance currentIndex
  -> [not exhausted] reviewService.openDueItem(nextScheduleId)
  -> [exhausted] runtimeStore.setReviewQueueView(null) -> exit

onReviewResult(taskId, result)
  -> reviewService.updateScheduleAfterResult({taskId, result})

onCreateTaskFromBadMove(badMoveId)
  -> taskImportService.createTaskFromBadMove({badMoveId})
  -> task created + badMove.generatedTaskId updated + review schedule auto-created
```

## User Stories

**US-1:** As a learner, clicking "start review" loads my due items and opens the first one as a normal Task (not a special review mode).

**US-2:** As a learner, clicking "下一题" in review advances to the next due item, or exits review when queue is exhausted.

**US-3:** As a learner, completing a review task automatically updates my review schedule for spaced repetition.

**US-4:** As a learner, bad moves automatically generate training tasks that enter my review queue.

**US-5:** Review is NOT a board mode -- it opens tasks in their default mode (play/problem) via inferDefaultMode.

## Test/Acceptance Contract Table

### Group A: State Forward (UI -> Service -> Store)

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| W6-T01 | WIRING | MUST_AUTOMATE | `onStartReviewSession` calls `reviewService.getDueItems()`, populates `reviewQueueView` with schedule IDs, and calls `reviewService.openDueItem` for the first item | critical | Review never starts |
| W6-T02 | WIRING | MUST_AUTOMATE | `onAdvanceReview` increments `currentIndex` and calls `reviewService.openDueItem` for the next schedule | critical | Review stuck on first item |
| W6-T03 | STATE | MUST_AUTOMATE | `onAdvanceReview` clears `reviewQueueView` to null when queue is exhausted | high | Review never ends |
| W6-T04 | WIRING | MUST_AUTOMATE | `onReviewResult({taskId, result})` calls `reviewService.updateScheduleAfterResult` | high | Schedule never updates |
| W6-T05 | SIDE_EFFECT | MUST_AUTOMATE | `onCreateTaskFromBadMove({badMoveId})` calls `taskImportService.createTaskFromBadMove` which creates task + auto-enqueues review | critical | Bad moves never generate tasks |

### Group B: State Return / Projection (Store -> UI)

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| W6-T06 | STATE | MUST_AUTOMATE | `reviewQueueView` projects `reviewQueue` (array), `reviewCurrentIndex`, `reviewTotalDue` to shellProps | critical | ProblemBar shows no data |
| W6-T07 | STATE | MUST_AUTOMATE | Null `reviewQueueView` projects undefined/empty review props | high | Stale review data shown |
| W6-T08 | STATE | MUST_AUTOMATE | ProblemBar review counter shows correct position (currentIndex+1)/totalDue | high | Wrong counter display |

### Group C: Side-Effect Isolation

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| W6-T09 | SIDE_EFFECT | MUST_AUTOMATE | `onStartReviewSession` and `onAdvanceReview` do NOT call `documentStore.playMove` | high | Review modifies game tree |
| W6-T10 | SIDE_EFFECT | MUST_AUTOMATE | `onCreateTaskFromBadMove` does NOT call `repository.createProblem` | high | Creates wrong entity type |

### Group D: Architecture Boundaries

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| W6-T11 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Container source does not import `trainingRepository` directly | critical | Bypasses service layer |
| W6-T12 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `reviewService.openDueItem` does NOT call `workbenchTabService.openProblemTab` | critical | Legacy path regression |
| W6-T13 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | ProblemBar source does not import reviewService, repository, or stores | high | Panel not presentational |
| W6-T14 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Review does NOT set `mode='review'` -- review is not a mode | critical | Architecture violation |

## State Flow

```
onStartReviewSession:
  reviewService.getDueItems()
  -> [{id: 'sched_1', taskId: 'task_a', ...}, {id: 'sched_2', taskId: 'task_b', ...}]
  -> runtimeStore.setReviewQueueView({queue: ['sched_1', 'sched_2'], currentIndex: 0, totalDue: 2})
  -> reviewService.openDueItem('sched_1')
  -> workbenchTabService.openTask({taskId: 'task_a', mode: inferDefaultMode(task)})

onAdvanceReview:
  runtimeStore.getState().reviewQueueView = {queue: ['sched_1', 'sched_2'], currentIndex: 0, totalDue: 2}
  -> update to {queue: ['sched_1', 'sched_2'], currentIndex: 1, totalDue: 2}
  -> reviewService.openDueItem('sched_2')

onAdvanceReview (exhausted):
  runtimeStore.getState().reviewQueueView = {queue: ['sched_1'], currentIndex: 0, totalDue: 1}
  -> nextIndex=1 >= queue.length=1
  -> runtimeStore.setReviewQueueView(null)

onReviewResult:
  reviewService.updateScheduleAfterResult({taskId: 'task_a', result: 'pass'})
  -> findReviewScheduleByTask('task_a')
  -> updateReviewSchedule or createReviewSchedule

onCreateTaskFromBadMove:
  taskImportService.createTaskFromBadMove({badMoveId: 'bm_1'})
  -> loadBadMove -> createTask -> updateBadMove.generatedTaskId -> createReviewSchedule
```
