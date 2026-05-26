Date: 2026-05-25
Status: draft-for-reaudit
Supersedes: test-contract-v0.1.md
Audit response: fixes BLOCK items from contract-auditor report by narrowing P3-T08 to orchestration order, requiring typed TS helpers/coverage for production doubles, expanding stale AI cases, and making deferred downstream coverage explicit.

# Phase 3 Attempt / AI / Recall Convergence -- Test Contract v0.2

## 0. True Source Alignment

| Source | Sections | Constraint |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | 4.2, 5.1, 5.2, 6.1.5, 6.2, 6.5, 12.1, 12.4 | Play/Problem produce attempts and submit into Recall; modes are Play/Problem/Recall/Analysis; Problem owns mutable attempt before submit; Recall records recall facts. |
| `docs/architecture/workbench-architecture-overview.md` | Mode Orchestration Layer, Mutation Contract, Problem Attempt Move, Recall Answer | Mode orchestration owns companion state; Problem writes mutable Attempt/problem runtime until submit; Recall writes Recall facts, not source Attempt facts. |
| `docs/architecture/position-source-mutation-contract.md` | `problemAttemptMove`, `recallAnswer`, executor ownership table | Problem may write mutable Attempt while playing; frozen Attempt mutation is forbidden; Recall must not mutate source Attempt `userLine`, `result`, or `status`. |
| `docs/design/workbench-mode-orchestration-contract.md` | Owner table, Mode internal behavior table, transition effect tables, highest-risk points | Attempt is owned by repository + attemptService; stale async AI callbacks must be generation/target guarded; repository update can bypass frozen Attempt guard; `completeRecall` must stop mutating source Attempt status/result/userLine. |
| `docs/archive/architecture-versions/gabaki-sabaki-training-implementation-plan.md` | Phase 3 | Migration execution scope: explicit AiMovePending/stale guard, frozen Attempt write guard, completeRecall no source Attempt pollution, problem undo Attempt rollback. |

## 1. User Story

As a training user, late AI replies must not alter my current board or Attempt after I undo, switch tabs, enter another mode, or start another Attempt. Once an Attempt is submitted/frozen, Recall and Analysis may read it but must not rewrite its `userLine`, `result`, or `status`. When I undo a Problem move before submit, visible problem runtime and persisted Attempt line must remain synchronized.

## 2. In Scope

- Runtime `AiMovePending` fact with request id, tab id, attempt id, position hash, mode, color, and start time.
- AI stale rejection for position change, active tab change, active attempt change, mode change, and pending request mismatch.
- Repository-level frozen Attempt guard for `userLine`, `moveActors`, `result`, and `status`.
- Submit lifecycle order: finalize result while Attempt is mutable, then freeze, then create RecallSession.
- `recallService.completeRecall` updates RecallSession/runtime only.
- `problemFlowService.undoProblemMove` rolls back runtime problem cache and mutable Attempt `userLine` / `moveActors`.

## 3. Out Of Scope

- Full AI-vs-AI auto-play loop, pass/resign stop conditions, and UI interruption controls.
- Moving Problem out of the legacy `play + problemView` board path.
- BadMove derivation policy, Snapshot, Review, and visual/UI layout work.
- Replacing legacy `recallCompleted` with a new follow-up table. This slice only forbids Recall completion from writing source Attempt protected fields.

## 4. Mock Binding Requirements

All production service/repository/store doubles used by automated tests must be bound in one of these ways:

- `.test.ts` or `test/training/phase3TypedFakes.ts` helpers using `satisfies`, `Pick<ProductionInterface, ...>`, explicit return types, or `Parameters<typeof productionFactory>[0]`.
- Existing shared typed factories from `test/workbench/shared/workbenchSpyFactories.ts` when they already expose the needed production interface.
- Local tiny stubs are allowed only for stateless callbacks or unused collaborators and must not be claimed as proving that collaborator's layer.

JS tests may call typed TS helpers, but per-file JS repository/service fakes cannot be the only contract source for P3-T02 through P3-T08.

