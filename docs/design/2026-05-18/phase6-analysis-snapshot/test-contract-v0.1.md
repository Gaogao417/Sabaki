# Phase 6 Test Contract: Analysis / Global Snapshot

Date: 2026-05-18
Status: pending

## Gap Analysis

### Already fully implemented and tested (no new tests needed)
- `snapshotService.captureSnapshotInput` — analysis-only mode (current constraint, Phase 6 expands)
- `snapshotService.createProblemFromCurrentAnalysisPosition` — full flow including persistence, logging, unique ID
- `taskImportService.createTaskFromSnapshot` — creates task with `origin.provider = 'snapshot'`
- `workbenchFlowService.snapshotFromCurrentContext` — end-to-end orchestration via snapshotService
- `workbenchFlowService.enterAnalysis` — mode transition from play/problem/recall to analysis
- `workbenchFlowService.returnFromAnalysis` — restore to previous mode from analysis
- Existing snapshotService tests cover analysis-mode capture, source resolution (via task.source.kind), logging

### Gaps Phase 6 must close

| # | Gap | Severity | Description |
|---|-----|----------|-------------|
| G1 | captureSnapshotInput analysis-only | P0 | snapshotService line 65: throws when tab.mode !== 'analysis'. Phase 6 requires all modes. |
| G2 | Source resolution uses deprecated task.source.kind | P0 | snapshotService lines 85-91 reads task.source.kind. Should read from task.origin.provider. |
| G3 | AnalysisContext type missing | P1 | src/modules/training/types/analysis.ts only has NormalizedAnalysisResult. No AnalysisContext type. |
| G4 | Analysis no-mutation invariant not tested | P0 | Architecture rule: analysis free-play must never write Attempt.userLine. Not enforced or tested yet. |
| G5 | Snapshot integration from non-analysis modes not tested | P0 | Existing tests only snapshot from analysis mode. Need play/problem/recall coverage. |
| G6 | sourceAttemptId auto-populated from tab | P2 | Convenience: derive from tab.activeAttemptId if not provided. |

## User Stories

**US-1:** As a learner, I want to snapshot the current position from any mode (play, problem, recall, analysis) so I can derive a new TrainingTask from any learning stage without switching to analysis first.

**US-2:** As a learner, I want Analysis to be a free research sandbox so my free-play moves in analysis mode never pollute the attempt's userLine.

**US-3:** As a developer, I want AnalysisContext to encapsulate context information (taskId, attemptId, checkpointId, positionHash, positionSgf, source mode) into a typed struct so analysis-related services receive rich context without loose parameter passing.

**US-4:** As a learner, I want snapshot source tracking to use the new TaskOrigin.provider field (not deprecated task.source.kind) so source information is consistent across the snapshot derivation chain.

**US-5:** As a learner, I want snapshotFromCurrentContext to work end-to-end from all modes: capture position, create a new TrainingTask with origin.provider = 'snapshot', and open it in a new tab without changing the original tab mode.

