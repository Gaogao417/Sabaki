import assert from 'assert'
import initSqlJs from 'sql.js'

// Integration test: repository ↔ trainingDbApi ↔ dbClient ↔ real SQLite
// Uses real production code instead of reimplementing db.js functions.

import { createDbClient } from '../../src/modules/db/client.js'
import { migrate } from '../../src/modules/db/migrate.js'
import { createTrainingDbApi } from '../../src/modules/db/trainingDbApi.js'
import { createTrainingRepository } from '../../src/modules/training/repository/trainingRepository.ts'

let SQL = null

async function createTestSetup() {
  if (!SQL) {
    SQL = await initSqlJs()
  }
  const rawDb = new SQL.Database()
  const client = createDbClient(rawDb)
  migrate(client)

  const trainingApi = createTrainingDbApi(client)

  // Build a db-like object that the repository expects.
  // Includes training API + seed helpers for prerequisite records.
  const dbLike = {
    ...trainingApi,

    // Seed helpers for prerequisites (tasks, attempts, evaluations, bad_moves)
    async createTrainingTask(task) {
      const id = task.id || 'task_1'
      const now = new Date().toISOString()
      client.run(`INSERT INTO training_tasks (id, kind, source_json, root_position_sgf, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`, [
        id, task.kind || 'free_play', JSON.stringify(task.source || {}), task.rootPositionSgf || '(;SZ[9])', now, now,
      ])
      client.save()
    },

    async createTrainingAttempt(attempt) {
      const id = attempt.id || 'attempt_1'
      const now = new Date().toISOString()
      client.run(`INSERT INTO training_attempts (id, task_id, started_at, root_position_sgf, user_line_json, status, result)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        id, attempt.taskId || 'task_1', now, '(;SZ[9])', JSON.stringify(attempt.userLine || []), 'playing', 'pending',
      ])
      client.save()
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
    },

    async createTrainingBadMove(bm) {
      const evId = bm.moveEvaluationId || 'ev_1'
      const now = new Date().toISOString()
      // Ensure prerequisite move_evaluation exists
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
    },

    async loadTrainingBadMove(badMoveId) {
      return client.queryOne('SELECT * FROM training_bad_moves WHERE id = ?', [badMoveId])
    },

    async listMoveEvaluationsByAttempt(attemptId) {
      return client.queryAll('SELECT * FROM move_evaluations WHERE attempt_id = ? ORDER BY move_index ASC', [attemptId])
    },

    async listBadMovesByAttempt(attemptId) {
      return client.queryAll('SELECT * FROM training_bad_moves WHERE attempt_id = ? ORDER BY move_index ASC', [attemptId])
    },

    // Transaction passthrough
    transaction(fn) { return client.transaction(fn) },

    // Stubs for legacy functions the repository references but we don't test
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
    async upsertReviewSchedule() {},
    async getDashboardSummary() { return {} },
    async loadTrainingTask() { return null },
    async findTaskBySource() { return null },
    async updateTrainingTask() {},
    async loadTrainingAttempt() { return null },
    async listTrainingAttemptsByTask() { return [] },
    async updateTrainingAttempt() {},
    async listIncompleteTrainingAttempts() { return [] },
    async updateMoveEvaluation() {},
    async markTrainingBadMoveAsNotBad() {},
  }

  const repo = createTrainingRepository(dbLike)
  return { client, trainingApi, repo, dbLike, rawDb }
}

describe('Recall Repository Integration (real SQLite)', () => {
  let repo, helpers

  beforeEach(async () => {
    const setup = await createTestSetup()
    repo = setup.repo
    helpers = {
      seedTask: setup.dbLike.createTrainingTask.bind(setup.dbLike),
      seedAttempt: setup.dbLike.createTrainingAttempt.bind(setup.dbLike),
      seedBadMove: setup.dbLike.createTrainingBadMove.bind(setup.dbLike),
      seedEvaluation: setup.dbLike.createMoveEvaluation.bind(setup.dbLike),
      loadBadMoveRaw: setup.dbLike.loadTrainingBadMove.bind(setup.dbLike),
    }
    // Seed prerequisites
    await helpers.seedTask({ id: 'task_1' })
    await helpers.seedAttempt({ id: 'attempt_1', taskId: 'task_1' })
  })

  // --- RecallSession ---

  describe('RecallSession round-trip', () => {
    it('create and load recall session with JSON fields', async () => {
      const session = await repo.createRecallSession({
        id: 'rs_1',
        taskId: 'task_1',
        tabId: 'tab_1',
        type: 'line_recall',
        source: { kind: 'attempt', attemptId: 'attempt_1' },
        startMove: 0,
        endMove: undefined,
        expectedMoves: ['D4', 'Q16', 'C3'],
        currentMoveIndex: 0,
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      assert.strictEqual(session.id, 'rs_1')
      assert.strictEqual(session.taskId, 'task_1')
      assert.strictEqual(session.tabId, 'tab_1')
      assert.strictEqual(session.type, 'line_recall')
      assert.deepStrictEqual(session.source, { kind: 'attempt', attemptId: 'attempt_1' })
      assert.deepStrictEqual(session.expectedMoves, ['D4', 'Q16', 'C3'])
      assert.strictEqual(session.currentMoveIndex, 0)
      assert.strictEqual(session.completed, false)
      assert.strictEqual(session.completedAt, undefined)

      const loaded = await repo.loadRecallSession('rs_1')
      assert.strictEqual(loaded.id, 'rs_1')
      assert.deepStrictEqual(loaded.source, { kind: 'attempt', attemptId: 'attempt_1' })
      assert.deepStrictEqual(loaded.expectedMoves, ['D4', 'Q16', 'C3'])
    })

    it('loads null for missing session', async () => {
      const result = await repo.loadRecallSession('nonexistent')
      assert.strictEqual(result, null)
    })

    it('update recall session advances index and marks completed', async () => {
      await repo.createRecallSession({
        id: 'rs_2',
        taskId: 'task_1',
        type: 'line_recall',
        source: { kind: 'attempt', attemptId: 'attempt_1' },
        startMove: 0,
        expectedMoves: ['D4'],
        currentMoveIndex: 0,
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      await repo.updateRecallSession('rs_2', { currentMoveIndex: 1 })
      let loaded = await repo.loadRecallSession('rs_2')
      assert.strictEqual(loaded.currentMoveIndex, 1)

      const now = '2026-01-02T00:00:00.000Z'
      await repo.updateRecallSession('rs_2', { completed: true, completedAt: now })
      loaded = await repo.loadRecallSession('rs_2')
      assert.strictEqual(loaded.completed, true)
      assert.strictEqual(loaded.completedAt, now)
    })

    it('handles undefined/null mapping: tabId undefined → null → undefined', async () => {
      await repo.createRecallSession({
        id: 'rs_3',
        taskId: 'task_1',
        type: 'line_recall',
        source: { kind: 'game', gameId: 'g1' },
        startMove: 0,
        expectedMoves: [],
        currentMoveIndex: 0,
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      const loaded = await repo.loadRecallSession('rs_3')
      assert.strictEqual(loaded.tabId, undefined)
      assert.strictEqual(loaded.endMove, undefined)
      assert.strictEqual(loaded.completedAt, undefined)
    })
  })

  // --- RecallAttempt ---

  describe('RecallAttempt round-trip', () => {
    it('create and list recall attempts', async () => {
      await repo.createRecallSession({
        id: 'rs_10',
        taskId: 'task_1',
        type: 'line_recall',
        source: { kind: 'attempt', attemptId: 'attempt_1' },
        startMove: 0,
        expectedMoves: ['D4', 'Q16'],
        currentMoveIndex: 0,
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      const ra = await repo.createRecallAttempt({
        id: 'ra_1',
        recallSessionId: 'rs_10',
        moveNumber: 0,
        expectedMove: 'D4',
        userMove: 'D4',
        isCorrect: true,
        hintLevelUsed: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      assert.strictEqual(ra.id, 'ra_1')
      assert.strictEqual(ra.recallSessionId, 'rs_10')
      assert.strictEqual(ra.isCorrect, true)

      const attempts = await repo.listRecallAttempts('rs_10')
      assert.strictEqual(attempts.length, 1)
      assert.strictEqual(attempts[0].isCorrect, true)
    })

    it('boolean coercion: isCorrect 0 → false', async () => {
      await repo.createRecallSession({
        id: 'rs_11',
        taskId: 'task_1',
        type: 'line_recall',
        source: { kind: 'attempt', attemptId: 'attempt_1' },
        startMove: 0,
        expectedMoves: ['D4'],
        currentMoveIndex: 0,
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      const ra = await repo.createRecallAttempt({
        id: 'ra_2',
        recallSessionId: 'rs_11',
        moveNumber: 0,
        expectedMove: 'D4',
        userMove: 'E5',
        isCorrect: false,
        hintLevelUsed: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      assert.strictEqual(ra.isCorrect, false)
    })

    it('lists multiple attempts ordered by moveNumber', async () => {
      await repo.createRecallSession({
        id: 'rs_12',
        taskId: 'task_1',
        type: 'line_recall',
        source: { kind: 'attempt', attemptId: 'attempt_1' },
        startMove: 0,
        expectedMoves: ['D4', 'Q16'],
        currentMoveIndex: 0,
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      await repo.createRecallAttempt({
        id: 'ra_3', recallSessionId: 'rs_12',
        moveNumber: 0, expectedMove: 'D4', userMove: 'D4',
        isCorrect: true, hintLevelUsed: 0, createdAt: '2026-01-01T00:00:00.000Z',
      })
      await repo.createRecallAttempt({
        id: 'ra_4', recallSessionId: 'rs_12',
        moveNumber: 1, expectedMove: 'Q16', userMove: 'E5',
        isCorrect: false, hintLevelUsed: 0, createdAt: '2026-01-01T00:00:00.000Z',
      })

      const attempts = await repo.listRecallAttempts('rs_12')
      assert.strictEqual(attempts.length, 2)
      assert.strictEqual(attempts[0].moveNumber, 0)
      assert.strictEqual(attempts[1].moveNumber, 1)
    })
  })

  // --- RecallCheckpoint ---

  describe('RecallCheckpoint round-trip', () => {
    it('create and load checkpoint with JSON array fields', async () => {
      await helpers.seedBadMove({
        id: 'bm_1', moveEvaluationId: 'ev_1', attemptId: 'attempt_1',
        taskId: 'task_1', moveIndex: 5, severity: 'major', punishSide: 'white',
      })

      await repo.createRecallSession({
        id: 'rs_20',
        taskId: 'task_1',
        type: 'line_recall',
        source: { kind: 'attempt', attemptId: 'attempt_1' },
        startMove: 0,
        expectedMoves: ['D4'],
        currentMoveIndex: 0,
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      const cp = await repo.createRecallCheckpoint({
        id: 'cp_1',
        recallSessionId: 'rs_20',
        badMoveId: 'bm_1',
        status: 'pending_correction',
        userCorrectionLine: [],
        aiCandidateLines: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      assert.strictEqual(cp.id, 'cp_1')
      assert.strictEqual(cp.status, 'pending_correction')
      assert.deepStrictEqual(cp.userCorrectionLine, [])
      assert.deepStrictEqual(cp.aiCandidateLines, [])
      assert.strictEqual(cp.userCommentId, undefined)
      assert.strictEqual(cp.completedAt, undefined)

      const loaded = await repo.loadRecallCheckpoint('cp_1')
      assert.strictEqual(loaded.id, 'cp_1')
      assert.deepStrictEqual(loaded.userCorrectionLine, [])
    })

    it('update checkpoint: status, correction line, AI lines, comment', async () => {
      await helpers.seedBadMove({
        id: 'bm_2', moveEvaluationId: 'ev_2', attemptId: 'attempt_1',
        taskId: 'task_1', moveIndex: 3, severity: 'severe', punishSide: 'black',
      })

      await repo.createRecallSession({
        id: 'rs_21',
        taskId: 'task_1',
        type: 'line_recall',
        source: { kind: 'attempt', attemptId: 'attempt_1' },
        startMove: 0,
        expectedMoves: ['D4'],
        currentMoveIndex: 0,
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      await repo.createRecallCheckpoint({
        id: 'cp_2',
        recallSessionId: 'rs_21',
        badMoveId: 'bm_2',
        status: 'pending_correction',
        userCorrectionLine: [],
        aiCandidateLines: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      await repo.updateRecallCheckpoint('cp_2', {
        status: 'ai_revealed',
        userCorrectionLine: ['E5', 'F6'],
        aiCandidateLines: [{ label: 'AI recommended', moves: ['D4', 'C3'], source: 'engine' }],
      })

      let loaded = await repo.loadRecallCheckpoint('cp_2')
      assert.strictEqual(loaded.status, 'ai_revealed')
      assert.deepStrictEqual(loaded.userCorrectionLine, ['E5', 'F6'])
      assert.strictEqual(loaded.aiCandidateLines.length, 1)
      assert.strictEqual(loaded.aiCandidateLines[0].label, 'AI recommended')

      const now = '2026-01-02T00:00:00.000Z'
      await repo.updateRecallCheckpoint('cp_2', {
        status: 'commented',
        userCommentId: 'mc_1',
        completedAt: now,
      })

      loaded = await repo.loadRecallCheckpoint('cp_2')
      assert.strictEqual(loaded.status, 'commented')
      assert.strictEqual(loaded.userCommentId, 'mc_1')
      assert.strictEqual(loaded.completedAt, now)
    })

    it('list checkpoints by session', async () => {
      await helpers.seedBadMove({
        id: 'bm_3a', moveEvaluationId: 'ev_3a', attemptId: 'attempt_1',
        taskId: 'task_1', moveIndex: 1, severity: 'major', punishSide: 'white',
      })
      await helpers.seedBadMove({
        id: 'bm_3b', moveEvaluationId: 'ev_3b', attemptId: 'attempt_1',
        taskId: 'task_1', moveIndex: 3, severity: 'major', punishSide: 'white',
      })

      await repo.createRecallSession({
        id: 'rs_22',
        taskId: 'task_1',
        type: 'line_recall',
        source: { kind: 'attempt', attemptId: 'attempt_1' },
        startMove: 0,
        expectedMoves: ['D4'],
        currentMoveIndex: 0,
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      await repo.createRecallCheckpoint({
        id: 'cp_3a', recallSessionId: 'rs_22', badMoveId: 'bm_3a',
        status: 'pending_correction', userCorrectionLine: [], aiCandidateLines: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      })
      await repo.createRecallCheckpoint({
        id: 'cp_3b', recallSessionId: 'rs_22', badMoveId: 'bm_3b',
        status: 'pending_correction', userCorrectionLine: [], aiCandidateLines: [],
        createdAt: '2026-01-01T00:01:00.000Z',
      })

      const checkpoints = await repo.listCheckpointsByRecallSession('rs_22')
      assert.strictEqual(checkpoints.length, 2)
      assert.strictEqual(checkpoints[0].id, 'cp_3a')
      assert.strictEqual(checkpoints[1].id, 'cp_3b')
    })

    it('loads null for missing checkpoint', async () => {
      const result = await repo.loadRecallCheckpoint('nonexistent')
      assert.strictEqual(result, null)
    })
  })

  // --- MoveComment ---

  describe('MoveComment round-trip', () => {
    it('create and load comment with JSON fields', async () => {
      const comment = await repo.createMoveComment({
        id: 'mc_1',
        target: { kind: 'checkpoint', checkpointId: 'cp_1' },
        content: 'This was a bad peep',
        templateAnswers: [
          { question: 'Why was this bad?', answer: 'It wasted a move' },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })

      assert.strictEqual(comment.id, 'mc_1')
      assert.deepStrictEqual(comment.target, { kind: 'checkpoint', checkpointId: 'cp_1' })
      assert.strictEqual(comment.content, 'This was a bad peep')
      assert.strictEqual(comment.templateAnswers.length, 1)
      assert.strictEqual(comment.templateAnswers[0].question, 'Why was this bad?')

      const loaded = await repo.loadMoveComment('mc_1')
      assert.deepStrictEqual(loaded.target, { kind: 'checkpoint', checkpointId: 'cp_1' })
    })

    it('templateAnswers undefined when not provided', async () => {
      const comment = await repo.createMoveComment({
        id: 'mc_2',
        target: { kind: 'bad_move', badMoveId: 'bm_1' },
        content: 'Note without template',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })

      assert.strictEqual(comment.templateAnswers, undefined)

      const loaded = await repo.loadMoveComment('mc_2')
      assert.strictEqual(loaded.templateAnswers, undefined)
    })

    it('update comment content', async () => {
      await repo.createMoveComment({
        id: 'mc_3',
        target: { kind: 'checkpoint', checkpointId: 'cp_1' },
        content: 'Original',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })

      await repo.updateMoveComment('mc_3', { content: 'Updated' })

      const loaded = await repo.loadMoveComment('mc_3')
      assert.strictEqual(loaded.content, 'Updated')
    })

    it('loads null for missing comment', async () => {
      const result = await repo.loadMoveComment('nonexistent')
      assert.strictEqual(result, null)
    })
  })

  // --- BadMove update (checkpoint link-back) ---

  describe('BadMove updateBadMove', () => {
    it('links recallCheckpointId to bad move', async () => {
      await helpers.seedBadMove({
        id: 'bm_10', moveEvaluationId: 'ev_10', attemptId: 'attempt_1',
        taskId: 'task_1', moveIndex: 2, severity: 'major', punishSide: 'white',
      })

      await repo.updateBadMove('bm_10', { recallCheckpointId: 'cp_linked' })

      const row = await helpers.loadBadMoveRaw('bm_10')
      assert.strictEqual(row.recall_checkpoint_id, 'cp_linked')
    })
  })
})