## 5. Expected State Flow

### AI request

```text
requestAiMove(tab, attempt, task)
-> runtimeStore.setAiMovePending(...)
-> engineService.requestMove(...)
-> validate requestId, active tab, active attempt, mode, positionHash, problemArea
-> fresh: clear matching pending fact, return accepted move
-> stale: clear matching pending fact, return null, leave Attempt/runtime problem cache/active tab unchanged
```

The AI service returns a move or `null`; it must not append to Attempt or write documentStore.

### Submit lifecycle

```text
Attempt status playing
-> evaluate result
-> attemptService.finalizeAttemptResult(result) while mutable
-> attemptService.freezeAttempt()
-> recallService.createRecallFromAttempt()
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
-> require active unsubmitted problemView and playing Attempt
-> persist Attempt line/actors rollback
-> update runtime evalCache/badMoves rollback
-> return rolled-back line
```

## 6. Test Contract

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3-T01 | STORE_SUBSCRIPTION | `createTrainingRuntimeStore` | real runtime store | none | none | store under test | `setAiMovePending` and `clearAiMovePending` update state and notify subscribers; clearing another request id leaves current pending intact. | P3-T02/P3-T03 |
| P3-T02 | SIDE_EFFECT_BOUNDARY | `aiMoveService.requestAiMove` | real aiMoveService, real runtime/workbench stores | typed engine stub, typed repository pick | TS helper using `Pick<TrainingRepository, 'loadAttempt'>` and `AiMoveServiceDeps['engineService']` | aiMoveService under test | Fresh request records pending, passes problemArea to engine, clears pending, and returns in-area move. | DEFERRED-D1 |
| P3-T03a | SIDE_EFFECT_BOUNDARY | `aiMoveService.requestAiMove` | real aiMoveService, real runtime/workbench stores | typed deferred engine stub, typed repository pick | TS helper using production types | aiMoveService under test | Position changed before response: returns `null`, clears pending, and leaves Attempt/runtime problem cache/active tab unchanged. | DEFERRED-D1 |
| P3-T03b | SIDE_EFFECT_BOUNDARY | `aiMoveService.requestAiMove` | real aiMoveService, real runtime/workbench stores | typed deferred engine stub, typed repository pick | TS helper using production types | aiMoveService under test | Active tab changed before response: returns `null`, clears pending, and leaves protected state unchanged. | DEFERRED-D1 |
| P3-T03c | SIDE_EFFECT_BOUNDARY | `aiMoveService.requestAiMove` | real aiMoveService, real runtime/workbench stores | typed deferred engine stub, typed repository pick | TS helper using production types | aiMoveService under test | Active attempt changed before response: returns `null`, clears pending, and leaves protected state unchanged. | DEFERRED-D1 |
| P3-T03d | SIDE_EFFECT_BOUNDARY | `aiMoveService.requestAiMove` | real aiMoveService, real runtime/workbench stores | typed deferred engine stub, typed repository pick | TS helper using production types | aiMoveService under test | Mode changed before response: returns `null`, clears pending, and leaves protected state unchanged. | DEFERRED-D1 |
| P3-T03e | SIDE_EFFECT_BOUNDARY | `aiMoveService.requestAiMove` | real aiMoveService, real runtime/workbench stores | typed deferred engine stub, typed repository pick | TS helper using production types | aiMoveService under test | Pending request mismatch before response: older response returns `null` and does not clear newer pending fact. | DEFERRED-D1 |
| P3-T04 | SERVICE_REPOSITORY_TRANSITION | `createTrainingRepository.updateAttempt` | real repository wrapper | typed in-memory DB adapter fake | `.test.ts` DB fake typed as `Parameters<typeof createTrainingRepository>[0]` | repository method under test | Frozen Attempt rejects protected field patches before DB update. | P3-T05/P3-T06/P3-T07 |
| P3-T05 | SERVICE_REPOSITORY_TRANSITION | `attemptService.finalizeAttemptResult` + `freezeAttempt` | real attemptService, real runtime store | typed repository fake implementing used `TrainingRepository` methods | TS helper with `Pick<TrainingRepository, ...>` | attemptService under test | Result is finalized while mutable, then freeze sets submitted status without violating frozen guard. | P3-T08 |
| P3-T06 | SERVICE_REPOSITORY_TRANSITION | `recallService.completeRecall` | real recallService, real checkpoint service, real runtime store | typed in-memory repository fake | TS helper / explicit `Pick<TrainingRepository, ...>` | recallService under test | Completing RecallSession updates session/runtime and never calls `repository.updateAttempt`. | P3-T04 |
| P3-T07 | SERVICE_REPOSITORY_TRANSITION | `problemFlowService.undoProblemMove` | real problemFlowService, real runtime store | typed repository fake, unused local tiny monitor/problem/review stubs | TS helper with `Pick<TrainingRepository, ...>`; local tiny stubs only for unused deps | problemFlowService under test | Undo rolls runtime eval/bad move cache back and persists Attempt `userLine` / `moveActors` rollback while attempt is mutable. | DEFERRED-D2 |
| P3-T08 | CONTROLLER_STATE_TRANSITION | `workbenchFlowService.submit` orchestration order | real workbenchFlowService, real workbench/runtime stores | typed attempt/recall service order spies, typed repository fake | TS helper with explicit method picks; this row does not claim attempt/recall internals | workbenchFlowService under test | Flow calls finalize before freeze, creates RecallSession after freeze, sets tab mode recall. | P3-T05/P3-T06 |