## 9. Test/Acceptance Contract Table

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| **Group A: AnalysisContext type** | | | | | |
| C01 | PURE_LOGIC | MUST_AUTOMATE | AnalysisContext type defines all required fields: taskId, attemptId?, checkpointId?, positionHash?, positionSgf?, source (literal union). Passing full input produces a valid object satisfying the type. | high | Type hole propagates at runtime |
| C02 | PURE_LOGIC | MUST_AUTOMATE | AnalysisContext.source only accepts 'play' \| 'problem' \| 'recall' \| 'direct'. Unknown strings rejected. | medium | Unexpected source modes |
| **Group B: snapshotService multi-mode capture** | | | | | |
| C03 | STATE | MUST_AUTOMATE | captureSnapshotInput succeeds when tab.mode === 'play' | high | Phase 6 core requirement |
| C04 | STATE | MUST_AUTOMATE | captureSnapshotInput succeeds when tab.mode === 'problem' | high | Phase 6 core requirement |
| C05 | STATE | MUST_AUTOMATE | captureSnapshotInput succeeds when tab.mode === 'recall' | high | Phase 6 core requirement |
| C06 | STATE | MUST_AUTOMATE | captureSnapshotInput succeeds when tab.mode === 'analysis' (existing behavior, regression guard) | high | Prevent regression |
| C07 | STATE | MUST_AUTOMATE | captureSnapshotInput returns correct positionSgf, sideToMove, sourceMoveIndex from positionSnapshotAdapter.captureCurrentPosition() | high | Capture correctness |
| C08 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | captureSnapshotInput resolves source fields from task.origin, not deprecated task.source | high | Deprecated field migration |
| C09 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | captureSnapshotInput sets sourceGameId when task.origin.provider === 'fox' | medium | Source traceability |
| C10 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | captureSnapshotInput sets sourceProblemId when task.origin.provider === '101' | medium | Source traceability |
| C11 | STATE | MUST_AUTOMATE | captureSnapshotInput does not set sourceGameId or sourceProblemId when task.origin is absent or provider is unrecognized | medium | Graceful degradation |
| C12 | STATE | MUST_AUTOMATE | captureSnapshotInput passes sourceAttemptId from input through to output | medium | Traceability |
| C13 | STATE | MUST_AUTOMATE | captureSnapshotInput defaults to tab.activeAttemptId as sourceAttemptId when input sourceAttemptId is not provided | medium | Convenience |
| C14 | STATE | MUST_AUTOMATE | captureSnapshotInput throws when tab not found | high | Error handling |
| C15 | STATE | MUST_AUTOMATE | captureSnapshotInput throws when sourceTaskId does not match tab.taskId | high | Integrity |
| C16 | STATE | MUST_AUTOMATE | captureSnapshotInput throws when task not found in repository | high | Error handling |
| C17 | SIDE_EFFECT | MUST_AUTOMATE | captureSnapshotInput logs capture event with tabId, sourceTaskId, positionHash | low | Observability |
| **Group C: Analysis no-mutation invariant** | | | | | |
| C18 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Analysis mode free-play must not call repository.updateAttempt or modify any attempt data | critical | Core architecture invariant |
| C19 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Analysis mode free-play must not write to Attempt.userLine | critical | Core architecture invariant |
| C20 | STATE | MUST_AUTOMATE | snapshotFromCurrentContext in analysis mode preserves original tab's mode, activeAttemptId, activeRecallSessionId | high | Mode preservation |
| **Group D: End-to-end Snapshot integration** | | | | | |
| C21 | WIRING | MUST_AUTOMATE | snapshotFromCurrentContext from play mode: creates TrainingTask, new tab opens, original tab mode stays play | high | E2E correctness |
| C22 | WIRING | MUST_AUTOMATE | snapshotFromCurrentContext from problem mode: same behavior | high | E2E correctness |
| C23 | WIRING | MUST_AUTOMATE | snapshotFromCurrentContext from recall mode: same behavior | high | E2E correctness |
| C24 | WIRING | MUST_AUTOMATE | snapshotFromCurrentContext from analysis mode: same behavior (regression) | high | Existing feature preserved |
| C25 | STATE | MUST_AUTOMATE | snapshotFromCurrentContext creates task with origin.provider === 'snapshot' | high | Origin tracking |
| C26 | STATE | MUST_AUTOMATE | snapshotFromCurrentContext creates task with origin.parentTaskId === tab.taskId | high | Parent-child relationship |
| C27 | STATE | MUST_AUTOMATE | snapshotFromCurrentContext creates task with origin.parentAttemptId === tab.activeAttemptId (when present) | medium | Traceability |
| C28 | WIRING | MUST_AUTOMATE | snapshotFromCurrentContext returns a new tab with parentTabId === originalTabId | high | Tab parent-child |
| C29 | WIRING | MUST_AUTOMATE | snapshotFromCurrentContext sets mode === 'problem' on new tab | medium | UI consistency |
| C30 | SIDE_EFFECT | MUST_AUTOMATE | snapshotFromCurrentContext persists new task in a single repository transaction | medium | Atomicity |
