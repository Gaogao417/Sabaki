Date: 2026-05-25
Status: draft-for-audit

# Phase 3 Attempt / AI / Recall Convergence -- Test Contract v0.1

## 0. True Source Alignment

| Source | Sections | Constraint |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | 4.2, 5.1, 5.2, 6.1.5, 6.2, 6.5, 12.1, 12.4 | Play/Problem produce training material and submit into Recall; Workbench modes are Play/Problem/Recall/Analysis; Problem has a mutable attempt before submit; Recall records recall facts. |
| `docs/architecture/workbench-architecture-overview.md` | Mode Orchestration Layer, Mutation Contract, Problem Attempt Move, Recall Answer | Workbench mode orchestration owns companion state; Problem writes mutable Attempt/problem runtime until submit; Recall answer writes RecallSession/RecallAttempt, not the source Attempt. |
| `docs/architecture/position-source-mutation-contract.md` | `problemAttemptMove`, `recallAnswer`, executor ownership table | Problem may write mutable Attempt while playing; frozen Attempt mutation is forbidden; Recall must not mutate source Attempt `userLine`, `result`, or `status`. |
| `docs/design/workbench-mode-orchestration-contract.md` | Owner table, Mode internal behavior table, `play -> recall`, `problem -> recall`, `recall -> analysis`, highest risk points | Attempt is owned by repository + attemptService; `updateAttempt` currently bypasses frozen guards; stale async AI callbacks must not write Attempt/document state; `completeRecall` must not write source Attempt status/result/userLine. |
| `docs/archive/architecture-versions/gabaki-sabaki-training-implementation-plan.md` | Phase 3 | Migration execution scope: explicit AiMovePending/stale guard, frozen Attempt write guard, completeRecall no source Attempt status/result/userLine write, problem undo rolls back Attempt.userLine. |

## 1. User Story

As a Workbench training user, I want Play/Problem attempts to remain the single mutable record before submit, AI move requests to be discarded when they become stale, and Recall/Analysis follow-up work to leave the submitted Attempt frozen, so my training record cannot be corrupted by late engine callbacks, undo drift, or recall completion.

## 2. In Scope

- Add `AiMovePending` as runtime companion state with request id, tab id, attempt id, position hash, color, and start time.
- Guard `aiMoveService.requestAiMove` so a late engine response returns `null` and clears only its own pending fact when active tab, active attempt, mode, or position no longer matches.
- Add repository-level protection against direct frozen Attempt writes to `userLine`, `moveActors`, `result`, or `status`.
- Keep submit/finalize lifecycle valid by finalizing result before freezing the Attempt.
- Change `recallService.completeRecall` to complete only the RecallSession and runtime active recall state.
- Change `problemFlowService.undoProblemMove` to roll back runtime problem cache and the mutable Attempt `userLine` / `moveActors` together.

## 3. Out of Scope

- Full AI-vs-AI auto-play loop, move legality, pass/resign stop conditions, and UI interruption controls.
- Moving Problem out of the legacy `play + problemView` board path.
- BadMove derivation policy, punishment generation cleanup, Snapshot, Review, and visual/UI layout work.
- New persisted Recall follow-up state replacing legacy `recallCompleted`; this contract only forbids writing source Attempt status/result/userLine during Recall completion.

## 4. Position Sources And Mutation Contracts

| Mode/Action | Position Source | Mutation Contract | Expected Write Owner |
| --- | --- | --- | --- |
| Play/Problem AI request | game-tree or problem-attempt view | no mutation until response validates | `aiMoveService` records runtime pending state and returns a move; board command/attempt append remains outside this service. |
| Problem undo | game-tree migration path plus problem runtime | `problemAttemptMove` rollback | `problemFlowService` updates runtime cache and mutable Attempt; legacy controller moves tree position. |
| Recall complete | existing recall source | `recallAnswer` follow-up | `recallService` updates RecallSession/runtime only. |
| Frozen Attempt direct write | repository fact | forbidden | `trainingRepository.updateAttempt` rejects protected fields once Attempt is not `playing`. |

## 5. Expected State Flow

### AI request

```text
requestAiMove(tab, attempt, task)
-> runtimeStore.setAiMovePending({requestId, tabId, attemptId, positionHash, color, startedAt})
-> engineService.requestMove(...)
-> validate active Workbench tab, tab mode, active attempt, runtime pending request, latest Attempt position hash
-> if valid: runtimeStore.clearAiMovePending(requestId), return move inside problemArea if applicable
-> if stale: runtimeStore.clearAiMovePending(requestId), return null
```

The service does not write the game tree or append to Attempt; those writes must stay with board command / problem attempt execution.

### Submit lifecycle

```text
Attempt status playing
-> attemptService.finalizeAttemptResult(attemptId, result) stores result while mutable
-> attemptService.freezeAttempt(attemptId) stores submitted status/submittedAt
-> recallService.createRecallFromAttempt(attemptId)
-> workbenchFlowService sets tab mode recall and active recall session
```

### Recall complete

```text
recallService.completeRecall(sessionId)
-> repository.updateRecallSession({completed:true, completedAt})
-> runtimeStore.setActiveRecallSession(undefined)
-> no repository.updateAttempt call
```

### Problem undo

```text
problemFlowService.undoProblemMove()
-> read runtime problemView and mutable Attempt
-> derive evalCache/badMoves/userLine minus last runtime move
-> repository.updateAttempt(attemptId, {userLine, moveActors})
-> runtimeStore.setProblemView(...)
-> legacy controller may separately move game-tree position to parent
```

## 6. Allowed Side Effects

