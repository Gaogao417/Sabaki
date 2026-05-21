# Workbench Wiring Workflow

Use this workflow when the workbench UI already exists visually and the task is to connect controls to training domain behavior.

This workflow is different from the frontend visual workflow. Visual work proves that the page looks right. Wiring work proves that user actions change the correct backend state, and that backend state changes flow back into the UI.

## Non-Negotiable Source Of Truth

The only product and architecture sources of truth for Workbench wiring are:

1. Product source: `docs/design/gabaki-sabaki-training-prd-v0.5.md`
2. Architecture source: `docs/design/gabaki-sabaki-training-architecture-v0.5.md`
3. UI source, only for visual/control placement after the two sources above: `docs/design/workbench-ui-ux-spec.md`

All generated contracts, inventories, plans, tests, and implementation notes are derived artifacts. They must not introduce behavior, command names, ownership, store fields, services, tab APIs, or flow branches that conflict with PRD v0.5 or Architecture v0.5.

If any derived artifact conflicts with the v0.5 sources, the derived artifact is wrong. Do not reconcile by inventing a compromise. Rewrite the derived artifact from the v0.5 sources.

Before writing any contract or implementation, every agent must read and cite the relevant sections of the PRD and Architecture. At minimum, a Workbench wiring contract must cite:

- PRD v0.5 sections for the affected mode and workflow.
- Architecture v0.5 sections for read path, write path, stores, services, repository, adapters, WorkbenchTab, WorkbenchMode, Attempt, Recall, Analysis, Snapshot, and Review when touched.
- UI/UX spec sections only for the visible control placement and copy.

Forbidden source hierarchy:

- Do not use `completion-plan-and-parallelism.md` as a behavior source.
- Do not use W0 inventory files as a behavior source.
- Do not use older PRD or architecture files when v0.5 has an answer.
- Do not use current code shape as justification to violate v0.5; current code may be a migration state.

## When To Use

Use this workflow for:

- Binding WorkbenchShell, panels, toolbar, tab bar, drawer, or bottom bar controls to behavior.
- Connecting UI callbacks to `TrainingWorkbenchContainer`.
- Adding controller commands that call training services, adapters, repositories, or Sabaki facade methods.
- Projecting `runtimeStore`, `workbenchStore`, engine state, or Sabaki state into workbench props.
- Verifying `store.subscribe()` causes UI projection and visible state updates.
- Migrating legacy workbench behavior into `legacyTrainingFlowController` or a new workbench controller.
- Checking that a control's loading, empty, active, success, error, or disabled state follows backend state rather than local demo state.

Do not use this workflow for pure CSS/layout/token/screenshot work. Use `frontend-visual-workflow.md` for that.

## Core State Loop

Every wiring task must name the full loop it touches:

```text
UI control event
  -> WorkbenchShell / panel callback prop
  -> TrainingWorkbenchContainer handler
  -> controller command
  -> service / adapter / repository
  -> runtimeStore / workbenchStore / Sabaki state
  -> container subscription
  -> projection into props
  -> UI state update
```

If a task only implements the first half of this loop, it is incomplete unless the contract explicitly marks it as a temporary no-op.

## Agent Order

1. `contract-designer`
   - Produces a wiring contract.
   - Archives it at `docs/design/YYYY-MM-DD/<task>/test-contract-v0.N.md`.
   - Must first produce a "source alignment" section citing PRD v0.5 and Architecture v0.5.
   - Must list control events, controller commands, service calls, store before/after state, projection results, allowed side effects, forbidden side effects, and manual acceptance.
   - Must name the specific UI component (e.g., ProblemBar, RecallModePanel, TrainingDashboardDrawer) that triggers each handler. If no UI component exists, the handler must be marked `DEFERRED` with the missing UI control described.
   - Must classify every automated Test ID by Layer, Production Subject, Real Dependencies, Mocked Dependencies, Forbidden Mocks, Primary Assertion, and Downstream Covered By.
   - Must mark any command or state not present in v0.5 as `PROPOSED_GAP`, not as an approved behavior.
   - For any matrix/state-table based task, must convert each in-scope row into an explicit expected value/behavior with a test status: `GREEN`, `RED`, or `DEFERRED`.
   - Must not leave test-writer to infer whether a matrix/current-code conflict should test current behavior. Known GAP rows must be `RED` or `DEFERRED`, never green current-behavior tests.

