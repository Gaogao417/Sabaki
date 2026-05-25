/**
 * Phase 0 Cleanup: RecallPolicy + expectedMoveIndexes
 *
 * Test contract source: docs/design/2026-05-25/phase0-cleanup/test-contract-v0.1.md
 * True source alignment:
 *   - Architecture v0.5 section 5.8 (RecallService, RecallPolicy, RecallSession type)
 *   - Architecture v0.5 section 7.5 (recall_sessions table schema)
 *   - Architecture v0.5 section 13.2 (repository tests required)
 *   - Architecture v0.5 section 13.3 (service tests required)
 *
 * Harness manifest:
 *   - Real production modules: createDbClient, migrate, createTrainingDbApi,
 *     createTrainingRepository (Group B/C/D tests)
 *   - Real production module: deriveExpectedMoves from recallService or independent
 *     module (Group A pure logic tests)
 *   - No fake/spy/mock modules for repository or DB layers
 *   - Valid for: PURE_LOGIC, STATE, SIDE_EFFECT_BOUNDARY, SERVICE_REPOSITORY_TRANSITION
 *   - Not valid for: RENDERED_UI_RETURN, CONTAINER_DELEGATION
 */

import assert from 'assert'
import path from 'path'
import { fileURLToPath } from 'url'
import initSqlJs from 'sql.js'

import { createDbClient } from '../../src/modules/db/client.js'
import { migrate } from '../../src/modules/db/migrate.js'
import { createTrainingDbApi } from '../../src/modules/db/trainingDbApi.js'
import { createTrainingRepository } from '../../src/modules/training/repository/trainingRepository.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Pure function under test for Group A tests.
// Contract section 18 specifies this may live in recallService.ts or an independent module.
// Architecture v0.5 section 5.8 places RecallPolicy logic in recallService scope.
// When the implementation lands, deriveExpectedMoves will be exported from one of:
//   - src/modules/training/recall/deriveExpectedMoves.ts
//   - src/modules/training/recall/recallService.ts
let deriveExpectedMoves = null
let DERIVE_EXPECTED_MOVES_IMPORT_ERROR = 'Module not loaded yet'

// Dynamic import in an async IIFE — sets deriveExpectedMoves on success.
;(async () => {
  try {
    const mod = await import('../../src/modules/training/recall/deriveExpectedMoves.ts')
    deriveExpectedMoves = mod.deriveExpectedMoves
    DERIVE_EXPECTED_MOVES_IMPORT_ERROR = null
  } catch (e) {
    DERIVE_EXPECTED_MOVES_IMPORT_ERROR = e.message || String(e)
  }
})()

