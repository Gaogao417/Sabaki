// @ts-check

/**
 * W8-P1 Board Interaction Controller Wiring Tests
 *
 * Test contract: docs/design/2026-05-21/w8-p1-board-interaction-controller/test-contract-v0.1.md
 * Contracts covered: W8P1-T01 through W8P1-T24
 *
 * Source of truth alignment:
 *   - PRD v0.5 SS2.1: Mode by user intent, workbenchMode routes clicks
 *   - PRD v0.5 SS3.1: Play - user free placement -> game tree
 *   - PRD v0.5 SS3.2: Problem - AI must respond within problemArea
 *   - PRD v0.5 SS3.3: Recall - user recalls moves sequentially
 *   - PRD v0.5 SS3.4: Analysis - free placement on scratch
 *   - Arch v0.5 SS0.3: UI only reads, Container/Controller calls Service
 *   - Arch v0.5 SS1.2: Command write path UI -> Controller -> Service -> Store/Repo
 *   - Arch v0.5 SS9.3: play -> documentStore.playMove
 *   - Arch v0.5 SS9.5: recall -> recallService.submitRecallMove
 *   - Arch v0.5 SS14: recall does NOT modify game tree, scratch does NOT modify Attempt.userLine
 *
 * v0.5 conflict check: No conflicts found. Contract routes by workbenchMode only,
 * no origin.provider branching, no source-specific tab API, no container store writes,
 * no UI service/store imports, resolver is pure.
 *
 * Test classification:
 *   - T01-T09, T15-T16, T20: Pure logic tests (CONTROLLER_STATE_TRANSITION), zero mocks
 *   - T10-T14: Side effect boundary tests, real resolver, mock executor deps
 *   - T17-T18: Architecture boundary tests (module import checks)
 *   - T19: UI command mapping (Goban signature test)
 *   - T21-T23: Service/repository transition (real store/repository)
 *   - T24: Container delegation test
 *
 * Workbench wiring coverage:
 *   - UI command mapping: T19 (Goban.handleVertexMouseUp -> onVertexClick(evt))
 *   - Container handler -> controller: T24 (Container.onVertexClick -> handleBoardClick)
 *   - Controller -> service/store: T10, T11, T13, T14 (executor dispatch)
 *   - Store subscription -> projection: T23 (runtimeStore subscription)
 *
 * Harness manifest:
 *   - Real production modules: resolveBoardInteraction, createBoardInteractionContext,
 *     BOARD_INTENTS, RESOLVE_STATUSES, createTrainingRuntimeStore, createRecallService,
 *     createRecallCheckpointService, createLoggerService, createConsoleWriter
 *   - Fake/spy modules: mock executor deps (documentStore, recallService, legacySabaki,
 *     editWorkspaceDeps) for T10-T14
 *   - Fake repository (in-memory) for T21-T23
 *   - Valid for: CONTROLLER_STATE_TRANSITION, SIDE_EFFECT_BOUNDARY, ARCHITECTURE_BOUNDARY,
 *     UI_COMMAND_MAPPING, STORE_SUBSCRIPTION, SERVICE_REPOSITORY_TRANSITION, CONTAINER_DELEGATION
 *   - Not valid for: RENDERED_UI_RETURN (no DOM rendering)
 *
 * Long-term vs migration:
 *   - T01-T09, T15-T16, T17-T20: Long-term (resolver purity + architecture)
 *   - T10-T14: Long-term (controller side effects)
 *   - T21-T23: Long-term (service/repo transition)
 *   - T24: Long-term (container delegation)
 *   - No migration-period tests; all tests protect stable architecture contracts.
 *
 * Fragile test warnings:
 *   1. T10-T14: Do NOT mock resolveBoardInteraction (contract Section 9.1).
 *      Let the resolver execute for real to prevent false-green.
 *   2. T24: Assert parameter shape, not call count (contract Section 9.2).
 *   3. T11: Coordinate format must match expectedMoves format (contract Section 9.3).
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'

// --- Real production imports ---

import {resolveBoardInteraction} from '../../../src/modules/workbench/board-interactions/resolveBoardInteraction.ts'
import {BOARD_INTENTS, RESOLVE_STATUSES} from '../../../src/modules/workbench/board-interactions/intents.ts'
import {createBoardInteractionContext} from '../../../src/modules/workbench/board-interactions/createBoardInteractionContext.ts'
import {createBoardInteractionController} from '../../../src/modules/training/workbench/boardInteractionController.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createRecallService} from '../../../src/modules/training/recall/recallService.ts'
import {createRecallCheckpointService} from '../../../src/modules/training/recall/recallCheckpointService.ts'
import {createLoggerService} from '../../../src/modules/logger/LoggerService.js'
import {createConsoleWriter} from '../../../src/modules/logger/consoleWriter.js'

/**
 * @typedef {import('../../../src/modules/training/workbench/boardInteractionController.ts').BoardInteractionControllerDeps} BoardInteractionControllerDeps
 * @typedef {{rootPositionSgf: string, userLine: string[]}} PlayCommitAttempt
 * @typedef {{
 *   documentStorePlayMove: Array<{vertex: [number, number], opts: unknown}>,
 *   attemptAppendMove: Array<{attemptId: string, move: string, actor?: 'human' | 'ai'}>,
 *   monitorOnUserMove: Array<Record<string, unknown>>,
 *   analysisSchedule: Array<{treePosition: string}>,
 *   aiMaybePlay: Array<{treePosition?: string, attempt: PlayCommitAttempt}>,
 *   problemAppendMove: Array<Record<string, unknown>>,
 *   recallSubmitBoardClick: Array<{vertex: [number, number]}>,
 *   editCommitScratchResult: Array<unknown>,
 *   sequence: string[],
 * }} PlayCommitCalls
 */

// --- Logger for test harness (real, not mocked) ---

const logger = createLoggerService({writers: [createConsoleWriter()]})

// --- Helper Factories ---

function makeMockBoard(signMapOverrides = {}) {
  const signMap = Array(19).fill(null).map(() => Array(19).fill(0))
  for (const [key, val] of Object.entries(signMapOverrides)) {
    const [x, y] = key.split(',').map(Number)
    signMap[y][x] = val
  }
  return {
    width: 19,
    height: 19,
    get([x, y]) { return signMap[y]?.[x] ?? 0 },
    markers: Array(19).fill(null).map(() => Array(19).fill(null)),
  }
}

/**
 * Build a ResolverInput using the real createBoardInteractionContext,
 * then resolve it through the pure resolver.
 */
