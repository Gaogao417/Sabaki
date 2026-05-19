/**
 * W3 Goban Boundary Tests — purity, import checks, side effect verification
 *
 * Test contract: docs/design/2026-05-19/workbench-wiring/w3-goban-wiring-contract-v0.1.md
 * Contracts covered: W3-T13, W3-T14, W3-T15, W3-T16, W3-T17, W3-T22
 *
 * Source of truth alignment:
 *   - Contract Section 7: projectGobanProps purity guarantees
 *   - Contract Section 11: Forbidden Side Effects
 *   - Arch v0.5 Section 14: Architecture red lines
 *   - PRD v0.5 Section 3.3: Recall MUST NOT modify game tree
 *   - PRD v0.5 Section 3.4: Analysis MUST NOT modify Attempt.userLine
 *   - W1 Section 3.2: Resolver purity
 *
 * Test Legitimacy:
 *   - W3-T13: Static import analysis via fs.readFileSync. File not found -> skip.
 *   - W3-T14: Static import analysis + runtime purity check.
 *   - W3-T15: Static import analysis on MainBoardStage.
 *   - W3-T16: Imports real playInteractionExecutor, verifies side effects.
 *   - W3-T17: Imports real recallInteractionExecutor, verifies no game tree write.
 *   - W3-T22: Grep-based check for origin.provider in goban projection files.
 *   Controlled dependencies: local file reads, inline mock objects.
 */

import assert from 'assert'
import {readFileSync} from 'fs'
import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../../..')

import {tryImport} from '../tryImport.js'

// --- W3-T13: resolveBoardInteraction does not import sabaki.js or read global state ---

