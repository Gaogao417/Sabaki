import assert from 'assert'

import { createTrainingRuntimeStore } from '../../src/modules/training/store/trainingRuntimeStore.ts'
import { createWorkbenchStore } from '../../src/modules/training/store/workbenchStore.ts'
import {
  createPhase3AttemptRepository,
  createPhase3EngineService,
} from './phase3TypedFakes.ts'

const {
  createAiMoveService,
  shouldAiMove: shouldAiMoveFn,
} = require('../../src/modules/training/ai/aiMoveService.ts')

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

function makeAttempt(overrides = {}) {
  return {
    id: 'attempt_1',
    taskId: 'task_1',
    startedAt: '2026-01-01T00:00:00.000Z',
    rootPositionSgf: '(;SZ[9])',
    userLine: [],
    status: 'playing',
    result: 'pending',
    hintLevelUsed: 0,
    recallCompleted: false,
    analysisOpened: false,
    ...overrides,
  }
}

function makeTask(overrides = {}) {
  return {
    id: 'task_1',
    rootPositionSgf: '(;SZ[9])',
    sideToMove: 'black',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// --- Tests ---

describe('aiMoveService', () => {
  // =====================================================================
  // shouldAiMove — pure function tests (C07-C13, C34, C36, C37)
  // =====================================================================

  describe('shouldAiMove (pure function)', () => {
    const shouldAiMove = shouldAiMoveFn

    it('returns false when playerConfig is undefined (C07)', () => {
      const tab = makeTab({ mode: 'play' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns false when no active attempt (C08)', () => {
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const result = shouldAiMove({ tab, attempt: null, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns true in play mode when it is AI turn after human played (C09)', () => {
      // Black=human, White=AI. Black plays first (move 0).
      // After black plays (userLine.length=1), it's white's turn (AI).
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, true)
    })

    it('returns false in play mode when it is human turn (C10)', () => {
      // Black=human, White=AI. No moves yet, it's black's turn (human).
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: [] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns false when both sides are human (C11)', () => {
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'human' },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns true in problem mode when opponent is AI after human solver played (C12)', () => {
      // In problem mode, solver plays human moves. Opponent configured as AI.
      // After solver plays (userLine.length=1), AI should respond.
      const tab = makeTab({
        mode: 'problem',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, true)
    })

    it('returns false in recall mode (C13)', () => {
      const tab = makeTab({
        mode: 'recall',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns false in analysis mode (C13)', () => {
      const tab = makeTab({
        mode: 'analysis',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('is a pure function -- uses only input params, no external state (C34)', () => {
      // Call shouldAiMove with same inputs multiple times -- must always return same result.
      // Also verify it does not throw or access globals.
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })

      const result1 = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      const result2 = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result1, result2)
      assert.strictEqual(result1, true)
    })

    it('returns false when playerConfig.ai.autoPlay is false (C36)', () => {
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: false } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns true in AI vs AI play after each AI move (C37)', () => {
      // Both sides are AI. After black AI plays (userLine.length=1), white AI should play.
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'ai', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, true)
    })
  })

  // =====================================================================
  // shouldAiMove architecture boundary (C32)
  // =====================================================================

  describe('shouldAiMove architecture boundary (C32)', () => {
    const shouldAiMove = shouldAiMoveFn

    it('does not modify store, repo, or engine (pure function with no side effects)', () => {
      // shouldAiMove receives plain data objects. Verify that calling it does not
      // mutate the input objects.
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const originalUserLine = [...attempt.userLine]
      const originalMode = tab.mode

      shouldAiMove({ tab, attempt, sideToMove: 'black' })

      // Inputs must remain unmodified
      assert.deepStrictEqual(attempt.userLine, originalUserLine)
      assert.strictEqual(tab.mode, originalMode)
    })
  })

  // =====================================================================
  // requestAiMove — orchestration with engine adapter (C14-C19)
  // =====================================================================

  describe('requestAiMove', () => {
    it('calls engineMoveAdapter.requestMove with correct params (C14)', async () => {
      let receivedInput = null
      const mockAdapter = {
        async requestMove(input) {
          receivedInput = input
          return { move: 'Q16', candidates: ['Q16', 'D4'] }
        },
      }

      const service = createAiMoveService({ engineService: mockAdapter })
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ rootPositionSgf: '(;SZ[9])', userLine: ['D4'] })
      const task = makeTask()

      await service.requestAiMove({ tab, attempt, task })

      assert.ok(receivedInput, 'adapter.requestMove should have been called')
      assert.strictEqual(receivedInput.positionSgf, '(;SZ[9])')
    })

    it('passes post-human-move treePosition to engine request when provided', async () => {
      let receivedInput = null
      const mockAdapter = {
        async requestMove(input) {
          receivedInput = input
          return { move: 'Q16', candidates: ['Q16'] }
        },
      }

      const service = createAiMoveService({ engineService: mockAdapter })
      const tab = makeTab({
        mode: 'play',
        playerConfig: {
          black: 'human',
          white: 'ai',
          ai: {engineId: 'engine_white', autoPlay: true},
        },
      })
      const attempt = makeAttempt({ rootPositionSgf: '(;SZ[9])', userLine: ['D4'] })

      await service.maybePlayAiMove({
        tab,
        attempt,
        task: makeTask({sideToMove: 'black'}),
        treePosition: 'node_after_human_black',
      })

      assert.ok(receivedInput, 'adapter.requestMove should have been called')
      assert.strictEqual(receivedInput.treePosition, 'node_after_human_black')
      assert.strictEqual(receivedInput.engineId, 'engine_white')
    })

    it('returns engine top move in play mode (C15)', async () => {
      const mockAdapter = {
        async requestMove() {
          return { move: 'Q16', candidates: ['Q16', 'D4'] }
        },
      }

      const service = createAiMoveService({ engineService: mockAdapter })
      const tab = makeTab({ mode: 'play' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const task = makeTask()

      const result = await service.requestAiMove({ tab, attempt, task })
      assert.strictEqual(result, 'Q16')
    })

    it('returns move when engine move is inside problemArea (C16)', async () => {
      const mockAdapter = {
        async requestMove() {
          return { move: 'C3', candidates: ['C3', 'D4'] }
        },
      }

      const service = createAiMoveService({ engineService: mockAdapter })
      const tab = makeTab({ mode: 'problem' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      // problemArea: top-left 6x6 region (0-indexed [x,y] pairs)
      const areaCoords = []
      for (let x = 0; x <= 5; x++) {
        for (let y = 0; y <= 5; y++) {
          areaCoords.push([x, y])
        }
      }
      const task = makeTask({ problemArea: areaCoords })

      const result = await service.requestAiMove({ tab, attempt, task })
      // C3 at coord (2,2) is within area (0,0)-(5,5)
      assert.strictEqual(result, 'C3')
    })

    it('returns null when engine move is outside problemArea (C17)', async () => {
      const mockAdapter = {
        async requestMove() {
          // Q16 on a 19x19 board is far from the top-left area
          return { move: 'Q16', candidates: ['Q16', 'R17'] }
        },
      }

      const service = createAiMoveService({ engineService: mockAdapter })
      const tab = makeTab({ mode: 'problem' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      // problemArea: top-left 6x6 region — Q16 (15,15) is outside
      const smallArea = []
      for (let x = 0; x <= 5; x++) {
        for (let y = 0; y <= 5; y++) {
          smallArea.push([x, y])
        }
      }
      const task = makeTask({ problemArea: smallArea })

      const result = await service.requestAiMove({ tab, attempt, task })
      assert.strictEqual(result, null)
    })

    it('returns null in problem mode when no problemArea is configured (C18)', async () => {
      let called = false
      const mockAdapter = {
        async requestMove() {
          called = true
          return { move: 'Q16', candidates: ['Q16'] }
        },
      }

      const service = createAiMoveService({ engineService: mockAdapter })
      const tab = makeTab({ mode: 'problem' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      // task without problemArea
      const task = makeTask()

      const result = await service.requestAiMove({ tab, attempt, task })
      assert.strictEqual(result, null)
      assert.strictEqual(called, false)
    })

    it('returns null when engineMoveAdapter returns null (C19)', async () => {
      const mockAdapter = {
        async requestMove() {
          return null
        },
      }

      const service = createAiMoveService({ engineService: mockAdapter })
      const tab = makeTab({ mode: 'play' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const task = makeTask()

      const result = await service.requestAiMove({ tab, attempt, task })
      assert.strictEqual(result, null)
    })

    it('P3-T02 records and clears AiMovePending for a valid in-area response', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const attempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      const tab = makeTab({
        id: 'tab_1',
        mode: 'problem',
        activeAttemptId: 'attempt_1',
      })
      workbenchStore.addTab(tab)
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')

      let receivedInput = null
      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => attempt),
        engineService: createPhase3EngineService(
          async (input) => {
            receivedInput = input
            assert.ok(runtimeStore.getState().pendingAiMove)
            return { move: 'C3', candidates: ['C3'] }
          },
        ),
      })

      const result = await service.requestAiMove({
        tab,
        attempt,
        task: makeTask({ problemArea: [[2, 2]] }),
        color: 'white',
      })

      assert.strictEqual(result, 'C3')
      assert.deepStrictEqual(receivedInput.analysisAreaVertices, [[2, 2]])
      assert.strictEqual(runtimeStore.getState().pendingAiMove, undefined)
    })

    it('P3-T03 drops a stale AI response when the Attempt position changes before resolve', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const originalAttempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      let latestAttempt = originalAttempt
      let resolveEngine
      const enginePromise = new Promise(resolve => {
        resolveEngine = resolve
      })

      const tab = makeTab({
        id: 'tab_1',
        mode: 'play',
        activeAttemptId: 'attempt_1',
      })
      workbenchStore.addTab(tab)
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')
      runtimeStore.setProblemView({
        taskId: 'task_1',
        tabId: 'tab_1',
        attemptId: 'attempt_1',
        legacyProblemSession: null,
        evalCache: [{ moveIndex: 0, move: 'D4', isBadMove: false, severity: 'none' }],
        badMoves: [],
        submitted: false,
        result: null,
      })
      const problemViewBefore = runtimeStore.getState().problemView

      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => latestAttempt),
        engineService: createPhase3EngineService(
          async () => {
            return enginePromise
          },
        ),
      })

      const pending = service.requestAiMove({
        tab,
        attempt: originalAttempt,
        task: makeTask(),
        color: 'white',
      })

      latestAttempt = { ...originalAttempt, userLine: ['D4', 'Q16'] }
      resolveEngine({ move: 'C3', candidates: ['C3'] })

      const result = await pending

      assert.strictEqual(result, null)
      assert.strictEqual(runtimeStore.getState().pendingAiMove, undefined)
      assert.deepStrictEqual(runtimeStore.getState().problemView, problemViewBefore)
      assert.strictEqual(workbenchStore.getState().activeTabId, 'tab_1')
    })

    it('P3-T03b drops a stale AI response when the active tab changes before resolve', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const attempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      let resolveEngine
      const enginePromise = new Promise(resolve => {
        resolveEngine = resolve
      })

      const tab = makeTab({ id: 'tab_1', mode: 'play', activeAttemptId: 'attempt_1' })
      workbenchStore.addTab(tab)
      workbenchStore.addTab(makeTab({ id: 'tab_2', mode: 'play', activeAttemptId: 'attempt_2' }))
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')

      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => attempt),
        engineService: createPhase3EngineService(async () => enginePromise),
      })

      const pending = service.requestAiMove({ tab, attempt, task: makeTask(), color: 'white' })
      workbenchStore.setActiveTab('tab_2')
      resolveEngine({ move: 'C3', candidates: ['C3'] })

      assert.strictEqual(await pending, null)
      assert.strictEqual(runtimeStore.getState().pendingAiMove, undefined)
      assert.strictEqual(workbenchStore.getState().activeTabId, 'tab_2')
    })

    it('P3-T03c drops a stale AI response when the active attempt changes before resolve', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const attempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      let resolveEngine
      const enginePromise = new Promise(resolve => {
        resolveEngine = resolve
      })

      const tab = makeTab({ id: 'tab_1', mode: 'play', activeAttemptId: 'attempt_1' })
      workbenchStore.addTab(tab)
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')

      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => attempt),
        engineService: createPhase3EngineService(async () => enginePromise),
      })

      const pending = service.requestAiMove({ tab, attempt, task: makeTask(), color: 'white' })
      runtimeStore.setActiveAttempt('attempt_2')
      resolveEngine({ move: 'C3', candidates: ['C3'] })

      assert.strictEqual(await pending, null)
      assert.strictEqual(runtimeStore.getState().pendingAiMove, undefined)
      assert.strictEqual(runtimeStore.getState().activeAttemptId, 'attempt_2')
    })

    it('P3-T03d drops a stale AI response when mode changes before resolve', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const attempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      let resolveEngine
      const enginePromise = new Promise(resolve => {
        resolveEngine = resolve
      })

      const tab = makeTab({ id: 'tab_1', mode: 'play', activeAttemptId: 'attempt_1' })
      workbenchStore.addTab(tab)
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')

      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => attempt),
        engineService: createPhase3EngineService(async () => enginePromise),
      })

      const pending = service.requestAiMove({ tab, attempt, task: makeTask(), color: 'white' })
      workbenchStore.updateTab('tab_1', { mode: 'analysis' })
      resolveEngine({ move: 'C3', candidates: ['C3'] })

      assert.strictEqual(await pending, null)
      assert.strictEqual(runtimeStore.getState().pendingAiMove, undefined)
      assert.strictEqual(workbenchStore.getState().tabs.find(t => t.id === 'tab_1').mode, 'analysis')
    })

    it('P3-T03e keeps a newer pending request when an older response resolves', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const attempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      let resolveEngine
      const enginePromise = new Promise(resolve => {
        resolveEngine = resolve
      })

      const tab = makeTab({ id: 'tab_1', mode: 'play', activeAttemptId: 'attempt_1' })
      workbenchStore.addTab(tab)
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')

      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => attempt),
        engineService: createPhase3EngineService(async () => enginePromise),
      })

      const pending = service.requestAiMove({ tab, attempt, task: makeTask(), color: 'white' })
      runtimeStore.setAiMovePending({
        requestId: 'ai_req_newer',
        tabId: 'tab_1',
        attemptId: 'attempt_1',
        positionHash: 'newer',
        mode: 'play',
        color: 'black',
        startedAt: '2026-05-25T00:00:00.000Z',
      })
      resolveEngine({ move: 'C3', candidates: ['C3'] })

      assert.strictEqual(await pending, null)
      assert.strictEqual(runtimeStore.getState().pendingAiMove.requestId, 'ai_req_newer')
    })

    it('P3-T03f drops an older response after the newer request already resolved', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const attempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      let resolveOlder
      let resolveNewer
      const olderEnginePromise = new Promise(resolve => {
        resolveOlder = resolve
      })
      const newerEnginePromise = new Promise(resolve => {
        resolveNewer = resolve
      })
      let callCount = 0

      const tab = makeTab({ id: 'tab_1', mode: 'play', activeAttemptId: 'attempt_1' })
      workbenchStore.addTab(tab)
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')

      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => attempt),
        engineService: createPhase3EngineService(async () => {
          callCount += 1
          return callCount === 1 ? olderEnginePromise : newerEnginePromise
        }),
      })

      const older = service.requestAiMove({ tab, attempt, task: makeTask(), color: 'white' })
      const newer = service.requestAiMove({ tab, attempt, task: makeTask(), color: 'white' })

      resolveNewer({ move: 'B2', candidates: ['B2'] })
      assert.strictEqual(await newer, 'B2')
      assert.strictEqual(runtimeStore.getState().pendingAiMove, undefined)

      resolveOlder({ move: 'A1', candidates: ['A1'] })
      assert.strictEqual(await older, null)
      assert.strictEqual(runtimeStore.hasSupersededAiMoveRequest(runtimeStore.getState().supersededAiMoveRequestIds[0]), true)
    })

    it('P3-T03g clears only matching pending when the engine request rejects', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const attempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      const tab = makeTab({ id: 'tab_1', mode: 'play', activeAttemptId: 'attempt_1' })

      workbenchStore.addTab(tab)
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')

      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => attempt),
        engineService: createPhase3EngineService(async () => {
          throw new Error('engine unavailable')
        }),
      })

      await assert.rejects(
        () => service.requestAiMove({ tab, attempt, task: makeTask(), color: 'white' }),
        /engine unavailable/,
      )
      assert.strictEqual(runtimeStore.getState().pendingAiMove, undefined)
    })

    it('P3-T03h keeps newer pending when an older engine request rejects', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const attempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      let rejectOlder
      let resolveNewer
      const olderEnginePromise = new Promise((_, reject) => {
        rejectOlder = reject
      })
      const newerEnginePromise = new Promise(resolve => {
        resolveNewer = resolve
      })
      let callCount = 0

      const tab = makeTab({ id: 'tab_1', mode: 'play', activeAttemptId: 'attempt_1' })
      workbenchStore.addTab(tab)
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')

      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => attempt),
        engineService: createPhase3EngineService(async () => {
          callCount += 1
          return callCount === 1 ? olderEnginePromise : newerEnginePromise
        }),
      })

      const older = service.requestAiMove({ tab, attempt, task: makeTask(), color: 'white' })
      const newer = service.requestAiMove({ tab, attempt, task: makeTask(), color: 'white' })
      const newerRequestId = runtimeStore.getState().pendingAiMove.requestId

      rejectOlder(new Error('older failed'))
      await assert.rejects(() => older, /older failed/)
      assert.strictEqual(runtimeStore.getState().pendingAiMove.requestId, newerRequestId)

      resolveNewer({ move: 'B2', candidates: ['B2'] })
      assert.strictEqual(await newer, 'B2')
      assert.strictEqual(runtimeStore.getState().pendingAiMove, undefined)
    })

    it('W8-PMC-RC-T11 stores request treePosition in AiMovePending while engine request is pending', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const attempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      let resolveEngine
      const enginePromise = new Promise(resolve => {
        resolveEngine = resolve
      })
      let notificationCount = 0
      const unsubscribe = runtimeStore.subscribe(() => {
        notificationCount += 1
      })

      const tab = makeTab({
        id: 'tab_1',
        mode: 'play',
        activeAttemptId: 'attempt_1',
        currentTreePosition: 'node_after_human',
      })
      workbenchStore.addTab(tab)
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')

      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => attempt),
        engineService: createPhase3EngineService(async () => enginePromise),
      })

      const pending = service.requestAiMove({
        tab,
        attempt,
        task: makeTask(),
        color: 'white',
        treePosition: 'node_after_human',
      })

      assert.strictEqual(
        runtimeStore.getState().pendingAiMove?.treePosition,
        'node_after_human',
        'pending AI request must persist the request treePosition',
      )
      assert.ok(notificationCount >= 2,
        'runtime store subscribers should be notified when pending AI request is stored')

      resolveEngine({ move: 'C3', candidates: ['C3'] })
      assert.strictEqual(await pending, 'C3')
      assert.strictEqual(runtimeStore.getState().pendingAiMove, undefined)
      unsubscribe()
    })

    it('W8-PMC-RC-T12 drops AI response when active treePosition changes before resolve', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const attempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      let resolveEngine
      const enginePromise = new Promise(resolve => {
        resolveEngine = resolve
      })

      const tab = makeTab({
        id: 'tab_1',
        mode: 'play',
        activeAttemptId: 'attempt_1',
        currentTreePosition: 'node_after_human',
      })
      workbenchStore.addTab(tab)
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')

      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => attempt),
        engineService: createPhase3EngineService(async () => enginePromise),
      })

      const pending = service.requestAiMove({
        tab,
        attempt,
        task: makeTask(),
        color: 'white',
        treePosition: 'node_after_human',
      })

      assert.strictEqual(runtimeStore.getState().pendingAiMove?.treePosition, 'node_after_human')

      workbenchStore.updateTab('tab_1', { currentTreePosition: 'node_changed' })
      resolveEngine({ move: 'C3', candidates: ['C3'] })

      assert.strictEqual(await pending, null)
      assert.strictEqual(runtimeStore.getState().pendingAiMove, undefined)
      assert.strictEqual(
        workbenchStore.getState().tabs.find(t => t.id === 'tab_1').currentTreePosition,
        'node_changed',
      )
    })

    it('W8-PMC-RC-T12b drops AI response using injected current tree-position source when tab snapshot has no position', async () => {
      const runtimeStore = createTrainingRuntimeStore()
      const workbenchStore = createWorkbenchStore()
      const attempt = makeAttempt({ id: 'attempt_1', userLine: ['D4'] })
      let currentTreePosition = 'node_after_human'
      let resolveEngine
      const enginePromise = new Promise(resolve => {
        resolveEngine = resolve
      })
      const readCalls = []

      const tab = makeTab({
        id: 'tab_1',
        mode: 'play',
        activeAttemptId: 'attempt_1',
      })
      workbenchStore.addTab(tab)
      workbenchStore.setActiveTab('tab_1')
      runtimeStore.setActiveAttempt('attempt_1')

      const service = createAiMoveService({
        runtimeStore,
        workbenchStore,
        repository: createPhase3AttemptRepository(() => attempt),
        getCurrentTreePosition: ({ tabId }) => {
          readCalls.push(tabId)
          return currentTreePosition
        },
        engineService: createPhase3EngineService(async () => enginePromise),
      })

      const pending = service.requestAiMove({
        tab,
        attempt,
        task: makeTask(),
        color: 'white',
        treePosition: 'node_after_human',
      })

      assert.strictEqual(runtimeStore.getState().pendingAiMove?.treePosition, 'node_after_human')

      currentTreePosition = 'node_changed'
      resolveEngine({ move: 'C3', candidates: ['C3'] })

      assert.strictEqual(await pending, null)
      assert.ok(readCalls.includes('tab_1'), 'freshness guard must read the live current tree position')
      assert.strictEqual(runtimeStore.getState().pendingAiMove, undefined)
    })
  })
})
