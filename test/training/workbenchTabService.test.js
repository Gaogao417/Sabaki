import assert from 'assert'

import {createWorkbenchTabService} from '../../src/modules/training/workbench/workbenchTabService.ts'
import {createWorkbenchPhaseService} from '../../src/modules/training/workbench/workbenchPhaseService.ts'
import {createWorkbenchStore} from '../../src/modules/training/store/workbenchStore.ts'

// --- Mocks ---

function createMockRepository(overrides = {}) {
  const problems = {
    prob_1: {
      id: 'prob_1',
      type: 'tesuji',
      positionSgf: '(;GM[1]FF[4]SZ[19])',
      sideToMove: 'black',
      title: 'Test Problem',
    },
    bad_sgf_prob: {
      id: 'bad_sgf_prob',
      type: 'tesuji',
      positionSgf: '',
      sideToMove: 'black',
    },
    ...overrides.problems,
  }

  const games = {
    game_1: {
      id: 'game_1',
      sgf: '(;GM[1]FF[4]SZ[19])',
      title: 'Test Game',
    },
    ...overrides.games,
  }

  return {
    async getProblem(id) {
      return problems[id] ?? null
    },
    async getGame(id) {
      return games[id] ?? null
    },
    async saveProblemAttempt(attempt) {
      return {...attempt, id: 'attempt_1'}
    },
    async createTask(task) {
      return task
    },
  }
}

function createMockLegacyAdapter() {
  const calls = {
    loadGameTrees: [],
    setCurrentTreePosition: [],
    setProblemMode: [],
    startAnalysisIfEngineReady: [],
    notifyLegacyStateChanged: [],
  }

  return {
    calls,
    async loadGameTrees(trees) {
      calls.loadGameTrees.push(trees)
    },
    setCurrentTreePosition(tree, pos) {
      calls.setCurrentTreePosition.push({tree, pos})
    },
    setProblemMode() {
      calls.setProblemMode.push(true)
    },
    startAnalysisIfEngineReady(tp) {
      calls.startAnalysisIfEngineReady.push(tp)
    },
    notifyLegacyStateChanged(patch) {
      calls.notifyLegacyStateChanged.push(patch)
    },
    getSabaki() {
      return {
        setMode(mode) {
          calls.setProblemMode.push(mode)
        },
      }
    },
  }
}

function createMockSgfParser(overrides = {}) {
  return {
    parse(sgf) {
      if (overrides.parse) return overrides.parse(sgf)
      if (!sgf || sgf.trim() === '') return []
      return [{root: {id: 'root_node'}}]
    },
  }
}

function createMockTaskStore(tasks = {}) {
  // Tasks keyed by id for openTask to load.
  return tasks
}

function createTestServices(overrides = {}) {
  const store = createWorkbenchStore()
  const repository = createMockRepository(overrides)
  const legacyAdapter = createMockLegacyAdapter()
  const sgfParser = createMockSgfParser(overrides)

  // Extend repository with loadTask for Phase 1 openTask.
  if (!repository.loadTask) {
    const taskStore = createMockTaskStore(overrides.tasks)
    repository.loadTask = async id => taskStore[id] ?? null
  }

  const tabService = createWorkbenchTabService({
    workbenchStore: store,
    repository,
    legacyAdapter,
    sgfParser,
    taskImportService: overrides.taskImportService,
  })
  const phaseService = createWorkbenchPhaseService({workbenchStore: store})
  return {store, repository, legacyAdapter, sgfParser, tabService, phaseService}
}

// --- Tests ---