let SQL = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestSetup() {
  if (!SQL) { SQL = await initSqlJs() }
  const rawDb = new SQL.Database()
  const client = createDbClient(rawDb)
  migrate(client)

  const trainingApi = createTrainingDbApi(client)

  const seed = {
    async trainingTask(task = {}) {
      const id = task.id || 'task_1'
      const now = new Date().toISOString()
      const source = task.source || (task.kind ? { kind: task.kind } : {})
      const originJson = task.origin ? JSON.stringify(task.origin) : null
      const passRuleJson = task.passRule ? JSON.stringify(task.passRule) : null
      const referenceLinesJson = task.referenceLines ? JSON.stringify(task.referenceLines) : null
      const problemAreaJson = task.problemArea ? JSON.stringify(task.problemArea) : null
      const tagsJson = task.tags ? JSON.stringify(task.tags) : null
      client.run(`INSERT INTO training_tasks (id, kind, source_json, source_kind, source_game_id,
        source_problem_id, source_segment_id, parent_task_id, parent_attempt_id,
        root_position_sgf, side_to_move, title,
        origin_json, initial_position_sgf, prompt, goal, pass_rule_json, reference_lines_json, problem_area_json,
        tags_json, difficulty, status,
        created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id, task.kind || 'free_play', JSON.stringify(source), source.kind || null,
        source.gameId || null, source.problemId || null, source.segmentId || null,
        source.parentTaskId || null, source.parentAttemptId || null,
        task.rootPositionSgf || '(;SZ[9])', task.sideToMove || null,
        task.title || null,
        originJson, task.initialPositionSgf || task.rootPositionSgf || '(;SZ[9])',
        task.prompt || null, task.goal || null, passRuleJson,
        referenceLinesJson, problemAreaJson, tagsJson,
        task.difficulty ?? null, task.status || null,
        now, now,
      ])
      client.save()
    },

    async trainingAttempt(attempt = {}) {
      const id = attempt.id || 'attempt_1'
      const startedAt = attempt.startedAt || new Date().toISOString()
      const moveActorsJson = attempt.moveActors ? JSON.stringify(attempt.moveActors) : null
      client.run(`INSERT INTO training_attempts (id, task_id, tab_id, started_at, submitted_at,
        completed_at, root_position_sgf, user_line_json, status, result, hint_level_used,
        recall_completed, analysis_opened, move_actors_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id, attempt.taskId || 'task_1', attempt.tabId || null, startedAt,
        attempt.submittedAt || null, attempt.completedAt || null,
        attempt.rootPositionSgf || '(;SZ[9])', JSON.stringify(attempt.userLine || []),
        attempt.status || 'playing', attempt.result || 'pending',
        attempt.hintLevelUsed ?? 0, attempt.recallCompleted ? 1 : 0,
        attempt.analysisOpened ? 1 : 0,
        moveActorsJson,
      ])
      client.save()
    },
  }

  const dbLike = {
    ...trainingApi,

    seedTrainingTask: seed.trainingTask,
    seedTrainingAttempt: seed.trainingAttempt,

    async createTrainingTask(task) {
      return seed.trainingTask(task)
    },
    async loadTrainingTask(taskId) {
      const row = client.queryOne('SELECT * FROM training_tasks WHERE id = ?', [taskId])
      return row || null
    },
    async findTrainingTaskBySource(source) {
      const row = client.queryOne('SELECT * FROM training_tasks WHERE source_json = ? LIMIT 1', [
        JSON.stringify(source),
      ])
      return row || null
    },
    async updateTrainingTask() {},
    async createTrainingAttempt(attempt) {
      return seed.trainingAttempt(attempt)
    },
    async loadTrainingAttempt(attemptId) {
      const row = client.queryOne('SELECT * FROM training_attempts WHERE id = ?', [attemptId])
      return row || null
    },
    async listTrainingAttemptsByTask() { return [] },
    async updateTrainingAttempt() {},
    async createTrainingBadMove() {},
    async loadTrainingBadMove() { return null },
    async listMoveEvaluationsByAttempt() { return [] },
    async listTrainingBadMovesByAttempt() { return [] },
    async listTrainingBadMovesByTask() { return [] },
    async upsertReviewSchedule() {},
    async findReviewScheduleByItem() { return null },
    async updateReviewSchedule() {},

    transaction(fn) { return client.transaction(fn) },

    // Stubs for legacy and domain functions the repository references
    async saveGame() {},
    async getGame() { return null },
    async getRecentGames() { return [] },
    async saveRecallSession() {},
    async saveRecallAttempts() {},
    async saveProblem() {},
    async getProblem() { return null },
    async getProblemsByStatus() { return [] },
    async saveProblemAttempt() {},
    async saveBadMove() {},
    async updateBadMoveGeneratedProblem() {},
    async getDueReviews() { return [] },
    async getDashboardSummary() { return {} },
    async findTaskBySource() { return null },
    async listIncompleteTrainingAttempts() { return [] },
    async updateMoveEvaluation() {},
    async markTrainingBadMoveAsNotBad() {},
    async archiveProblem() {},
    async updateProblem() {},
    async listIncompleteTrainingRecallSessions() { return [] },
    async listExpiredPendingMoveEvaluations() { return [] },
  }

  const repo = createTrainingRepository(dbLike)
  return { client, trainingApi, repo, dbLike, rawDb }
}

/**
 * Insert a legacy-format training_recall_sessions row directly via SQL.
 * This simulates rows created before recall_policy / expected_move_indexes_json
 * columns were added.
 *
 * Contract section 6 "Legacy read path" and section 10 Group D (P0-T13, P0-T14).
 */
