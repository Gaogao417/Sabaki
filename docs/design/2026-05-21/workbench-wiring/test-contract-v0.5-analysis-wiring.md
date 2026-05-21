# W5 Analysis Mode Wiring Test Contract v0.5

Date: 2026-05-21
Status: approved

## 0. Truth Source Alignment

| Truth Source | Section | Constraint |
| --- | --- | --- |
| PRD v0.5 | Section 2.6 | Analysis free play is exploration by default; does not write Attempt.userLine |
| PRD v0.5 | Section 3.4 | Analysis loads task/attempt/bad moves/recall comments; shows AI candidates; allows free play/edit; Snapshot creates new TrainingTask + new Tab |
| PRD v0.5 | Section 4.4 | AnalysisContext: taskId, attemptId?, checkpointId?, positionHash?, positionSgf?, source |
| PRD v0.5 | Section 4.5 | Attempt.analysisOpened: boolean; Analysis does not pollute Attempt.userLine |
| PRD v0.5 | Section 5.4 | Analysis flexible entry from Recall/Play/Problem/direct; default no Attempt.userLine modification; free play is exploration |
| PRD v0.5 | Section 5.5 | Snapshot: any mode can snapshot; snapshotService -> createTaskFromSnapshot -> createTask -> openTask; origin.provider='snapshot' |
| PRD v0.5 | Section 6.6 | Analysis UI: top=free review/Snapshot/return/restart; right=AI candidates/BadMove/Recall comments/comparison; bottom=free play tools |
| PRD v0.5 | Section 8.4 | Analysis acceptance: can view bad moves, AI candidates, recall comments; free play does not modify Attempt.userLine; Snapshot creates new TrainingTask + new Tab |
| Arch v0.5 | Section 4.2 | WorkbenchTab.analysisContext?: AnalysisContext; writers: workbenchTabService, workbenchFlowService |
| Arch v0.5 | Section 5.3 | workbenchFlowService: enterAnalysis, returnFromAnalysis, restartAttempt, snapshotFromCurrentContext |
| Arch v0.5 | Section 8.4 | analysisResultAdapter: getAnalysisForPosition, subscribeToAnalysisUpdates |
| Arch v0.5 | Section 9.6 | enterAnalysis command path: button -> flowService -> store update -> markAnalysisOpened? -> panel loads data |
| Arch v0.5 | Section 9.7 | Snapshot command path: button -> flowService.snapshotFromCurrentContext -> snapshotService -> createTask -> openTask |
| Arch v0.5 | Section 14 | Analysis does not pollute Attempt; Snapshot creates new Task; Store controlled at 2-3 |

## 1. User Stories

1. Enter Analysis from Play/Problem/Recall — mode transitions to 'analysis', previousMode preserved
2. View AI analysis results — scoreLead, winrate, candidates projected to panels
3. Free play in Analysis — exploration does not modify Attempt.userLine
4. Snapshot current position — creates new TrainingTask + new Tab
5. Return to previous mode — tab restores previous mode
6. Restart attempt — tab switches back to play/problem

## 2. Test Matrix

### 2.1 State Forward Tests

| ID | Description | Expected Behavior |
| --- | --- | --- |
| W5-T01 | enterAnalysis from play | flowService.enterAnalysis(tabId) called; store updates mode='analysis', previousMode='play' |
| W5-T02 | enterAnalysis from problem | flowService.enterAnalysis(tabId) called; mode='analysis', previousMode='problem' |
| W5-T03 | enterAnalysis from recall | flowService.enterAnalysis(tabId) called; mode='analysis', previousMode='recall', analysisContext.attemptId set |
| W5-T04 | enterAnalysis preserves previousMode | tab.previousMode equals the mode user came from |
| W5-T05 | returnFromAnalysis to previousMode | flowService.returnFromAnalysis(tabId, toMode); mode=toMode, previousMode=undefined |
| W5-T06 | returnFromAnalysis defaults to 'play' | if previousMode is undefined, toMode defaults to 'play' |
| W5-T07 | Snapshot from analysis | flowService.snapshotFromCurrentContext(tabId) called; snapshotService.captureSnapshotInput called; repository.createTask with origin.provider='snapshot'; tabService.openTask called |
| W5-T08 | Snapshot does not modify current tab mode | after snapshot, active tab still mode='analysis' |
| W5-T09 | Snapshot creates new tab with parentTabId | new tab parentTabId equals source tab id |
| W5-T10 | restartAttempt | flowService.restartAttempt(tabId); mode = previousMode ?? 'play' |
| W5-T11 | Invalid transition rejected | enterAnalysis from analysis throws InvalidModeTransitionError |

### 2.2 State Return / Projection Tests

| ID | Description | Expected Behavior |
| --- | --- | --- |
| W5-T12 | analysisContext projection | shellProps.analysisContext equals tab.analysisContext |
| W5-T13 | previousMode projection | shellProps.previousMode equals tab.previousMode |
| W5-T14 | mode projection | shellProps.mode = 'analysis' when tab.mode='analysis' |
| W5-T15 | modeBarPolicy in analysis | analysis tab shows previousMode as enabled |
| W5-T16 | onSnapshot callback wired | shellProps.onSnapshot routes to handleSnapshot |
| W5-T17 | analysisContext source from recall | analysisContext.source derived from previousMode |

### 2.3 Side-Effect Isolation Tests

| ID | Description | Expected Behavior |
| --- | --- | --- |
| W5-T18 | Snapshot does not modify Attempt.userLine | attemptService.appendMove NOT called after snapshot |
| W5-T19 | Snapshot does not modify current tab mode | tab.mode still 'analysis' after snapshot |
| W5-T20 | enterAnalysis does not call documentStore.playMove | pure mode transition |
| W5-T21 | returnFromAnalysis does not call documentStore.playMove | pure mode transition |
| W5-T22 | restartAttempt does not call repository.createTask | mode transition only |

### 2.4 Architecture Boundary Tests

| ID | Description | Expected Behavior |
| --- | --- | --- |
| W5-T23 | Container does not import trainingRepository | static analysis |
| W5-T24 | AnalysisModePanel does not import services/stores/repo | static analysis |
| W5-T25 | AnalysisRightPanel does not import services/stores/repo | static analysis |
| W5-T26 | AnalysisModePanel does not access window.sabaki | static analysis |
| W5-T27 | AnalysisRightPanel does not access window.sabaki | static analysis |
| W5-T28 | Container does not call snapshotService directly | Container only calls flowService |
| W5-T29 | flowService.enterAnalysis does not branch on origin.provider | static analysis |

## 3. GAPs

| GAP ID | Description | Blocking? |
| --- | --- | --- |
| GAP-A1 | attemptService.markAnalysisOpened not implemented | Non-blocking for core wiring |
| GAP-A2 | flowService.enterAnalysis does not set analysisContext | Blocks analysisContext projection tests |
| GAP-A3 | AnalysisContextSource type differs from PRD v0.5 | Blocks source precision tests |
| GAP-A4 | Container missing handleRestartAttempt handler | Blocks restartAttempt wiring tests |

## 4. Out of Scope

- BadMove derived tasks (W6)
- Review flow
- AnalysisRightPanel expand callbacks (deferred, no-op)
- analysisResultAdapter KataGo integration
- AnalysisModePanel CSS/visual
- snapshotService SGF generation correctness