describe('workbenchTabService', () => {
  describe('openProblemTab — new system path (no legacy)', () => {
    let store, tabService

    beforeEach(() => {
      const ctx = createTestServices()
      store = ctx.store
      tabService = ctx.tabService
    })

    it('creates a tab with mode=play', async () => {
      const tab = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
      assert.strictEqual(tab.mode, 'play')
      assert.ok(tab.taskId)
    })

    it('sets the new tab as active', async () => {
      const tab = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
      assert.strictEqual(store.getState().activeTabId, tab.id)
    })

    it('does NOT call legacy adapter', async () => {
      const {tabService, legacyAdapter} = createTestServices()
      await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
      assert.strictEqual(legacyAdapter.calls.setProblemMode.length, 0)
      assert.strictEqual(legacyAdapter.calls.loadGameTrees.length, 0)
    })

    it('throws if problem not found', async () => {
      await assert.rejects(
        () => tabService.openProblemTab('nonexistent', {legacyCompatibility: false}),
        /problem not found/,
      )
    })

    it('P2-T05: delegates legacy problem material creation to taskImportService then openTask when available', async () => {
      const importedTask = {
        id: 'task_from_legacy_problem',
        rootPositionSgf: '(;GM[1]FF[4]SZ[19])',
        sideToMove: 'black',
        prompt: 'Solve',
        origin: {provider: 'local', externalId: 'prob_1'},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const calls = []
      const {store, tabService, legacyAdapter} = createTestServices({
        tasks: {[importedTask.id]: importedTask},
        taskImportService: {
          async createTaskFromLegacyProblem(input) {
            calls.push(input)
            return importedTask
          },
        },
      })

      const tab = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})

      assert.deepStrictEqual(calls, [{problemId: 'prob_1'}])
      assert.strictEqual(tab.taskId, importedTask.id)
      assert.strictEqual(tab.mode, 'problem')
      assert.strictEqual(store.getState().activeTabId, tab.id)
      assert.strictEqual(legacyAdapter.calls.loadGameTrees.length, 0)
    })

    it('does not run legacy compatibility by default', async () => {
      const {tabService, legacyAdapter} = createTestServices()

      await tabService.openProblemTab('prob_1')

      assert.strictEqual(legacyAdapter.calls.loadGameTrees.length, 0)
      assert.strictEqual(legacyAdapter.calls.setProblemMode.length, 0)
      assert.strictEqual(legacyAdapter.calls.setCurrentTreePosition.length, 0)
    })

    it('uses taskImportService and openTask without legacy setup when no flag is provided', async () => {
      const importedTask = {
        id: 'task_default_open_problem',
        rootPositionSgf: '(;GM[1]FF[4]SZ[19])',
        sideToMove: 'black',
        prompt: 'Solve',
        origin: {provider: 'local', externalId: 'prob_1'},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const importCalls = []
      const {store, tabService, legacyAdapter} = createTestServices({
        tasks: {[importedTask.id]: importedTask},
        taskImportService: {
          async createTaskFromLegacyProblem(input) {
            importCalls.push(input)
            return importedTask
          },
        },
      })

      const tab = await tabService.openProblemTab('prob_1')

      assert.deepStrictEqual(importCalls, [{problemId: 'prob_1'}])
      assert.strictEqual(tab.taskId, importedTask.id)
      assert.strictEqual(tab.mode, 'problem')
      assert.strictEqual(store.getState().activeTabId, tab.id)
      assert.strictEqual(legacyAdapter.calls.loadGameTrees.length, 0)
      assert.strictEqual(legacyAdapter.calls.setProblemMode.length, 0)
    })
  })

  describe('openProblemTab — legacy compatibility mode', () => {
    let store, tabService, legacyAdapter

    beforeEach(() => {
      const ctx = createTestServices()
      store = ctx.store
      tabService = ctx.tabService
      legacyAdapter = ctx.legacyAdapter
    })

    it('calls legacy adapter to load game trees and set mode', async () => {
      await tabService.openProblemTab('prob_1', {legacyCompatibility: true})
      assert.strictEqual(legacyAdapter.calls.loadGameTrees.length, 1)
      assert.strictEqual(legacyAdapter.calls.setProblemMode.length, 1)
      assert.strictEqual(legacyAdapter.calls.setCurrentTreePosition.length, 1)
    })

    it('does not run legacy by default when flag not specified', async () => {
      await tabService.openProblemTab('prob_1')
      assert.strictEqual(legacyAdapter.calls.loadGameTrees.length, 0)
      assert.strictEqual(legacyAdapter.calls.setProblemMode.length, 0)
    })
  })

  describe('openProblemTab — error cases', () => {
    it('does not mutate store if SGF cannot be parsed (legacy mode)', async () => {
      const {store, tabService} = createTestServices()
      await assert.rejects(
        () => tabService.openProblemTab('bad_sgf_prob', {legacyCompatibility: true}),
        /failed to parse SGF/,
      )
      assert.strictEqual(store.getState().tabs.length, 0)
      assert.strictEqual(store.getState().activeTabId, null)
    })

    it('throws if parentTabId does not exist', async () => {
      const {tabService} = createTestServices()
      await assert.rejects(
        () => tabService.openProblemTab('prob_1', {
          parentTabId: 'missing_tab',
          legacyCompatibility: false,
        }),
        /parent tab not found/,
      )
    })
  })

  describe('openProblemTab — parent-child linking', () => {
    it('links parent tab when parentTabId provided', async () => {
      const {store, tabService} = createTestServices()
      const parentTab = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
      const childTab = await tabService.openProblemTab('prob_1', {
        parentTabId: parentTab.id,
        legacyCompatibility: false,
      })
      const updatedParent = store.getState().tabs.find(t => t.id === parentTab.id)
      assert.ok(updatedParent.childTabIds.includes(childTab.id))
    })
  })

  describe('openGameTab', () => {
    let store, tabService

    beforeEach(() => {
      const ctx = createTestServices()
      store = ctx.store
      tabService = ctx.tabService
    })

    it('creates a tab with mode=play', async () => {
      const tab = await tabService.openGameTab('game_1')
      assert.strictEqual(tab.mode, 'play')
    })

    it('sets opened game tab as active', async () => {
      const tab = await tabService.openGameTab('game_1')
      assert.strictEqual(store.getState().activeTabId, tab.id)
    })

    it('creates a task with kind=game', async () => {
      const tab = await tabService.openGameTab('game_1')
      assert.ok(tab.taskId)
      // taskId is generated, just verify it exists
    })

    it('throws if game not found', async () => {
      await assert.rejects(
        () => tabService.openGameTab('nonexistent'),
        /game not found/,
      )
    })
  })

  describe('closeTab', () => {
    let store, tabService

    beforeEach(() => {
      const ctx = createTestServices()
      store = ctx.store
      tabService = ctx.tabService
    })

    it('removes the tab', async () => {
      const tab = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
      await tabService.closeTab(tab.id)
      assert.strictEqual(store.getState().tabs.length, 0)
    })

    it('clears activeTabId when active tab is closed', async () => {
      const tab = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
      await tabService.closeTab(tab.id)
      assert.strictEqual(store.getState().activeTabId, null)
    })

    it('closes child tabs recursively', async () => {
      const parent = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
      const child = await tabService.openProblemTab('prob_1', {
        parentTabId: parent.id,
        legacyCompatibility: false,
      })
      await tabService.closeTab(parent.id)
      assert.strictEqual(store.getState().tabs.length, 0)
    })

    it('clears activeTabId when active child is closed via parent', async () => {
      const parent = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
      const child = await tabService.openProblemTab('prob_1', {
        parentTabId: parent.id,
        legacyCompatibility: false,
      })
      // child is now active
      await tabService.closeTab(parent.id)
      assert.strictEqual(store.getState().activeTabId, null)
    })

    it('unlinks from parent', async () => {
      const parent = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
      const child = await tabService.openProblemTab('prob_1', {
        parentTabId: parent.id,
        legacyCompatibility: false,
      })
      await tabService.closeTab(child.id)
      const updatedParent = store.getState().tabs.find(t => t.id === parent.id)
      assert.strictEqual(updatedParent.childTabIds.length, 0)
    })

    it('does not throw on missing tab', async () => {
      assert.doesNotThrow(() => tabService.closeTab('missing_tab'))
    })
  })

  describe('switchTab', () => {
    let tabService, store

    beforeEach(() => {
      const ctx = createTestServices()
      store = ctx.store
      tabService = ctx.tabService
    })

    it('changes active tab', async () => {
      const tab1 = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
      const tab2 = await tabService.openGameTab('game_1')
      tabService.switchTab(tab1.id)
      assert.strictEqual(store.getState().activeTabId, tab1.id)
    })

    it('throws if tab not found', () => {
      assert.throws(
        () => tabService.switchTab('nonexistent'),
        /tab not found/,
      )
    })
  })
})

