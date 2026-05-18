# Phase 5 Test Contract: Recall Checkpoint / Comment

Date: 2026-05-18
Status: pending-confirmation

## Gap Analysis

### Already Fully Implemented and Tested (no new tests needed)
- `shouldTriggerCheckpoint`: major/severe trigger, minor skip, duplicate skip
- `startCheckpoint`: creation, runtime, dedup, error cases
- `submitUserCorrectionLine`: save, wrong-status, not-found
- `revealAiCandidateLines`: engine-line, empty-line, missing-badMove, wrong-status
- `saveComment`: save, pending_correction-to-commented, duplicate-block
- `resumeRecall`: advance, skipped-status, wrong-status, completed, not-found
- Full integration flow: create -> moves -> checkpoint -> correct -> reveal -> comment -> resume -> complete
- `submitRecallMove` checkpoint blocking and triggering

### Gaps Requiring New Code and/or Tests

| # | Gap | Severity | Description |
|---|-----|----------|-------------|
| G1 | `skipCheckpoint` function missing | P0 | `skipped` status exists, `resumeRecall` accepts it, but no function transitions to `skipped`. Phase 5 req 7: "skipped checkpoint can enter Review candidate" |
| G2 | Skipped checkpoint integration | P0 | No test verifies skipping allows resume and marks for review |
| G3 | Crash recovery for incomplete checkpoints | P1 | "incomplete recall/checkpoint can be discovered" — no recovery test |
| G4 | `correctionDraft` runtime lifecycle | P1 | Set during editing, cleared on submit — not tested |
| G5 | Comment id auto-generation | P2 | Code auto-generates but untested |
| G6 | `revealAiCandidateLines` idempotency | P2 | Already `ai_revealed` re-call untested |
| G7 | Multiple BadMoves per session | P1 | Sequential checkpoints at different indices |
| G8 | Checkpoint is substate, not mode | P0 | No test verifies checkpoint doesn't change tab.mode |
| G9 | `MoveComment` target kind = `checkpoint` | P1 | Target association untested |
| G10 | Comment as independent entity | P1 | Not embedded in Attempt — untested |

## User Stories

**US-1:** As a learner, when recall hits a major/severe bad move, the system pauses and enters checkpoint substate.
**US-2:** As a learner in checkpoint, I play correction moves before seeing AI suggestions.
**US-3:** As a learner in checkpoint, after submitting correction, I reveal AI candidate lines.
**US-4:** As a learner, I write comments saved as independent MoveComment, not embedded in Attempt.
**US-5:** As a learner, I can skip a checkpoint without correction/comment. Skipped checkpoints become review candidates.
**US-6:** After crash, incomplete recall sessions with active checkpoints are discoverable.
**US-7:** Checkpoint is a substate of recall, not a tab mode. Activating checkpoint must NOT change tab.mode.

## Test Contracts

### MUST_AUTOMATE

| ID | Type | Contract |
|----|------|----------|
| CP01 | unit | `skipCheckpoint(id)` transitions `pending_correction` to `skipped`, sets `completedAt`, clears `activeCheckpointId`, advances session `currentMoveIndex` by 1 |
| CP02 | unit | `skipCheckpoint(id)` transitions `ai_revealed` to `skipped` |
| CP03 | unit | `skipCheckpoint(id)` clears `correctionDraft` in runtime store |
| CP04 | unit | `skipCheckpoint(id)` throws if checkpoint is `commented` |
| CP05 | unit | `skipCheckpoint(id)` throws if checkpoint is already `skipped` |
| CP06 | unit | `skipCheckpoint(id)` throws if checkpoint is already completed |
| CP07 | unit | `skipCheckpoint(id)` throws if checkpoint not found |
| CP08 | integration | Full skip flow: recall hits bad move -> checkpoint -> skip -> session advances -> recall continues -> complete |
| CP09 | unit | `saveComment` auto-generates `id` when input `comment.id` is falsy |
| CP10 | unit | `revealAiCandidateLines` returns same result when called on already `ai_revealed` checkpoint (idempotent) |
| CP11 | integration | Multiple checkpoints: bad move at index 1 -> checkpoint -> resume -> bad move at index 3 -> second checkpoint -> resume -> complete |
| CP12 | unit/arch | `startCheckpoint` does NOT change tab mode; `activeCheckpointId` is set but tab mode remains `recall` |
| CP13 | unit | `saveComment` creates MoveComment with `target.kind = 'checkpoint'` and `target.checkpointId` |
| CP14 | unit/arch | `saveComment` persists via `repository.createMoveComment` only; NOT stored inside Attempt or RecallSession |
| CP15 | unit | `submitUserCorrectionLine` clears `correctionDraft` from runtime store |
| CP16 | integration | Crash recovery: session + checkpoint without completedAt -> list incomplete -> discoverable |
| CP17 | unit | Skipped checkpoint has `completedAt` set but no `userCommentId` |
| CP18 | integration | Skip + resume does not accidentally complete session; `completeRecall` still needed |

## Fragile Test Warnings

1. CP08, CP11 (integration): Do NOT assert exact call ordering. Verify final state.
2. CP12 (arch boundary): Test that `startCheckpoint` only modifies `runtimeStore.activeCheckpointId`, NOT tab mode.
3. CP16 (crash recovery): Test via repository queries, not via non-existent recovery service.
4. CP09 (id auto-gen): Test that a non-empty string `id` is produced, not the format.
5. CP11 (multiple checkpoints): Test coexistence, not internal storage structure.

## Out of Scope

- `RecallCheckpointPanel.tsx` UI component (separate task)
- Review Schedule creation from skipped checkpoints (Phase 7)
- Engine analysis pipeline (Phase 4)
- `workbenchFlowService` checkpoint wiring
- Comment editing after save
