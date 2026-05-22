# Phase 0: v0.5 Model Convergence - Test Contract v0.1

> Date: 2026-05-17
> Corresponding Plan: gabaki-sabaki-training-implementation-plan.md Phase 0
> Corresponding Architecture: gabaki-sabaki-training-architecture-v0.5.md

## 1. User Story

As a training system developer, I need to converge type definitions, repository mappers, and DB compatibility reads from v0.4 semantics (kind/source, phase, generatedProblemId, itemId/itemType, RecallSource) to v0.5 semantics (origin, mode, generatedTaskId, taskId, attemptId binding) without changing any visible UI behavior.

## 2. Change Contracts

| Entity | Change Contract |
|--------|----------------|
| `TrainingTask` | Type def change, repo mapper rewrite. Creation without kind/source, use origin. Old rows readable via compatibility mapper. |
| `WorkbenchTab` | Type field rename from `phase: WorkbenchPhase` to `mode: WorkbenchMode`. New value `'problem'` added. |
| `BadMove` | Field rename from `generatedProblemId` to `generatedTaskId`. Old column still readable. |
| `ReviewSchedule` | Fields `itemId + itemType` replaced by `taskId`. Old columns still readable. |
| `RecallSession` | Fields `source`, `type`, `startMove`, `endMove` replaced by `attemptId`. Old columns still readable. |
| `TrainingAttempt` | New field `moveActors`. Optional, empty/absent when missing. |

## 3. State Flows

### 3.1 TrainingTask Source-to-Origin Mapper

```text
v0.4: kind='game', source_json={kind:'game', gameId:'x'}
  -> v0.5: origin={provider:'fox'|inferred, externalId:'x'}

v0.4: kind='problem', source_json={kind:'problem', problemId:'p1'}
  -> v0.5: origin={provider:'101'|inferred, externalId:'p1'}

v0.4: kind='snapshot_problem', source_json={kind:'snapshot_problem', problemId:'p2', parentTaskId:'t1'}
  -> v0.5: origin={provider:'snapshot', externalId:'p2', parentTaskId:'t1'}

v0.4: kind='recall_segment', source_json={kind:'recall_segment', segmentId:'s1'}
  -> v0.5: origin={provider:'review', externalId:'s1'}

v0.4: kind field but no source_json -> origin={provider: kind as string}
v0.4: unrecognized kind -> origin={provider:'local', raw:{kind, source}}
```

### 3.2 WorkbenchTab Phase-to-Mode Mapper

```text
phase='play'    -> mode='play'
phase='recall'  -> mode='recall'
phase='analysis' -> mode='analysis'
New: mode='problem' (no v0.4 predecessor)
```

### 3.3 ReviewSchedule Item-to-Task Mapper

```text
itemId='prob_1', itemType='problem' -> taskId='prob_1'
itemId='seg_1', itemType='recall_segment' -> taskId='seg_1'
```

### 3.4 RecallSession Source-to-Attempt Mapper

```text
source={kind:'attempt', attemptId:'a1'} -> attemptId='a1'
source={kind:'game', ...} -> attemptId=undefined (migration warning)
```

### 3.5 BadMove generatedProblemId-to-generatedTaskId

```text
generatedProblemId='prob_1' -> generatedTaskId='prob_1'
```

### 3.6 TrainingAttempt moveActors Addition

```text
v0.4: no moveActors field -> v0.5: moveActors=undefined
New writes: moveActors=[{moveIndex:0, actor:'human'}, {moveIndex:1, actor:'ai'}]
```

## 4. Allowed Side Effects

- DB migration adds new columns to existing tables
- Type definition files modified at type-definition level
- Repository mapper functions updated
- Old columns filled on new writes (dual-write period)
- Existing tests may update to use v0.5 type names but must preserve same contracts
- Console warnings logged for unmappable old data

## 5. Forbidden Side Effects

- No UI component rendering or behavior changes
- No old DB column deletion (must remain readable)
- No existing service workflow modifications
- No new flow branching based on origin.provider
- No new window.sabaki dependencies
- No new stores
- No existing store public API surface changes (internal field rename phase->mode on WorkbenchTab is allowed as it flows through the store)

## 6. Test / Acceptance Contract Table

### Group 1: Source-to-Origin Mapping (Pure Logic)

| ID   | Type        | Classification | Contract | Why |
|------|-------------|----------------|----------|-----|
| T-01 | PURE_LOGIC  | MUST_AUTOMATE  | Game source `{kind:'game', gameId:'g1'}` maps to TaskOrigin with provider set, externalId='g1' | Old game tasks remain readable |
| T-02 | PURE_LOGIC  | MUST_AUTOMATE  | Problem source `{kind:'problem', problemId:'p1'}` maps to TaskOrigin with provider set, externalId='p1' | Old problem tasks remain readable |
| T-03 | PURE_LOGIC  | MUST_AUTOMATE  | Snapshot source preserves parentTaskId, parentAttemptId | Snapshot lineage survives migration |
| T-04 | PURE_LOGIC  | MUST_AUTOMATE  | Recall segment source maps preserving parent references | Recall segment lineage survives |
| T-05 | PURE_LOGIC  | MUST_AUTOMATE  | Unrecognized source kind maps to fallback provider with raw data preserved | Forward compatibility |
| T-06 | PURE_LOGIC  | MUST_AUTOMATE  | null/empty source maps to undefined origin | Graceful degradation |

