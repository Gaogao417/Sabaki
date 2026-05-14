import type {
  TrainingTask,
  TrainingTaskSource,
  TrainingAttempt,
  MoveEvaluation,
  BadMove,
  RecallSession,
  RecallAttempt,
  RecallCheckpoint,
  Problem,
  MoveComment,
  ReviewSchedule,
} from '../types/index'

type Db = typeof window.sabaki.db

export type TrainingRepository = {
  // --- Existing legacy table wrappers ---

  // Games
  saveGame(game: Record<string, unknown>): Promise<Record<string, unknown>>
  getGame(id: string): Promise<Record<string, unknown> | null>
  getRecentGames(limit?: number): Promise<Record<string, unknown>[]>

  // Recall (legacy)
  saveRecallSession(session: Record<string, unknown>): Promise<Record<string, unknown>>
  saveRecallAttempts(attempts: Record<string, unknown>[]): Promise<void>

  // Problems (legacy)
  saveProblem(problem: Record<string, unknown>): Promise<Record<string, unknown>>
  getProblem(id: string): Promise<Record<string, unknown> | null>
  getProblemsByStatus(status: string, limit?: number): Promise<Record<string, unknown>[]>

  // Problem Attempts (legacy)
  saveProblemAttempt(attempt: Record<string, unknown>): Promise<Record<string, unknown>>

  // Bad Moves (legacy)
  saveBadMove(badMove: Record<string, unknown>): Promise<Record<string, unknown>>
  updateBadMoveGeneratedProblem(badMoveId: string, problemId: string): Promise<void>

  // Review (legacy)
  getDueReviews(): Promise<Record<string, unknown>[]>
  upsertReviewSchedule(item: Record<string, unknown>): Promise<void>
  getDashboardSummary(): Promise<Record<string, unknown>>

  // --- New training domain tables ---

  // Task
  createTask(task: TrainingTask): Promise<TrainingTask>
  loadTask(taskId: string): Promise<TrainingTask | null>
  findTaskBySource(source: TrainingTaskSource): Promise<TrainingTask | null>
  updateTask(taskId: string, patch: Partial<TrainingTask>): Promise<void>

  // Attempt
  createAttempt(attempt: TrainingAttempt): Promise<TrainingAttempt>
  loadAttempt(attemptId: string): Promise<TrainingAttempt | null>
  listAttemptsByTask(taskId: string): Promise<TrainingAttempt[]>
  updateAttempt(attemptId: string, patch: Partial<TrainingAttempt>): Promise<void>

  // MoveEvaluation
  createMoveEvaluation(evaluation: MoveEvaluation): Promise<MoveEvaluation>
  updateMoveEvaluation(evaluationId: string, patch: Partial<MoveEvaluation>): Promise<void>
  listMoveEvaluationsByAttempt(attemptId: string): Promise<MoveEvaluation[]>

  // BadMove (new)
  createBadMove(badMove: BadMove): Promise<BadMove>
  loadBadMove(badMoveId: string): Promise<BadMove | null>
  listBadMovesByAttempt(attemptId: string): Promise<BadMove[]>
  listBadMovesByTask(taskId: string): Promise<BadMove[]>
  markBadMoveAsNotBad(badMoveId: string): Promise<void>

  // Recall (new)
  createRecallSession(session: RecallSession): Promise<RecallSession>
  loadRecallSession(sessionId: string): Promise<RecallSession | null>
  updateRecallSession(sessionId: string, patch: Partial<RecallSession>): Promise<void>
  createRecallAttempt(attempt: RecallAttempt): Promise<RecallAttempt>
  listRecallAttempts(sessionId: string): Promise<RecallAttempt[]>

  // Checkpoint
  createRecallCheckpoint(checkpoint: RecallCheckpoint): Promise<RecallCheckpoint>
  loadRecallCheckpoint(checkpointId: string): Promise<RecallCheckpoint | null>
  updateRecallCheckpoint(checkpointId: string, patch: Partial<RecallCheckpoint>): Promise<void>
  listCheckpointsByRecallSession(sessionId: string): Promise<RecallCheckpoint[]>

  // Problem (new)
  createProblem(problem: Problem): Promise<Problem>
  loadProblem(problemId: string): Promise<Problem | null>
  updateProblem(problemId: string, patch: Partial<Problem>): Promise<void>

  // Comment
  createMoveComment(comment: MoveComment): Promise<MoveComment>
  loadMoveComment(commentId: string): Promise<MoveComment | null>
  updateMoveComment(commentId: string, patch: Partial<MoveComment>): Promise<void>

  // Review (new)
  createReviewSchedule(schedule: ReviewSchedule): Promise<ReviewSchedule>
  listDueReviewItems(now: string): Promise<ReviewSchedule[]>
  updateReviewSchedule(id: string, patch: Partial<ReviewSchedule>): Promise<void>

  // Recovery
  listIncompleteAttempts(): Promise<TrainingAttempt[]>
  listIncompleteRecallSessions(): Promise<RecallSession[]>
  listExpiredPendingMoveEvaluations(now: string): Promise<MoveEvaluation[]>

  // Transaction
  transaction<T>(fn: () => Promise<T>): Promise<T>
}