2. `contract-auditor`
   - Reviews the approved-source contract before any test code is written.
   - Does not write contracts, tests, or production code.
   - Must reject contract rows that mix delegation, state transition, projection, and rendered UI without a clear Layer and mock policy.
   - Must reject any contract that allows the production object responsible for the claimed behavior to be mocked.
   - Must require a per-Test-ID table:
     - Layer
     - Production Subject
     - Real Dependencies
     - Mocked Dependencies
     - Forbidden Mocks
     - Primary Assertion
     - Downstream Covered By
   - Must output APPROVE, APPROVE_WITH_NOTES, REQUEST_CHANGES, or BLOCK.
   - If the auditor returns REQUEST_CHANGES or BLOCK, do not start test writing.

3. `test-writer`
   - Writes tests from the approved wiring contract.
   - Must cover at least one state-forward path and one state-return path for every non-trivial control group:
     - state-forward: UI/container command changes store/service/repository state.
     - state-return: store/service state projects back into UI props or rendered state.
   - Must include at least one test per handler that proves a named UI component (e.g., ProblemBar, TrainingDashboardDrawer) receives and calls the handler. Tests that only call `shellProps.handler()` without proving UI consumption are incomplete.
   - Must not replace wiring with "callback was called" tests except as auxiliary checks.
   - Must not assert known GAP/bug current behavior as correct. If the approved matrix/contract says expected=A and current implementation returns B, write a RED test for A or stop and request contract clarification.
   - Must include a harness/mock manifest for every shared test setup, naming which modules are real, which are fake, and which Layers the harness can and cannot prove.
   - Must not mark a test as state-forward if it manually mutates the asserted store state after invoking the action.

4. `test-auditor`
   - Reviews the approved contract and generated tests before implementation starts.
   - Does not write tests, does not write production code, and does not split or orchestrate tasks.
   - Must reject placeholder pass tests, silent conditional passes, noop-handler tests, and wiring tests that do not verify a real boundary crossing.
   - Must reject Layer/mock mismatches: e.g. state transition tests with mocked state owner, rendered UI claims that only assert shell props, or callback-count tests marked as store/projection coverage.
   - Must reject reverse-contract tests that acknowledge a matrix/GAP conflict but assert the current wrong behavior as green.
   - Must require a coverage table for matrix/state-table based work:
     - `covered`
     - `deferred-with-approved-reason`
     - `not-covered`
   - Must output APPROVE, APPROVE_WITH_NOTES, REQUEST_CHANGES, or BLOCK.
   - If the auditor returns REQUEST_CHANGES or BLOCK, do not start implementation.
   - If the auditor returns APPROVE or APPROVE_WITH_NOTES, a human must explicitly decide whether to proceed.

5. Human gate
   - Reviews the test-auditor report.
   - Confirms any deferred rows and scope tradeoffs.
   - Explicitly authorizes implementation to begin.
   - This workflow intentionally does not add an orchestrator agent; task breakdown remains human-directed.

6. `implementation-agent`
   - Implements minimal production wiring against the approved contract and tests.
   - Keeps panel components presentational.
   - Reads dependencies through `sabaki.getTrainingContext()` in container/controller boundaries, not inside panels.
   - Uses adapters for Sabaki, engine, analysis, board, and repository dependencies.

7. `architecture-reviewer`
   - Reviews the diff for boundary leaks, duplicate state, direct service imports in UI components, store impurity, hidden globals, and weak tests.
   - Must explicitly trace at least one implemented loop from UI event to projected UI update.

Use `visual-fidelity-reviewer` only if the wiring changed visible layout or visual behavior enough to risk a UI regression.

## Required Acceptance Layers

Every wiring task should classify acceptance into these layers:

