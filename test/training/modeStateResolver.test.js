/**
 * modeStateResolver.test.js
 *
 * Contract source:
 * docs/archive/daily-design/2026-05-26/workbench-mode-state-resolver/test-contract-v0.1.md
 *
 * Harness/mock manifest:
 * - Real production subject: src/modules/training/workbench/modeStateResolver.ts::resolveModeState
 * - RED production subject: src/modules/training/workbench/modeStateResolver.ts::classifyModeStateDiagnostics
 * - Fake/spy modules: NONE
 * - Inputs: immutable plain tab/runtime/overlay/engine/Sabaki snapshots
 * - Forbidden mocks: stores, services, repositories, controller, engine, overlay, document, Sabaki globals
 * - Expected status for step2.3: RED until the pure diagnostics classifier helper is exported
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'

const resolverPath = path.resolve(
  process.cwd(),
  'src/modules/training/workbench/modeStateResolver.ts',
)

let _resolverModule

function loadResolverModule() {
  if (_resolverModule !== undefined) return _resolverModule
  try {
    _resolverModule = require('../../src/modules/training/workbench/modeStateResolver.ts')
  } catch (error) {
    _resolverModule = {loadError: error}
  }
  return _resolverModule
}

function getResolveModeState() {
  const mod = loadResolverModule()
  assert.ifError(mod.loadError)
  assert.strictEqual(
    typeof mod.resolveModeState,
    'function',
    'modeStateResolver.ts must export resolveModeState(input)',
  )
  return mod.resolveModeState
}

function getClassifyModeStateDiagnostics() {
  const mod = loadResolverModule()
  assert.ifError(mod.loadError)
  assert.strictEqual(
    typeof mod.classifyModeStateDiagnostics,
    'function',
    'modeStateResolver.ts must export classifyModeStateDiagnostics(result, context)',
  )
  return mod.classifyModeStateDiagnostics
}

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    activeAttemptId: 'attempt_1',
    activeRecallSessionId: null,
    recallSubstate: null,
    analysisContext: null,
    analysisReturnTarget: null,
    currentTreePosition: {treeId: 'tree_1', nodeId: 'node_12'},
    parentTabId: null,
    childTabIds: [],
    source: {kind: 'task', source_kind: 'provider-task'},
    origin: {provider: '101', externalId: 'problem_1'},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeAttempt(overrides = {}) {
  return {
    id: 'attempt_1',
    taskId: 'task_1',
    tabId: 'tab_1',
    status: 'playing',
    userLine: ['D4', 'Q16'],
    moveActors: ['user', 'engine'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeFrozenAttempt(overrides = {}) {
  return makeAttempt({
    status: 'submitted',
    userLine: Object.freeze(['D4', 'Q16', 'C3']),
    moveActors: Object.freeze(['user', 'engine', 'user']),
    ...overrides,
  })
}

function baseRuntime(overrides = {}) {
  return {
    activeAttemptId: 'attempt_1',
    activeRecallSessionId: null,
    activeCheckpointId: null,
    correctionDraft: null,
    aiMovePending: false,
    pendingMoveEvaluations: [
      {id: 'eval_1', attemptId: 'attempt_1', moveIndex: 1},
    ],
    visibleBadMoveIds: ['bad_1'],
    problemView: null,
    recallView: null,
    attempt: makeAttempt(),
    sourceAttempt: null,
    activeCheckpoint: null,
    explorationBranch: null,
    ...overrides,
  }
}

function baseOverlay(overrides = {}) {
  return {
    territoryEnabled: false,
    territoryCompareEnabled: false,
    owner: null,
    source: null,
    pending: false,
    unavailableReason: null,
    ...overrides,
  }
}

function baseEngine(overrides = {}) {
  return {
    target: {kind: 'none'},
    pending: false,
    candidateMoves: [],
    ownershipAvailable: false,
    workspaceId: null,
    ...overrides,
  }
}

function baseSabaki(overrides = {}) {
  return {
    state: {mode: 'play'},
    document: {
      treePosition: {treeId: 'tree_1', nodeId: 'node_12'},
      boardSize: 19,
      currentPlayer: 'black',
    },
    editWorkspace: {
      currentSnapshot: null,
      referenceSnapshot: null,
      currentAnalysis: null,
    },
    ...overrides,
  }
}

function makeInput(overrides = {}) {
  return {
    tab: overrides.tab ?? makeTab(),
    runtime: overrides.runtime ?? baseRuntime(),
    overlay: overrides.overlay ?? baseOverlay(),
    engine: overrides.engine ?? baseEngine(),
    sabaki: overrides.sabaki ?? baseSabaki(),
  }
}

function makeProblemInput(overrides = {}) {
  return makeInput({
    tab: makeTab({mode: 'problem', ...overrides.tab}),
    runtime: baseRuntime({
      problemView: {
        attemptId: 'attempt_1',
        positionSource: {
          kind: 'scratch',
          role: 'problem-attempt',
          workspaceId: 'problem_ws_1',
        },
      },
      ...overrides.runtime,
    }),
    engine: baseEngine({
      target: {
        kind: 'game-tree-live',
        treePosition: {treeId: 'tree_1', nodeId: 'node_12'},
      },
      ...overrides.engine,
    }),
    sabaki: baseSabaki({state: {mode: 'problem'}, ...overrides.sabaki}),
  })
}

function makeRecallInput(overrides = {}) {
  return makeInput({
    tab: makeTab({
      mode: 'recall',
      activeRecallSessionId: 'recall_1',
      recallSubstate: 'normal',
      ...overrides.tab,
    }),
    runtime: baseRuntime({
      activeRecallSessionId: 'recall_1',
      recallView: {
        recallSessionId: 'recall_1',
        attemptId: 'attempt_1',
        moveIndex: 2,
        positionSource: {
          kind: 'scratch',
          role: 'problem-attempt',
          workspaceId: 'recall_ws_1',
        },
      },
      attempt: null,
      sourceAttempt: makeFrozenAttempt(),
      ...overrides.runtime,
    }),
    engine: baseEngine({
      target: {kind: 'none'},
      ...overrides.engine,
    }),
    overlay: overrides.overlay,
    sabaki: baseSabaki({state: {mode: 'recall'}, ...overrides.sabaki}),
  })
}

function makeAnalysisInput(overrides = {}) {
  const currentSnapshot = {
    id: 'snap_current_1',
    workspaceId: 'analysis_ws_1',
    role: 'current',
    positionSgf: '(;SZ[19];B[dd])',
  }

  return makeInput({
    tab: makeTab({
      mode: 'analysis',
      analysisContext: {workspaceId: 'analysis_ws_1', previousMode: 'recall'},
      analysisReturnTarget: {
        tabId: 'tab_1',
        mode: 'recall',
        recallSessionId: 'recall_1',
      },
      ...overrides.tab,
    }),
    runtime: baseRuntime({
      attempt: null,
      sourceAttempt: makeFrozenAttempt(),
      activeRecallSessionId: 'recall_1',
      ...overrides.runtime,
    }),
    overlay: baseOverlay({
      territoryEnabled: true,
      territoryCompareEnabled: false,
      owner: 'analysis',
      source: 'scratch-current',
      ...overrides.overlay,
    }),
    engine: baseEngine({
      target: {kind: 'scratch', workspaceId: 'analysis_ws_1'},
      workspaceId: 'analysis_ws_1',
      ...overrides.engine,
    }),
    sabaki: baseSabaki({
      state: {mode: 'analysis'},
      editWorkspace: {
        currentSnapshot,
        referenceSnapshot: {
          id: 'snap_reference_1',
          workspaceId: 'analysis_ws_1',
          role: 'reference',
          positionSgf: '(;SZ[19];B[pd])',
        },
        currentAnalysis: {workspaceId: 'analysis_ws_1'},
      },
      ...overrides.sabaki,
    }),
  })
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value))
    return value
  seen.add(value)

  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(value[key], seen)
  }

  return Object.freeze(value)
}

function assertLegal(result, mode) {
  assert.notStrictEqual(result.ok, false, `${mode} projection should be legal`)
  assert.strictEqual(result.mode, mode)
  assert.strictEqual(result.companion?.kind, mode)
  assert.deepStrictEqual(result.illegal ?? [], [])
}

function assertIncludesContract(result, contract) {
  assert.ok(
    result.allowedMutationContracts?.includes(contract),
    `expected mutation contract ${contract}, got ${JSON.stringify(result.allowedMutationContracts)}`,
  )
}

function assertIllegalCode(result, code) {
  assert.strictEqual(result.ok, false, `expected invalid result for ${code}`)
  const codes = (result.illegal ?? []).map((item) => item?.code ?? item)
  assert.ok(
    codes.includes(code),
    `expected diagnostic ${code}, got ${JSON.stringify(codes)}`,
  )
}

function diagnosticCodes(result) {
  return (result.diagnostics ?? []).map((item) => item?.code ?? item)
}

function illegalCodes(result) {
  return (result.illegal ?? []).map((item) => item?.code ?? item)
}

function assertNoRepairSurface(decision) {
  const stack = [decision]

  while (stack.length > 0) {
    const value = stack.pop()
    if (value == null || typeof value !== 'object') continue

    for (const [key, child] of Object.entries(value)) {
      assert.ok(
        !/repair|patch|setter|callback|effect|write/i.test(key),
        `diagnostics classifier must not return repair/write surface key ${key}`,
      )

      if (child != null && typeof child === 'object') stack.push(child)
    }
  }
}

describe('modeStateResolver', () => {
  describe('legal mode projections from immutable snapshots', () => {
    it('resolves play from WorkbenchTab.mode with game-tree source and playMove hint', () => {
      const resolveModeState = getResolveModeState()
      const input = deepFreeze(makeInput())

      const result = resolveModeState(input)

      assertLegal(result, 'play')
      assert.strictEqual(result.positionSource?.kind, 'game-tree')
      assertIncludesContract(result, 'playMove')
      assert.notStrictEqual(result.engine?.kind, 'scratch')
      assert.notStrictEqual(result.positionSource?.kind, 'scratch')
      assert.strictEqual(result.snapshotPersistAllowed, false)
      assert.strictEqual(result.snapshotNextStep, 'enter-analysis')
    })

    it('resolves problem with problemView, problem-attempt source, and problemAttemptMove hint', () => {
      const resolveModeState = getResolveModeState()
      const input = deepFreeze(
        makeProblemInput({
          sabaki: {state: {mode: 'play'}},
        }),
      )

      const result = resolveModeState(input)

      assertLegal(result, 'problem')
      assert.strictEqual(result.companion.problemView.attemptId, 'attempt_1')
      assert.strictEqual(result.positionSource?.kind, 'scratch')
      assert.strictEqual(result.positionSource?.role, 'problem-attempt')
      assertIncludesContract(result, 'problemAttemptMove')
      assert.ok(
        !result.allowedMutationContracts?.includes('playMove'),
        `problem mode must not fall back to playMove: ${JSON.stringify(result.allowedMutationContracts)}`,
      )
    })

    it('resolves recall with frozen source attempt, checkpoint companion, and recallAnswer hint', () => {
      const resolveModeState = getResolveModeState()
      const input = deepFreeze(
        makeRecallInput({
          tab: {recallSubstate: 'checkpoint'},
          runtime: {
            activeCheckpointId: 'checkpoint_1',
            activeCheckpoint: {
              id: 'checkpoint_1',
              recallSessionId: 'recall_1',
              badMoveId: 'bad_1',
            },
            correctionDraft: {checkpointId: 'checkpoint_1', line: ['R17']},
          },
        }),
      )

      const result = resolveModeState(input)

      assertLegal(result, 'recall')
      assert.strictEqual(result.tab.recallSubstate, 'checkpoint')
      assert.strictEqual(result.companion.sourceAttempt.status, 'submitted')
      assert.notStrictEqual(result.companion.sourceAttempt.status, 'playing')
      assert.strictEqual(result.companion.attempt, undefined)
      assert.strictEqual(result.companion.activeCheckpoint?.id, 'checkpoint_1')
      assert.strictEqual(result.positionSource?.role, 'problem-attempt')
      assertIncludesContract(result, 'recallAnswer')
    })

    it('resolves problem and recall from production runtime-store shape without attempt objects', () => {
      const resolveModeState = getResolveModeState()
      const problemResult = resolveModeState(deepFreeze(
        makeProblemInput({
          runtime: {
            attempt: undefined,
            sourceAttempt: undefined,
          },
        }),
      ))
      const recallResult = resolveModeState(deepFreeze(
        makeRecallInput({
          runtime: {
            attempt: undefined,
            sourceAttempt: undefined,
          },
        }),
      ))

      assertLegal(problemResult, 'problem')
      assert.deepStrictEqual(problemResult.companion.attempt, {id: 'attempt_1'})
      assertLegal(recallResult, 'recall')
      assert.deepStrictEqual(recallResult.companion.sourceAttempt, {id: 'attempt_1'})
    })

    it('resolves analysis with scratch/current source, saved return target, overlay owner, and scratchEdit hint', () => {
      const resolveModeState = getResolveModeState()
      const input = deepFreeze(makeAnalysisInput())

      const result = resolveModeState(input)

      assertLegal(result, 'analysis')
      assert.strictEqual(result.companion.previousMode, 'recall')
      assert.deepStrictEqual(result.companion.returnTarget, {
        tabId: 'tab_1',
        mode: 'recall',
        recallSessionId: 'recall_1',
      })
      assert.strictEqual(result.companion.scratch.workspaceId, 'analysis_ws_1')
      assert.strictEqual(
        result.companion.scratch.currentSnapshotId,
        'snap_current_1',
      )
      assert.strictEqual(result.positionSource?.kind, 'scratch')
      assert.strictEqual(result.positionSource?.role, 'current')
      assertIncludesContract(result, 'scratchEdit')
      assert.strictEqual(result.overlay?.owner, 'analysis')
      assert.strictEqual(result.engine?.kind, 'scratch')
      assert.strictEqual(result.engine?.mayWrite, 'edit-workspace-only')
      assert.strictEqual(result.snapshotPersistAllowed, true)
    })
  })

  describe('DIAG-T01B snapshot affordance matrix', () => {
    for (const [label, inputFactory] of [
      ['play', () => makeInput()],
      ['problem', () => makeProblemInput()],
      ['recall', () => makeRecallInput()],
    ]) {
      it(`${label} requires entering analysis before snapshot persistence`, () => {
        const resolveModeState = getResolveModeState()
        const result = resolveModeState(deepFreeze(inputFactory()))

        assertLegal(result, label)
        assert.strictEqual(result.snapshotPersistAllowed, false)
        assert.strictEqual(result.snapshotNextStep, 'enter-analysis')
      })
    }

    it('analysis with scratch/current allows snapshot persistence', () => {
      const resolveModeState = getResolveModeState()
      const result = resolveModeState(deepFreeze(makeAnalysisInput()))

      assertLegal(result, 'analysis')
      assert.strictEqual(result.positionSource?.kind, 'scratch')
      assert.strictEqual(result.positionSource?.role, 'current')
      assert.strictEqual(result.snapshotPersistAllowed, true)
      assert.strictEqual(result.snapshotNextStep, undefined)
    })

    it('analysis without scratch/current is invalid and cannot persist a snapshot', () => {
      const resolveModeState = getResolveModeState()
      const result = resolveModeState(
        deepFreeze(
          makeAnalysisInput({
            sabaki: {
              editWorkspace: {
                currentSnapshot: null,
                referenceSnapshot: null,
                currentAnalysis: {workspaceId: 'analysis_ws_1'},
              },
            },
          }),
        ),
      )

      assertIllegalCode(result, 'analysis-missing-scratch-current')
      assert.strictEqual(result.snapshotPersistAllowed, false)
      assert.strictEqual(result.snapshotNextStep, undefined)
    })
  })

  describe('illegal companion diagnostics', () => {
    it('diagnoses problem mode without problemView', () => {
      const resolveModeState = getResolveModeState()
      const result = resolveModeState(
        deepFreeze(
          makeProblemInput({
            runtime: {problemView: null},
          }),
        ),
      )

      assertIllegalCode(result, 'missing-problem-view')
    })

    it('diagnoses recall mode polluted with problemView', () => {
      const resolveModeState = getResolveModeState()
      const result = resolveModeState(
        deepFreeze(
          makeRecallInput({
            runtime: {
              problemView: {attemptId: 'attempt_1'},
            },
          }),
        ),
      )

      assertIllegalCode(result, 'problem-view-in-recall')
    })

    it('diagnoses play mode polluted with problemView', () => {
      const resolveModeState = getResolveModeState()
      const result = resolveModeState(
        deepFreeze(
          makeInput({
            runtime: baseRuntime({
              problemView: {attemptId: 'attempt_1'},
            }),
          }),
        ),
      )

      assertIllegalCode(result, 'problem-view-in-play')
    })

    it('diagnoses play mode polluted with recall companions', () => {
      const resolveModeState = getResolveModeState()
      const result = resolveModeState(
        deepFreeze(
          makeInput({
            runtime: baseRuntime({
              activeRecallSessionId: 'recall_1',
              recallView: {recallSessionId: 'recall_1'},
            }),
          }),
        ),
      )

      assertIllegalCode(result, 'recall-companion-in-play')
    })

    it('diagnoses checkpoint companion outside recall mode', () => {
      const resolveModeState = getResolveModeState()
      const result = resolveModeState(
        deepFreeze(
          makeInput({
            runtime: baseRuntime({
              activeCheckpointId: 'checkpoint_1',
              activeCheckpoint: {
                id: 'checkpoint_1',
                recallSessionId: 'recall_1',
              },
            }),
          }),
        ),
      )

      assertIllegalCode(result, 'checkpoint-without-recall')
    })

    it('diagnoses territory and compare overlays outside analysis mode', () => {
      const resolveModeState = getResolveModeState()
      const territoryResult = resolveModeState(
        deepFreeze(
          makeInput({
            overlay: baseOverlay({
              territoryEnabled: true,
              owner: 'analysis',
              source: 'game-tree',
            }),
          }),
        ),
      )
      const compareResult = resolveModeState(
        deepFreeze(
          makeRecallInput({
            overlay: baseOverlay({
              territoryCompareEnabled: true,
              owner: 'analysis',
              source: 'scratch-current-vs-reference',
            }),
          }),
        ),
      )

      assertIllegalCode(territoryResult, 'non-analysis-territory-overlay')
      assertIllegalCode(compareResult, 'non-analysis-compare-overlay')
    })

    it('diagnoses analysis mode without scratch/current workspace', () => {
      const resolveModeState = getResolveModeState()
      const result = resolveModeState(
        deepFreeze(
          makeAnalysisInput({
            sabaki: {
              editWorkspace: {
                currentSnapshot: null,
                referenceSnapshot: null,
                currentAnalysis: {workspaceId: 'analysis_ws_1'},
              },
            },
          }),
        ),
      )

      assertIllegalCode(result, 'analysis-missing-scratch-current')
      assert.strictEqual(result.snapshotPersistAllowed, false)
    })

    for (const [label, inputFactory, code] of [
      [
        'problem mode without an active attempt',
        () =>
          makeProblemInput({
            tab: {activeAttemptId: null},
            runtime: {activeAttemptId: null, attempt: null},
          }),
        'missing-problem-attempt',
      ],
      [
        'recall mode without recallView',
        () =>
          makeRecallInput({
            runtime: {recallView: null},
          }),
        'missing-recall-view',
      ],
      [
        'recall mode without a source attempt binding',
        () =>
          makeRecallInput({
            tab: {activeAttemptId: null},
            runtime: {
              sourceAttempt: null,
              recallView: {
                recallSessionId: 'recall_1',
                moveIndex: 2,
                positionSource: {
                  kind: 'scratch',
                  role: 'problem-attempt',
                  workspaceId: 'recall_ws_1',
                },
              },
            },
          }),
        'missing-frozen-source-attempt',
      ],
      [
        'missing active tab',
        () => ({
          ...makeInput(),
          tab: null,
        }),
        'missing-active-tab',
      ],
    ]) {
      it(`DIAG-T02B diagnoses ${label} without repairing input`, () => {
        const resolveModeState = getResolveModeState()
        const input = inputFactory()
        const before = clone(input)

        const result = resolveModeState(deepFreeze(input))

        assertIllegalCode(result, code)
        assert.deepStrictEqual(clone(input), before)
      })
    }
  })

  describe('mode truth and legacy/source diagnostics', () => {
    it('uses WorkbenchTab.mode as truth when Sabaki mode and provider/source fields conflict', () => {
      const resolveModeState = getResolveModeState()
      const input = deepFreeze(
        makeProblemInput({
          tab: {
            mode: 'problem',
            source: {kind: 'game', source_kind: 'fox-live-game'},
            origin: {provider: 'fox', externalId: 'game_99'},
          },
          sabaki: {state: {mode: 'play'}},
        }),
      )

      const result = resolveModeState(input)

      assert.notStrictEqual(result.ok, false)
      assert.strictEqual(result.mode, 'problem')
      assert.strictEqual(result.companion.kind, 'problem')
      assertIncludesContract(result, 'problemAttemptMove')

      const codes = (result.illegal ?? result.diagnostics ?? []).map(
        (item) => item?.code ?? item,
      )
      assert.ok(
        codes.includes('legacy-mode-mismatch'),
        `expected legacy mode mismatch diagnostic, got ${JSON.stringify(codes)}`,
      )
      assert.ok(
        codes.includes('source-mode-mismatch'),
        `expected source/provider mismatch diagnostic, got ${JSON.stringify(codes)}`,
      )
    })
  })

  describe('purity', () => {
    for (const [name, inputFactory] of [
      ['play', () => makeInput()],
      ['problem', () => makeProblemInput()],
      ['recall', () => makeRecallInput()],
      ['analysis', () => makeAnalysisInput()],
      [
        'illegal problem without problemView',
        () => makeProblemInput({runtime: {problemView: null}}),
      ],
    ]) {
      it(`does not mutate a deep-frozen ${name} input graph`, () => {
        const resolveModeState = getResolveModeState()
        const input = inputFactory()
        const before = clone(input)

        resolveModeState(deepFreeze(input))

        assert.deepStrictEqual(clone(input), before)
      })
    }
  })

  describe('DIAG-T05 pure diagnostics policy classifier', () => {
    it('maps preflight illegal resolver output to reject and preserves illegal codes without repair operations', () => {
      const resolveModeState = getResolveModeState()
      const classifyModeStateDiagnostics = getClassifyModeStateDiagnostics()
      const result = resolveModeState(
        deepFreeze(makeProblemInput({runtime: {problemView: null}})),
      )
      const frozenResult = deepFreeze(clone(result))

      const decision = classifyModeStateDiagnostics(frozenResult, {
        phase: 'preflight',
        command: 'submit',
        tabId: 'tab_1',
      })

      assert.deepStrictEqual(frozenResult, result)
      assert.strictEqual(decision?.action, 'reject')
      assert.deepStrictEqual(
        decision?.illegalCodes,
        illegalCodes(result),
        'reject decisions must preserve resolver illegal codes',
      )
      assertNoRepairSurface(decision)
    })

    it('maps preflight diagnostics-only resolver output to allow with diagnostic codes', () => {
      const resolveModeState = getResolveModeState()
      const classifyModeStateDiagnostics = getClassifyModeStateDiagnostics()
      const result = resolveModeState(
        deepFreeze(
          makeProblemInput({
            tab: {
              source: {kind: 'game', source_kind: 'fox-live-game'},
              origin: {provider: 'fox', externalId: 'game_99'},
            },
            sabaki: {state: {mode: 'play'}},
          }),
        ),
      )
      const frozenResult = deepFreeze(clone(result))

      const decision = classifyModeStateDiagnostics(frozenResult, {
        phase: 'preflight',
        command: 'enterAnalysis',
        tabId: 'tab_1',
      })

      assert.notStrictEqual(result.ok, false)
      assert.deepStrictEqual(illegalCodes(result), [])
      assert.strictEqual(decision?.action, 'allow')
      assert.deepStrictEqual(
        decision?.diagnosticCodes,
        diagnosticCodes(result),
        'allow decisions must preserve non-blocking diagnostic codes',
      )
      assertNoRepairSurface(decision)
    })

    it('maps postflight illegal resolver output to invalid-after-commit without repair operations', () => {
      const resolveModeState = getResolveModeState()
      const classifyModeStateDiagnostics = getClassifyModeStateDiagnostics()
      const result = resolveModeState(
        deepFreeze(
          makeAnalysisInput({
            sabaki: {
              editWorkspace: {
                currentSnapshot: null,
                referenceSnapshot: null,
                currentAnalysis: {workspaceId: 'analysis_ws_1'},
              },
            },
          }),
        ),
      )
      const frozenResult = deepFreeze(clone(result))

      const decision = classifyModeStateDiagnostics(frozenResult, {
        phase: 'postflight',
        command: 'returnFromAnalysis',
        tabId: 'tab_1',
      })

      assert.strictEqual(decision?.action, 'invalid-after-commit')
      assert.deepStrictEqual(
        decision?.illegalCodes,
        illegalCodes(result),
        'postflight invalid decisions must preserve resolver illegal codes',
      )
      assertNoRepairSurface(decision)
    })
  })

  describe('architecture boundary', () => {
    it('has no direct store/service/repository/engine/overlay/document/global imports or calls', () => {
      assert.ok(fs.existsSync(resolverPath), `${resolverPath} must exist`)
      const source = fs.readFileSync(resolverPath, 'utf8')

      const bannedPatterns = [
        /from\s+['"][^'"]*\/store\//,
        /require\(\s*['"][^'"]*\/store\//,
        /from\s+['"][^'"]*\/repository\//,
        /require\(\s*['"][^'"]*\/repository\//,
        /from\s+['"][^'"]*\/(?:attempt|analysis|problem|recall|review|import|controller)\//,
        /require\(\s*['"][^'"]*\/(?:attempt|analysis|problem|recall|review|import|controller)\//,
        /workbench(?:Flow|Tab|Phase)Service/i,
        /snapshotService/i,
        /attemptService/i,
        /recall(?:Checkpoint)?Service/i,
        /problemFlowService/i,
        /reviewService/i,
        /trainingRepository/i,
        /analysisService/i,
        /engine(?:Service|Syncer)?/i,
        /overlayStore/i,
        /documentStore/i,
        /sabaki\.js/i,
        /window\.sabaki/i,
        /globalThis\.sabaki/i,
        /ipc(?:Main|Renderer)/,
        /setTimeout|setInterval/,
      ]

      for (const pattern of bannedPatterns) {
        assert.ok(
          !pattern.test(source),
          `modeStateResolver violates boundary: ${pattern}`,
        )
      }
    })
  })
})
