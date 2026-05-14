import type {
  TrainingTask,
  TrainingTaskSource,
  TrainingAttempt,
  TrainingAttemptResult,
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

  // --- New training domain tables (stubs for Phase 0) ---

  // Task
  createTask(task: TrainingTask): Promise<TrainingTask>
  loadTask(taskId: string): Promise<TrainingTask | null>
  findTaskBySource(source: TrainingTaskSource): Promise<TrainingTask | null>
  updateTask(taskId: string, patch: Partial<TrainingTask>): Promise<void>

  // Attempt (new)
  createAttempt(attempt: TrainingAttempt): Promise<TrainingAttempt>
  loadAttempt(attemptId: string): Promise<TrainingAttempt | null>
  listAttemptsByTask(taskId: string): Promise<TrainingAttempt[]>
  updateAttempt(attemptId: string, patch: Partial<TrainingAttempt>): Promise<void>

  // MoveEvaluation (new)
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

  // Checkpoint (new)
  createRecallCheckpoint(checkpoint: RecallCheckpoint): Promise<RecallCheckpoint>
  loadRecallCheckpoint(checkpointId: string): Promise<RecallCheckpoint | null>
  updateRecallCheckpoint(checkpointId: string, patch: Partial<RecallCheckpoint>): Promise<void>
  listCheckpointsByRecallSession(sessionId: string): Promise<RecallCheckpoint[]>

  // Problem (new)
  createProblem(problem: Problem): Promise<Problem>
  loadProblem(problemId: string): Promise<Problem | null>
  updateProblem(problemId: string, patch: Partial<Problem>): Promise<void>

  // Comment (new)
  createMoveComment(comment: MoveComment): Promise<MoveComment>
  loadMoveComment(commentId: string): Promise<MoveComment | null>
  updateMoveComment(commentId: string, patch: Partial<MoveComment>): Promise<void>

  // Review (new)
  createReviewSchedule(schedule: ReviewSchedule): Promise<ReviewSchedule>
  listDueReviewItems(now: string): Promise<ReviewSchedule[]>
  updateReviewSchedule(id: string, patch: Partial<ReviewSchedule>): Promise<void>

  // Recovery (new)
  listIncompleteAttempts(): Promise<TrainingAttempt[]>
  listIncompleteRecallSessions(): Promise<RecallSession[]>
  listExpiredPendingMoveEvaluations(now: string): Promise<MoveEvaluation[]>

  // Transaction
  transaction<T>(fn: () => Promise<T>): Promise<T>
}

export function createTrainingRepository(db?: Db): TrainingRepository {
  const _db = db ?? window?.sabaki?.db

  // --- Existing legacy table wrappers ---

  async function saveGame(game: Record<string, unknown>) {
    return _db.saveGame(game)
  }

  async function getGame(id: string) {
    return _db.getGame(id)
  }

  async function getRecentGames(limit = 20) {
    return _db.getRecentGames(limit)
  }

  async function saveRecallSession(session: Record<string, unknown>) {
    return _db.saveRecallSession(session)
  }

  async function saveRecallAttempts(attempts: Record<string, unknown>[]) {
    await _db.saveRecallAttempts(attempts)
  }

  async function saveProblem(problem: Record<string, unknown>) {
    return _db.saveProblem(problem)
  }

  async function getProblem(id: string) {
    return _db.getProblem(id)
  }

  async function getProblemsByStatus(status: string, limit = 50) {
    return _db.getProblemsByStatus(status, limit)
  }

  async function saveProblemAttempt(attempt: Record<string, unknown>) {
    return _db.saveProblemAttempt(attempt)
  }

  async function saveBadMove(badMove: Record<string, unknown>) {
    return _db.saveBadMove(badMove)
  }

  async function updateBadMoveGeneratedProblem(badMoveId: string, problemId: string) {
    await _db.updateBadMoveGeneratedProblem(badMoveId, problemId)
  }

  async function getDueReviews() {
    return _db.getDueReviews()
  }

  async function upsertReviewSchedule(item: Record<string, unknown>) {
    await _db.upsertReviewSchedule(item)
  }

  async function getDashboardSummary() {
    return _db.getDashboardSummary()
  }

  // --- New training domain stubs ---
  // These will be connected to new DB tables in later phases.

  function _notImplemented(method: string): never {
    throw new Error(`trainingRepository.${method}: not yet implemented (Phase 0 stub)`)
  }

  function createTask(task: TrainingTask): Promise<TrainingTask> {
    _notImplemented('createTask')
  }

  function loadTask(taskId: string): Promise<TrainingTask | null> {
    _notImplemented('loadTask')
  }

  function findTaskBySource(source: TrainingTaskSource): Promise<TrainingTask | null> {
    _notImplemented('findTaskBySource')
  }

  function updateTask(taskId: string, patch: Partial<TrainingTask>): Promise<void> {
    _notImplemented('updateTask')
  }

  function createAttempt(attempt: TrainingAttempt): Promise<TrainingAttempt> {
    _notImplemented('createAttempt')
  }

  function loadAttempt(attemptId: string): Promise<TrainingAttempt | null> {
    _notImplemented('loadAttempt')
  }

  function listAttemptsByTask(taskId: string): Promise<TrainingAttempt[]> {
    _notImplemented('listAttemptsByTask')
  }

  function updateAttempt(attemptId: string, patch: Partial<TrainingAttempt>): Promise<void> {
    _notImplemented('updateAttempt')
  }

  function createMoveEvaluation(evaluation: MoveEvaluation): Promise<MoveEvaluation> {
    _notImplemented('createMoveEvaluation')
  }

  function updateMoveEvaluation(evaluationId: string, patch: Partial<MoveEvaluation>): Promise<void> {
    _notImplemented('updateMoveEvaluation')
  }

  function listMoveEvaluationsByAttempt(attemptId: string): Promise<MoveEvaluation[]> {
    _notImplemented('listMoveEvaluationsByAttempt')
  }

  function createBadMove(badMove: BadMove): Promise<BadMove> {
    _notImplemented('createBadMove')
  }

  function loadBadMove(badMoveId: string): Promise<BadMove | null> {
    _notImplemented('loadBadMove')
  }

  function listBadMovesByAttempt(attemptId: string): Promise<BadMove[]> {
    _notImplemented('listBadMovesByAttempt')
  }

  function listBadMovesByTask(taskId: string): Promise<BadMove[]> {
    _notImplemented('listBadMovesByTask')
  }

  function markBadMoveAsNotBad(badMoveId: string): Promise<void> {
    _notImplemented('markBadMoveAsNotBad')
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

  function listIncompleteAttempts(): Promise<TrainingAttempt[]> {
    _notImplemented('listIncompleteAttempts')
  }

  function listIncompleteRecallSessions(): Promise<RecallSession[]> {
    _notImplemented('listIncompleteRecallSessions')
  }

  function listExpiredPendingMoveEvaluations(now: string): Promise<MoveEvaluation[]> {
    _notImplemented('listExpiredPendingMoveEvaluations')
  }

  async function transaction<T>(fn: () => Promise<T>): Promise<T> {
    // Phase 0: no real transaction support over IPC yet
    return fn()
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