function resolveClick({
  workbenchMode = 'play',
  vertex = [3, 3],
  event = {button: 0, ctrlKey: false, metaKey: false},
  selectedTool = 'stone_1',
  editWorkspacePresent = false,
  playerConfig = null,
  problemArea = null,
  activeAttemptId,
  activeRecallSessionId,
  board = makeMockBoard(),
}) {
  const state = {
    mode: workbenchMode,
    selectedTool,
    treePosition: 'node_root',
    editWorkspace: editWorkspacePresent ? {activeTab: 'current'} : null,
  }

  const context = createBoardInteractionContext({
    state,
    board,
    vertex,
    event,
    isMac: false,
    workbenchMode,
    tabId: 'tab_1',
    taskId: 'task_1',
    playerConfig,
    problemArea,
    activeAttemptId,
    activeRecallSessionId,
  })

  return resolveBoardInteraction(context)
}

/**
 * Create controller deps with write-tracking spies.
 * Each executor target records calls for assertion.
 */
function createControllerDeps(options = {}) {
  const {
    playMoveResult = {valid: true, changed: true, treePosition: 'node_2'},
    recallAnswerResult = {handled: true, changed: true, isCorrect: true},
  } = options

  const calls = {
    documentStorePlayMove: [],
    recallSubmitBoardClick: [],
    legacyClickVertex: [],
    editAnalysisInvalidate: [],
    editAnalysisSchedule: [],
  }

  const documentStore = {
    playMove: async (vertex, opts) => {
      calls.documentStorePlayMove.push({vertex, opts})
      return playMoveResult
    },
  }

  const recallAdapter = {
    async submitBoardClick(vertex) {
      calls.recallSubmitBoardClick.push({vertex})
      return recallAnswerResult
    },
  }

  const editWorkspaceDeps = {
    invalidateEditAnalysis: () => { calls.editAnalysisInvalidate.push({}) },
    scheduleEditWorkspaceAnalysis: () => { calls.editAnalysisSchedule.push({}) },
  }

  const legacySabaki = {
    clickVertex: (vertex, opts) => {
      calls.legacyClickVertex.push({vertex, opts})
    },
  }

  return {
    getPlayServices: () => ({
      documentStore,
      engineService: undefined,
      analysisService: undefined,
    }),
    getRecallAdapter: () => recallAdapter,
    getEditWorkspaceContext: () => ({
      activeTab: 'current',
      currentSnapshot: {
        id: 'snap_1',
        role: 'current',
        signMap: Array(19).fill(null).map(() => Array(19).fill(0)),
        nextPlayer: 1,
        width: 19,
        height: 19,
      },
      referenceSnapshot: null,
      currentMarkerMap: Array(19).fill(null).map(() => Array(19).fill(null)),
      referenceMarkerMap: null,
      currentLines: [],
      referenceLines: null,
      lineFirstVertex: null,
    }),
    getEditWorkspaceDeps: () => editWorkspaceDeps,
    getLegacySabaki: () => legacySabaki,
    getIsMac: () => false,
    _calls: calls,
    _documentStore: documentStore,
    _recallAdapter: recallAdapter,
    _legacySabaki: legacySabaki,
  }
}

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    childTabIds: [],
    playerConfig: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Typed spy harness for the Play move post-commit contract. These spies observe
 * controller ports only; they do not model resolver, executor, engine, or repo
 * semantics.
 *
 * @param {{
 *   playMoveResults?: Array<Record<string, unknown>>,
 *   aiMoves?: Array<string | null>,
 *   initialAttemptLine?: string[],
 * }} [options]
 * @returns {BoardInteractionControllerDeps & {
 *   _calls: PlayCommitCalls,
 *   _attempts: Map<string, PlayCommitAttempt>,
 * }}
 */
function createPlayMoveCommitDeps(options = {}) {
  const playMoveResults = options.playMoveResults ?? [
    {valid: true, changed: true, treePosition: 'node_human'},
  ]
  const aiMoves = [...(options.aiMoves ?? [null])]
  let playMoveIndex = 0

  /** @type {PlayCommitCalls} */
  const calls = {
    documentStorePlayMove: [],
    attemptAppendMove: [],
    monitorOnUserMove: [],
    analysisSchedule: [],
    aiMaybePlay: [],
    problemAppendMove: [],
    recallSubmitBoardClick: [],
    editCommitScratchResult: [],
    sequence: [],
  }

  /** @type {Map<string, PlayCommitAttempt>} */
  const attempts = new Map([
    [
      'attempt_1',
      {
        rootPositionSgf: '(;GM[1]SZ[19])',
        userLine: [...(options.initialAttemptLine ?? [])],
      },
    ],
  ])

  /** @type {BoardInteractionControllerDeps} */
  const deps = {
    getPlayServices: () => ({
      documentStore: {
        playMove: async (vertex, opts) => {
          calls.sequence.push(`document:${playMoveIndex}`)
          calls.documentStorePlayMove.push({vertex, opts})
          const result = playMoveResults[Math.min(playMoveIndex, playMoveResults.length - 1)]
          playMoveIndex += 1
          return result
        },
      },
      engineService: undefined,
      analysisService: {
        scheduleLiveAnalysis: (treePosition) => {
          calls.sequence.push(`analysis:${treePosition}`)
          calls.analysisSchedule.push({treePosition})
        },
      },
      problemFlowService: {
        appendProblemMove: async (input) => {
          calls.problemAppendMove.push({...input})
          return {handled: true, changed: true}
        },
      },
      attemptService: {
        appendMove: async (attemptId, move, actor) => {
          calls.sequence.push(`attempt:${actor ?? 'human'}:${move}`)
          calls.attemptAppendMove.push({attemptId, move, actor})
          const current = attempts.get(attemptId) ?? {
            rootPositionSgf: '(;GM[1]SZ[19])',
            userLine: [],
          }
          attempts.set(attemptId, {
            ...current,
            userLine: [...current.userLine, move],
          })
        },
      },
      monitor: {
        onUserMove: async (input) => {
          calls.sequence.push(`monitor:${String(input.move)}`)
          calls.monitorOnUserMove.push({...input})
        },
      },
      repository: {
        loadAttempt: async (attemptId) => {
          const attempt = attempts.get(attemptId)
          return attempt
            ? {rootPositionSgf: attempt.rootPositionSgf, userLine: [...attempt.userLine]}
            : null
        },
        loadTask: async () => ({
          rootPositionSgf: '(;GM[1]SZ[19])',
          sideToMove: 'black',
        }),
      },
      aiMoveService: {
        maybePlayAiMove: async (input) => {
          calls.sequence.push(`ai:${input.treePosition ?? ''}`)
          calls.aiMaybePlay.push({
            treePosition: input.treePosition,
            attempt: {
              rootPositionSgf: input.attempt.rootPositionSgf,
              userLine: [...input.attempt.userLine],
            },
          })
          return aiMoves.length > 0 ? aiMoves.shift() ?? null : null
        },
      },
    }),
    getRecallAdapter: () => ({
      submitBoardClick: async (vertex) => {
        calls.recallSubmitBoardClick.push({vertex})
        return {handled: true, changed: true, isCorrect: true}
      },
    }),
    getEditWorkspaceContext: () => ({
      activeTab: 'current',
      currentSnapshot: {
        id: 'snap_1',
        role: 'current',
        signMap: Array(19).fill(null).map(() => Array(19).fill(0)),
        nextPlayer: 1,
        width: 19,
        height: 19,
      },
      referenceSnapshot: null,
      currentMarkerMap: Array(19).fill(null).map(() => Array(19).fill(null)),
      referenceMarkerMap: null,
      currentLines: [],
      referenceLines: null,
      lineFirstVertex: null,
    }),
    getEditWorkspaceDeps: () => ({
      commitScratchResult: (result) => {
        calls.editCommitScratchResult.push(result)
      },
    }),
    getLegacySabaki: () => ({clickVertex: () => {}}),
    getIsMac: () => false,
  }

  return Object.assign(deps, {
    _calls: calls,
    _attempts: attempts,
  })
}