### Group 2: WorkbenchTab Phase-to-Mode (State)

| ID   | Type   | Classification | Contract | Why |
|------|--------|----------------|----------|-----|
| T-07 | STATE  | MUST_AUTOMATE  | Old phase='play' readable as mode='play' through store | Store field rename doesn't break consumers |
| T-08 | STATE  | MUST_AUTOMATE  | New mode='problem' value works in tab creation and store updates | Problem mode is first-class |
| T-09 | STATE  | MUST_AUTOMATE  | Compatibility mapper allows reading mode from phase during transition | Mixed consumer states work |

### Group 3: Repository Roundtrip (State with real SQLite)

| ID   | Type   | Classification | Contract | Why |
|------|--------|----------------|----------|-----|
| T-10 | STATE  | MUST_AUTOMATE  | BadMove generatedTaskId roundtrips | Derived task relation survives |
| T-11 | STATE  | MUST_AUTOMATE  | ReviewSchedule taskId roundtrips | Review scheduling works |
| T-12 | STATE  | MUST_AUTOMATE  | RecallSession attemptId roundtrips | Recall bound to attempt |
| T-13 | STATE  | MUST_AUTOMATE  | TrainingAttempt moveActors roundtrips with structural correctness | Human/AI move source preserved |
| T-14 | STATE  | MUST_AUTOMATE  | TrainingTask with all v0.5 fields (initialPositionSgf, prompt, goal, passRule, referenceLines, problemArea, tags, difficulty, status, origin) roundtrips | All new fields persist through DB |
| T-15 | STATE  | MUST_AUTOMATE  | problemArea {x1:3, y1:3, x2:15, y2:15} roundtrips with exact values | Precision of AI move range |
| T-16 | STATE  | MUST_AUTOMATE  | origin with nested raw record roundtrips | Complex lineage survives |

### Group 4: Legacy Data Compatibility (State with real SQLite)

| ID   | Type   | Classification | Contract | Why |
|------|--------|----------------|----------|-----|
| T-17 | STATE  | MUST_AUTOMATE  | Old training_tasks row (kind, source_json, root_position_sgf) loads as v0.5 TrainingTask with origin populated | Existing data readable |
| T-18 | STATE  | MUST_AUTOMATE  | Old review_schedule row (item_id, item_type) loads as v0.5 ReviewSchedule with taskId set | Existing review items readable |
| T-19 | STATE  | MUST_AUTOMATE  | Old training_bad_moves row (generated_problem_id) loads with generatedTaskId set | Existing derived task links readable |
| T-20 | STATE  | MUST_AUTOMATE  | Old training_recall_sessions row (source_json with attempt kind) loads with attemptId set | Existing recall sessions readable |

### Group 5: New Code Uses v0.5 API (Architecture Boundary)

| ID   | Type                | Classification | Contract | Why |
|------|---------------------|----------------|----------|-----|
| T-21 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE  | createTask no longer requires kind/source | New code uses v0.5 API |
| T-22 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE  | ReviewSchedule creation no longer requires itemId/itemType | Simplified review model |
| T-23 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE  | updateBadMove accepts generatedTaskId patch | Renamed field works |

### Group 6: DB Migration (Wiring)

| ID   | Type    | Classification | Contract | Why |
|------|---------|----------------|----------|-----|
| T-24 | WIRING  | MUST_AUTOMATE  | New columns added, existing rows unchanged | Migration is safe for existing data |
| T-25 | WIRING  | MUST_AUTOMATE  | Running migrate() twice is idempotent | App restart safe |
| T-28 | WIRING  | MUST_AUTOMATE  | findTaskBySource (legacy API) still works for existing source-based rows | Transitional compatibility |

### Manual Acceptance Only

| ID   | Type                | Contract | How to Verify |
|------|---------------------|----------|---------------|
| T-26 | WIRING              | Repository public API backward compatible | Run npm test; all existing tests pass |
| T-27 | ARCHITECTURE_BOUNDARY | TaskOrigin provider is constrained literal union | Visual inspection of type def |

### Do Not Test

| ID   | Reason |
|------|--------|
| T-29 | Trivial type field. TypeScript compiler catches. |
| T-30 | Trivial literal union member. TypeScript compiler catches. |
| T-31 | Procedural constraint about origin.provider branching. Enforced by code review. |
| T-32 | Trivial re-export. TypeScript compiler catches. |

## 7. Brittle Test Warnings

1. **T-07, T-08, T-09**: Test behavior contract, not mapper function existence.
2. **T-17 to T-20**: Use helper to seed "v0.4 format" rows rather than inline SQL.
3. **T-21, T-22, T-23**: Test new paths work, don't test old fields are rejected.
4. **T-15**: Test coordinate survival only, not problemArea validation.
5. **T-25**: Test with empty DB for idempotency, not with pre-existing data.

## 8. Out of Scope

- taskImportService implementation (Phase 2)
- workbenchFlowService implementation (Phase 1)
- openTask default mode inference logic (Phase 1)
- Removing openGameTab/openProblemTab/openSnapshotProblemTab (Phase 1)
- workbenchPhaseService replacement with workbenchFlowService (Phase 1)
- RecallSession createRecallFromGame path removal (Phase 3)
- UI panel switching from phase-based to mode-based rendering (Phase 1/8)
- playerConfig addition to WorkbenchTab (Phase 1)
- Populating problem-like fields from Problem into TrainingTask (Phase 2)
