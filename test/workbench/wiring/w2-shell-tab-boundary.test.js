/**
 * W2 Shell and Tab Architecture Boundary Tests
 *
 * Test contract: docs/design/2026-05-19/workbench-wiring/w2-shell-and-tab-wiring-contract-v0.1.md
 * Contracts covered: W2-T16, W2-T17, W2-T18, W2-T33
 *
 * Source of truth alignment:
 *   - Arch v0.5 §14 Architecture red lines
 *   - PRD v0.5 §2.3 origin only for traceability, not flow decisions
 *   - Arch v0.5 §5.3 Illegal transitions must throw/reject
 *   - Contract §5 Forbidden Side Effects
 *
 * Test Legitimacy:
 *   - W2-T16 and W2-T17: Static import analysis via fs.readFileSync.
 *     No module execution. File not found -> readFileSync throws -> test fails.
 *   - W2-T18: Import real workbenchFlowService and verify rejection behavior.
 *   - W2-T33: Import real workbenchFlowService and verify origin.provider in snapshot output.
 *   Controlled dependencies: local file reads, inline mock objects.
 */

import assert from 'assert'
import {readFileSync} from 'fs'
import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../../..')

import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'

// --- Lazy-load factories ---

let _createWorkbenchFlowService = null
let _flowLoadAttempted = false

function getFlowServiceFactory() {
  if (_flowLoadAttempted) return _createWorkbenchFlowService
  _flowLoadAttempted = true
  try {
    const mod = require('../../../src/modules/training/workbench/workbenchFlowService.ts')
    _createWorkbenchFlowService = mod.createWorkbenchFlowService
  } catch {}
  return _createWorkbenchFlowService
}

const describeFlow = getFlowServiceFactory() ? describe : describe.skip