function makePlayCommitInput(overrides = {}) {
  return {
    vertex: [3, 3],
    event: {button: 0, ctrlKey: false, metaKey: false},
    activeTab: makeTab({
      mode: 'play',
      activeAttemptId: 'attempt_1',
      playerConfig: {
        black: 'human',
        white: 'ai',
        ai: {autoPlay: true},
      },
    }),
    settings: {selectedTool: 'stone_1'},
    board: makeMockBoard(),
    editWorkspacePresent: false,
    task: null,
    runtimeState: {},
    ...overrides,
  }
}

/**
 * In-memory repository fake for SERVICE_REPOSITORY_TRANSITION tests.
 * Stores data in Maps, supports the recall/recallAttempt/checkpoint operations.
 */
function createInMemoryRepository() {
  const sessions = new Map()
  const attempts = new Map()
  const checkpoints = new Map()
  const badMoves = new Map()
  const moveEvaluations = new Map()

  return {
    // Recall session
    createRecallSession: async (session) => { sessions.set(session.id, {...session}); return session },
    loadRecallSession: async (id) => sessions.get(id) || null,
    updateRecallSession: async (id, patch) => {
      const s = sessions.get(id)
      if (s) sessions.set(id, {...s, ...patch})
    },

    // Recall attempt
    createRecallAttempt: async (attempt) => { attempts.set(attempt.id, {...attempt}); return attempt },
    listRecallAttempts: async (sessionId) => {
      return [...attempts.values()].filter(a => a.recallSessionId === sessionId)
    },

    // Checkpoint
    createRecallCheckpoint: async (cp) => { checkpoints.set(cp.id, {...cp}); return cp },
    loadRecallCheckpoint: async (id) => checkpoints.get(id) || null,
    updateRecallCheckpoint: async (id, patch) => {
      const cp = checkpoints.get(id)
      if (cp) checkpoints.set(id, {...cp, ...patch})
    },
    listCheckpointsByRecallSession: async (sessionId) => {
      return [...checkpoints.values()].filter(cp => cp.recallSessionId === sessionId)
    },

    // BadMove
    createBadMove: async (bm) => { badMoves.set(bm.id, {...bm}); return bm },
    loadBadMove: async (id) => badMoves.get(id) || null,
    listBadMovesByAttempt: async (attemptId) => {
      return [...badMoves.values()].filter(bm => bm.attemptId === attemptId)
    },
    updateBadMove: async (id, patch) => {
      const bm = badMoves.get(id)
      if (bm) badMoves.set(id, {...bm, ...patch})
    },

    // Move evaluation
    listMoveEvaluationsByAttempt: async (attemptId) => {
      return [...moveEvaluations.values()].filter(ev => ev.attemptId === attemptId)
    },

    // Attempt
    loadAttempt: async () => null,
    updateAttempt: async () => {},
  }
}

// ==========================================================================
// T01-T09, T15-T16, T20: Pure resolver tests (CONTROLLER_STATE_TRANSITION)
// Zero mocks. Real resolveBoardInteraction, real createBoardInteractionContext.
// ==========================================================================

