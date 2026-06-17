import assert from 'assert'
import fs from 'fs'
import initSqlJs from 'sql.js'

import { createDbClient } from '../../src/modules/db/client.js'
import { migrate } from '../../src/modules/db/migrate.js'
import { createTrainingDbApi } from '../../src/modules/db/trainingDbApi.js'
import { createTrainingRepository } from '../../src/modules/training/repository/trainingRepository.ts'
import { mapSourceToOrigin } from '../../src/modules/training/repository/trainingRepository.ts'
import { createWorkbenchStore } from '../../src/modules/training/store/workbenchStore.ts'

let SQL = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a full test stack: sql.js -> client -> migrate -> trainingApi -> dbLike -> repo.
 * The dbLike object mirrors the repository-facing DB contract closely enough to
 * exercise mapper behavior against real SQLite rows. Raw seed helpers are kept
 * separate so repository tests do not accidentally pass because a seed helper
 * returned a shape the production DB layer would not.
 */
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
      return rowToTrainingTask(client.queryOne('SELECT * FROM training_tasks WHERE id = ?', [id]))
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
      return rowToTrainingAttempt(client.queryOne('SELECT * FROM training_attempts WHERE id = ?', [id]))
    },

    async createMoveEvaluation(eval_) {
      const id = eval_.id || 'ev_1'
      const now = new Date().toISOString()
      client.run(`INSERT INTO move_evaluations (id, attempt_id, move_index, move, status, created_at,
        engine_suggested_line_json, after_score_lead, after_winrate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id, eval_.attemptId || 'attempt_1', eval_.moveIndex ?? 0, eval_.move || 'D4',
        eval_.status || 'completed', now,
        eval_.engineSuggestedLine ? JSON.stringify(eval_.engineSuggestedLine) : null,
        eval_.afterScoreLead ?? null, eval_.afterWinrate ?? null,
      ])
      client.save()
      return client.queryOne('SELECT * FROM move_evaluations WHERE id = ?', [id])
    },

    async createTrainingBadMove(bm) {
      const evId = bm.moveEvaluationId || 'ev_1'
      const now = new Date().toISOString()
      client.run(`INSERT OR IGNORE INTO move_evaluations (id, attempt_id, move_index, move, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`, [
        evId, bm.attemptId || 'attempt_1', bm.moveIndex ?? 0, 'D4', 'completed', now,
      ])
      const id = bm.id || 'bm_1'
      client.run(`INSERT INTO training_bad_moves (id, move_evaluation_id, attempt_id, task_id,
        move_index, severity, punish_side, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        id, evId, bm.attemptId || 'attempt_1', bm.taskId || 'task_1',
        bm.moveIndex ?? 0, bm.severity || 'major', bm.punishSide || 'white', now,
      ])
      client.save()
      return rowToTrainingBadMove(client.queryOne('SELECT * FROM training_bad_moves WHERE id = ?', [id]))
    },
  }

  const dbLike = {
    ...trainingApi,

    // Test-only seed helpers. Repository tests should call these only for
    // prerequisites, never for the behavior under test.
    seedTrainingTask: seed.trainingTask,
    seedTrainingAttempt: seed.trainingAttempt,

    async createTrainingTask(task) {
      return seed.trainingTask(task)
    },

    async loadTrainingTask(taskId) {
      const row = client.queryOne('SELECT * FROM training_tasks WHERE id = ?', [taskId])
      return row ? rowToTrainingTask(row) : null
    },

    async findTrainingTaskBySource(source) {
      const row = client.queryOne('SELECT * FROM training_tasks WHERE source_json = ? LIMIT 1', [
        JSON.stringify(source),
      ])
      return row ? rowToTrainingTask(row) : null
    },

    async updateTrainingTask(taskId, patch) {
      const sets = []
      const params = []
      if (patch.kind !== undefined) { sets.push('kind = ?'); params.push(patch.kind) }
      if (patch.source !== undefined) { sets.push('source_json = ?'); params.push(JSON.stringify(patch.source)) }
      if (patch.rootPositionSgf !== undefined) { sets.push('root_position_sgf = ?'); params.push(patch.rootPositionSgf) }
      if (patch.sideToMove !== undefined) { sets.push('side_to_move = ?'); params.push(patch.sideToMove) }
      if (patch.title !== undefined) { sets.push('title = ?'); params.push(patch.title) }
      if (sets.length === 0) return
      sets.push('updated_at = ?')
      params.push(new Date().toISOString(), taskId)
      client.run(`UPDATE training_tasks SET ${sets.join(', ')} WHERE id = ?`, params)
      client.save()
    },

    async createTrainingAttempt(attempt) {
      return seed.trainingAttempt(attempt)
    },

    async loadTrainingAttempt(attemptId) {
      const row = client.queryOne('SELECT * FROM training_attempts WHERE id = ?', [attemptId])
      return row ? rowToTrainingAttempt(row) : null
    },

    async listTrainingAttemptsByTask(taskId) {
      return client.queryAll('SELECT * FROM training_attempts WHERE task_id = ? ORDER BY started_at ASC', [taskId])
        .map(rowToTrainingAttempt)
    },

    async updateTrainingAttempt(attemptId, patch) {
      const sets = []
      const params = []
      if (patch.userLine !== undefined) { sets.push('user_line_json = ?'); params.push(JSON.stringify(patch.userLine)) }
      if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status) }
      if (patch.result !== undefined) { sets.push('result = ?'); params.push(patch.result) }
      if (patch.moveActors !== undefined) {
        sets.push('move_actors_json = ?')
        params.push(patch.moveActors == null ? null : JSON.stringify(patch.moveActors))
      }
      if (sets.length === 0) return
      params.push(attemptId)
      client.run(`UPDATE training_attempts SET ${sets.join(', ')} WHERE id = ?`, params)
      client.save()
    },

    async createTrainingBadMove(badMove) {
      return seed.createTrainingBadMove(badMove)
    },

    async loadTrainingBadMove(badMoveId) {
      const row = client.queryOne('SELECT * FROM training_bad_moves WHERE id = ?', [badMoveId])
      return row ? rowToTrainingBadMove(row) : null
    },

    async listMoveEvaluationsByAttempt(attemptId) {
      return client.queryAll('SELECT * FROM move_evaluations WHERE attempt_id = ? ORDER BY move_index ASC', [attemptId])
    },

    async listTrainingBadMovesByAttempt(attemptId) {
      return client.queryAll('SELECT * FROM training_bad_moves WHERE attempt_id = ? ORDER BY move_index ASC', [attemptId])
        .map(rowToTrainingBadMove)
    },

    async listTrainingBadMovesByTask(taskId) {
      return client.queryAll('SELECT * FROM training_bad_moves WHERE task_id = ? ORDER BY move_index ASC', [taskId])
        .map(rowToTrainingBadMove)
    },

    async upsertReviewSchedule(schedule) {
      const id = schedule.id || `${schedule.itemId || schedule.taskId}_${schedule.itemType || 'problem'}`
      const now = new Date().toISOString()
      const itemId = schedule.itemId || schedule.taskId
      const itemType = schedule.itemType || 'problem'
      const taskId = schedule.taskId || null
      client.run(`INSERT INTO review_schedule (id, item_id, item_type, due_at, interval_days,
        ease_factor, last_result, consecutive_pass_count, total_fail_count, last_reviewed_at,
        task_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id, itemId, itemType, schedule.dueAt,
        schedule.intervalDays ?? 1, schedule.easeFactor ?? null,
        schedule.lastResult || null, schedule.consecutivePassCount ?? 0,
        schedule.totalFailCount ?? 0, schedule.lastReviewedAt || null,
        taskId, now, now,
      ])
      client.save()
      return rowToReviewSchedule(client.queryOne('SELECT * FROM review_schedule WHERE id = ?', [id]))
    },

    async findReviewScheduleByItem(itemId, itemType) {
      // v0.5: also try finding by task_id
      let row = client.queryOne('SELECT * FROM review_schedule WHERE item_id = ? AND item_type = ?', [
        itemId, itemType,
      ])
      if (!row) {
        row = client.queryOne('SELECT * FROM review_schedule WHERE task_id = ?', [itemId])
      }
      return row ? rowToReviewSchedule(row) : null
    },

    async updateReviewSchedule(id, patch) {
      const sets = []
      const params = []
      if (patch.dueAt !== undefined) { sets.push('due_at = ?'); params.push(patch.dueAt) }
      if (patch.intervalDays !== undefined) { sets.push('interval_days = ?'); params.push(patch.intervalDays) }
      if (patch.easeFactor !== undefined) { sets.push('ease_factor = ?'); params.push(patch.easeFactor) }
      if (patch.lastResult !== undefined) { sets.push('last_result = ?'); params.push(patch.lastResult) }
      if (sets.length === 0) return
      sets.push('updated_at = ?')
      params.push(new Date().toISOString(), id)
      client.run(`UPDATE review_schedule SET ${sets.join(', ')} WHERE id = ?`, params)
      client.save()
    },

    // Transaction passthrough
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

function rowToTrainingTask(row) {
  return {
    id: row.id,
    kind: row.kind,
    source: JSON.parse(row.source_json || '{}'),
    rootPositionSgf: row.root_position_sgf,
    sideToMove: row.side_to_move,
    title: row.title,
    origin: row.origin_json ? JSON.parse(row.origin_json) : undefined,
    initialPositionSgf: row.initial_position_sgf,
    prompt: row.prompt,
    goal: row.goal,
    passRule: row.pass_rule_json ? JSON.parse(row.pass_rule_json) : undefined,
    referenceLines: row.reference_lines_json ? JSON.parse(row.reference_lines_json) : undefined,
    problemArea: row.problem_area_json ? JSON.parse(row.problem_area_json) : undefined,
    tags: row.tags_json ? JSON.parse(row.tags_json) : undefined,
    difficulty: row.difficulty,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToTrainingAttempt(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    tabId: row.tab_id,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    rootPositionSgf: row.root_position_sgf,
    userLine: JSON.parse(row.user_line_json || '[]'),
    moveActors: row.move_actors_json ? JSON.parse(row.move_actors_json) : undefined,
    status: row.status,
    result: row.result,
    hintLevelUsed: row.hint_level_used,
    recallCompleted: !!row.recall_completed,
    analysisOpened: !!row.analysis_opened,
  }
}

function rowToTrainingBadMove(row) {
  return {
    id: row.id,
    moveEvaluationId: row.move_evaluation_id,
    attemptId: row.attempt_id,
    taskId: row.task_id,
    moveIndex: row.move_index,
    severity: row.severity,
    punishSide: row.punish_side,
    positionBeforeSgf: row.position_before_sgf,
    positionAfterSgf: row.position_after_sgf,
    userMarkedAsNotBad: !!row.user_marked_as_not_bad,
    generatedTaskId: row.generated_task_id || row.generated_problem_id || undefined,
    generatedProblemId: row.generated_problem_id,
    recallCheckpointId: row.recall_checkpoint_id,
    createdAt: row.created_at,
  }
}

function rowToReviewSchedule(row) {
  const taskId = row.task_id || row.item_id || ''
  return {
    id: row.id,
    taskId,
    itemId: row.item_id,
    itemType: row.item_type,
    dueAt: row.due_at,
    intervalDays: row.interval_days,
    easeFactor: row.ease_factor,
    lastResult: row.last_result,
    consecutivePassCount: row.consecutive_pass_count,
    totalFailCount: row.total_fail_count,
    lastReviewedAt: row.last_reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Insert a v0.4-format training_tasks row directly via SQL.
 */
function seedLegacyTask(client, overrides = {}) {
  const id = overrides.id || 'legacy_task_1'
  const kind = overrides.kind || 'game'
  const sourceJson = JSON.stringify(overrides.source || { kind: 'game', gameId: 'g1' })
  const rootPositionSgf = overrides.rootPositionSgf || '(;SZ[9])'
  const now = new Date().toISOString()
  client.run(`INSERT INTO training_tasks (id, kind, source_json, root_position_sgf, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`, [id, kind, sourceJson, rootPositionSgf, now, now])
  client.save()
}

/**
 * Insert a v0.4-format review_schedule row directly via SQL.
 */
function seedLegacyReviewSchedule(client, overrides = {}) {
  const id = overrides.id || 'review_1'
  const itemId = overrides.itemId || 'prob_1'
  const itemType = overrides.itemType || 'problem'
  const dueAt = overrides.dueAt || '2026-06-01T00:00:00.000Z'
  const now = new Date().toISOString()
  client.run(`INSERT INTO review_schedule (id, item_id, item_type, due_at, interval_days,
    ease_factor, last_result, consecutive_pass_count, total_fail_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, itemId, itemType, dueAt, 1, 2.5, null, 0, 0, now, now,
  ])
  client.save()
}

/**
 * Insert a v0.4-format training_bad_moves row with generated_problem_id directly via SQL.
 */
function seedLegacyBadMove(client, overrides = {}) {
  const id = overrides.id || 'legacy_bm_1'
  const evId = overrides.moveEvaluationId || 'ev_legacy'
  const now = new Date().toISOString()
  // Ensure prerequisite move_evaluation exists
  client.run(`INSERT OR IGNORE INTO move_evaluations (id, attempt_id, move_index, move, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`, [
    evId, overrides.attemptId || 'attempt_1', overrides.moveIndex ?? 0, 'D4', 'completed', now,
  ])
  client.run(`INSERT INTO training_bad_moves (id, move_evaluation_id, attempt_id, task_id,
    move_index, severity, punish_side, generated_problem_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, evId, overrides.attemptId || 'attempt_1', overrides.taskId || 'task_1',
    overrides.moveIndex ?? 0, overrides.severity || 'major', overrides.punishSide || 'white',
    overrides.generatedProblemId || null, now,
  ])
  client.save()
}

/**
 * Insert a v0.4-format training_recall_sessions row with source_json via SQL.
 */
function seedLegacyRecallSession(client, overrides = {}) {
  const id = overrides.id || 'legacy_rs_1'
  const sourceJson = JSON.stringify(overrides.source || { kind: 'attempt', attemptId: 'attempt_1' })
  const now = new Date().toISOString()
  client.run(`INSERT INTO training_recall_sessions (id, task_id, tab_id, type, source_json,
    start_move, end_move, expected_moves_json, current_move_index, completed, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, overrides.taskId || 'task_1', overrides.tabId || null, overrides.type || 'line_recall',
    sourceJson, overrides.startMove ?? 0, overrides.endMove ?? null,
    JSON.stringify(overrides.expectedMoves || []), 0, 0, now, null,
  ])
  client.save()
}

// ===========================================================================
// Group 1: Source-to-Origin Mapping (Pure Logic)
// ===========================================================================

describe('Phase 0 Migration - Group 1: Source-to-Origin Mapper', () => {
  // T-01: Game source maps to TaskOrigin with provider and externalId
  it('T-01: game source {kind:"game", gameId:"g1"} maps to TaskOrigin', () => {
    const source = { kind: 'game', gameId: 'g1' }
    const origin = mapSourceToOrigin(source, 'game')

    assert.ok(origin, 'origin should not be null/undefined')
    assert.strictEqual(origin.externalId, 'g1')
    assert.ok(origin.provider, 'provider should be set')
  })

  // T-02: Problem source maps to TaskOrigin with provider and externalId
  it('T-02: problem source {kind:"problem", problemId:"p1"} maps to TaskOrigin', () => {
    const source = { kind: 'problem', problemId: 'p1' }
    const origin = mapSourceToOrigin(source, 'problem')

    assert.ok(origin)
    assert.strictEqual(origin.externalId, 'p1')
    assert.ok(origin.provider)
  })

  // T-03: Snapshot source preserves parentTaskId and parentAttemptId
  it('T-03: snapshot_problem source preserves parentTaskId and parentAttemptId', () => {
    const source = {
      kind: 'snapshot_problem',
      problemId: 'p2',
      parentTaskId: 't1',
      parentAttemptId: 'a1',
    }
    const origin = mapSourceToOrigin(source, 'snapshot_problem')

    assert.ok(origin)
    assert.strictEqual(origin.externalId, 'p2')
    assert.strictEqual(origin.parentTaskId, 't1')
    assert.strictEqual(origin.parentAttemptId, 'a1')
  })

  // T-04: Recall segment source maps with parent references
  it('T-04: recall_segment source maps preserving parent references', () => {
    const source = {
      kind: 'recall_segment',
      segmentId: 's1',
      sourceAttemptId: 'a1',
      sourceGameId: 'g1',
    }
    const origin = mapSourceToOrigin(source, 'recall_segment')

    assert.ok(origin)
    assert.strictEqual(origin.externalId, 's1')
    assert.ok(origin.provider)
  })

  // T-05: Unknown kind maps to fallback provider with raw data preserved
  it('T-05: unrecognized source kind maps to fallback provider with raw preserved', () => {
    const source = { kind: 'custom', foo: 'bar' }
    const origin = mapSourceToOrigin(source, 'custom')

    assert.ok(origin)
    assert.strictEqual(origin.provider, 'local')
    assert.ok(origin.raw, 'raw field should exist for unrecognized kinds')
    assert.strictEqual(origin.raw.kind, 'custom')
  })

  // T-06: null/undefined source maps to undefined origin
  it('T-06: null source maps to undefined origin', () => {
    const origin = mapSourceToOrigin(null, 'game')
    assert.strictEqual(origin, undefined)
  })

  it('T-06: undefined source maps to undefined origin', () => {
    const origin = mapSourceToOrigin(undefined, 'game')
    assert.strictEqual(origin, undefined)
  })
})

// ===========================================================================
// Group 2: WorkbenchTab Phase-to-Mode (State)
// ===========================================================================

describe('Phase 0 Migration - Group 2: WorkbenchTab Mode', () => {
  let store

  beforeEach(() => {
    store = createWorkbenchStore()
  })

  // T-07: Old phase='play' remains readable through the v0.5 mode field
  it('T-07: old phase="play" reads back as mode="play"', () => {
    store.addTab({
      id: 'tab_1',
      taskId: 'task_1',
      phase: 'play',
      childTabIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    assert.strictEqual(store.getState().tabs[0].mode, 'play')
  })

  // T-08: mode='problem' is a valid WorkbenchMode value
  it('T-08: tab created with mode="problem" is a valid WorkbenchMode', () => {
    store.addTab({
      id: 'tab_1',
      taskId: 'task_1',
      mode: 'problem',
      childTabIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    assert.strictEqual(store.getState().tabs[0].mode, 'problem')
  })

  // T-09: Mixed transition patches still surface through mode
  it('T-09: compatibility mapper reads mode from phase during transition', () => {
    store.addTab({
      id: 'tab_1',
      taskId: 'task_1',
      phase: 'play',
      childTabIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    store.updateTab('tab_1', { phase: 'recall' })
    assert.strictEqual(store.getState().tabs[0].mode, 'recall')
  })
})

// ===========================================================================
// Group 3: Repository Roundtrip with real SQLite
// ===========================================================================

describe('Phase 0 Migration - Group 3: Repository Roundtrip (real SQLite)', () => {
  let repo, client, dbLike

  beforeEach(async () => {
    const setup = await createTestSetup()
    repo = setup.repo
    client = setup.client
    dbLike = setup.dbLike

    // Seed prerequisites used across tests
    await dbLike.seedTrainingTask({ id: 'task_1', kind: 'game', source: { kind: 'game', gameId: 'g1' } })
    await dbLike.seedTrainingAttempt({ id: 'attempt_1', taskId: 'task_1' })
  })

  // T-10: BadMove generatedTaskId roundtrips
  it('T-10: BadMove generatedTaskId roundtrips', async () => {
    await dbLike.createTrainingBadMove({
      id: 'bm_10', moveEvaluationId: 'ev_10', attemptId: 'attempt_1',
      taskId: 'task_1', moveIndex: 0, severity: 'major', punishSide: 'white',
    })

    await repo.updateBadMove('bm_10', { generatedTaskId: 'derived_task_1' })

    const loaded = await repo.loadBadMove('bm_10')
    assert.ok(loaded, 'bad move should exist after update')
    assert.strictEqual(loaded.generatedTaskId, 'derived_task_1')
  })

  // T-11: ReviewSchedule with taskId roundtrips
  it('T-11: ReviewSchedule with taskId roundtrips', async () => {
    const schedule = await repo.createReviewSchedule({
      id: 'rsched_1',
      taskId: 'task_1',
      dueAt: '2026-06-01T00:00:00.000Z',
      intervalDays: 1,
      easeFactor: 2.5,
      consecutivePassCount: 0,
      totalFailCount: 0,
    })

    assert.strictEqual(schedule.taskId, 'task_1')

    const loaded = await repo.findReviewScheduleByItem('task_1', 'task')
    assert.ok(loaded, 'review schedule should be findable by taskId')
    assert.strictEqual(loaded.taskId, 'task_1')
  })

  // T-12: RecallSession with attemptId roundtrips
  it('T-12: RecallSession with attemptId roundtrips', async () => {
    const session = await repo.createRecallSession({
      id: 'rs_12',
      taskId: 'task_1',
      tabId: 'tab_1',
      attemptId: 'attempt_1',
      expectedMoves: ['D4', 'Q16'],
      currentMoveIndex: 0,
      completed: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    assert.strictEqual(session.attemptId, 'attempt_1')

    const loaded = await repo.loadRecallSession('rs_12')
    assert.ok(loaded)
    assert.strictEqual(loaded.attemptId, 'attempt_1')
  })

  // T-13: TrainingAttempt with moveActors roundtrips
  it('T-13: TrainingAttempt with moveActors roundtrips', async () => {
    const attempt = await repo.createAttempt({
      id: 'attempt_13',
      taskId: 'task_1',
      rootPositionSgf: '(;SZ[9])',
      userLine: ['D4', 'Q16'],
      status: 'playing',
      result: 'pending',
      hintLevelUsed: 0,
      recallCompleted: false,
      analysisOpened: false,
      moveActors: [
        { moveIndex: 0, actor: 'human' },
        { moveIndex: 1, actor: 'ai' },
      ],
    })

    assert.ok(Array.isArray(attempt.moveActors))
    assert.strictEqual(attempt.moveActors.length, 2)
    assert.strictEqual(attempt.moveActors[0].actor, 'human')
    assert.strictEqual(attempt.moveActors[1].actor, 'ai')
  })

  it('T-13b: TrainingAttempt moveActors update roundtrips', async () => {
    await repo.createAttempt({
      id: 'attempt_13b',
      taskId: 'task_1',
      rootPositionSgf: '(;SZ[9])',
      userLine: [],
      status: 'playing',
      result: 'pending',
      hintLevelUsed: 0,
      recallCompleted: false,
      analysisOpened: false,
    })

    await repo.updateAttempt('attempt_13b', {
      userLine: ['D4'],
      moveActors: [{ moveIndex: 0, actor: 'ai' }],
    })

    const loaded = await repo.loadAttempt('attempt_13b')
    assert.deepStrictEqual(loaded.moveActors, [{ moveIndex: 0, actor: 'ai' }])
  })

  // T-14: TrainingTask with all v0.5 fields roundtrips
  it('T-14: TrainingTask with all v0.5 fields roundtrips', async () => {
    const task = await repo.createTask({
      id: 'task_14',
      rootPositionSgf: '(;SZ[9]AB[dc][ce]AW[dd][cf])',
      origin: { provider: 'inferred', externalId: 'ext_14' },
      prompt: 'Find the best move for Black',
      goal: 'Kill the white group',
      passRule: { allowed: false },
      referenceLines: [
        { id: 'ref_1', label: 'Main line', moves: ['D4', 'C3'], source: 'engine' },
      ],
      problemArea: { x1: 3, y1: 3, x2: 15, y2: 15 },
      tags: ['tesuji', 'life-death'],
      difficulty: 5,
      status: 'active',
    })

    assert.strictEqual(task.id, 'task_14')
    assert.strictEqual(task.rootPositionSgf, '(;SZ[9]AB[dc][ce]AW[dd][cf])')
    assert.strictEqual(task.origin.provider, 'inferred')
    assert.strictEqual(task.origin.externalId, 'ext_14')
    assert.strictEqual(task.prompt, 'Find the best move for Black')
    assert.strictEqual(task.goal, 'Kill the white group')
    assert.deepStrictEqual(task.passRule, { allowed: false })
    assert.strictEqual(task.referenceLines.length, 1)
    assert.strictEqual(task.referenceLines[0].moves[0], 'D4')
    // problemArea rectangle is normalized to vertex list on roundtrip
    assert.ok(Array.isArray(task.problemArea), 'problemArea should be a vertex list')
    assert.strictEqual(task.problemArea.length, 169, '13x13 rectangle should expand to 169 vertices')
    assert.deepStrictEqual(task.problemArea[0], [3, 3])
    assert.deepStrictEqual(task.problemArea[task.problemArea.length - 1], [15, 15])
    assert.deepStrictEqual(task.tags, ['tesuji', 'life-death'])
    assert.strictEqual(task.difficulty, 5)
    assert.strictEqual(task.status, 'active')

    const loaded = await repo.loadTask('task_14')
    assert.ok(loaded)
    assert.strictEqual(loaded.origin.provider, 'inferred')
    assert.strictEqual(loaded.origin.externalId, 'ext_14')
    assert.strictEqual(loaded.prompt, 'Find the best move for Black')
    assert.ok(Array.isArray(loaded.problemArea), 'loaded problemArea should be a vertex list')
    assert.strictEqual(loaded.problemArea.length, 169, 'loaded problemArea should preserve all rectangle vertices')
    assert.deepStrictEqual(loaded.problemArea[0], [3, 3])
    assert.deepStrictEqual(loaded.problemArea[loaded.problemArea.length - 1], [15, 15])
    assert.deepStrictEqual(loaded.tags, ['tesuji', 'life-death'])
  })

  // T-15: problemArea rectangle is normalized to vertex list on roundtrip
  it('T-15: problemArea {x1:3, y1:3, x2:15, y2:15} normalizes to vertex list', async () => {
    await repo.createTask({
      id: 'task_15',
      rootPositionSgf: '(;SZ[19])',
      problemArea: { x1: 3, y1: 3, x2: 15, y2: 15 },
    })

    const loaded = await repo.loadTask('task_15')
    assert.ok(loaded)
    assert.ok(Array.isArray(loaded.problemArea), 'problemArea should be normalized to vertex list')
    const area = loaded.problemArea
    assert.strictEqual(area.length, 169, '13x13 rectangle should expand to 169 vertices')
    // First vertex should be [3,3] (x1,y1), last should be [15,15] (x2,y2)
    assert.deepStrictEqual(area[0], [3, 3])
    assert.deepStrictEqual(area[area.length - 1], [15, 15])
  })

  // T-16: origin with nested raw record roundtrips
  it('T-16: origin with nested raw record roundtrips', async () => {
    const rawRecord = { kind: 'custom', foo: 'bar', nested: { a: 1 } }
    await repo.createTask({
      id: 'task_16',
      rootPositionSgf: '(;SZ[9])',
      origin: { provider: 'local', raw: rawRecord },
    })

    const loaded = await repo.loadTask('task_16')
    assert.ok(loaded)
    assert.strictEqual(loaded.origin.provider, 'local')
    assert.deepStrictEqual(loaded.origin.raw, rawRecord)
  })
})

// ===========================================================================
// Group 4: Legacy Data Compatibility (State with real SQLite)
// ===========================================================================

describe('Phase 0 Migration - Group 4: Legacy Data Compatibility', () => {
  let repo, client, dbLike

  beforeEach(async () => {
    const setup = await createTestSetup()
    repo = setup.repo
    client = setup.client
    dbLike = setup.dbLike
  })

  // T-17: Old training_tasks row loads as v0.5 TrainingTask with origin
  it('T-17: old training_tasks row (kind, source_json) loads as v0.5 TrainingTask with origin', async () => {
    seedLegacyTask(client, {
      id: 'legacy_task_17',
      kind: 'game',
      source: { kind: 'game', gameId: 'g_legacy' },
    })

    const task = await repo.loadTask('legacy_task_17')
    assert.ok(task, 'legacy task should be loadable')
    assert.ok(task.origin, 'origin should be populated from legacy kind/source')
    assert.strictEqual(task.origin.externalId, 'g_legacy')
    assert.strictEqual(task.rootPositionSgf, '(;SZ[9])')
  })

  // T-18: Old review_schedule row loads as v0.5 ReviewSchedule with taskId
  it('T-18: old review_schedule row (item_id, item_type) loads with taskId', async () => {
    seedLegacyReviewSchedule(client, {
      id: 'review_18',
      itemId: 'prob_18',
      itemType: 'problem',
    })

    const schedule = await repo.findReviewScheduleByItem('prob_18', 'problem')
    assert.ok(schedule, 'legacy review schedule should be findable')
    assert.strictEqual(schedule.taskId, 'prob_18', 'taskId should be populated from item_id')
  })

  // T-19: Old training_bad_moves row with generated_problem_id loads with generatedTaskId
  it('T-19: old training_bad_moves row (generated_problem_id) loads with generatedTaskId', async () => {
    // Seed prerequisite task + attempt for FK
    await dbLike.seedTrainingTask({ id: 'task_19', kind: 'game', source: { kind: 'game', gameId: 'g19' } })
    await dbLike.seedTrainingAttempt({ id: 'attempt_19', taskId: 'task_19' })

    seedLegacyBadMove(client, {
      id: 'bm_19',
      attemptId: 'attempt_19',
      taskId: 'task_19',
      generatedProblemId: 'prob_19',
    })

    const badMove = await repo.loadBadMove('bm_19')
    assert.ok(badMove, 'legacy bad move should be loadable')
    assert.strictEqual(badMove.generatedTaskId, 'prob_19', 'generatedTaskId should be populated from generated_problem_id')
  })

  // T-20: Old training_recall_sessions row with source_json loads with attemptId
  it('T-20: old training_recall_sessions row (source_json with attempt) loads with attemptId', async () => {
    await dbLike.seedTrainingTask({ id: 'task_20', kind: 'game', source: { kind: 'game', gameId: 'g20' } })

    seedLegacyRecallSession(client, {
      id: 'rs_20',
      taskId: 'task_20',
      source: { kind: 'attempt', attemptId: 'attempt_20' },
    })

    const session = await repo.loadRecallSession('rs_20')
    assert.ok(session, 'legacy recall session should be loadable')
    assert.strictEqual(session.attemptId, 'attempt_20', 'attemptId should be populated from source_json')
  })
})

// ===========================================================================
// Group 5: New Code Uses v0.5 API (Architecture Boundary)
// ===========================================================================

describe('Phase 0 Migration - Group 5: v0.5 API Paths', () => {
  let repo, client, dbLike

  beforeEach(async () => {
    const setup = await createTestSetup()
    repo = setup.repo
    client = setup.client
    dbLike = setup.dbLike
  })

  // T-21: createTask without kind/source succeeds (only needs initialPositionSgf)
  it('T-21: createTask without kind/source succeeds', async () => {
    const task = await repo.createTask({
      id: 'task_21',
      rootPositionSgf: '(;SZ[9])',
    })

    assert.strictEqual(task.id, 'task_21')
    assert.strictEqual(task.rootPositionSgf, '(;SZ[9])')
    // v0.5: kind/source are not required; origin may be undefined
  })

  // T-21b: Phase 0 model contract requires initialPositionSgf on TrainingTask.
  // This static type-shape test protects TypeScript callers because repository
  // and DB mappers already read/write the field at runtime.
  it('T-21b: TrainingTask type declares initialPositionSgf', () => {
    const source = fs.readFileSync('src/modules/training/types/task.ts', 'utf8')
    const trainingTaskBlock = source.match(/export type TrainingTask = \{[\s\S]*?\n\}/)

    assert.ok(trainingTaskBlock, 'TrainingTask type declaration must exist')
    assert.match(
      trainingTaskBlock[0],
      /\binitialPositionSgf\?:\s*string\b/,
      'TrainingTask must declare optional initialPositionSgf for v0.5 model convergence',
    )
  })

  // T-22: createReviewSchedule with taskId succeeds (no itemId/itemType needed)
  it('T-22: createReviewSchedule with taskId succeeds', async () => {
    const schedule = await repo.createReviewSchedule({
      id: 'rsched_22',
      taskId: 'task_22',
      dueAt: '2026-07-01T00:00:00.000Z',
      intervalDays: 2,
      consecutivePassCount: 0,
      totalFailCount: 0,
    })

    assert.strictEqual(schedule.id, 'rsched_22')
    assert.strictEqual(schedule.taskId, 'task_22')
  })

  // T-23: updateBadMove accepts generatedTaskId patch
  it('T-23: updateBadMove accepts generatedTaskId patch', async () => {
    await dbLike.seedTrainingTask({ id: 'task_23', kind: 'game', source: { kind: 'game', gameId: 'g23' } })
    await dbLike.seedTrainingAttempt({ id: 'attempt_23', taskId: 'task_23' })
    await dbLike.createTrainingBadMove({
      id: 'bm_23', moveEvaluationId: 'ev_23', attemptId: 'attempt_23',
      taskId: 'task_23', moveIndex: 0,
    })

    // Should not throw - the v0.5 API accepts generatedTaskId
    await repo.updateBadMove('bm_23', { generatedTaskId: 'gen_task_23' })

    const loaded = await repo.loadBadMove('bm_23')
    assert.strictEqual(loaded.generatedTaskId, 'gen_task_23')
  })
})

// ===========================================================================
// Group 6: DB Migration (Wiring)
// ===========================================================================

describe('Phase 0 Migration - Group 6: DB Migration', () => {
  // T-24: After migration, new columns exist and existing rows unchanged
  it('T-24: after migration, new v0.5 columns exist on training_tasks', async () => {
    const setup = await createTestSetup()
    const client = setup.client

    const columns = client.queryAll("PRAGMA table_info(training_tasks)", [])
    const columnNames = columns.map(c => c.name)

    // v0.5 columns that should exist after migration
    assert.ok(columnNames.includes('origin_json'), 'origin_json column should exist')
    assert.ok(columnNames.includes('prompt'), 'prompt column should exist')
    assert.ok(columnNames.includes('goal'), 'goal column should exist')
    assert.ok(columnNames.includes('problem_area_json'), 'problem_area_json column should exist')
    assert.ok(columnNames.includes('tags_json'), 'tags_json column should exist')
    assert.ok(columnNames.includes('difficulty'), 'difficulty column should exist')
    assert.ok(columnNames.includes('status'), 'status column should exist')

    // Existing v0.4 columns should still be there
    assert.ok(columnNames.includes('kind'), 'kind column should still exist')
    assert.ok(columnNames.includes('source_json'), 'source_json column should still exist')
    assert.ok(columnNames.includes('root_position_sgf'), 'root_position_sgf column should still exist')
  })

  it('T-24: after migration, existing rows are unchanged', async () => {
    const setup = await createTestSetup()
    const client = setup.client

    seedLegacyTask(client, {
      id: 'task_24',
      kind: 'game',
      source: { kind: 'game', gameId: 'original' },
      rootPositionSgf: '(;SZ[9]AB[aa])',
    })

    const row = client.queryOne('SELECT * FROM training_tasks WHERE id = ?', ['task_24'])
    assert.strictEqual(row.kind, 'game')
    assert.strictEqual(row.root_position_sgf, '(;SZ[9]AB[aa])')
    const source = JSON.parse(row.source_json)
    assert.strictEqual(source.gameId, 'original')
  })

  // T-25: Running migrate() twice is idempotent
  it('T-25: running migrate() twice does not crash', async () => {
    if (!SQL) { SQL = await initSqlJs() }
    const rawDb = new SQL.Database()
    const client = createDbClient(rawDb)

    // First migration
    migrate(client)

    // Insert some data to prove it survives the second migration
    const now = new Date().toISOString()
    client.run(`INSERT INTO training_tasks (id, kind, source_json, root_position_sgf, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`, ['t25', 'game', '{}', '(;SZ[9])', now, now])
    client.save()

    // Second migration - should not throw
    assert.doesNotThrow(() => {
      migrate(client)
    })

    // Data should survive
    const row = client.queryOne('SELECT * FROM training_tasks WHERE id = ?', ['t25'])
    assert.ok(row, 'data should survive double migration')
    assert.strictEqual(row.id, 't25')
  })

  // T-28: findTaskBySource still works for old source-based rows
  it('T-28: findTaskBySource works for old source-based rows', async () => {
    const setup = await createTestSetup()
    const client = setup.client
    const repo = setup.repo

    seedLegacyTask(client, {
      id: 'task_28',
      kind: 'game',
      source: { kind: 'game', gameId: 'g28' },
    })

    // The legacy findTaskBySource API should still find the row
    const task = await repo.findTaskBySource({ kind: 'game', gameId: 'g28' })
    assert.ok(task, 'findTaskBySource should find old-format row')
    assert.strictEqual(task.id, 'task_28')
  })
})