- UI command mapping: the control emits the intended semantic callback with stable payload.
- Container binding: `TrainingWorkbenchContainer` maps callback props to controller commands.
- Controller orchestration: controller calls the correct service/adapter/repository boundary and owns side effects.
- Store transition: `runtimeStore` or `workbenchStore` changes from the expected before state to after state.
- Projection return: changed store state produces the correct props or rendered panel state after subscription.
- Side-effect boundary: game tree, scratch state, engine, DB, IPC, and overlay effects happen only where allowed.
- Manual acceptance: the user-visible workflow can be clicked through in the app.

## Completion Plan Template

For a workbench wiring project, complete phases in this order:

1. **Inventory controls**
   - Read PRD v0.5, Architecture v0.5, then UI/UX spec in that order.
   - List every visible control in GlobalHeader, ModeBar, left panels, right panels, tab bar, board stage, drawer, and bottom bar.
   - Mark each as active, disabled, display-only, or intentionally deferred.
   - Do not decide ownership from component shape alone. Ownership must come from Architecture v0.5.

2. **Define command surface**
   - Name semantic commands such as `openTask`, `startProblemAttempt`, `submitProblemAttempt`, `skipRecallMove`, `createSnapshot`, `selectWorkbenchTab`, `setProblemArea`, `toggleAnnotationTool`.
   - Each command must have one owner: container, controller, service, or existing Sabaki command.
   - Commands must map to v0.5 concepts. For example, unified task opening must flow through the v0.5 WorkbenchTab/Task API, not source-specific `openGameTab`/`openProblemTab` branches unless Architecture v0.5 explicitly permits a compatibility wrapper.
   - Snapshot commands must respect the v0.5 boundary that snapshot creation and tab opening are not owned by `snapshotService` if Architecture v0.5 assigns those responsibilities elsewhere.

3. **Write wiring contracts**
   - Split contracts by mode or workflow, not by CSS component.
   - Recommended contracts:
     - `play-mode-command-wiring`
     - `problem-mode-command-wiring`
     - `recall-mode-command-wiring`
     - `analysis-mode-command-wiring`
     - `workbench-tab-and-shell-wiring`
     - `projection-and-store-subscription`
   - Every Test ID must declare its Layer and mock policy before test writing starts.
   - Callback-only rows may cover command mapping or container delegation, but must not be counted as store transition or projection return.

4. **Write tests first**
   - Add container/controller/store tests before production wiring.
   - Keep visual tests separate from wiring tests.
   - Prefer tests that fail when store state no longer reaches UI.
   - Require every shared harness to document real modules, fake modules, valid Layers, and invalid Layers.

5. **Implement by vertical slice**
   - One mode or workflow at a time.
   - Finish event mapping, controller command, service call, store update, and projection before moving to the next slice.

6. **Review boundaries**
   - Check for panels importing services.
   - Check for stores calling engine/DB/UI.
   - Check for duplicate local state that mirrors runtimeStore/workbenchStore.
   - Check for forbidden game-tree mutation in recall/scratch paths.

7. **Manual app pass**
   - Start the app.
   - Click through each wired workflow.
   - Confirm UI state follows backend state after refresh-like rerenders, not just immediate local click state.

## Task Parallelism Suggestions

Parallelize only when write ownership is clear. Do not let two workers edit the same production file family unless one is explicitly integrating.

### Safe Parallel Lanes

| Lane | Owner | Suggested write scope | Output |
| --- | --- | --- | --- |
| Inventory | explorer or contract-designer | docs only | Control inventory and command map |
| Projection tests | test-writer | `test/workbench/container/**`, test helpers | Store-to-UI projection and subscription tests |
| Problem wiring tests | test-writer | `test/workbench/wiring/problem*.test.js` | Problem command/state contracts |
| Recall wiring tests | test-writer | `test/workbench/wiring/recall*.test.js` | Recall command/state contracts |
| Analysis wiring tests | test-writer | `test/workbench/wiring/analysis*.test.js` | Snapshot/analysis command contracts |
| Shell/tab wiring tests | test-writer | `test/workbench/wiring/shell*.test.js` | Mode/tab/bottom bar command contracts |
| Controller implementation | implementation-agent | `src/modules/training/controller/**` | Command orchestration |
| Container implementation | implementation-agent | `src/components/TrainingWorkbenchContainer.js` | Props, handlers, projections |
| Panel callback plumbing | implementation-agent | `src/components/WorkbenchShell.js`, `src/components/workbench/**` | Presentational callback pass-through |
| Architecture review | architecture-reviewer | read-only | Boundary and test quality findings |