describe('W8-P1 Board Interaction Controller', function () {

  describe('T01-T09, T15-T16, T20: resolveBoardInteraction pure logic (zero mocks)', function () {

    // W8P1-T01: play + empty point -> resolved, intent=play-stone
    it('W8P1-T01: play mode click on empty point resolves to play-stone', function () {
      const result = resolveClick({
        workbenchMode: 'play',
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        board: makeMockBoard(),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLAY_STONE)
      assert.deepStrictEqual(result.payload.vertex, [3, 3])
    })

    // W8P1-T02: play + AI turn -> rejected
    it('W8P1-T02: play mode AI turn click is rejected', function () {
      const result = resolveClick({
        workbenchMode: 'play',
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        playerConfig: {currentSide: 'ai'},
        board: makeMockBoard(),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    // W8P1-T03: problem + vertex inside problemArea -> resolved (problemAttemptMove)
    it('W8P1-T03: problem mode click inside problemArea resolves to problem attempt move', function () {
      const result = resolveClick({
        workbenchMode: 'problem',
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        problemArea: {vertices: [[3, 3], [3, 4], [4, 3], [4, 4]]},
        board: makeMockBoard(),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLAY_STONE)
      assert.strictEqual(result.mutationContract, 'problemAttemptMove')
    })

    // W8P1-T04: problem + vertex outside problemArea -> rejected
    it('W8P1-T04: problem mode click outside problemArea is rejected', function () {
      const result = resolveClick({
        workbenchMode: 'problem',
        vertex: [10, 10],
        event: {button: 0, ctrlKey: false, metaKey: false},
        problemArea: {vertices: [[3, 3], [3, 4], [4, 3], [4, 4]]},
        board: makeMockBoard(),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    // W8P1-T05: problem + AI turn -> rejected
    it('W8P1-T05: problem mode AI turn click is rejected', function () {
      const result = resolveClick({
        workbenchMode: 'problem',
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        problemArea: {vertices: [[3, 3], [3, 4], [4, 3], [4, 4]]},
        playerConfig: {currentSide: 'ai'},
        board: makeMockBoard(),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    // W8P1-T06: recall + empty point -> resolved, intent=submit-recall-answer
    it('W8P1-T06: recall mode click on empty point resolves to submit-recall-answer', function () {
      const result = resolveClick({
        workbenchMode: 'recall',
        vertex: [5, 5],
        event: {button: 0, ctrlKey: false, metaKey: false},
        board: makeMockBoard(),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.SUBMIT_RECALL_ANSWER)
    })

    // W8P1-T07: recall + occupied point -> rejected
    it('W8P1-T07: recall mode click on occupied point is rejected', function () {
      const result = resolveClick({
        workbenchMode: 'recall',
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        board: makeMockBoard({'3,3': 1}),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    // W8P1-T08: analysis + editWorkspace + stone_1 -> scratchEdit (place-black-stone)
    it('W8P1-T08: analysis mode with editWorkspace and stone_1 tool resolves to scratchEdit', function () {
      const result = resolveClick({
        workbenchMode: 'analysis',
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        selectedTool: 'stone_1',
        editWorkspacePresent: true,
        board: makeMockBoard(),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
    })

    // W8P1-T09: analysis without editWorkspace -> deferred
    it('W8P1-T09: analysis mode without editWorkspace is deferred', function () {
      const result = resolveClick({
        workbenchMode: 'analysis',
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        editWorkspacePresent: false,
        board: makeMockBoard(),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
    })

    // W8P1-T15: play + right-click -> deferred (legacy)
    it('W8P1-T15: play mode right-click is deferred to legacy', function () {
      const result = resolveClick({
        workbenchMode: 'play',
        vertex: [3, 3],
        event: {button: 2, ctrlKey: false, metaKey: false},
        board: makeMockBoard(),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.strictEqual(result.intent, BOARD_INTENTS.LEGACY_PLAY_RIGHT_CLICK)
    })

    // W8P1-T16: play + occupied point -> rejected
    it('W8P1-T16: play mode click on occupied point is rejected', function () {
      const result = resolveClick({
        workbenchMode: 'play',
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        board: makeMockBoard({'3,3': 1}),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    // W8P1-T20: problem without problemArea -> resolved (problemAttemptMove)
    it('W8P1-T20: problem mode without problemArea resolves to problem attempt move', function () {
      const result = resolveClick({
        workbenchMode: 'problem',
        vertex: [10, 10],
        event: {button: 0, ctrlKey: false, metaKey: false},
        problemArea: null,
        board: makeMockBoard(),
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLAY_STONE)
      assert.strictEqual(result.mutationContract, 'problemAttemptMove')
    })
  })

  // =====================================================================
  // T10-T14: SIDE_EFFECT_BOUNDARY tests
  // Real resolveBoardInteraction (forbidden to mock per contract Section 9.1).
  // Mock executor deps (documentStore, recallService, legacySabaki).
  // =====================================================================

  describe('T10-T14: boardInteractionController side effect boundary', function () {
    // W8P1-T10: play resolved -> documentStore.playMove is called
    it('W8P1-T10: play resolved routes to documentStore.playMove', async function () {
      const deps = createControllerDeps()
      const controller = createBoardInteractionController(deps)

      await controller.handleBoardClick({
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'play'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      assert.strictEqual(deps._calls.documentStorePlayMove.length, 1,
        'documentStore.playMove must be called exactly once for play resolved')
      assert.deepStrictEqual(deps._calls.documentStorePlayMove[0].vertex, [3, 3])
    })

    // W8P1-T11: recall resolved -> adapter.submitBoardClick is called via executor
    it('W8P1-T11: recall resolved routes to adapter.submitBoardClick', async function () {
      const deps = createControllerDeps()
      const controller = createBoardInteractionController(deps)

      await controller.handleBoardClick({
        vertex: [5, 5],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({
          mode: 'recall',
          activeRecallSessionId: 'rs_123',
        }),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      assert.strictEqual(deps._calls.recallSubmitBoardClick.length, 1,
        'adapter.submitBoardClick must be called exactly once for recall resolved')
      const call = deps._calls.recallSubmitBoardClick[0]
      assert.deepStrictEqual(call.vertex, [5, 5],
        'submitBoardClick must receive vertex [5,5]')
    })

    // W8P1-T12: deferred -> legacySabaki.clickVertex is called
    it('W8P1-T12: deferred routes to legacySabaki.clickVertex', async function () {
      const deps = createControllerDeps()
      const controller = createBoardInteractionController(deps)

      // analysis without editWorkspace -> deferred
      await controller.handleBoardClick({
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'analysis'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      assert.strictEqual(deps._calls.legacyClickVertex.length, 1,
        'legacySabaki.clickVertex must be called for deferred')
      assert.deepStrictEqual(deps._calls.legacyClickVertex[0].vertex, [3, 3])
    })

    // W8P1-T13: recall resolved -> documentStore.playMove is NOT called (Arch v0.5 SS14)
    it('W8P1-T13: recall resolved does NOT call documentStore.playMove', async function () {
      const deps = createControllerDeps()
      const controller = createBoardInteractionController(deps)

      await controller.handleBoardClick({
        vertex: [5, 5],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({
          mode: 'recall',
          activeRecallSessionId: 'rs_123',
        }),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      assert.strictEqual(deps._calls.documentStorePlayMove.length, 0,
        'documentStore.playMove must NOT be called for recall (Arch v0.5 SS14)')
    })

    // W8P1-T14: scratchEdit resolved -> documentStore.playMove is NOT called (Arch v0.5 SS14)
    it('W8P1-T14: scratchEdit resolved does NOT call documentStore.playMove', async function () {
      const deps = createControllerDeps()
      const controller = createBoardInteractionController(deps)

      // analysis + editWorkspace + stone_1 -> scratchEdit
      await controller.handleBoardClick({
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'analysis'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: true,
        task: null,
        runtimeState: {},
      })

      assert.strictEqual(deps._calls.documentStorePlayMove.length, 0,
        'documentStore.playMove must NOT be called for scratchEdit (Arch v0.5 SS14)')
      assert.ok(deps._calls.editAnalysisInvalidate.length >= 1,
        'editWorkspaceDeps.invalidateEditAnalysis should be called for scratch edit')
    })
  })

  // =====================================================================
  // W8-PMC: Play move post-commit pipeline
  // Contract: docs/archive/daily-design/2026-05-29/play-move-committed-workflow/test-contract-v0.1.md
  // =====================================================================

  describe('W8-PMC: Play move post-commit pipeline', function () {
    it('W8-PMC-T01: changed human Play move gates Attempt, monitor, analysis, and AI decision after document write', async function () {
      const deps = createPlayMoveCommitDeps({
        playMoveResults: [{valid: true, changed: true, treePosition: 'node_human'}],
        aiMoves: [null],
      })
      const controller = createBoardInteractionController(deps)

      const result = await controller.handleBoardClick(makePlayCommitInput())

      assert.strictEqual(result.changed, true)
      assert.deepStrictEqual(deps._calls.documentStorePlayMove, [
        {vertex: [3, 3], opts: {player: null}},
      ])
      assert.deepStrictEqual(deps._calls.attemptAppendMove, [
        {attemptId: 'attempt_1', move: 'dd', actor: 'human'},
      ])
      assert.deepStrictEqual(deps._calls.monitorOnUserMove, [
        {
          attemptId: 'attempt_1',
          moveIndex: 0,
          move: 'dd',
          positionAfterHash: 'node_human',
        },
      ])
      assert.deepStrictEqual(deps._calls.analysisSchedule, [
        {treePosition: 'node_human'},
      ])
      assert.strictEqual(deps._calls.aiMaybePlay.length, 1)
      assert.strictEqual(deps._calls.aiMaybePlay[0].treePosition, 'node_human')
      assert.deepStrictEqual(deps._calls.aiMaybePlay[0].attempt.userLine, ['dd'])

      const documentIndex = deps._calls.sequence.indexOf('document:0')
      assert.ok(documentIndex >= 0, 'document write must be observed')
      for (const marker of ['attempt:human:dd', 'monitor:dd', 'ai:node_human']) {
        assert.ok(
          deps._calls.sequence.indexOf(marker) > documentIndex,
          `${marker} must run after changed document write`,
        )
      }
    })

    it('W8-PMC-T02: invalid or unchanged Play document result does not run post-commit participants', async function () {
      for (const playMoveResult of [
        {valid: false, changed: false, reason: 'illegal'},
        {valid: true, changed: false, treePosition: 'node_same'},
      ]) {
        const deps = createPlayMoveCommitDeps({
          playMoveResults: [playMoveResult],
          aiMoves: ['pp'],
        })
        const controller = createBoardInteractionController(deps)

        const result = await controller.handleBoardClick(makePlayCommitInput())

        assert.strictEqual(result.changed, false)
        assert.strictEqual(deps._calls.documentStorePlayMove.length, 1)
        assert.strictEqual(deps._calls.attemptAppendMove.length, 0)
        assert.strictEqual(deps._calls.monitorOnUserMove.length, 0)
        assert.strictEqual(deps._calls.analysisSchedule.length, 0)
        assert.strictEqual(deps._calls.aiMaybePlay.length, 0)
      }
    })

    it('W8-PMC-T03: AI candidate re-enters the same Play post-commit pipeline after human commit', async function () {
      const deps = createPlayMoveCommitDeps({
        playMoveResults: [
          {valid: true, changed: true, treePosition: 'node_human'},
          {valid: true, changed: true, treePosition: 'node_ai'},
        ],
        aiMoves: ['pp', null],
      })
      const controller = createBoardInteractionController(deps)

      await controller.handleBoardClick(makePlayCommitInput())

      assert.deepStrictEqual(
        deps._calls.documentStorePlayMove.map(call => call.vertex),
        [[3, 3], [15, 15]],
      )
      assert.deepStrictEqual(deps._calls.attemptAppendMove, [
        {attemptId: 'attempt_1', move: 'dd', actor: 'human'},
        {attemptId: 'attempt_1', move: 'pp', actor: 'ai'},
      ])
      assert.deepStrictEqual(
        deps._calls.monitorOnUserMove.map(call => ({
          attemptId: call.attemptId,
          moveIndex: call.moveIndex,
          move: call.move,
          positionAfterHash: call.positionAfterHash,
        })),
        [
          {attemptId: 'attempt_1', moveIndex: 0, move: 'dd', positionAfterHash: 'node_human'},
          {attemptId: 'attempt_1', moveIndex: 1, move: 'pp', positionAfterHash: 'node_ai'},
        ],
      )
      assert.deepStrictEqual(deps._calls.analysisSchedule, [
        {treePosition: 'node_human'},
        {treePosition: 'node_ai'},
      ])
      assert.deepStrictEqual(
        deps._calls.aiMaybePlay.map(call => ({
          treePosition: call.treePosition,
          userLine: call.attempt.userLine,
        })),
        [
          {treePosition: 'node_human', userLine: ['dd']},
          {treePosition: 'node_ai', userLine: ['dd', 'pp']},
        ],
      )
    })

    it('W8-PMC-T04: AI vs AI continuation is bounded by maxAutoMovesPerRun', async function () {
      const deps = createPlayMoveCommitDeps({
        playMoveResults: [
          {valid: true, changed: true, treePosition: 'node_human'},
          {valid: true, changed: true, treePosition: 'node_ai_1'},
          {valid: true, changed: true, treePosition: 'node_ai_2'},
          {valid: true, changed: true, treePosition: 'node_ai_3'},
        ],
        aiMoves: ['pp', 'dp', 'qq'],
      })
      const controller = createBoardInteractionController(deps)

      await controller.handleBoardClick(makePlayCommitInput({
        activeTab: makeTab({
          mode: 'play',
          activeAttemptId: 'attempt_1',
          playerConfig: {
            black: 'ai',
            white: 'ai',
            ai: {
              autoPlay: true,
              autoPlayLimits: {maxAutoMovesPerRun: 2},
            },
          },
        }),
      }))

      assert.deepStrictEqual(
        deps._calls.documentStorePlayMove.map(call => call.vertex),
        [[3, 3], [15, 15], [3, 15]],
      )
      assert.deepStrictEqual(
        deps._calls.attemptAppendMove.map(call => ({move: call.move, actor: call.actor})),
        [
          {move: 'dd', actor: 'human'},
          {move: 'pp', actor: 'ai'},
          {move: 'dp', actor: 'ai'},
        ],
      )
      assert.deepStrictEqual(
        deps._calls.aiMaybePlay.map(call => call.treePosition),
        ['node_human', 'node_ai_1'],
      )
      assert.strictEqual(deps._attempts.get('attempt_1')?.userLine.includes('qq'), false,
        'third queued AI move must be ignored by the maxAutoMovesPerRun guard')
    })

    it('W8-PMC-T05: null or invalid AI reply does not write game tree or AI Attempt', async function () {
      for (const aiMove of [null, 'resign']) {
        const deps = createPlayMoveCommitDeps({
          playMoveResults: [{valid: true, changed: true, treePosition: 'node_human'}],
          aiMoves: [aiMove],
        })
        const controller = createBoardInteractionController(deps)

        await controller.handleBoardClick(makePlayCommitInput())

        assert.strictEqual(deps._calls.documentStorePlayMove.length, 1)
        assert.deepStrictEqual(deps._calls.attemptAppendMove, [
          {attemptId: 'attempt_1', move: 'dd', actor: 'human'},
        ])
        assert.strictEqual(deps._calls.monitorOnUserMove.length, 1)
        assert.strictEqual(deps._calls.aiMaybePlay.length, 1)
      }
    })

    it('W8-PMC-RC-T10: double-pass terminal commit stops before AI request or AI write', async function () {
      const deps = createPlayMoveCommitDeps({
        playMoveResults: [
          {valid: true, changed: true, treePosition: 'node_terminal', doublePass: true},
          {valid: true, changed: true, treePosition: 'node_ai'},
        ],
        aiMoves: ['pp'],
      })
      const controller = createBoardInteractionController(deps)

      await controller.handleBoardClick(makePlayCommitInput())

      assert.deepStrictEqual(deps._calls.documentStorePlayMove, [
        {vertex: [3, 3], opts: {player: null}},
      ])
      assert.deepStrictEqual(deps._calls.attemptAppendMove, [
        {attemptId: 'attempt_1', move: 'dd', actor: 'human'},
      ])
      assert.deepStrictEqual(
        deps._calls.monitorOnUserMove.map(call => ({
          move: call.move,
          positionAfterHash: call.positionAfterHash,
        })),
        [{move: 'dd', positionAfterHash: 'node_terminal'}],
      )
      assert.deepStrictEqual(deps._calls.analysisSchedule, [
        {treePosition: 'node_terminal'},
      ])
      assert.strictEqual(deps._calls.aiMaybePlay.length, 0,
        'terminal double-pass commit must not request an AI continuation')
    })

    it('W8-PMC-T06: Problem, Recall, and Analysis clicks do not trigger Play post-commit handlers', async function () {
      const cases = [
        {
          name: 'problem',
          input: makePlayCommitInput({
            activeTab: makeTab({mode: 'problem'}),
            task: {sideToMove: 'black'},
          }),
          assertModeSpecific: (deps) => {
            assert.strictEqual(deps._calls.problemAppendMove.length, 1)
          },
        },
        {
          name: 'recall',
          input: makePlayCommitInput({
            activeTab: makeTab({mode: 'recall', activeRecallSessionId: 'rs_1'}),
          }),
          assertModeSpecific: (deps) => {
            assert.strictEqual(deps._calls.recallSubmitBoardClick.length, 1)
          },
        },
        {
          name: 'analysis',
          input: makePlayCommitInput({
            activeTab: makeTab({mode: 'analysis'}),
            editWorkspacePresent: true,
          }),
          assertModeSpecific: (deps) => {
            assert.strictEqual(deps._calls.editCommitScratchResult.length, 1)
          },
        },
      ]

      for (const testCase of cases) {
        const deps = createPlayMoveCommitDeps({
          playMoveResults: [{valid: true, changed: true, treePosition: `node_${testCase.name}`}],
          aiMoves: ['pp'],
        })
        const controller = createBoardInteractionController(deps)

        await controller.handleBoardClick(testCase.input)

        testCase.assertModeSpecific(deps)
        assert.strictEqual(deps._calls.documentStorePlayMove.length, 0,
          `${testCase.name} must not write through Play documentStore.playMove`)
        assert.strictEqual(deps._calls.attemptAppendMove.length, 0,
          `${testCase.name} must not run Play Attempt append`)
        assert.strictEqual(deps._calls.monitorOnUserMove.length, 0,
          `${testCase.name} must not run Play monitor`)
        assert.strictEqual(deps._calls.analysisSchedule.length, 0,
          `${testCase.name} must not run Play analysis scheduler`)
        assert.strictEqual(deps._calls.aiMaybePlay.length, 0,
          `${testCase.name} must not run Play AI continuation`)
      }
    })

    it('W8-PMC-T07: Play commit fan-out has no overlayRegion or overlayStore dependency', function () {
      const files = [
        '../../../src/modules/training/workbench/boardInteractionController.ts',
        '../../../src/modules/workbench/board-interactions/executors/playInteractionExecutor.js',
      ]

      for (const file of files) {
        const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8')
        assert.ok(!/\boverlayRegion\b/.test(source), `${file} must not depend on overlayRegion`)
        assert.ok(!/\boverlayStore\b/.test(source), `${file} must not depend on overlayStore`)
      }
    })

    it('W8-PMC-T08/W8-PMC-RC-T13: aiMoveService does not directly write commit side effects or UI', function () {
      const source = fs.readFileSync(
        path.resolve(__dirname, '../../../src/modules/training/ai/aiMoveService.ts'),
        'utf8',
      )

      const forbiddenPatterns = [
        /\bdocumentStore\b/,
        /\.playMove\s*\(/,
        /\.appendMove\s*\(/,
        /\.updateAttempt\s*\(/,
        /\.createAttempt\s*\(/,
        /\bmonitor\b/,
        /\banalysisService\b/,
        /\bscheduleLiveAnalysis\b/,
        /\boverlayRegion\b/,
        /\boverlayStore\b/,
        /from\s+['"][^'"]*components\//,
        /\bReact\b/,
        /\bwindow\b/,
        /\bsabaki\b/i,
      ]

      for (const pattern of forbiddenPatterns) {
        assert.ok(!pattern.test(source), `aiMoveService must not contain ${pattern}`)
      }
    })

    it('W8-PMC-T09/W8-PMC-RC-T14: no formal event, source-specific API, or Snapshot orchestration is introduced', function () {
      const files = [
        '../../../src/modules/training/workbench/boardInteractionController.ts',
        '../../../src/modules/workbench/board-interactions/executors/playInteractionExecutor.js',
        '../../../src/modules/training/ai/aiMoveService.ts',
      ]
      const forbiddenPatterns = [
        /\b(?:export\s+)?(?:type|interface|class)\s+PlayMoveCommitted(?:Event)?\b/,
        /\.emit\s*\(\s*['"]PlayMoveCommitted['"]/,
        /\bdispatchEvent\s*\(\s*new\s+Event\s*\(\s*['"]PlayMoveCommitted['"]/,
        /\bipc(?:Main|Renderer)?\.\w+\s*\(\s*['"]PlayMoveCommitted['"]/,
        /\bPlayMoveCommitted\b[\s\S]{0,120}\bEventEmitter\b/,
        /\bEventEmitter\b[\s\S]{0,120}\bPlayMoveCommitted\b/,
        /\bpersist\w*\s*\([^)]*PlayMoveCommitted/i,
        /\bopen(?:Game|Play|Problem|SnapshotProblem)Tab\b/,
        /\borigin\.provider\b/,
        /\bsnapshotService\b/,
        /\b(?:open|create|save|persist)Snapshot\b/,
      ]

      for (const file of files) {
        const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8')
        for (const pattern of forbiddenPatterns) {
          assert.ok(!pattern.test(source), `${file} must not introduce ${pattern}`)
        }
      }
    })
  })

  // =====================================================================
  // T17-T18: ARCHITECTURE_BOUNDARY tests
  // Verify module imports do not violate architecture constraints.
  // =====================================================================

  describe('T17-T18: architecture boundary checks', function () {
    // W8P1-T17: resolveBoardInteraction module has no sabaki.js/store/service imports
    it('W8P1-T17: resolveBoardInteraction has no sabaki.js/store/service imports', function () {
      const resolverPath = path.resolve(
        __dirname,
        '../../../src/modules/workbench/board-interactions/resolveBoardInteraction.ts'
      )
      const source = fs.readFileSync(resolverPath, 'utf8')

      // Must not import sabaki.js, stores, or services
      const forbiddenPatterns = [
        /from\s+['"].*sabaki\.js/,
        /from\s+['"].*\/store\//,
        /from\s+['"].*\/service\//,
        /from\s+['"].*\/repository\//,
        /window\.sabaki/,
        /require\s*\(\s*['"].*sabaki\.js/,
      ]

      for (const pattern of forbiddenPatterns) {
        assert.ok(
          !pattern.test(source),
          `resolveBoardInteraction must not contain forbidden import: ${pattern}`
        )
      }
    })

    // W8P1-T18: boardInteractionController deps are injected, no direct store/service imports
    it('W8P1-T18: boardInteractionController has no direct store/service imports', function () {
      const controllerPath = path.resolve(
        __dirname,
        '../../../src/modules/training/workbench/boardInteractionController.ts'
      )
      const source = fs.readFileSync(controllerPath, 'utf8')

      // The controller imports resolveBoardInteraction and intents (allowed),
      // but must not directly import stores, services, or sabaki.js.
      const forbiddenPatterns = [
        /from\s+['"].*sabaki\.js/,
        /from\s+['"].*trainingRuntimeStore/,
        /from\s+['"].*trainingRepository/,
        /from\s+['"].*recallService['"]/,
        /from\s+['"].*recallCheckpointService['"]/,
        /window\.sabaki/,
      ]

      for (const pattern of forbiddenPatterns) {
        assert.ok(
          !pattern.test(source),
          `boardInteractionController must not contain forbidden import: ${pattern}`
        )
      }
    })
  })

  // =====================================================================
  // T19: UI_COMMAND_MAPPING
  // Verify Goban.handleVertexMouseUp calls onVertexClick(evt) with single arg.
  // =====================================================================

  describe('T19: UI command mapping - Goban onVertexClick signature', function () {
    // W8P1-T19: onVertexClick(evt) is called with single-arg from Goban
    // Goban.handleVertexMouseUp:282 calls onVertexClick(evt) where evt.vertex = vertex
    it('W8P1-T19: Goban.handleVertexMouseUp calls onVertexClick(evt) single-arg with evt.vertex', function () {
      const gobanPath = path.resolve(__dirname, '../../../src/components/Goban.js')
      const source = fs.readFileSync(gobanPath, 'utf8')

      // Verify the calling convention: onVertexClick(evt) is a single-arg call
      // and evt.vertex is set before the call.
      assert.ok(
        source.includes('evt.vertex = vertex'),
        'Goban must set evt.vertex = vertex before calling onVertexClick'
      )

      // Find the actual call to onVertexClick
      const callMatch = source.match(/onVertexClick\s*\(\s*evt\s*\)/)
      assert.ok(
        callMatch,
        'Goban must call onVertexClick(evt) with single argument'
      )

      // Verify it is NOT called as onVertexClick(vertex, ...) or onVertexClick([x,y], ...)
      const twoArgCall = source.match(/onVertexClick\s*\(\s*[^,)]+,\s*[^)]+\)/)
      // The only allowed two-arg call should be onLineDraw or onAreaSelect, not onVertexClick
      if (twoArgCall) {
        // Verify this match is not an onVertexClick call
        const before = source.substring(
          Math.max(0, twoArgCall.index - 50),
          twoArgCall.index
        )
        assert.ok(
          !before.includes('onVertexClick'),
          'onVertexClick must not be called with two arguments'
        )
      }
    })
  })

  // =====================================================================
  // T21-T23: SERVICE_REPOSITORY_TRANSITION
  // Real store (trainingRuntimeStore), real repository (in-memory),
  // real recallService, real recallCheckpointService.
  // =====================================================================

  describe('T21-T23: service/repository transition (real store + real services)', function () {
    let runtimeStore
    let repository
    let recallService
    let checkpointService

    beforeEach(function () {
      runtimeStore = createTrainingRuntimeStore({logger})
      repository = createInMemoryRepository()

      checkpointService = createRecallCheckpointService({
        repository,
        runtimeStore,
        logger,
      })

      recallService = createRecallService({
        repository,
        runtimeStore,
        checkpointService,
        logger,
      })
    })

    // W8P1-T21: recallService.submitRecallMove creates correct RecallAttempt
    it('W8P1-T21: submitRecallMove creates a RecallAttempt with correct fields', async function () {
      // Setup: create a recall session with expected moves
      const session = {
        id: 'rs_test_1',
        taskId: 'task_1',
        tabId: 'tab_1',
        attemptId: 'att_1',
        type: 'line_recall',
        source: {kind: 'attempt', attemptId: 'att_1'},
        startMove: 0,
        endMove: undefined,
        expectedMoves: ['dd', 'pp', 'dp'],
        currentMoveIndex: 0,
        completed: false,
        createdAt: new Date().toISOString(),
      }
      await repository.createRecallSession(session)

      // Submit a correct move at index 0
      const attempt = await recallService.submitRecallMove({
        recallSessionId: 'rs_test_1',
        userMove: 'dd',
      })

      assert.ok(attempt, 'submitRecallMove must return a RecallAttempt')
      assert.strictEqual(attempt.recallSessionId, 'rs_test_1')
      assert.strictEqual(attempt.moveNumber, 0)
      assert.strictEqual(attempt.expectedMove, 'dd')
      assert.strictEqual(attempt.userMove, 'dd')
      assert.strictEqual(attempt.isCorrect, true)

      // Verify the session advanced
      const updatedSession = await repository.loadRecallSession('rs_test_1')
      assert.strictEqual(updatedSession.currentMoveIndex, 1,
        'Session must advance to next move on correct answer')
    })

    // W8P1-T22: recallService + checkpointService: major BadMove triggers startCheckpoint
    it('W8P1-T22: correct move at bad-move index triggers startCheckpoint', async function () {
      // Setup: create a recall session
      const session = {
        id: 'rs_cp_1',
        taskId: 'task_1',
        tabId: 'tab_1',
        attemptId: 'att_cp_1',
        type: 'line_recall',
        source: {kind: 'attempt', attemptId: 'att_cp_1'},
        startMove: 0,
        expectedMoves: ['dd', 'pp'],
        currentMoveIndex: 0,
        completed: false,
        createdAt: new Date().toISOString(),
      }
      await repository.createRecallSession(session)

      // Create a major bad move at moveIndex 0
      await repository.createBadMove({
        id: 'bm_1',
        moveEvaluationId: 'me_1',
        attemptId: 'att_cp_1',
        taskId: 'task_1',
        moveIndex: 0,
        severity: 'major',
        punishSide: 'black',
        createdAt: new Date().toISOString(),
      })

      // Submit correct move at index 0 (which has a major bad move)
      const attempt = await recallService.submitRecallMove({
        recallSessionId: 'rs_cp_1',
        userMove: 'dd',
      })

      assert.strictEqual(attempt.isCorrect, true)

      // Verify checkpoint was created
      const checkpoints = await repository.listCheckpointsByRecallSession('rs_cp_1')
      assert.strictEqual(checkpoints.length, 1,
        'A checkpoint must be created when a correct move matches a major bad move')

      // Verify runtimeStore has active checkpoint
      const state = runtimeStore.getState()
      assert.ok(state.activeCheckpointId,
        'runtimeStore must have activeCheckpointId set after checkpoint starts')
    })

    // W8P1-T23: trainingRuntimeStore.setActiveCheckpoint notifies subscriber
    it('W8P1-T23: runtimeStore.setActiveCheckpoint notifies subscribers', function () {
      let notificationCount = 0
      const unsub = runtimeStore.subscribe(() => { notificationCount++ })

      // Initial state: no active checkpoint
      assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)

      // Set active checkpoint
      runtimeStore.setActiveCheckpoint('cp_123')

      assert.strictEqual(notificationCount, 1,
        'Subscriber must be notified exactly once after setActiveCheckpoint')
      assert.strictEqual(runtimeStore.getState().activeCheckpointId, 'cp_123')

      // Clear
      runtimeStore.setActiveCheckpoint(undefined)
      assert.strictEqual(notificationCount, 2,
        'Subscriber must be notified on clear as well')

      unsub()
    })

    it('W8P1-T25: recall board answer refreshes runtime recallView without game-tree writes', async function () {
      await repository.createRecallSession({
        id: 'rs_project',
        taskId: 'task_1',
        tabId: 'tab_1',
        attemptId: undefined,
        type: 'line_recall',
        source: {kind: 'game', gameId: 'game_1'},
        startMove: 0,
        endMove: undefined,
        expectedMoves: ['dd', 'pp'],
        currentMoveIndex: 0,
        completed: false,
        createdAt: new Date().toISOString(),
      })
      runtimeStore.setActiveRecallSession('rs_project')
      runtimeStore.setRecallView({
        recallSessionId: 'rs_project',
        taskId: 'task_1',
        tabId: 'tab_1',
        moveIndex: 0,
        expectedMoves: [
          {sign: 1, vertex: 'dd'},
          {sign: -1, vertex: 'pp'},
        ],
        userAttempts: [],
        showHint: false,
        completed: false,
      })

      const documentStoreCalls = []
      const controller = createBoardInteractionController({
        getPlayServices: () => ({
          documentStore: {
            playMove: async (vertex, opts) => {
              documentStoreCalls.push({vertex, opts})
              return {valid: true, changed: true, treePosition: 'node_2'}
            },
          },
        }),
        getRecallAdapter: () => ({
          submitBoardClick: async (vertex) => {
            const userMove = String.fromCharCode(97 + vertex[0]) + String.fromCharCode(97 + vertex[1])
            const attempt = await recallService.submitRecallMove({
              recallSessionId: 'rs_project',
              userMove,
            })
            const session = await repository.loadRecallSession('rs_project')
            return {
              handled: true,
              changed: true,
              isCorrect: attempt.isCorrect,
              completed: session ? session.completed : false,
              recallMoveIndex: session ? session.currentMoveIndex : 0,
              attempt,
            }
          },
        }),
        getEditWorkspaceContext: () => null,
        getEditWorkspaceDeps: () => ({}),
        getLegacySabaki: () => ({clickVertex: () => {}}),
        getIsMac: () => false,
      })

      const result = await controller.handleBoardClick({
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'recall', activeRecallSessionId: 'rs_project'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: runtimeStore.getState(),
      })

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.isCorrect, true)
      assert.strictEqual(documentStoreCalls.length, 0,
        'Recall board answers must not write through documentStore/game tree')
      assert.strictEqual(runtimeStore.getState().recallView.moveIndex, 1)
      assert.deepStrictEqual(runtimeStore.getState().recallView.userAttempts, [
        {vertex: 'dd', isCorrect: true},
      ])
    })
  })

  // =====================================================================
  // T24: CONTAINER_DELEGATION
  // Verify Container.onVertexClick correctly extracts parameters.
  // =====================================================================

  describe('T24: Container delegation - parameter extraction', function () {
    // W8P1-T24: Container extracts vertex/button/ctrlKey/metaKey from evt
    // and passes them to handleBoardClick
    it('W8P1-T24: boardInteractionController.handleBoardClick receives correct params from evt shape', async function () {
      const received = []

      const deps = {
        getPlayServices: () => ({
          documentStore: {
            playMove: async (vertex, opts) => {
              received.push({type: 'playMove', vertex, opts})
              return {valid: true, changed: true, treePosition: 'node_2'}
            },
          },
          engineService: undefined,
          analysisService: undefined,
        }),
        getRecallAdapter: () => ({
          submitBoardClick: async () => ({handled: true, changed: true}),
        }),
        getEditWorkspaceContext: () => null,
        getEditWorkspaceDeps: () => ({}),
        getLegacySabaki: () => ({clickVertex: () => {}}),
        getIsMac: () => false,
      }

      const controller = createBoardInteractionController(deps)

      // Simulate what Container.onVertexClick passes:
      // Goban.handleVertexMouseUp:243 sets evt.vertex = vertex
      // Container.onVertexClick:331 extracts vertex: evt.vertex
      // Container.onVertexClick:332 extracts event: {button, ctrlKey, metaKey}
      await controller.handleBoardClick({
        vertex: [7, 7],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'play'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      assert.strictEqual(received.length, 1)
      assert.deepStrictEqual(received[0].vertex, [7, 7],
        'vertex must be [7,7] extracted from evt.vertex')
    })

    it('W8P1-T24b: controller handles Mac ctrl+click (right-click emulation)', async function () {
      const received = []

      const deps = {
        getPlayServices: () => ({
          documentStore: {
            playMove: async () => { received.push('playMove'); return {valid: true, changed: false} },
          },
          engineService: undefined,
          analysisService: undefined,
        }),
        getRecallAdapter: () => ({
          submitBoardClick: async () => ({handled: false, changed: false}),
        }),
        getEditWorkspaceContext: () => null,
        getEditWorkspaceDeps: () => ({}),
        getLegacySabaki: () => ({
          clickVertex: (v, e) => { received.push({type: 'legacy', vertex: v, event: e}) },
        }),
        getIsMac: () => true,
      }

      const controller = createBoardInteractionController(deps)

      // Mac right-click emulation: button=0 + ctrlKey=true
      await controller.handleBoardClick({
        vertex: [3, 3],
        event: {button: 0, ctrlKey: true, metaKey: false},
        activeTab: makeTab({mode: 'play'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      // play mode + right-click (Mac ctrl+click) -> deferred -> legacy
      assert.strictEqual(received.length, 1)
      assert.strictEqual(received[0].type, 'legacy',
        'Mac ctrl+click in play mode must be deferred to legacy, not playMove')
      assert.deepStrictEqual(received[0].vertex, [3, 3])
      assert.deepStrictEqual(received[0].event, {button: 0, ctrlKey: true, metaKey: false})
    })
  })
})