## 7. Deferred Coverage

| ID | Deferred item | Approved reason | Exit condition / follow-up |
| --- | --- | --- | --- |
| DEFERRED-D1 | Board command/documentStore fresh AI application and stale no-write through `boardInteractionController`. | This slice adds the service stale guard. The current AI service returns a move and does not own documentStore/Attempt append side effects. | Follow-up wiring/controller contract should cover `boardInteractionController -> board command -> attemptService.appendMove(actor='ai')` and stale documentStore no-write. |
| DEFERRED-D2 | Legacy controller game-tree parent rollback for Problem undo. | `problemFlowService` owns runtime/Attempt synchronization; legacy controller currently owns tree-position rollback. | Follow-up explicit Problem mode migration should cover `WorkbenchMode.problem -> problemAttemptMove -> executor` tree/runtime/Attempt loop. |
| DEFERRED-D3 | UI pending indicator and user interruption control. | No visual/control change in this service slice. | Frontend/wiring contract for AI pending controls and interruption status. |

## 8. Automation Classification

| Item | Classification | Type |
| --- | --- | --- |
| AiMovePending runtime state | MUST_AUTOMATE | STATE |
| AI stale response rejection for position/tab/attempt/mode/request | MUST_AUTOMATE | SIDE_EFFECT_BOUNDARY |
| Frozen Attempt repository guard | MUST_AUTOMATE | ARCHITECTURE_BOUNDARY |
| Submit finalize/freeze order | MUST_AUTOMATE | CONTROLLER_STATE_TRANSITION |
| Recall complete no Attempt mutation | MUST_AUTOMATE | SERVICE_REPOSITORY_TRANSITION |
| Problem undo rolls back Attempt line | MUST_AUTOMATE | SERVICE_REPOSITORY_TRANSITION |
| Manual app click through AI pending/interruption | MANUAL_ACCEPTANCE | UI_BEHAVIOR |
| AI-vs-AI full loop controls | DO_NOT_TEST | SIDE_EFFECT |

## 9. Conflict Check

- No item treats `origin.provider`, legacy `source/kind`, or source-specific tab openers as workflow drivers.
- No item asks `snapshotService` to open tabs or orchestrate flow.
- No item lets UI components write repository/store state directly.
- No item lets Recall or Analysis mutate source Attempt `userLine`, `result`, or `status`.
- No item lets stale AI requests write documentStore, problem runtime, active tab state, or Attempt.