### Recommended Parallel Batches

1. **Batch A: discovery and contracts**
   - Run one inventory task and one architecture-boundary scan in parallel.
   - Do not start implementation yet.

2. **Batch B: tests by independent mode**
   - Write problem, recall, analysis, and shell/tab wiring tests in parallel.
   - Each worker owns separate test files.
   - One integrator resolves shared test helper needs.

3. **Batch C: implementation by layer**
   - Controller worker owns controller command methods.
   - Container worker owns `TrainingWorkbenchContainer.js` projections and handler mapping.
   - Panel worker owns callback props and presentational pass-through.
   - Workers must coordinate names from the approved command map before editing.

4. **Batch D: verification**
   - One worker runs unit/integration tests.
   - One reviewer checks architecture boundaries.
   - One manual pass checks app workflows if UI behavior changed.

### Do Not Parallelize

- Two workers editing `TrainingWorkbenchContainer.js` at the same time.
- Two workers editing the same controller file at the same time.
- Production implementation before command names and store transitions are agreed.
- Production implementation before command names and ownership are checked against PRD v0.5 and Architecture v0.5.
- Visual CSS changes mixed into wiring tasks unless the contract explicitly requires visible state feedback.

## Anti-Patterns

Do not accept these as completed wiring:

- The button calls a callback, but no store/service state changes.
- The service changes state, but the UI still reads hardcoded demo props.
- The panel imports `sabaki`, `window.sabaki`, repository, or training services directly.
- The container keeps duplicate state that mirrors `runtimeStore` or `workbenchStore`.
- The container writes `runtimeStore` or `workbenchStore` directly when Architecture v0.5 assigns the write to a service.
- A derived inventory invents source-specific workflows after v0.5 standardized all materials as `TrainingTask`.
- A derived inventory treats `origin.provider` as a workflow branch.
- A derived inventory assigns tab creation, snapshot handling, review, recall, or attempt ownership contrary to Architecture v0.5.
- Store methods call DB, engine, UI, IPC, or controller commands.
- Tests only assert call count and never assert before/after state.
- A handler is exposed on `shellProps` but no UI component consumes it. Every non-deferred handler must be traceable to a named UI component that triggers it (e.g., ProblemBar "下一题" button, TrainingDashboardDrawer "Start Review" button).
- Tests mock the entire controller and therefore prove no production wiring.
- Tests use `assert.ok(true)`, `assert(true)`, or empty assertions to document future behavior.
- Tests use conditional branches to pass when the production path is missing.
- Tests pass when a required handler is noop, a required prop is not passed, or a required store/projection update does not happen.
- Matrix/state-table work claims coverage without a row-by-row coverage table.
- Recall or scratch workflows mutate the formal game tree without an approved contract.

## Done Definition

Workbench wiring is done only when:

- Every in-scope control is active, disabled with a reason, display-only, or documented as deferred.
- Every non-deferred handler is consumed by a named UI component. Handlers without a consuming UI component must be marked deferred and are not counted as complete.
- Non-trivial controls have tests for command mapping, state transition, and projection return.
- Each contract/test row declares the Layer it proves, the production subject, real dependencies, mocked dependencies, forbidden mocks, and primary assertion.
- No test row claims state transition, projection, or rendered UI coverage for behavior owned by a mocked production object.
- Store subscription updates are tested or manually verified.
- Panels remain presentational.
- Controller/service/store boundaries pass architecture review.
- Relevant tests pass.
- Manual acceptance confirms the workflow can be clicked through in the app.
