Date: 2026-05-25
Status: approved-by-codex-audit

# Phase 2 Task Import Cleanup -- Test/Acceptance Contract v0.1

## 0. True Source Alignment

| Source | Sections | Constraint |
| --- | --- | --- |
| PRD v0.5 | 0.2, 2.2, 2.3, 5.1, 5.5, 5.6 | External materials become standard `TrainingTask`; `origin` is metadata only; imported tasks open through `workbenchTabService.openTask`; Snapshot and BadMove derived material are ordinary tasks. |
| Architecture v0.5 | Terminology mapping, 0.3, 2.2, 5.5, 9.1, 9.7, 9.8, 13.3 | `openProblemTab` / `openSnapshotProblemTab` are legacy migration terms; import ownership belongs to `taskImportService`; `snapshotService` captures input only and must not open tabs; main flow must not branch on `origin.provider`. |
| Implementation Plan | Phase 2 | Phase 2 is landed with wrapper cleanup remaining: material entries call import service and then `openTask`; Workbench handles standardized tasks only. |

## 1. User Story

As a training workflow maintainer, I want remaining legacy material wrappers to delegate task creation to `taskImportService` and tab opening to `openTask`, so the Workbench never chooses its main flow from source/kind wrappers such as `openProblemTab` or `openSnapshotProblemTab`.

## 2. Actions

- Legacy problem entry requests a problem-like task from an existing local problem id.
- Analysis snapshot creates a normal snapshot task and opens it as a child task tab.
- Review/dashboard entries continue to open existing task ids through `openTask`.

## 3. Position Sources

| Source | Use |
| --- | --- |
| game-tree | Not written by import cleanup. |
| scratch | Snapshot input may come from analysis scratch through `snapshotService.captureSnapshotInput`. |
| problem-attempt | Not mutated by import cleanup. |
| workbench-tab | Parent/child tab relation is updated only by `openTask`. |

## 4. Mutation Contract

- `taskImportService.createTaskFromLegacyProblem({problemId})` creates a standard `TrainingTask` with problem-like fields on the task and `origin.provider='local'`.
- `workbenchPhaseService.snapshotFromAnalysis(tabId)` calls `snapshotService.captureSnapshotInput`, `taskImportService.createTaskFromSnapshot`, then `workbenchTabService.openTask({taskId, mode:'problem', parentTabId})`.
- `workbenchPhaseService.snapshotFromAnalysis` must not call `snapshotService.createProblemFromCurrentAnalysisPosition`, `repository.createTask`, or `openSnapshotProblemTab`.
- Deprecated wrappers may remain exported, but new main-path code must not call `openSnapshotProblemTab`.

## 5. Allowed Side Effects

- Create a `TrainingTask`.
- Update Workbench tab state through `openTask`.
- Link child tab to parent tab through `openTask`.
- Log structured import/open events.

## 6. Forbidden Side Effects

- No new legacy `Problem` entity during Phase 2 snapshot cleanup.
- No `TrainingTask.kind='snapshot_problem'`.
- No tab opening through `openSnapshotProblemTab` on the cleaned snapshot path.
- No branch on `origin.provider` to choose Workbench mode.
- No component direct service/repository import.

## 7. Test Contract

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2-T01 | SERVICE_REPOSITORY_TRANSITION | `taskImportService.createTaskFromLegacyProblem` | real service | in-memory repository fake | local fake implements repository methods used by service | service under test | Local legacy problem becomes standard task with `origin.provider='local'` and problem-like fields | P2-T03 |
| P2-T02 | ARCHITECTURE_BOUNDARY | `taskImportService.createTaskFromLegacyProblem` | real service | in-memory repository fake | local fake implements repository methods used by service | service under test | Does not call `repository.createProblem` and does not set special task kind | P2-T03 |
| P2-T03 | SIDE_EFFECT_BOUNDARY | `workbenchPhaseService.snapshotFromAnalysis` | real phase service | spy `snapshotService`, spy `taskImportService`, spy `tabService`, in-memory store | fakes expose only called production interface methods | phase service under test | Snapshot path calls `createTaskFromSnapshot` then `openTask({mode:'problem', parentTabId})`; it does not call legacy problem creation/opening | not-covered: full UI click path belongs to later wiring |
| P2-T04 | ARCHITECTURE_BOUNDARY | `workbenchTabService` / `workbenchPhaseService` source | source text | none | static source inspection | source under test | Main cleanup path has no `openSnapshotProblemTab(` call inside `workbenchPhaseService` | not-covered |

## 8. Contract Audit

Conclusion: APPROVE_WITH_NOTES.

- The contract is scoped to Phase 2 wrapper cleanup and does not claim full Workbench UI wiring.
- State-forward coverage is limited to service/repository and phase-service orchestration. Rendered UI return is explicitly out of scope.
- Mock policy is acceptable because the mocked dependencies are downstream boundaries and the production subjects under test remain real.

Residual risk: `openProblemTab` remains exported for compatibility. Architecture review must verify it is not used by the cleaned snapshot path.
