/**
 * Phase 4 MoveEvaluation / BadMove status wiring tests.
 *
 * Source alignment:
 *   - docs/product/sabaki-training-prd.md: Play/Problem tracks pending evaluations
 *     and visible bad move projection.
 *   - docs/architecture/sabaki-state-field-mapping.md: trainingRuntimeStore owns
 *     pendingMoveEvaluations and visibleBadMoveIds.
 *   - docs/design/workbench-mode-orchestration-contract.md: MoveEvaluation /
 *     BadMove may update after Attempt freeze but must return through runtime
 *     projection, not Attempt mutation.
 *
 * Layer: PROJECTION_RETURN / STORE_SUBSCRIPTION.
 * Production subject: TrainingWorkbenchContainer projectFromRuntime + real stores.
 * Real dependencies: TrainingWorkbenchContainer, createWorkbenchStore,
 * createTrainingRuntimeStore.
 * Fake dependencies: local tiny shell services only; no fake projection logic.
 */

import assert from 'assert'

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createLoggerService, createConsoleWriter} from '../../../src/modules/logger/index.js'

const logger = createLoggerService({writers: [createConsoleWriter()]})

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    activeAttemptId: 'attempt_1',
    childTabIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeEvaluation(overrides = {}) {
  return {
    id: 'eval_1',
    attemptId: 'attempt_1',
    moveIndex: 0,
    move: 'D4',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function createHarness({
  tabs = [makeTab()],
  activeTabId = tabs[0]?.id ?? null,
} = {}) {
  const workbenchStore = createWorkbenchStore({logger})
  const runtimeStore = createTrainingRuntimeStore({logger})

  for (const tab of tabs) workbenchStore.addTab(tab)
  if (activeTabId != null) workbenchStore.setActiveTab(activeTabId)

  const trainingContext = {
    runtimeStore,
    workbenchStore,
    workbenchFlowService: {},
    flowService: {},
    workbenchTabService: {},
    tabService: {},
    taskImportService: {},
    legacyTrainingFlowController: {},
  }

  const sabaki = {
    getTrainingContext() { return trainingContext },
    getPlayServices() { return {} },
    makeResign() {},
    undo() {},
    redo() {},
    makeMove() {},
    openDrawer() {},
    setComment() {},
    flashInfoOverlay() {},
    setState() {},
    toggleThirdPartyPanel() {},
  }

  const container = new TrainingWorkbenchContainer({sabaki})
  container.props = {sabaki}
  container._unsubRuntime = runtimeStore.subscribe(() => container.forceUpdate())
  container._unsubWorkbench = workbenchStore.subscribe(() => container.forceUpdate())

  return {
    workbenchStore,
    runtimeStore,
    getShellProps() {
      const vdom = container.render()
      return vdom ? vdom.props : {}
    },
  }
}

describe('Phase 4 evaluation status projection', function () {
  it('projects pendingEval for the active play attempt only', function () {
    const harness = createHarness({
      tabs: [
        makeTab({id: 'tab_1', activeAttemptId: 'attempt_1'}),
        makeTab({id: 'tab_2', activeAttemptId: 'attempt_2'}),
      ],
      activeTabId: 'tab_1',
    })

    harness.runtimeStore.upsertPendingMoveEvaluation(makeEvaluation({
      id: 'eval_active',
      attemptId: 'attempt_1',
    }))
    harness.runtimeStore.upsertPendingMoveEvaluation(makeEvaluation({
      id: 'eval_other',
      attemptId: 'attempt_2',
    }))

    const shellProps = harness.getShellProps()

    assert.strictEqual(shellProps.pendingEval, 1,
      'pendingEval must count pending MoveEvaluation rows for activeTab.activeAttemptId only')
  })

  it('projects badMoveCount from visibleBadMoveIds', function () {
    const harness = createHarness()

    harness.runtimeStore.setVisibleBadMoveIds(['bm_1', 'bm_2'])

    const shellProps = harness.getShellProps()

    assert.strictEqual(shellProps.badMoveCount, 2,
      'badMoveCount must reflect runtimeStore.visibleBadMoveIds length')
  })

  it('updates projected pendingEval after pending evaluation is removed', function () {
    const harness = createHarness()

    harness.runtimeStore.upsertPendingMoveEvaluation(makeEvaluation({
      id: 'eval_active',
      attemptId: 'attempt_1',
    }))
    assert.strictEqual(harness.getShellProps().pendingEval, 1)

    harness.runtimeStore.removePendingMoveEvaluation('eval_active')

    assert.strictEqual(harness.getShellProps().pendingEval, 0,
      'pendingEval must return to 0 after the runtime pending evaluation is removed')
  })
})