- Runtime `pendingAiMove` set/clear with subscriber notification.
- Engine move request through the injected engine service.
- Mutable Attempt `result`, `status`, `submittedAt`, `userLine`, and `moveActors` changes through submit/undo lifecycle while the Attempt is still `playing`.
- RecallSession `completed` and `completedAt` update.
- Problem runtime `evalCache` and `badMoves` rollback.

## 7. Forbidden Side Effects

- AI stale response must not write documentStore, Attempt, runtime problem cache, or active tab state.
- AI service must not append moves itself.
- Recall completion must not update source Attempt `userLine`, `moveActors`, `result`, or `status`.
- Repository direct update must not mutate protected Attempt fields once the loaded Attempt status is not `playing`.
- Problem undo must not mutate RecallSession, RecallAttempt, scratch analysis workspace, or frozen Attempt.

## 8. Test Contract

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3-T01 | STORE_SUBSCRIPTION | `createTrainingRuntimeStore` | real runtime store | none | none | store under test | `setAiMovePending` and `clearAiMovePending` update state and notify subscribers; clearing a different request id leaves current pending untouched. | P3-T02 |
| P3-T02 | SIDE_EFFECT_BOUNDARY | `aiMoveService.requestAiMove` | real aiMoveService, real runtime/workbench stores | local engine stub, in-memory repository fake | local tiny stub for stateless engine response; in-memory fake for latest Attempt state | aiMoveService under test | Valid AI request records pending fact, passes problemArea to engine, clears pending, and returns in-area move. | not-covered: board command append belongs to existing board interaction tests |
| P3-T03 | SIDE_EFFECT_BOUNDARY | `aiMoveService.requestAiMove` | real aiMoveService, real runtime/workbench stores | deferred engine stub, in-memory repository fake | local tiny stub for async engine; in-memory fake for Attempt position | aiMoveService under test | If active Attempt position changes before engine resolves, response returns `null` and pending is cleared without appending or writing Attempt. | not-covered: documentStore write absence is covered by service returning only a move |
| P3-T04 | SERVICE_REPOSITORY_TRANSITION | `createTrainingRepository.updateAttempt` | real repository wrapper | in-memory DB fake implementing training attempt load/update | in-memory repository DB fake | repository method under test | Direct update of frozen Attempt `userLine`, `moveActors`, `result`, or changed `status` rejects before DB update. | P3-T05 |
| P3-T05 | SERVICE_REPOSITORY_TRANSITION | `attemptService.finalizeAttemptResult` + `freezeAttempt` | real attemptService, real runtime store | in-memory repository fake with guard behavior | in-memory repository fake mirroring P3-T04 protected-field rule | attemptService under test | Submit lifecycle can store result while playing and then freeze to submitted without violating frozen guard. | P3-T08 |
| P3-T06 | SERVICE_REPOSITORY_TRANSITION | `recallService.completeRecall` | real recallService, real checkpoint service, real runtime store | strict in-memory repository fake | existing strict fake repository shape in recall tests | recallService under test | Completing RecallSession updates session/runtime and never calls `repository.updateAttempt`. | not-covered |
| P3-T07 | SERVICE_REPOSITORY_TRANSITION | `problemFlowService.undoProblemMove` | real problemFlowService, real runtime store | in-memory repository fake, local tiny monitor/problem/review stubs | in-memory fake repository; local tiny stubs for unused collaborators | problemFlowService under test | Undo rolls runtime eval/bad move cache back and persists Attempt `userLine` / `moveActors` rollback while attempt is mutable. | not-covered: legacy controller tree-position rollback covered separately |
| P3-T08 | SERVICE_REPOSITORY_TRANSITION | `workbenchFlowService.submit` | real workbenchFlowService, real workbench/runtime stores | in-memory repository fake, real-ish attempt/recall service fakes bound to lifecycle contract | in-memory fakes implementing production method names | flow service under test | Submit finalizes result before freezing, creates RecallSession, sets tab mode recall, and does not try to update protected Attempt fields after freeze. | not-covered |

## 9. Automation Classification

| Item | Classification | Type | Notes |
| --- | --- | --- | --- |
| AiMovePending runtime state | MUST_AUTOMATE | STATE | Protects async race handling and UI pending projection source. |
| AI stale response rejection | MUST_AUTOMATE | SIDE_EFFECT | Directly covers Phase 3 race gap. |
| Frozen Attempt repository guard | MUST_AUTOMATE | ARCHITECTURE_BOUNDARY | Protects source Attempt after submit from service bypass. |
| Recall complete no Attempt mutation | MUST_AUTOMATE | SERVICE_REPOSITORY_TRANSITION | Current code violates this; test is RED until fixed. |
| Problem undo rolls back Attempt line | MUST_AUTOMATE | SERVICE_REPOSITORY_TRANSITION | Current code violates this; test is RED until fixed. |
| AI-vs-AI full loop controls | DO_NOT_TEST | SIDE_EFFECT | Out of this slice; needs separate command/loop contract. |
| Manual click through Play/Problem submit | MANUAL_ACCEPTANCE | UI_BEHAVIOR | Useful after broader UI wiring, not required for this service slice. |

## 10. Fragility Risks

- Engine candidate quality and legality are not tested here; tests only assert stale guards and problemArea contract.
- Repository guard tests must not reimplement DB behavior beyond `loadTrainingAttempt` / `updateTrainingAttempt`.
- Problem undo tests must not claim game-tree rollback because that remains in the legacy controller migration path.
- `AiMovePending.positionHash` is a service-level stale guard, not a cryptographic board hash; the test should only require it changes when source SGF or Attempt `userLine` changes.