export function createTrainingRepository(db: Db): TrainingRepository {
  if (!db) throw new Error('createTrainingRepository requires db')

  // --- Existing legacy table wrappers ---

  async function saveGame(game: Record<string, unknown>) {
    return db.saveGame(game)
  }

  async function getGame(id: string) {
    return db.getGame(id)
  }

  async function getRecentGames(limit = 20) {
    return db.getRecentGames(limit)
  }

  async function saveRecallSession(session: Record<string, unknown>) {
    return db.saveRecallSession(session)
  }

  async function saveRecallAttempts(attempts: Record<string, unknown>[]) {
    await db.saveRecallAttempts(attempts)
  }

  async function saveProblem(problem: Record<string, unknown>) {
    return db.saveProblem(problem)
  }

  async function getProblem(id: string) {
    return db.getProblem(id)
  }

  async function getProblemsByStatus(status: string, limit = 50) {
    return db.getProblemsByStatus(status, limit)
  }

  async function saveProblemAttempt(attempt: Record<string, unknown>) {
    return db.saveProblemAttempt(attempt)
  }

  async function saveBadMove(badMove: Record<string, unknown>) {
    return db.saveBadMove(badMove)
  }

  async function updateBadMoveGeneratedProblem(badMoveId: string, problemId: string) {
    await db.updateBadMoveGeneratedProblem(badMoveId, problemId)
  }

  async function getDueReviews() {
    return db.getDueReviews()
  }

  async function upsertReviewSchedule(item: Record<string, unknown>) {
    await db.upsertReviewSchedule(item)
  }

  async function getDashboardSummary() {
    return db.getDashboardSummary()
  }

  // --- New training domain (Phase 2: connected to DB) ---

  async function createTask(task: TrainingTask): Promise<TrainingTask> {
    const row = await db.createTrainingTask(task)
    return mapTaskRow(row)
  }

  async function loadTask(taskId: string): Promise<TrainingTask | null> {
    const row = await db.loadTrainingTask(taskId)
    return row ? mapTaskRow(row) : null
  }

  async function findTaskBySource(source: TrainingTaskSource): Promise<TrainingTask | null> {
    const row = await db.findTrainingTaskBySource(source)
    return row ? mapTaskRow(row) : null
  }

  async function updateTask(taskId: string, patch: Partial<TrainingTask>): Promise<void> {
    const mapped: Record<string, unknown> = {}
    if (patch.kind !== undefined) mapped.kind = patch.kind
    if (patch.source !== undefined) mapped.source = patch.source
    if (patch.rootPositionSgf !== undefined) mapped.rootPositionSgf = patch.rootPositionSgf
    if (patch.sideToMove !== undefined) mapped.sideToMove = patch.sideToMove
    if (patch.title !== undefined) mapped.title = patch.title
    await db.updateTrainingTask(taskId, mapped)
  }

  async function createAttempt(attempt: TrainingAttempt): Promise<TrainingAttempt> {
    const row = await db.createTrainingAttempt(attempt)
    return mapAttemptRow(row)
  }

  async function loadAttempt(attemptId: string): Promise<TrainingAttempt | null> {
    const row = await db.loadTrainingAttempt(attemptId)
    return row ? mapAttemptRow(row) : null
  }

  async function listAttemptsByTask(taskId: string): Promise<TrainingAttempt[]> {
    const rows = await db.listTrainingAttemptsByTask(taskId)
    return rows.map(mapAttemptRow)
  }

  async function updateAttempt(attemptId: string, patch: Partial<TrainingAttempt>): Promise<void> {
    const mapped: Record<string, unknown> = {}
    if (patch.tabId !== undefined) mapped.tabId = patch.tabId
    if (patch.submittedAt !== undefined) mapped.submittedAt = patch.submittedAt
    if (patch.completedAt !== undefined) mapped.completedAt = patch.completedAt
    if (patch.userLine !== undefined) mapped.userLine = patch.userLine
    if (patch.status !== undefined) mapped.status = patch.status
    if (patch.result !== undefined) mapped.result = patch.result
    if (patch.hintLevelUsed !== undefined) mapped.hintLevelUsed = patch.hintLevelUsed
    if (patch.recallCompleted !== undefined) mapped.recallCompleted = patch.recallCompleted
    if (patch.analysisOpened !== undefined) mapped.analysisOpened = patch.analysisOpened
    await db.updateTrainingAttempt(attemptId, mapped)
  }

  async function createMoveEvaluation(evaluation: MoveEvaluation): Promise<MoveEvaluation> {
    const row = await db.createMoveEvaluation(evaluation)
    return mapEvaluationRow(row)
  }

  async function updateMoveEvaluation(evaluationId: string, patch: Partial<MoveEvaluation>): Promise<void> {
    await db.updateMoveEvaluation(evaluationId, patch as Record<string, unknown>)
  }

  async function listMoveEvaluationsByAttempt(attemptId: string): Promise<MoveEvaluation[]> {
    const rows = await db.listMoveEvaluationsByAttempt(attemptId)
    return rows.map(mapEvaluationRow)
  }

  // --- BadMove (new domain) ---

  async function createBadMove(badMove: BadMove): Promise<BadMove> {
    const row = await db.createTrainingBadMove({
      id: badMove.id,
      moveEvaluationId: badMove.moveEvaluationId,
      attemptId: badMove.attemptId,
      taskId: badMove.taskId,
      moveIndex: badMove.moveIndex,
      severity: badMove.severity,
      punishSide: badMove.punishSide,
      positionBeforeSgf: undefined,
      positionAfterSgf: undefined,
    })
    return mapBadMoveRow(row)
  }

  async function loadBadMove(badMoveId: string): Promise<BadMove | null> {
    const row = await db.loadTrainingBadMove(badMoveId)
    return row ? mapBadMoveRow(row) : null
  }

  async function listBadMovesByAttempt(attemptId: string): Promise<BadMove[]> {
    const rows = await db.listTrainingBadMovesByAttempt(attemptId)
    return rows.map(mapBadMoveRow)
  }

  async function listBadMovesByTask(taskId: string): Promise<BadMove[]> {
    const rows = await db.listTrainingBadMovesByTask(taskId)
    return rows.map(mapBadMoveRow)
  }

  async function markBadMoveAsNotBad(badMoveId: string): Promise<void> {
    await db.markTrainingBadMoveAsNotBad(badMoveId)
  }

  // --- Remaining stubs (Phase 3+) ---

  function _notImplemented(method: string): never {
    throw new Error(`trainingRepository.${method}: not yet implemented (post-Phase 2 stub)`)
  }

  function createRecallSession(session: RecallSession): Promise<RecallSession> {
    _notImplemented('createRecallSession')
  }

  function loadRecallSession(sessionId: string): Promise<RecallSession | null> {
    _notImplemented('loadRecallSession')
  }

  function updateRecallSession(sessionId: string, patch: Partial<RecallSession>): Promise<void> {
    _notImplemented('updateRecallSession')
  }

  function createRecallAttempt(attempt: RecallAttempt): Promise<RecallAttempt> {
    _notImplemented('createRecallAttempt')
  }

  function listRecallAttempts(sessionId: string): Promise<RecallAttempt[]> {
    _notImplemented('listRecallAttempts')
  }

  function createRecallCheckpoint(checkpoint: RecallCheckpoint): Promise<RecallCheckpoint> {
    _notImplemented('createRecallCheckpoint')
  }

  function loadRecallCheckpoint(checkpointId: string): Promise<RecallCheckpoint | null> {
    _notImplemented('loadRecallCheckpoint')
  }

  function updateRecallCheckpoint(checkpointId: string, patch: Partial<RecallCheckpoint>): Promise<void> {
    _notImplemented('updateRecallCheckpoint')
  }

  function listCheckpointsByRecallSession(sessionId: string): Promise<RecallCheckpoint[]> {
    _notImplemented('listCheckpointsByRecallSession')
  }

  function createProblem(problem: Problem): Promise<Problem> {
    _notImplemented('createProblem')
  }

  function loadProblem(problemId: string): Promise<Problem | null> {
    _notImplemented('loadProblem')
  }

  function updateProblem(problemId: string, patch: Partial<Problem>): Promise<void> {
    _notImplemented('updateProblem')
  }

  function createMoveComment(comment: MoveComment): Promise<MoveComment> {
    _notImplemented('createMoveComment')
  }

  function loadMoveComment(commentId: string): Promise<MoveComment | null> {
    _notImplemented('loadMoveComment')
  }

  function updateMoveComment(commentId: string, patch: Partial<MoveComment>): Promise<void> {
    _notImplemented('updateMoveComment')
  }

  function createReviewSchedule(schedule: ReviewSchedule): Promise<ReviewSchedule> {
    _notImplemented('createReviewSchedule')
  }

  function listDueReviewItems(now: string): Promise<ReviewSchedule[]> {
    _notImplemented('listDueReviewItems')
  }

  function updateReviewSchedule(id: string, patch: Partial<ReviewSchedule>): Promise<void> {
    _notImplemented('updateReviewSchedule')
  }

  async function listIncompleteAttempts(): Promise<TrainingAttempt[]> {
    const rows = await db.listIncompleteTrainingAttempts()
    return rows.map(mapAttemptRow)
  }

  function listIncompleteRecallSessions(): Promise<RecallSession[]> {
    _notImplemented('listIncompleteRecallSessions')
  }

  async function listExpiredPendingMoveEvaluations(now: string): Promise<MoveEvaluation[]> {
    const rows = await db.listExpiredPendingMoveEvaluations(now)
    return rows.map(mapEvaluationRow)
  }

  async function transaction<T>(fn: () => Promise<T>): Promise<T> {
    // IPC does not support real transactions; sequential execution is safe for MVP
    return fn()
  }

  // --- Row mappers ---

  function mapTaskRow(row: Record<string, unknown>): TrainingTask {
    return {
      id: row.id as string,
      kind: row.kind as TrainingTask['kind'],
      source: typeof row.source === 'string' ? JSON.parse(row.source) : row.source,
      rootPositionSgf: row.rootPositionSgf as string,
      sideToMove: row.sideToMove as 'black' | 'white' | undefined,
      title: row.title as string | undefined,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
    }
  }

  function mapAttemptRow(row: Record<string, unknown>): TrainingAttempt {
    return {
      id: row.id as string,
      taskId: row.taskId as string,
      tabId: row.tabId as string | undefined,
      startedAt: row.startedAt as string,
      submittedAt: row.submittedAt as string | undefined,
      completedAt: row.completedAt as string | undefined,
      rootPositionSgf: row.rootPositionSgf as string,
      userLine: typeof row.userLine === 'string' ? JSON.parse(row.userLine) : (row.userLine as string[]),
      status: row.status as TrainingAttempt['status'],
      result: row.result as TrainingAttempt['result'],
      hintLevelUsed: (row.hintLevelUsed as number) ?? 0,
      recallCompleted: !!row.recallCompleted,
      analysisOpened: !!row.analysisOpened,
    }
  }

  function mapEvaluationRow(row: Record<string, unknown>): MoveEvaluation {
    return {
      id: row.id as string,
      attemptId: row.attemptId as string,
      moveIndex: row.moveIndex as number,
      move: row.move as string,
      positionBeforeHash: row.positionBeforeHash as string | undefined,
      positionAfterHash: row.positionAfterHash as string | undefined,
      positionBeforeSgf: row.positionBeforeSgf as string | undefined,
      positionAfterSgf: row.positionAfterSgf as string | undefined,
      beforeScoreLead: row.beforeScoreLead as number | undefined,
      afterScoreLead: row.afterScoreLead as number | undefined,
      scoreDrop: row.scoreDrop as number | undefined,
      beforeWinrate: row.beforeWinrate as number | undefined,
      afterWinrate: row.afterWinrate as number | undefined,
      winrateDrop: row.winrateDrop as number | undefined,
      engineSuggestedMove: row.engineSuggestedMove as string | undefined,
      engineSuggestedLine: typeof row.engineSuggestedLine === 'string'
        ? JSON.parse(row.engineSuggestedLine)
        : (row.engineSuggestedLine as string[] | undefined),
      status: row.status as MoveEvaluation['status'],
      createdAt: row.createdAt as string,
      evaluatedAt: row.evaluatedAt as string | undefined,
    }
  }

  function mapBadMoveRow(row: Record<string, unknown>): BadMove {
    return {
      id: row.id as string,
      moveEvaluationId: row.moveEvaluationId as string,
      attemptId: row.attemptId as string,
      taskId: row.taskId as string,
      moveIndex: row.moveIndex as number,
      severity: row.severity as BadMove['severity'],
      punishSide: row.punishSide as 'black' | 'white',
      positionBeforeSgf: row.positionBeforeSgf as string | undefined,
      positionAfterSgf: row.positionAfterSgf as string | undefined,
      userMarkedAsNotBad: row.userMarkedAsNotBad as boolean | undefined,
      generatedProblemId: row.generatedProblemId as string | undefined,
      recallCheckpointId: row.recallCheckpointId as string | undefined,
      createdAt: row.createdAt as string,
    }
  }

  return {
    saveGame, getGame, getRecentGames,
    saveRecallSession, saveRecallAttempts,
    saveProblem, getProblem, getProblemsByStatus,
    saveProblemAttempt,
    saveBadMove, updateBadMoveGeneratedProblem,
    getDueReviews, upsertReviewSchedule, getDashboardSummary,
    createTask, loadTask, findTaskBySource, updateTask,
    createAttempt, loadAttempt, listAttemptsByTask, updateAttempt,
    createMoveEvaluation, updateMoveEvaluation, listMoveEvaluationsByAttempt,
    createBadMove, loadBadMove, listBadMovesByAttempt, listBadMovesByTask, markBadMoveAsNotBad,
    createRecallSession, loadRecallSession, updateRecallSession, createRecallAttempt, listRecallAttempts,
    createRecallCheckpoint, loadRecallCheckpoint, updateRecallCheckpoint, listCheckpointsByRecallSession,
    createProblem, loadProblem, updateProblem,
    createMoveComment, loadMoveComment, updateMoveComment,
    createReviewSchedule, listDueReviewItems, updateReviewSchedule,
    listIncompleteAttempts, listIncompleteRecallSessions, listExpiredPendingMoveEvaluations,
    transaction,
  }
}