function seedLegacyRecallSession(client, overrides = {}) {
  const id = overrides.id || 'legacy_rs_1'
  const sourceJson = JSON.stringify(overrides.source || { kind: 'attempt', attemptId: 'attempt_1' })
  const expectedMovesJson = JSON.stringify(overrides.expectedMoves || [])
  const now = new Date().toISOString()

  // Use INSERT OR IGNORE to allow re-seeding in idempotent tests
  client.run(`INSERT OR IGNORE INTO training_recall_sessions
    (id, task_id, tab_id, type, source_json, start_move, end_move,
     expected_moves_json, current_move_index, completed, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, overrides.taskId || 'task_1', overrides.tabId || null,
    overrides.type || 'line_recall', sourceJson,
    overrides.startMove ?? 0, overrides.endMove ?? null,
    expectedMovesJson, overrides.currentMoveIndex ?? 0,
    overrides.completed ? 1 : 0, now, overrides.completedAt || null,
  ])
  client.save()
}

// ===========================================================================
// Group A: RecallPolicy type + deriveExpectedMoves pure function (unit)
// ===========================================================================

describe('Phase 0 Cleanup - Group A: deriveExpectedMoves Pure Function', () => {
  // When deriveExpectedMoves module does not exist yet, every test in this group
  // must RED with a clear message identifying the missing implementation.
  // No test may silently pass when the module is absent.
  function assertModuleLoaded() {
    if (!deriveExpectedMoves) {
      assert.fail(
        `deriveExpectedMoves module not found. ` +
        `Implementation required by Architecture v0.5 section 5.8. ` +
        `Import error: ${DERIVE_EXPECTED_MOVES_IMPORT_ERROR}`
      )
    }
  }

  // P0-T01: RecallPolicy type exports exist
  // This is a runtime approximation of the compile-time guarantee.
  // Architecture v0.5 section 5.8: RecallPolicy = 'fullLine' | 'humanMovesOnly' | 'sideToMoveOnly'
  it('P0-T01: deriveExpectedMoves accepts fullLine, humanMovesOnly, sideToMoveOnly policies', () => {
    assertModuleLoaded()

    const attempt = {
      id: 'a1',
      taskId: 't1',
      userLine: ['D4'],
      moveActors: [{ moveIndex: 0, actor: 'human' }],
    }

    // Each policy value must be accepted without throwing
    assert.doesNotThrow(() => deriveExpectedMoves('fullLine', attempt))
    assert.doesNotThrow(() => deriveExpectedMoves('humanMovesOnly', attempt))
    assert.doesNotThrow(() => deriveExpectedMoves('sideToMoveOnly', attempt))
  })

  // P0-T07: fullLine returns all moves and [0..N-1] indexes
  // Contract: deriveExpectedMoves('fullLine', attempt) returns
  //   { expectedMoves: attempt.userLine, expectedMoveIndexes: [0..N-1] }
  it('P0-T07: fullLine returns entire userLine and sequential indexes', () => {
    assertModuleLoaded()

    const attempt = {
      id: 'a_p07',
      taskId: 't1',
      userLine: ['D4', 'Q16', 'C3'],
      moveActors: [
        { moveIndex: 0, actor: 'human' },
        { moveIndex: 1, actor: 'ai' },
        { moveIndex: 2, actor: 'human' },
      ],
    }

    const result = deriveExpectedMoves('fullLine', attempt)

    assert.deepStrictEqual(result.expectedMoves, ['D4', 'Q16', 'C3'])
    assert.deepStrictEqual(result.expectedMoveIndexes, [0, 1, 2])
  })

  // P0-T08: humanMovesOnly filters to moveActors='human' moves
  // Contract: only moves where moveActors[i].actor === 'human'
  it('P0-T08: humanMovesOnly filters to human-actor moves only', () => {
    assertModuleLoaded()

    const attempt = {
      id: 'a_p08',
      taskId: 't1',
      userLine: ['D4', 'Q16', 'C3'],
      moveActors: [
        { moveIndex: 0, actor: 'human' },
        { moveIndex: 1, actor: 'ai' },
        { moveIndex: 2, actor: 'human' },
      ],
    }

    const result = deriveExpectedMoves('humanMovesOnly', attempt)

    assert.deepStrictEqual(result.expectedMoves, ['D4', 'C3'])
    assert.deepStrictEqual(result.expectedMoveIndexes, [0, 2])
  })

  // P0-T09: sideToMoveOnly filters to sideToMove color moves
  // Contract section 18: sideToMove='black' => moveIndex % 2 === 0 are black moves
  // Auditor note: must cover both sideToMove='black' and sideToMove='white'
  it('P0-T09a: sideToMoveOnly with sideToMove=black returns black moves', () => {
    assertModuleLoaded()

    // Black plays at even indexes (0, 2), White plays at odd indexes (1)
    const attempt = {
      id: 'a_p09b',
      taskId: 't1',
      userLine: ['D4', 'Q16', 'C3'],
      moveActors: [
        { moveIndex: 0, actor: 'human' },
        { moveIndex: 1, actor: 'ai' },
        { moveIndex: 2, actor: 'human' },
      ],
    }

    const result = deriveExpectedMoves('sideToMoveOnly', attempt, 'black')

    assert.deepStrictEqual(result.expectedMoves, ['D4', 'C3'])
    assert.deepStrictEqual(result.expectedMoveIndexes, [0, 2])
  })

  it('P0-T09b: sideToMoveOnly with sideToMove=white returns white moves', () => {
    assertModuleLoaded()

    // White plays at odd indexes (1, 3), Black plays at even indexes (0, 2)
    const attempt = {
      id: 'a_p09w',
      taskId: 't1',
      userLine: ['D4', 'Q16', 'C3', 'R17'],
      moveActors: [
        { moveIndex: 0, actor: 'human' },
        { moveIndex: 1, actor: 'ai' },
        { moveIndex: 2, actor: 'human' },
        { moveIndex: 3, actor: 'ai' },
      ],
    }

    const result = deriveExpectedMoves('sideToMoveOnly', attempt, 'white')

    assert.deepStrictEqual(result.expectedMoves, ['Q16', 'R17'])
    assert.deepStrictEqual(result.expectedMoveIndexes, [1, 3])
  })

  // P0-T10: humanMovesOnly with undefined moveActors degrades to fullLine
  // Contract section 10 Group A
  it('P0-T10: humanMovesOnly with no moveActors degrades to fullLine', () => {
    assertModuleLoaded()

    const attempt = {
      id: 'a_p10',
      taskId: 't1',
      userLine: ['D4', 'Q16'],
      moveActors: undefined,
    }

    const result = deriveExpectedMoves('humanMovesOnly', attempt)

    assert.deepStrictEqual(result.expectedMoves, ['D4', 'Q16'])
    assert.deepStrictEqual(result.expectedMoveIndexes, [0, 1])
  })

  // P0-T11: sideToMoveOnly with undefined sideToMove degrades to fullLine
  it('P0-T11: sideToMoveOnly with no sideToMove degrades to fullLine', () => {
    assertModuleLoaded()

    const attempt = {
      id: 'a_p11',
      taskId: 't1',
      userLine: ['D4', 'Q16'],
      moveActors: undefined,
    }

    const result = deriveExpectedMoves('sideToMoveOnly', attempt)

    assert.deepStrictEqual(result.expectedMoves, ['D4', 'Q16'])
    assert.deepStrictEqual(result.expectedMoveIndexes, [0, 1])
  })
})

// ===========================================================================
// Group B: Repository Roundtrip (integration, real SQLite)
// ===========================================================================

describe('Phase 0 Cleanup - Group B: RecallPolicy Repository Roundtrip (real SQLite)', () => {
  let repo, client, dbLike

  beforeEach(async () => {
    const setup = await createTestSetup()
    repo = setup.repo
    client = setup.client
    dbLike = setup.dbLike

    await dbLike.seedTrainingTask({ id: 'task_1', kind: 'game', source: { kind: 'game', gameId: 'g1' } })
    await dbLike.seedTrainingAttempt({ id: 'attempt_1', taskId: 'task_1' })
  })

  // P0-T02: createRecallSession with recallPolicy + expectedMoveIndexes roundtrips
  // Contract: repo.loadRecallSession returns the exact values stored
  it('P0-T02: createRecallSession with recallPolicy and expectedMoveIndexes roundtrips', async () => {
    const session = await repo.createRecallSession({
      id: 'rs_p02',
      taskId: 'task_1',
      attemptId: 'attempt_1',
      expectedMoves: ['D4', 'C3'],
      recallPolicy: 'humanMovesOnly',
      expectedMoveIndexes: [0, 2],
      currentMoveIndex: 0,
      completed: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    assert.strictEqual(session.recallPolicy, 'humanMovesOnly')
    assert.deepStrictEqual(session.expectedMoveIndexes, [0, 2])

    const loaded = await repo.loadRecallSession('rs_p02')
    assert.ok(loaded, 'session should be loadable')
    assert.strictEqual(loaded.recallPolicy, 'humanMovesOnly')
    assert.deepStrictEqual(loaded.expectedMoveIndexes, [0, 2])
  })

  // P0-T03: createRecallSession without recallPolicy defaults to 'fullLine'
  // Contract section 10 Group B: "loadRecallSession returns recallPolicy='fullLine'"
  it('P0-T03: createRecallSession without recallPolicy defaults to fullLine', async () => {
    await repo.createRecallSession({
      id: 'rs_p03',
      taskId: 'task_1',
      attemptId: 'attempt_1',
      expectedMoves: ['D4'],
      currentMoveIndex: 0,
      completed: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    const loaded = await repo.loadRecallSession('rs_p03')
    assert.ok(loaded)
    assert.strictEqual(loaded.recallPolicy, 'fullLine', 'recallPolicy should default to fullLine')
  })

  // P0-T04: createRecallSession without expectedMoveIndexes defaults to [0..N-1]
  // Contract section 10 Group B
  it('P0-T04: createRecallSession without expectedMoveIndexes defaults to [0..N-1]', async () => {
    await repo.createRecallSession({
      id: 'rs_p04',
      taskId: 'task_1',
      attemptId: 'attempt_1',
      expectedMoves: ['D4', 'Q16', 'C3'],
      currentMoveIndex: 0,
      completed: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    const loaded = await repo.loadRecallSession('rs_p04')
    assert.ok(loaded)
    assert.deepStrictEqual(loaded.expectedMoveIndexes, [0, 1, 2], 'expectedMoveIndexes should default to [0..N-1]')
  })

  // P0-T12: updateRecallSession advances currentMoveIndex
  // Contract section 10 Group B: "loadRecallSession returns currentMoveIndex=2"
  it('P0-T12: updateRecallSession advances currentMoveIndex within expectedMoveIndexes range', async () => {
    await repo.createRecallSession({
      id: 'rs_p12',
      taskId: 'task_1',
      attemptId: 'attempt_1',
      expectedMoves: ['D4', 'Q16', 'C3'],
      recallPolicy: 'humanMovesOnly',
      expectedMoveIndexes: [0, 2, 5],
      currentMoveIndex: 0,
      completed: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    await repo.updateRecallSession('rs_p12', { currentMoveIndex: 2 })

    const loaded = await repo.loadRecallSession('rs_p12')
    assert.ok(loaded)
    assert.strictEqual(loaded.currentMoveIndex, 2)
  })
})

// ===========================================================================
// Group C: DB Migration (integration, real SQLite)
// ===========================================================================

describe('Phase 0 Cleanup - Group C: DB Migration', () => {
  // P0-T05: migration adds recall_policy and expected_move_indexes_json columns
  // Contract section 10 Group C: "column list includes 'recall_policy' and 'expected_move_indexes_json'"
  it('P0-T05: migration adds recall_policy and expected_move_indexes_json columns', async () => {
    const setup = await createTestSetup()
    const client = setup.client

    const columns = client.queryAll('PRAGMA table_info(training_recall_sessions)', [])
    const columnNames = columns.map(c => c.name)

    assert.ok(columnNames.includes('recall_policy'),
      `training_recall_sessions should have recall_policy column. Got: ${columnNames.join(', ')}`)
    assert.ok(columnNames.includes('expected_move_indexes_json'),
      `training_recall_sessions should have expected_move_indexes_json column. Got: ${columnNames.join(', ')}`)
  })

  // P0-T06: migrate() twice does not crash
  // Contract section 10 Group C: "second migrate() does not throw; existing data survives"
  it('P0-T06: migrate() twice does not crash and data survives', async () => {
    if (!SQL) { SQL = await initSqlJs() }
    const rawDb = new SQL.Database()
    const client = createDbClient(rawDb)

    // First migration
    migrate(client)

    // Insert data to prove it survives
    const now = new Date().toISOString()
    client.run(`INSERT INTO training_tasks (id, kind, source_json, root_position_sgf, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`, ['t_p06', 'game', '{}', '(;SZ[9])', now, now])
    client.save()

    // Second migration -- must not throw
    assert.doesNotThrow(() => {
      migrate(client)
    })

    // Data survives
    const row = client.queryOne('SELECT * FROM training_tasks WHERE id = ?', ['t_p06'])
    assert.ok(row, 'data should survive double migration')
    assert.strictEqual(row.id, 't_p06')
  })
})

// ===========================================================================
// Group D: Legacy Compat (integration, real SQLite)
// ===========================================================================

describe('Phase 0 Cleanup - Group D: Legacy Row Compatibility', () => {
  let repo, client, dbLike

  beforeEach(async () => {
    const setup = await createTestSetup()
    repo = setup.repo
    client = setup.client
    dbLike = setup.dbLike

    // Seed a task so FK constraint is satisfied
    await dbLike.seedTrainingTask({ id: 'task_ld', kind: 'game', source: { kind: 'game', gameId: 'g_ld' } })
  })

  // P0-T13: legacy row without recall_policy loads as 'fullLine'
  // Contract section 10 Group D: "session.recallPolicy === 'fullLine'"
  it('P0-T13: legacy row without recall_policy loads as fullLine', async () => {
    // Insert a legacy row directly via SQL -- no recall_policy column value
    seedLegacyRecallSession(client, {
      id: 'rs_legacy_p13',
      taskId: 'task_ld',
      source: { kind: 'attempt', attemptId: 'attempt_ld' },
      expectedMoves: ['D4', 'Q16', 'C3'],
    })

    const session = await repo.loadRecallSession('rs_legacy_p13')
    assert.ok(session, 'legacy recall session should be loadable')
    assert.strictEqual(session.recallPolicy, 'fullLine',
      'legacy row without recall_policy should default to fullLine')
  })

  // P0-T14: legacy row without expected_move_indexes_json loads as [0..N-1]
  // Contract section 10 Group D: "session.expectedMoveIndexes === [0, 1, 2]"
  it('P0-T14: legacy row without expected_move_indexes_json loads as [0..N-1]', async () => {
    // Insert a legacy row directly via SQL -- no expected_move_indexes_json column value
    seedLegacyRecallSession(client, {
      id: 'rs_legacy_p14',
      taskId: 'task_ld',
      source: { kind: 'attempt', attemptId: 'attempt_ld' },
      expectedMoves: ['D4', 'Q16', 'C3'],
    })

    const session = await repo.loadRecallSession('rs_legacy_p14')
    assert.ok(session, 'legacy recall session should be loadable')
    assert.deepStrictEqual(session.expectedMoveIndexes, [0, 1, 2],
      'legacy row without expected_move_indexes_json should default to [0..N-1]')
  })
})

// ===========================================================================
// Group E: Architecture Boundary
// ===========================================================================

describe('Phase 0 Cleanup - Group E: Architecture Boundary', () => {
  // P0-T15: RecallPolicy does not drive WorkbenchMode transitions
  // Contract section 10 Group E: "RecallPolicy not used in modeTransition guards"
  // This is verified via grep-based static check against the codebase.
  it('P0-T15: RecallPolicy values do not appear in workbench mode transition logic', async () => {
    const { execFileSync } = await import('child_process')
    const repoRoot = path.resolve(__dirname, '../..')

    // Search for RecallPolicy values in workbench flow/mode transition files.
    // These files own mode transitions; RecallPolicy must not appear there.
    const modeTransitionFiles = [
      'src/modules/training/workbench/workbenchFlowService.ts',
      'src/modules/training/store/workbenchStore.ts',
    ]

    const grepPattern = 'fullLine|humanMovesOnly|sideToMoveOnly|recallPolicy|RecallPolicy'
    let checkedCount = 0

    for (const relPath of modeTransitionFiles) {
      const absPath = path.resolve(repoRoot, relPath)

      // Verify file exists — fail loudly if not, so we never silently skip a check
      const fs = await import('fs')
      assert.ok(fs.existsSync(absPath), `Mode transition file must exist: ${relPath}`)

      // Use execFileSync for deterministic error handling (no shell expansion)
      try {
        const result = execFileSync('grep', ['-cnE', grepPattern, absPath], { encoding: 'utf-8' })
        const lines = result.trim().split('\n').filter(l => l.length > 0)
        if (lines.length > 0) {
          assert.fail(
            `RecallPolicy values must not appear in mode transition file ${relPath}.\n` +
            `Found:\n${lines.join('\n')}`
          )
        }
        checkedCount++
      } catch (e) {
        // grep exit code 1 = no matches — that is the expected pass case
        if (e.status === 1) {
          checkedCount++
          continue
        }
        throw e
      }
    }

    // Structural guarantee: we must have actually checked files
    assert.ok(checkedCount === modeTransitionFiles.length,
      `Expected to check ${modeTransitionFiles.length} files, but only checked ${checkedCount}. ` +
      'A file may have been silently skipped.')
  })
})