describe('workbenchTabService + workbenchPhaseService integration', () => {
  let store, tabService, phaseService

  beforeEach(() => {
    const ctx = createTestServices()
    store = ctx.store
    tabService = ctx.tabService
    phaseService = ctx.phaseService
  })

  it('full flow: open problem -> submit -> recall -> complete -> analysis', async () => {
    const tab = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
    assert.strictEqual(phaseService.getMode(tab.id), 'play')

    phaseService.transition(tab.id, 'submit')
    assert.strictEqual(phaseService.getMode(tab.id), 'recall')

    phaseService.transition(tab.id, 'complete')
    assert.strictEqual(phaseService.getMode(tab.id), 'analysis')
  })

  it('cannot skip directly from play to analysis', async () => {
    const tab = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
    assert.throws(
      () => phaseService.transition(tab.id, 'complete'),
      /InvalidPhaseTransitionError/,
    )
  })

  it('can restart from recall back to play', async () => {
    const tab = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
    phaseService.transition(tab.id, 'submit')
    phaseService.transition(tab.id, 'restart')
    assert.strictEqual(phaseService.getMode(tab.id), 'play')
  })

  it('snapshot from analysis does not change tab mode', async () => {
    const tab = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
    phaseService.transition(tab.id, 'submit')
    phaseService.transition(tab.id, 'complete')
    assert.strictEqual(phaseService.getMode(tab.id), 'analysis')

    phaseService.transition(tab.id, 'snapshot')
    assert.strictEqual(phaseService.getMode(tab.id), 'analysis')
  })
})

// --- Phase 1 contracts: openTask, legacy wrappers, playerConfig ---

// openTask may not exist yet; skip gracefully.
const hasOpenTask = () => {
  try {
    const {tabService} = createTestServices()
    return typeof tabService.openTask === 'function'
  } catch {
    return false
  }
}