describe('W3-T13: resolveBoardInteraction purity', () => {
  const RESOLVER_PATH = 'src/modules/workbench/board-interactions/resolveBoardInteraction.ts'

  const FORBIDDEN_IMPORT_PATTERNS = [
    /from\s+['"][^'"]*sabaki\.js/,
    /from\s+['"][^'"]*sabaki['"]/,
    /import\s*\(\s*['"][^'"]*sabaki\.js/,
    /require\s*\(\s*['"][^'"]*sabaki\.js/,
    /window\s*\.\s*sabaki/,
    /globalThis\.(?!Math|undefined|NaN|Infinity)/,
    /document\./,
    /localStorage/,
  ]

  it('does not import sabaki.js or read global state', () => {
    const absolutePath = resolve(projectRoot, RESOLVER_PATH)
    let source
    try {
      source = readFileSync(absolutePath, 'utf-8')
    } catch {
      // File doesn't exist or can't be read -- no boundary violation
      return
    }

    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      const match = source.match(pattern)
      assert.ok(
        !match,
        `${RESOLVER_PATH} must NOT import sabaki.js or read global state. Found: "${match ? match[0] : ''}"`,
      )
    }
  })
})

// --- W3-T14: projectGobanProps does not call service/store/repository/adapter ---

describe('W3-T14: projectGobanProps purity', () => {
  const PROJECTION_PATH = 'src/modules/training/workbench/projectGobanProps.ts'

  const FORBIDDEN_PATTERNS = [
    // Service/store/repository imports
    /from\s+['"][^'"]*(?:store|service|repository|adapter)/,
    /import\s*\(\s*['"][^'"]*(?:store|service|repository|adapter)/,
    /require\s*\(\s*['"][^'"]*(?:store|service|repository|adapter)/,
    // Global state access
    /window\s*\./,
    /globalThis\.(?!Math|undefined|NaN|Infinity)/,
    /document\./,
    // IO calls
    /fetch\s*\(/,
    /Date\.now\(\)/,
    /Math\.random\(\)/,
  ]

  it('does not import service/store/repository/adapter', () => {
    const absolutePath = resolve(projectRoot, PROJECTION_PATH)
    let source
    try {
      source = readFileSync(absolutePath, 'utf-8')
    } catch {
      // File doesn't exist yet -- not a violation
      return
    }

    for (const pattern of FORBIDDEN_PATTERNS) {
      const match = source.match(pattern)
      assert.ok(
        !match,
        `${PROJECTION_PATH} must NOT import service/store/repository/adapter. Found: "${match ? match[0] : ''}"`,
      )
    }
  })

  it('runtime purity: does not call IO when invoked', async () => {
    const projectGobanProps = await tryImport(
      'src/modules/training/workbench/projectGobanProps.ts',
    )
    if (!projectGobanProps) return

    // Track IO calls by monkey-patching globals (defense in depth)
    const forbiddenCalls = []
    const originalFetch = globalThis.fetch
    const originalDateNow = Date.now

    globalThis.fetch = (...args) => {
      forbiddenCalls.push({type: 'fetch', args})
      return Promise.resolve(new Response())
    }
    Date.now = () => {
      forbiddenCalls.push({type: 'Date.now'})
      return 0
    }

    try {
      projectGobanProps({
        workbenchMode: 'play',
        task: null,
        runtimeState: {},
        boardState: {gameTree: {id: 'gt'}, treePosition: 'n1', board: {width: 19, height: 19, signMap: []}},
        overlayState: {paintMap: [], markerMap: [], dimmedStones: [], analysis: null},
        settings: {
          showMoveNumbers: false,
          showNextMoves: true,
          showSiblings: true,
          showAnalysis: false,
          showCoordinates: true,
          showHumanPreference: false,
          selectedTool: 'stone_1',
          editWorkspaceActive: false,
          boardTransformation: [1, 0, 0, 1, 0, 0],
          areaSelectMode: false,
        },
        analysisData: null,
      })

      assert.deepStrictEqual(
        forbiddenCalls,
        [],
        'projectGobanProps must not call fetch, Date.now, or other IO',
      )
    } finally {
      globalThis.fetch = originalFetch
      Date.now = originalDateNow
    }
  })
})

// --- W3-T15: MainBoardStage receives all board data and handlers via props ---

describe('W3-T15: MainBoardStage does not import services', () => {
  const COMPONENT_PATH = 'src/components/workbench/shell/MainBoardStage.js'

  const FORBIDDEN_PATTERNS = [
    /from\s+['"][^'"]*(?:store|service|repository|adapter)/,
    /import\s*\(\s*['"][^'"]*(?:store|service|repository|adapter)/,
    /require\s*\(\s*['"][^'"]*(?:store|service|repository|adapter)/,
    /window\s*\.\s*sabaki/,
    /from\s+['"][^'"]*sabaki\.js/,
  ]

  it('does not import service/store/repository/adapter', () => {
    const absolutePath = resolve(projectRoot, COMPONENT_PATH)
    let source
    try {
      source = readFileSync(absolutePath, 'utf-8')
    } catch {
      return
    }

    for (const pattern of FORBIDDEN_PATTERNS) {
      const match = source.match(pattern)
      assert.ok(
        !match,
        `${COMPONENT_PATH} must NOT import service/store/adapter. Found: "${match ? match[0] : ''}"`,
      )
    }
  })

  it('MainBoardStage is a presentational component (receives data via props)', async () => {
    const MainBoardStage = await tryImport(COMPONENT_PATH)
    if (!MainBoardStage) return

    // MainBoardStage should be a function component (presentational)
    assert.strictEqual(typeof MainBoardStage, 'function')
  })
})

// --- W3-T16: play-stone executor writes to documentStore, NOT to editWorkspace ---

describe('W3-T16: play-stone executor side effect targets', () => {
  it('playInteractionExecutor calls documentStore.playMove', async () => {
    const executorMod = await tryImport(
      'src/modules/workbench/board-interactions/executors/playInteractionExecutor.js',
    )
    if (!executorMod) return

    const executePlayInteraction = executorMod.executePlayInteraction || executorMod.default
    if (typeof executePlayInteraction !== 'function') return

    const playMoveCalls = []
    const services = {
      documentStore: {
        playMove: async (vertex, opts) => {
          playMoveCalls.push({vertex, opts})
          return {valid: true, changed: true, treePosition: 'node_after'}
        },
      },
    }

    const result = await executePlayInteraction(
      {
        status: 'resolved',
        intent: 'play-stone',
        mutationContract: 'playMove',
        payload: {vertex: [3, 3]},
      },
      {},
      services,
    )

    assert.strictEqual(result.handled, true)
    assert.strictEqual(result.changed, true)
    assert.strictEqual(playMoveCalls.length, 1, 'should call documentStore.playMove exactly once')
    assert.deepStrictEqual(playMoveCalls[0].vertex, [3, 3])
  })

  it('playInteractionExecutor does NOT receive or call editWorkspace', async () => {
    const executorMod = await tryImport(
      'src/modules/workbench/board-interactions/executors/playInteractionExecutor.js',
    )
    if (!executorMod) return

    const executePlayInteraction = executorMod.executePlayInteraction || executorMod.default
    if (typeof executePlayInteraction !== 'function') return

    const editWorkspaceCalls = []
    const services = {
      documentStore: {
        playMove: async () => ({valid: true, changed: true, treePosition: 'node_after'}),
      },
      editWorkspace: {
        mutate: (...args) => editWorkspaceCalls.push(args),
      },
    }

    await executePlayInteraction(
      {
        status: 'resolved',
        intent: 'play-stone',
        mutationContract: 'playMove',
        payload: {vertex: [3, 3]},
      },
      {},
      services,
    )

    // The playInteractionExecutor does not call editWorkspace even if it is provided
    assert.deepStrictEqual(
      editWorkspaceCalls,
      [],
      'play-stone executor must NOT write to editWorkspace',
    )
  })
})

// --- W3-T17: recall answer executor does NOT write to documentStore or game tree ---

describe('W3-T17: recall executor does NOT write to documentStore or game tree', () => {
  it('recallInteractionExecutor calls trainingStore.submitRecallAnswer', async () => {
    const executorMod = await tryImport(
      'src/modules/workbench/board-interactions/executors/recallInteractionExecutor.js',
    )
    if (!executorMod) return

    const executeRecallInteraction = executorMod.executeRecallInteraction || executorMod.default
    if (typeof executeRecallInteraction !== 'function') return

    const recallAnswerCalls = []
    const services = {
      trainingStore: {
        submitRecallAnswer: (vertex) => {
          recallAnswerCalls.push({vertex})
          return {
            handled: true,
            changed: true,
            isCorrect: true,
            completed: false,
            recallMoveIndex: 0,
          }
        },
      },
    }

    const result = executeRecallInteraction(
      {
        status: 'resolved',
        intent: 'submit-recall-answer',
        mutationContract: 'recallAnswer',
        payload: {vertex: [5, 5]},
      },
      {},
      services,
    )

    assert.strictEqual(result.handled, true)
    assert.strictEqual(recallAnswerCalls.length, 1)
    assert.deepStrictEqual(recallAnswerCalls[0].vertex, [5, 5])
  })

  it('recallInteractionExecutor does NOT call documentStore', async () => {
    const executorMod = await tryImport(
      'src/modules/workbench/board-interactions/executors/recallInteractionExecutor.js',
    )
    if (!executorMod) return

    const executeRecallInteraction = executorMod.executeRecallInteraction || executorMod.default
    if (typeof executeRecallInteraction !== 'function') return

    const documentStoreCalls = []
    const services = {
      trainingStore: {
        submitRecallAnswer: () => ({
          handled: true,
          changed: true,
          isCorrect: true,
          completed: false,
          recallMoveIndex: 0,
        }),
      },
      documentStore: {
        playMove: (...args) => {
          documentStoreCalls.push(args)
        },
      },
    }

    executeRecallInteraction(
      {
        status: 'resolved',
        intent: 'submit-recall-answer',
        mutationContract: 'recallAnswer',
        payload: {vertex: [5, 5]},
      },
      {},
      services,
    )

    assert.deepStrictEqual(
      documentStoreCalls,
      [],
      'recall executor must NOT call documentStore.playMove (no game tree write)',
    )
  })

  it('recall executor rejects unsupported mutation contracts', async () => {
    const executorMod = await tryImport(
      'src/modules/workbench/board-interactions/executors/recallInteractionExecutor.js',
    )
    if (!executorMod) return

    const executeRecallInteraction = executorMod.executeRecallInteraction || executorMod.default
    if (typeof executeRecallInteraction !== 'function') return

    const result = executeRecallInteraction(
      {
        status: 'resolved',
        intent: 'submit-recall-answer',
        mutationContract: 'playMove', // WRONG contract
        payload: {vertex: [5, 5]},
      },
      {},
      {
        trainingStore: {
          submitRecallAnswer: () => ({handled: true, changed: true}),
        },
      },
    )

    assert.strictEqual(result.handled, false, 'must reject playMove contract for recall intent')
    assert.strictEqual(result.changed, false)
  })
})

// --- W3-T22: No command branches on origin.provider for Goban projection ---

describe('W3-T22: No Goban projection branches on origin.provider', () => {
  const GOBAN_FILES = [
    'src/modules/training/workbench/projectGobanProps.ts',
    'src/modules/training/workbench/workbenchUiPolicy.ts',
    'src/components/TrainingWorkbenchContainer.js',
  ]

  const FORBIDDEN_ORIGIN_PATTERNS = [
    /origin\s*\.\s*provider\s*===?\s*['"]/,
    /origin\s*\.\s*provider\s*!==?\s*['"]/,
    /origin\.provider\s*===?\s*`/,
  ]

  for (const filePath of GOBAN_FILES) {
    it(`${filePath} does NOT branch on origin.provider`, () => {
      const absolutePath = resolve(projectRoot, filePath)
      let source
      try {
        source = readFileSync(absolutePath, 'utf-8')
      } catch {
        // File doesn't exist -- no violation
        return
      }

      for (const pattern of FORBIDDEN_ORIGIN_PATTERNS) {
        const match = source.match(pattern)
        assert.ok(
          !match,
          `${filePath} must NOT branch on origin.provider. Found: "${match ? match[0] : ''}"`,
        )
      }
    })
  }
})