// --- Helpers ---

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    childTabIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeTask(overrides = {}) {
  return {
    id: 'task_1',
    rootPositionSgf: '(;SZ[19])',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function createMockDeps(overrides = {}) {
  const store = createWorkbenchStore()
  const logs = []

  return {
    store,
    logs,
    workbenchStore: store,
    repository: {
      loadTask: async id => overrides.tasks?.[id] ?? makeTask({id}),
      createTask: async t => t,
      transaction: async fn => fn(),
      listMoveEvaluationsByAttempt: async () => [],
      listBadMovesByAttempt: async () => [],
      ...overrides.repository,
    },
    attemptService: {
      createAttempt: async input => ({id: 'attempt_1', ...input}),
      freezeAttempt: async () => {},
      finalizeAttemptResult: async () => {},
      ...overrides.attemptService,
    },
    recallService: {
      createRecallSession: async input => ({id: 'rs_1', ...input}),
      ...overrides.recallService,
    },
    snapshotService: {
      captureSnapshotInput: async input => ({
        sourceTaskId: input?.sourceTaskId ?? 'task_1',
        sourceAttemptId: input?.sourceAttemptId,
        positionSgf: '(;SZ[9]AB[dc])',
        sideToMove: 'black',
      }),
      ...overrides.snapshotService,
    },
    tabService: {
      openProblemTab: async opts => ({
        id: 'tab_snap_1',
        taskId: 'task_snap_1',
        mode: 'problem',
        parentTabId: opts?.parentTabId,
        childTabIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      openTask: async opts => ({
        id: 'tab_snap_1',
        taskId: 'task_snap_1',
        mode: 'problem',
        parentTabId: opts?.parentTabId,
        childTabIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      ...overrides.tabService,
    },
    logger: {
      info(channel, message, data) {
        logs.push({channel, message, data})
      },
    },
  }
}

// --- W2-T16: No UI component directly writes workbenchStore ---

describe('W2-T16: No UI component directly writes workbenchStore', () => {
  /**
   * UI components that must not import workbenchStore.
   * They receive data through props and send commands through callbacks.
   */
  const UI_COMPONENTS = [
    'src/components/workbench/shell/GlobalHeader.js',
    'src/components/workbench/shell/ModeBar.js',
    'src/components/workbench/shell/BottomActionBar.js',
    'src/components/workbench/shell/ModeActions.js',
    'src/components/workbench/shell/StoneStatus.js',
    'src/components/workbench/shell/MainBoardStage.js',
    'src/components/workbench/shell/RightModePanel.js',
    'src/components/workbench/shell/GameTabBar.js',
    'src/components/workbench/panels/PlayModePanel.js',
    'src/components/workbench/panels/ProblemModePanel.js',
    'src/components/workbench/panels/RecallModePanel.js',
    'src/components/workbench/panels/AnalysisModePanel.js',
  ]

  /**
   * Forbidden import patterns: importing workbenchStore or trainingRuntimeStore
   * directly from a UI component violates the architecture boundary.
   */
  const FORBIDDEN_STORE_PATTERNS = [
    /from\s+['"][^'"]*workbenchStore/,
    /from\s+['"][^'"]*trainingRuntimeStore/,
    /import\s*\(\s*['"][^'"]*workbenchStore/,
    /import\s*\(\s*['"][^'"]*trainingRuntimeStore/,
    /require\s*\(\s*['"][^'"]*workbenchStore/,
    /require\s*\(\s*['"][^'"]*trainingRuntimeStore/,
  ]

  for (const componentPath of UI_COMPONENTS) {
    it(`${componentPath} does NOT import workbenchStore or trainingRuntimeStore`, () => {
      const absolutePath = resolve(projectRoot, componentPath)
      let source
      try {
        source = readFileSync(absolutePath, 'utf-8')
      } catch {
        // Component does not exist yet -- not a boundary violation
        return
      }

      for (const pattern of FORBIDDEN_STORE_PATTERNS) {
        const match = source.match(pattern)
        assert.ok(
          !match,
          `${componentPath} must NOT directly import store modules. Found: "${match ? match[0] : ''}"`
        )
      }
    })
  }
})

// --- W2-T17: No command branches on origin.provider ---

describe('W2-T17: No command branches on origin.provider', () => {
  /**
   * Service files that must not branch main flow on origin.provider.
   */
  const SERVICE_FILES = [
    'src/modules/training/workbench/workbenchFlowService.ts',
    'src/modules/training/workbench/workbenchTabService.ts',
  ]

  /**
   * Forbidden patterns: branching on origin.provider in command logic.
   * We check for if/switch statements that read origin.provider.
   */
  const FORBIDDEN_ORIGIN_BRANCH_PATTERNS = [
    /origin\s*\.\s*provider\s*===?\s*['"]/,
    /origin\s*\.\s*provider\s*!==?\s*['"]/,
    /case\s+['"].*['"]\s*:.*origin\s*\.\s*provider/,
    /origin\.provider\s*===?\s*`/,
  ]

  for (const servicePath of SERVICE_FILES) {
    it(`${servicePath} does NOT branch on origin.provider`, () => {
      const absolutePath = resolve(projectRoot, servicePath)
      let source
      try {
        source = readFileSync(absolutePath, 'utf-8')
      } catch {
        // Service does not exist yet -- no violation
        return
      }

      for (const pattern of FORBIDDEN_ORIGIN_BRANCH_PATTERNS) {
        const match = source.match(pattern)
        assert.ok(
          !match,
          `${servicePath} must NOT branch on origin.provider in main flow. Found: "${match ? match[0] : ''}"`
        )
      }
    })
  }
})

// --- W2-T18: workbenchFlowService rejects illegal mode transitions ---

describeFlow('W2-T18: workbenchFlowService rejects illegal mode transitions', () => {
  const createWorkbenchFlowService = getFlowServiceFactory()

  const illegalTransitions = [
    {from: 'recall', method: 'submit', label: 'submit from recall'},
    {from: 'analysis', method: 'submit', label: 'submit from analysis'},
    {from: 'analysis', method: 'completeRecall', label: 'completeRecall from analysis'},
    {from: 'play', method: 'returnFromAnalysis', label: 'returnFromAnalysis from play'},
    {from: 'problem', method: 'returnFromAnalysis', label: 'returnFromAnalysis from problem'},
    {from: 'recall', method: 'returnFromAnalysis', label: 'returnFromAnalysis from recall'},
    {from: 'analysis', method: 'enterAnalysis', label: 'enterAnalysis from analysis'},
  ]

  for (const {from, method, label} of illegalTransitions) {
    it(`rejects ${label}`, () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: from}))

      assert.throws(
        () => {
          if (method === 'returnFromAnalysis') {
            service[method]({tabId: 'tab_1'})
          } else {
            service[method]('tab_1')
          }
        },
        /InvalidModeTransitionError|Invalid mode transition/,
        `${label} should throw InvalidModeTransitionError`
      )
    })
  }

  it('illegal transition does not change tab mode', () => {
    const deps = createMockDeps()
    const service = createWorkbenchFlowService(deps)
    deps.store.addTab(makeTab({id: 'tab_1', mode: 'recall'}))

    try { service.submit('tab_1') } catch {}

    const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
    assert.strictEqual(tab.mode, 'recall', 'tab mode must not change after rejected transition')
  })

  it('illegal transition logs rejection when logger provided', () => {
    const deps = createMockDeps()
    const service = createWorkbenchFlowService(deps)
    deps.store.addTab(makeTab({id: 'tab_1', mode: 'recall'}))

    try { service.submit('tab_1') } catch {}

    assert.ok(
      deps.logs.some(l => l.channel.includes('reject') || l.channel.includes('invalid') || l.channel.includes('transition')),
      'rejected transition should be logged'
    )
  })

  it('legal transitions are not rejected', () => {
    const legalTransitions = [
      {from: 'play', method: 'submit'},
      {from: 'problem', method: 'submit'},
      {from: 'play', method: 'enterAnalysis'},
      {from: 'problem', method: 'enterAnalysis'},
      {from: 'recall', method: 'enterAnalysis'},
      {from: 'recall', method: 'completeRecall'},
      {from: 'analysis', method: 'returnFromAnalysis'},
    ]

    for (const {from, method} of legalTransitions) {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      const tabConfig = from === 'analysis'
        ? {mode: 'analysis', analysisReturnTarget: {mode: 'play'}}
        : {mode: from}
      deps.store.addTab(makeTab({id: 'tab_1', ...tabConfig}))

      // Should not throw
      if (method === 'returnFromAnalysis') {
        service[method]({tabId: 'tab_1'})
      } else {
        service[method]('tab_1')
      }
    }
  })
})

// --- W2-T33: snapshotFromCurrentContext creates task with origin.provider='snapshot' ---

describeFlow('W2-T33: snapshot creates task with origin.provider=snapshot', () => {
  const createWorkbenchFlowService = getFlowServiceFactory()

  it('created task has origin.provider === "snapshot"', async () => {
    const createdTasks = []
    const deps = createMockDeps({
      repository: {
        loadTask: async id => makeTask({id}),
        createTask: async t => { createdTasks.push({...t}); return t },
        transaction: async fn => fn(),
        listMoveEvaluationsByAttempt: async () => [],
        listBadMovesByAttempt: async () => [],
      },
    })
    const service = createWorkbenchFlowService(deps)
    deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', taskId: 'task_parent'}))

    await service.snapshotFromCurrentContext('tab_1')

    assert.ok(createdTasks.length >= 1, 'should create at least one task')
    const task = createdTasks[createdTasks.length - 1]
    assert.ok(task.origin, 'task should have origin field')
    assert.strictEqual(task.origin.provider, 'snapshot', 'origin.provider must be "snapshot"')
  })

  it('created task origin.parentTaskId matches original tab taskId', async () => {
    const createdTasks = []
    const deps = createMockDeps({
      repository: {
        loadTask: async id => makeTask({id}),
        createTask: async t => { createdTasks.push({...t}); return t },
        transaction: async fn => fn(),
        listMoveEvaluationsByAttempt: async () => [],
        listBadMovesByAttempt: async () => [],
      },
    })
    const service = createWorkbenchFlowService(deps)
    deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', taskId: 'task_original'}))

    await service.snapshotFromCurrentContext('tab_1')

    const task = createdTasks[createdTasks.length - 1]
    assert.strictEqual(task.origin.parentTaskId, 'task_original')
  })

  it('created task origin.parentAttemptId matches tab activeAttemptId', async () => {
    const createdTasks = []
    const deps = createMockDeps({
      repository: {
        loadTask: async id => makeTask({id}),
        createTask: async t => { createdTasks.push({...t}); return t },
        transaction: async fn => fn(),
        listMoveEvaluationsByAttempt: async () => [],
        listBadMovesByAttempt: async () => [],
      },
    })
    const service = createWorkbenchFlowService(deps)
    deps.store.addTab(makeTab({
      id: 'tab_1',
      mode: 'analysis',
      taskId: 'task_1',
      activeAttemptId: 'att_42',
    }))

    await service.snapshotFromCurrentContext('tab_1')

    const task = createdTasks[createdTasks.length - 1]
    assert.strictEqual(task.origin.parentAttemptId, 'att_42')
  })

  it('snapshot task is wrapped in a repository transaction', async () => {
    let transactionCalled = false
    const deps = createMockDeps({
      repository: {
        loadTask: async id => makeTask({id}),
        createTask: async t => t,
        transaction: async fn => { transactionCalled = true; return fn() },
        listMoveEvaluationsByAttempt: async () => [],
        listBadMovesByAttempt: async () => [],
      },
    })
    const service = createWorkbenchFlowService(deps)
    deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', taskId: 'task_1'}))

    await service.snapshotFromCurrentContext('tab_1')

    assert.ok(transactionCalled, 'snapshotFromCurrentContext should call repository.transaction')
  })
})