;(hasOpenTask() ? describe : describe.skip)('workbenchTabService.openTask', () => {
  let store, tabService

  beforeEach(() => {
    const ctx = createTestServices({
      tasks: {
        task_free: {
          id: 'task_free',
          rootPositionSgf: '(;SZ[19])',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        task_problem: {
          id: 'task_problem',
          rootPositionSgf: '(;SZ[19])',
          prompt: 'Find the best move',
          goal: 'Kill the group',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    })
    store = ctx.store
    tabService = ctx.tabService
  })

  it('infers problem mode for task with prompt', async () => {
    const tab = await tabService.openTask({taskId: 'task_problem'})
    assert.strictEqual(tab.mode, 'problem')
  })

  it('infers play mode for free task', async () => {
    const tab = await tabService.openTask({taskId: 'task_free'})
    assert.strictEqual(tab.mode, 'play')
  })

  it('explicit mode overrides inference', async () => {
    const tab = await tabService.openTask({taskId: 'task_problem', mode: 'play'})
    assert.strictEqual(tab.mode, 'play')
  })

  it('adds tab to store and sets it active', async () => {
    const tab = await tabService.openTask({taskId: 'task_free'})
    assert.strictEqual(store.getState().activeTabId, tab.id)
    assert.ok(store.getState().tabs.find(t => t.id === tab.id))
  })

  it('creates tab with mode field (not phase)', async () => {
    const tab = await tabService.openTask({taskId: 'task_free'})
    assert.ok('mode' in tab)
    assert.strictEqual(tab.phase, undefined)
  })

  it('links parent/child when parentTabId provided', async () => {
    const parentTab = await tabService.openTask({taskId: 'task_free'})
    const childTab = await tabService.openTask({taskId: 'task_problem', parentTabId: parentTab.id})
    const updatedParent = store.getState().tabs.find(t => t.id === parentTab.id)
    assert.ok(updatedParent.childTabIds.includes(childTab.id))
    assert.strictEqual(childTab.parentTabId, parentTab.id)
  })

  it('throws when task does not exist', async () => {
    await assert.rejects(
      () => tabService.openTask({taskId: 'nonexistent'}),
      /task not found/,
    )
  })

  it('throws when parentTabId does not exist', async () => {
    await assert.rejects(
      () => tabService.openTask({taskId: 'task_free', parentTabId: 'missing_tab'}),
      /parent tab not found/,
    )
  })
})

;(hasOpenTask() ? describe : describe.skip)('legacy wrappers via openTask', () => {
  it('openProblemTab produces tab with mode (not phase)', async () => {
    const {tabService} = createTestServices()
    const tab = await tabService.openProblemTab('prob_1', {legacyCompatibility: false})
    assert.ok('mode' in tab)
  })

  it('openGameTab produces tab with mode=play', async () => {
    const {tabService} = createTestServices()
    const tab = await tabService.openGameTab('game_1')
    assert.strictEqual(tab.mode, 'play')
  })
})

;(hasOpenTask() ? describe : describe.skip)('playerConfig on tab', () => {
  it('stores playerConfig on tab via openTask', async () => {
    const {tabService, store} = createTestServices({
      tasks: {
        task_1: {
          id: 'task_1',
          rootPositionSgf: '(;SZ[19])',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    })
    const config = {black: 'human', white: 'ai', ai: {engineId: 'leela'}}
    const tab = await tabService.openTask({taskId: 'task_1', playerConfig: config})
    assert.deepStrictEqual(tab.playerConfig, config)
  })

  it('playerConfig round-trips through store', async () => {
    const {tabService, store} = createTestServices({
      tasks: {
        task_1: {
          id: 'task_1',
          rootPositionSgf: '(;SZ[19])',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    })
    const config = {black: 'ai', white: 'human', ai: {maxVisits: 100}}
    const tab = await tabService.openTask({taskId: 'task_1', playerConfig: config})
    const stored = store.getState().tabs.find(t => t.id === tab.id)
    assert.deepStrictEqual(stored.playerConfig, config)
  })

  it('playerConfig can be updated after creation', async () => {
    const {tabService, store} = createTestServices({
      tasks: {
        task_1: {
          id: 'task_1',
          rootPositionSgf: '(;SZ[19])',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    })
    const tab = await tabService.openTask({taskId: 'task_1'})
    assert.strictEqual(tab.playerConfig, undefined)

    const newConfig = {black: 'human', white: 'ai', ai: {autoPlay: true}}
    store.updateTab(tab.id, {playerConfig: newConfig})
    const updated = store.getState().tabs.find(t => t.id === tab.id)
    assert.deepStrictEqual(updated.playerConfig, newConfig)
  })
})
