import type {
  TrainingTask,
  TrainingTaskKind,
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

type RepositoryLogger = {
  info(channel: string, message: string, data?: Record<string, unknown>): void
}

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
  updateBadMove(badMoveId: string, patch: Partial<BadMove>): Promise<void>

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
  archiveProblem(problemId: string): Promise<void>

  // Comment
  createMoveComment(comment: MoveComment): Promise<MoveComment>
  loadMoveComment(commentId: string): Promise<MoveComment | null>
  updateMoveComment(commentId: string, patch: Partial<MoveComment>): Promise<void>

  // Review (new)
  createReviewSchedule(schedule: ReviewSchedule): Promise<ReviewSchedule>
  findReviewScheduleByItem(itemId: string, itemType: string): Promise<ReviewSchedule | null>
  findReviewScheduleByTask(taskId: string): Promise<ReviewSchedule | null>
  listDueReviewItems(now: string): Promise<ReviewSchedule[]>
  updateReviewSchedule(id: string, patch: Partial<ReviewSchedule>): Promise<void>

  // Recovery
  listIncompleteAttempts(): Promise<TrainingAttempt[]>
  listIncompleteRecallSessions(): Promise<RecallSession[]>
  listExpiredPendingMoveEvaluations(now: string): Promise<MoveEvaluation[]>

  // Transaction
  transaction<T>(fn: () => Promise<T>): Promise<T>
}

export function createTrainingRepository(db: Db, logger?: RepositoryLogger): TrainingRepository {
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
    logger?.info('repo.saveRecallSession', 'Saving recall session', { sessionId: session.id as string | undefined })
    return db.saveRecallSession(session)
  }

  async function saveRecallAttempts(attempts: Record<string, unknown>[]) {
    logger?.info('repo.saveRecallAttempts', 'Saving recall attempts', { count: attempts.length })
    await db.saveRecallAttempts(attempts)
  }

  async function saveProblem(problem: Record<string, unknown>) {
    logger?.info('repo.saveProblem', 'Saving problem', { problemId: problem.id as string | undefined })
    return db.saveProblem(problem)
  }

  async function getProblem(id: string) {
    return db.getProblem(id)
  }

  async function getProblemsByStatus(status: string, limit = 50) {
    return db.getProblemsByStatus(status, limit)
  }

  async function saveProblemAttempt(attempt: Record<string, unknown>) {
    logger?.info('repo.saveProblemAttempt', 'Saving problem attempt', { attemptId: attempt.id as string | undefined })
    return db.saveProblemAttempt(attempt)
  }

  async function saveBadMove(badMove: Record<string, unknown>) {
    logger?.info('repo.saveBadMove', 'Saving bad move (legacy)', { badMoveId: badMove.id as string | undefined })
    return db.saveBadMove(badMove)
  }

  async function updateBadMoveGeneratedProblem(badMoveId: string, problemId: string) {
    logger?.info('repo.updateBadMoveGeneratedProblem', 'Updating bad move generated problem', { badMoveId, problemId })
    await db.updateBadMoveGeneratedProblem(badMoveId, problemId)
  }

  async function getDueReviews() {
    return db.getDueReviews()
  }

  async function upsertReviewSchedule(item: Record<string, unknown>) {
    logger?.info('repo.upsertReviewSchedule', 'Upserting review schedule (legacy)', { itemId: item.id as string | undefined })
    await db.upsertReviewSchedule(item)
  }

  async function getDashboardSummary() {
    return db.getDashboardSummary()
  }

  // --- New training domain (Phase 2: connected to DB) ---

  async function createTask(task: TrainingTask): Promise<TrainingTask> {
    logger?.info('repo.createTask', 'Creating task', { kind: task.kind, source: task.source })
    // Merge origin into task for DB layer; v0.5 fields passed through
    const dbTask = {
      ...task,
      origin: task.origin,
      initialPositionSgf: task.initialPositionSgf || task.rootPositionSgf,
      prompt: task.prompt,
      goal: task.goal,
      passRule: task.passRule,
      referenceLines: task.referenceLines,
      problemArea: task.problemArea,
      tags: task.tags,
      difficulty: task.difficulty,
      status: task.status,
    }
    const row = await db.createTrainingTask(dbTask)
    const result = mapTaskRow(row)
    logger?.info('repo.createTask', 'Task created', { taskId: result.id })
    return result
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
    logger?.info('repo.updateTask', 'Updating task', { taskId, fields: Object.keys(mapped) })
    await db.updateTrainingTask(taskId, mapped)
  }

  async function createAttempt(attempt: TrainingAttempt): Promise<TrainingAttempt> {
    logger?.info('repo.createAttempt', 'Creating attempt', { attemptId: attempt.id, taskId: attempt.taskId })
    const row = await db.createTrainingAttempt({
      ...attempt,
      moveActors: attempt.moveActors,
    })
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
    if (patch.moveActors !== undefined) mapped.moveActors = patch.moveActors
    logger?.info('repo.updateAttempt', 'Updating attempt', { attemptId, fields: Object.keys(mapped) })
    await db.updateTrainingAttempt(attemptId, mapped)
  }

  async function createMoveEvaluation(evaluation: MoveEvaluation): Promise<MoveEvaluation> {
    logger?.info('repo.createMoveEvaluation', 'Creating move evaluation', { evaluationId: evaluation.id, attemptId: evaluation.attemptId })
    const row = await db.createMoveEvaluation(evaluation)
    return mapEvaluationRow(row)
  }

  async function updateMoveEvaluation(evaluationId: string, patch: Partial<MoveEvaluation>): Promise<void> {
    logger?.info('repo.updateMoveEvaluation', 'Updating move evaluation', { evaluationId, fields: Object.keys(patch) })
    await db.updateMoveEvaluation(evaluationId, patch as Record<string, unknown>)
  }

  async function listMoveEvaluationsByAttempt(attemptId: string): Promise<MoveEvaluation[]> {
    const rows = await db.listMoveEvaluationsByAttempt(attemptId)
    return rows.map(mapEvaluationRow)
  }

  // --- BadMove (new domain) ---

  async function createBadMove(badMove: BadMove): Promise<BadMove> {
    logger?.info('repo.createBadMove', 'Creating bad move', { badMoveId: badMove.id, taskId: badMove.taskId, moveIndex: badMove.moveIndex })
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
    logger?.info('repo.markBadMoveAsNotBad', 'Marking bad move as not bad', { badMoveId })
    await db.markTrainingBadMoveAsNotBad(badMoveId)
  }

  async function updateBadMove(badMoveId: string, patch: Partial<BadMove>): Promise<void> {
    const mapped: Record<string, unknown> = {}
    if (patch.recallCheckpointId !== undefined) mapped.recallCheckpointId = patch.recallCheckpointId
    if (patch.generatedProblemId !== undefined) mapped.generatedProblemId = patch.generatedProblemId
    if (patch.generatedTaskId !== undefined) mapped.generatedTaskId = patch.generatedTaskId
    if (patch.userMarkedAsNotBad !== undefined) mapped.userMarkedAsNotBad = patch.userMarkedAsNotBad
    logger?.info('repo.updateBadMove', 'Updating bad move', { badMoveId, fields: Object.keys(mapped) })
    await db.updateTrainingBadMove(badMoveId, mapped)
  }

  // --- Remaining stubs (Phase 3+) ---

  async function createRecallSession(session: RecallSession): Promise<RecallSession> {
    logger?.info('repo.createRecallSession', 'Creating recall session', { sessionId: session.id, taskId: session.taskId })
    const row = await db.createTrainingRecallSession({
      id: session.id,
      taskId: session.taskId,
      tabId: session.tabId,
      attemptId: session.attemptId,
      type: session.type,
      source: session.source,
      startMove: session.startMove,
      endMove: session.endMove,
      expectedMoves: session.expectedMoves,
      recallPolicy: session.recallPolicy,
      expectedMoveIndexes: session.expectedMoveIndexes,
      currentMoveIndex: session.currentMoveIndex,
      completed: session.completed,
      completedAt: session.completedAt,
    })
    return mapRecallSessionRow(row)
  }

  async function loadRecallSession(sessionId: string): Promise<RecallSession | null> {
    const row = await db.loadTrainingRecallSession(sessionId)
    return row ? mapRecallSessionRow(row) : null
  }

  async function updateRecallSession(sessionId: string, patch: Partial<RecallSession>): Promise<void> {
    const mapped: Record<string, unknown> = {}
    if (patch.currentMoveIndex !== undefined) mapped.currentMoveIndex = patch.currentMoveIndex
    if (patch.completed !== undefined) mapped.completed = patch.completed
    if (patch.completedAt !== undefined) mapped.completedAt = patch.completedAt
    logger?.info('repo.updateRecallSession', 'Updating recall session', { sessionId, fields: Object.keys(mapped) })
    await db.updateTrainingRecallSession(sessionId, mapped)
  }

  async function createRecallAttempt(attempt: RecallAttempt): Promise<RecallAttempt> {
    logger?.info('repo.createRecallAttempt', 'Creating recall attempt', { attemptId: attempt.id, sessionId: attempt.recallSessionId })
    const row = await db.createTrainingRecallAttempt({
      id: attempt.id,
      recallSessionId: attempt.recallSessionId,
      moveNumber: attempt.moveNumber,
      expectedMove: attempt.expectedMove,
      userMove: attempt.userMove,
      isCorrect: attempt.isCorrect,
      hintLevelUsed: attempt.hintLevelUsed,
    })
    return mapRecallAttemptRow(row)
  }

  async function listRecallAttempts(sessionId: string): Promise<RecallAttempt[]> {
    const rows = await db.listTrainingRecallAttemptsBySession(sessionId)
    return rows.map(mapRecallAttemptRow)
  }

  async function createRecallCheckpoint(checkpoint: RecallCheckpoint): Promise<RecallCheckpoint> {
    logger?.info('repo.createRecallCheckpoint', 'Creating recall checkpoint', { checkpointId: checkpoint.id, sessionId: checkpoint.recallSessionId })
    const row = await db.createTrainingRecallCheckpoint({
      id: checkpoint.id,
      recallSessionId: checkpoint.recallSessionId,
      badMoveId: checkpoint.badMoveId,
      status: checkpoint.status,
      userCorrectionLine: checkpoint.userCorrectionLine,
      aiCandidateLines: checkpoint.aiCandidateLines,
      userCommentId: checkpoint.userCommentId,
      completedAt: checkpoint.completedAt,
    })
    return mapRecallCheckpointRow(row)
  }

  async function loadRecallCheckpoint(checkpointId: string): Promise<RecallCheckpoint | null> {
    const row = await db.loadTrainingRecallCheckpoint(checkpointId)
    return row ? mapRecallCheckpointRow(row) : null
  }

  async function updateRecallCheckpoint(checkpointId: string, patch: Partial<RecallCheckpoint>): Promise<void> {
    const mapped: Record<string, unknown> = {}
    if (patch.status !== undefined) mapped.status = patch.status
    if (patch.userCorrectionLine !== undefined) mapped.userCorrectionLine = patch.userCorrectionLine
    if (patch.aiCandidateLines !== undefined) mapped.aiCandidateLines = patch.aiCandidateLines
    if (patch.userCommentId !== undefined) mapped.userCommentId = patch.userCommentId
    if (patch.completedAt !== undefined) mapped.completedAt = patch.completedAt
    logger?.info('repo.updateRecallCheckpoint', 'Updating recall checkpoint', { checkpointId, fields: Object.keys(mapped) })
    await db.updateTrainingRecallCheckpoint(checkpointId, mapped)
  }

  async function listCheckpointsByRecallSession(sessionId: string): Promise<RecallCheckpoint[]> {
    const rows = await db.listTrainingRecallCheckpointsBySession(sessionId)
    return rows.map(mapRecallCheckpointRow)
  }

  async function createProblem(problem: Problem): Promise<Problem> {
    logger?.info('repo.createProblem', 'Creating problem', { problemId: problem.id, type: problem.type })
    const row = await db.saveProblem(problem)
    return mapProblemRow(row)
  }

  async function loadProblem(problemId: string): Promise<Problem | null> {
    const row = await db.getProblem(problemId)
    return row ? mapProblemRow(row) : null
  }

  async function updateProblem(problemId: string, patch: Partial<Problem>): Promise<void> {
    const mapped: Record<string, unknown> = {}
    if (patch.type !== undefined) mapped.type = patch.type
    if (patch.positionSgf !== undefined) mapped.positionSgf = patch.positionSgf
    if (patch.sideToMove !== undefined) mapped.sideToMove = patch.sideToMove
    if (patch.title !== undefined) mapped.title = patch.title
    if (patch.positionDescription !== undefined) mapped.positionDescription = patch.positionDescription
    if (patch.taskGoal !== undefined) mapped.taskGoal = patch.taskGoal
    if (patch.referenceLines !== undefined) mapped.referenceLines = patch.referenceLines
    if (patch.passRule !== undefined) mapped.passRule = patch.passRule
    if (patch.tags !== undefined) mapped.tags = patch.tags
    if (patch.difficulty !== undefined) mapped.difficulty = patch.difficulty
    if (patch.status !== undefined) mapped.status = patch.status
    if (patch.sourceGameId !== undefined) mapped.sourceGameId = patch.sourceGameId
    if (patch.sourceMoveIndex !== undefined) mapped.sourceMoveIndex = patch.sourceMoveIndex
    if (patch.sourceProblemId !== undefined) mapped.sourceProblemId = patch.sourceProblemId
    if (patch.sourceTaskId !== undefined) mapped.sourceTaskId = patch.sourceTaskId
    if (patch.sourceAttemptId !== undefined) mapped.sourceAttemptId = patch.sourceAttemptId
    if (patch.parentProblemId !== undefined) mapped.parentProblemId = patch.parentProblemId
    if (patch.parentSnapshotReason !== undefined) mapped.parentSnapshotReason = patch.parentSnapshotReason
    logger?.info('repo.updateProblem', 'Updating problem', { problemId, fields: Object.keys(mapped) })
    await db.updateProblem(problemId, mapped)
  }

  async function archiveProblem(problemId: string): Promise<void> {
    logger?.info('repo.archiveProblem', 'Archiving problem', { problemId })
    await db.archiveProblem(problemId)
  }

  async function createMoveComment(comment: MoveComment): Promise<MoveComment> {
    logger?.info('repo.createMoveComment', 'Creating move comment', { commentId: comment.id })
    const row = await db.createTrainingMoveComment({
      id: comment.id,
      target: comment.target,
      content: comment.content,
      templateAnswers: comment.templateAnswers,
    })
    return mapMoveCommentRow(row)
  }

  async function loadMoveComment(commentId: string): Promise<MoveComment | null> {
    const row = await db.loadTrainingMoveComment(commentId)
    return row ? mapMoveCommentRow(row) : null
  }

  async function updateMoveComment(commentId: string, patch: Partial<MoveComment>): Promise<void> {
    const mapped: Record<string, unknown> = {}
    if (patch.content !== undefined) mapped.content = patch.content
    if (patch.templateAnswers !== undefined) mapped.templateAnswers = patch.templateAnswers
    logger?.info('repo.updateMoveComment', 'Updating move comment', { commentId, fields: Object.keys(mapped) })
    await db.updateTrainingMoveComment(commentId, mapped)
  }

  async function createReviewSchedule(schedule: ReviewSchedule): Promise<ReviewSchedule> {
    logger?.info('repo.createReviewSchedule', 'Creating review schedule', { scheduleId: schedule.id, taskId: schedule.taskId })
    const row = await db.upsertReviewSchedule({
      id: schedule.id,
      taskId: schedule.taskId,
      itemId: schedule.itemId || schedule.taskId,
      itemType: schedule.itemType || 'task',
      dueAt: schedule.dueAt,
      intervalDays: schedule.intervalDays,
      easeFactor: schedule.easeFactor,
      lastResult: schedule.lastResult,
      consecutivePassCount: schedule.consecutivePassCount,
      totalFailCount: schedule.totalFailCount,
      lastReviewedAt: schedule.lastReviewedAt,
    })
    return mapReviewScheduleRow(row)
  }

  async function findReviewScheduleByItem(itemId: string, itemType: string): Promise<ReviewSchedule | null> {
    const row = await db.findReviewScheduleByItem(itemId, itemType)
    return row ? mapReviewScheduleRow(row) : null
  }

  async function findReviewScheduleByTask(taskId: string): Promise<ReviewSchedule | null> {
    const row = await db.findReviewScheduleByTask(taskId)
    return row ? mapReviewScheduleRow(row) : null
  }

  async function listDueReviewItems(_now: string): Promise<ReviewSchedule[]> {
    const rows = await db.getDueReviews()
    return rows.map(mapReviewScheduleRow)
  }

  async function updateReviewSchedule(id: string, patch: Partial<ReviewSchedule>): Promise<void> {
    const mapped: Record<string, unknown> = {}
    if (patch.dueAt !== undefined) mapped.dueAt = patch.dueAt
    if (patch.intervalDays !== undefined) mapped.intervalDays = patch.intervalDays
    if (patch.easeFactor !== undefined) mapped.easeFactor = patch.easeFactor
    if (patch.lastResult !== undefined) mapped.lastResult = patch.lastResult
    if (patch.consecutivePassCount !== undefined) mapped.consecutivePassCount = patch.consecutivePassCount
    if (patch.totalFailCount !== undefined) mapped.totalFailCount = patch.totalFailCount
    if (patch.lastReviewedAt !== undefined) mapped.lastReviewedAt = patch.lastReviewedAt
    logger?.info('repo.updateReviewSchedule', 'Updating review schedule', { id, fields: Object.keys(mapped) })
    await db.updateReviewSchedule(id, mapped)
  }

  async function listIncompleteAttempts(): Promise<TrainingAttempt[]> {
    const rows = await db.listIncompleteTrainingAttempts()
    return rows.map(mapAttemptRow)
  }

  async function listIncompleteRecallSessions(): Promise<RecallSession[]> {
    const rows = await db.listIncompleteTrainingRecallSessions()
    return rows.map(mapRecallSessionRow)
  }

  async function listExpiredPendingMoveEvaluations(now: string): Promise<MoveEvaluation[]> {
    const rows = await db.listExpiredPendingMoveEvaluations(now)
    return rows.map(mapEvaluationRow)
  }

  async function transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (typeof db.transaction !== 'function') {
      logger?.info('repo.transaction', 'db.transaction unavailable, executing without transaction wrapper')
      return fn()
    }
    logger?.info('repo.transaction', 'Transaction started')
    const result = await db.transaction(() => fn())
    logger?.info('repo.transaction', 'Transaction completed')
    return result
  }

  // --- Row mappers ---

  /**
   * Migrate problemArea from legacy rectangle format to vertex list.
   * - If null/undefined -> undefined
   * - If already [number, number][] -> pass through
   * - If {x1, y1, x2, y2} -> expand to all vertices in the rectangle
   */
  function migrateProblemArea(raw: unknown): TrainingTask['problemArea'] {
    if (raw == null) return undefined

    const area = typeof raw === 'string' ? JSON.parse(raw) : raw

    // Already a vertex list (array of arrays)
    if (Array.isArray(area)) return area as TrainingTask['problemArea']

    // Legacy rectangle format {x1, y1, x2, y2} -> expand to vertex list
    if (typeof area === 'object' && 'x1' in area && 'y1' in area && 'x2' in area && 'y2' in area) {
      const vertices: [number, number][] = []
      for (let x = area.x1; x <= area.x2; x++) {
        for (let y = area.y1; y <= area.y2; y++) {
          vertices.push([x, y])
        }
      }
      return vertices
    }

    return undefined
  }

  function mapTaskRow(row: Record<string, unknown>): TrainingTask {
    const source = typeof row.source === 'string' ? JSON.parse(row.source as string) : row.source
    const kind = row.kind as TrainingTask['kind']

    // Build origin: prefer explicit origin_json column, fall back to legacy kind/source
    let origin: TrainingTask['origin'] | undefined
    if (row.origin != null) {
      origin = typeof row.origin === 'string' ? JSON.parse(row.origin as string) : (row.origin as TrainingTask['origin'])
    } else if (kind && source) {
      origin = mapSourceToOrigin(source as TrainingTaskSource, kind)
    }

    return {
      id: row.id as string,
      kind,
      source,
      rootPositionSgf: (row.rootPositionSgf as string) || (row.initialPositionSgf as string) || '',
      sideToMove: row.sideToMove as 'black' | 'white' | undefined,
      title: row.title as string | undefined,
      // v0.5 fields
      origin,
      initialPositionSgf: row.initialPositionSgf as string | undefined,
      prompt: row.prompt as string | undefined,
      goal: row.goal as string | undefined,
      passRule: row.passRule != null
        ? (typeof row.passRule === 'string' ? JSON.parse(row.passRule as string) : row.passRule) as TrainingTask['passRule']
        : undefined,
      referenceLines: row.referenceLines != null
        ? (typeof row.referenceLines === 'string' ? JSON.parse(row.referenceLines as string) : row.referenceLines) as TrainingTask['referenceLines']
        : undefined,
      problemArea: migrateProblemArea(row.problemArea),
      tags: row.tags != null
        ? (typeof row.tags === 'string' ? JSON.parse(row.tags as string) : row.tags) as string[]
        : undefined,
      difficulty: row.difficulty as number | undefined,
      status: row.status as string | undefined,
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
      moveActors: row.moveActors != null
        ? (typeof row.moveActors === 'string' ? JSON.parse(row.moveActors as string) : row.moveActors) as TrainingAttempt['moveActors']
        : undefined,
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
    // v0.5: prefer generatedTaskId, fall back to generatedProblemId
    const generatedTaskId = (row.generatedTaskId as string) || (row.generatedProblemId as string) || undefined

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
      generatedTaskId,
      generatedProblemId: row.generatedProblemId as string | undefined,
      recallCheckpointId: row.recallCheckpointId as string | undefined,
      createdAt: row.createdAt as string,
    }
  }

  function mapRecallSessionRow(row: Record<string, unknown>): RecallSession {
    // v0.5: prefer attemptId column, fall back to source_json parsing
    let attemptId: string | undefined = row.attemptId as string | undefined
    if (!attemptId && row.source) {
      const source = typeof row.source === 'string' ? JSON.parse(row.source as string) : row.source
      if (source && source.kind === 'attempt' && source.attemptId) {
        attemptId = source.attemptId
      }
    }

    const expectedMoves: string[] = typeof row.expectedMoves === 'string'
      ? JSON.parse(row.expectedMoves as string)
      : (row.expectedMoves as string[])

    // v0.5: recallPolicy defaults to 'fullLine' when absent (legacy compat)
    const recallPolicy: RecallSession['recallPolicy'] =
      (row.recallPolicy as RecallSession['recallPolicy']) || 'fullLine'

    // v0.5: expectedMoveIndexes defaults to [0..N-1] when absent (legacy compat)
    let expectedMoveIndexes: number[]
    if (row.expectedMoveIndexes != null) {
      expectedMoveIndexes = typeof row.expectedMoveIndexes === 'string'
        ? JSON.parse(row.expectedMoveIndexes as string)
        : (row.expectedMoveIndexes as number[])
    } else {
      expectedMoveIndexes = expectedMoves.map((_, i) => i)
    }

    return {
      id: row.id as string,
      taskId: row.taskId as string,
      tabId: (row.tabId as string) ?? undefined,
      attemptId,
      type: (row.type as 'line_recall') ?? 'line_recall',
      source: typeof row.source === 'string' ? JSON.parse(row.source as string) : row.source as RecallSession['source'],
      startMove: (row.startMove as number) ?? 0,
      endMove: (row.endMove as number) ?? undefined,
      recallPolicy,
      expectedMoveIndexes,
      expectedMoves,
      currentMoveIndex: (row.currentMoveIndex as number) ?? 0,
      completed: !!row.completed,
      createdAt: row.createdAt as string,
      completedAt: (row.completedAt as string) ?? undefined,
    }
  }

  function mapRecallAttemptRow(row: Record<string, unknown>): RecallAttempt {
    return {
      id: row.id as string,
      recallSessionId: row.recallSessionId as string,
      moveNumber: row.moveNumber as number,
      expectedMove: row.expectedMove as string,
      userMove: row.userMove as string,
      isCorrect: !!row.isCorrect,
      hintLevelUsed: (row.hintLevelUsed as number) ?? 0,
      createdAt: row.createdAt as string,
    }
  }

  function mapRecallCheckpointRow(row: Record<string, unknown>): RecallCheckpoint {
    return {
      id: row.id as string,
      recallSessionId: row.recallSessionId as string,
      badMoveId: row.badMoveId as string,
      status: row.status as RecallCheckpoint['status'],
      userCorrectionLine: typeof row.userCorrectionLine === 'string' ? JSON.parse(row.userCorrectionLine) : (row.userCorrectionLine as string[]),
      aiCandidateLines: typeof row.aiCandidateLines === 'string' ? JSON.parse(row.aiCandidateLines) : (row.aiCandidateLines as RecallCheckpoint['aiCandidateLines']),
      userCommentId: (row.userCommentId as string) ?? undefined,
      createdAt: row.createdAt as string,
      completedAt: (row.completedAt as string) ?? undefined,
    }
  }

  function mapMoveCommentRow(row: Record<string, unknown>): MoveComment {
    return {
      id: row.id as string,
      target: typeof row.target === 'string' ? JSON.parse(row.target) : row.target,
      content: row.content as string,
      templateAnswers: row.templateAnswers
        ? (typeof row.templateAnswers === 'string' ? JSON.parse(row.templateAnswers) : row.templateAnswers)
        : undefined,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
    }
  }

  function mapProblemRow(row: Record<string, unknown>): Problem {
    return {
      id: row.id as string,
      type: row.type as Problem['type'],
      positionSgf: row.positionSgf as string,
      sideToMove: row.sideToMove as 'black' | 'white',
      title: row.title as string | undefined,
      positionDescription: (row.positionDescription as string) || '',
      taskGoal: (row.taskGoal as string) || '',
      referenceLines: typeof row.referenceLines === 'string' ? JSON.parse(row.referenceLines) : (row.referenceLines as Problem['referenceLines']),
      passRule: typeof row.passRule === 'string' ? JSON.parse(row.passRule) : (row.passRule as Problem['passRule']),
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags as string[]),
      difficulty: row.difficulty as Problem['difficulty'],
      status: row.status as Problem['status'],
      sourceGameId: row.sourceGameId as string | undefined,
      sourceProblemId: row.sourceProblemId as string | undefined,
      sourceTaskId: row.sourceTaskId as string | undefined,
      sourceAttemptId: row.sourceAttemptId as string | undefined,
      sourceMoveIndex: row.sourceMoveIndex as number | undefined,
      parentProblemId: row.parentProblemId as string | undefined,
      parentSnapshotReason: row.parentSnapshotReason as string | undefined,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
    }
  }

  function mapReviewScheduleRow(row: Record<string, unknown>): ReviewSchedule {
    // v0.5: prefer taskId, fall back to itemId
    const taskId = (row.taskId as string) || (row.itemId as string) || ''

    return {
      id: row.id as string,
      taskId,
      itemId: row.itemId as string | undefined,
      itemType: row.itemType as ReviewSchedule['itemType'],
      dueAt: row.dueAt as string,
      intervalDays: (row.intervalDays as number) ?? 1,
      easeFactor: row.easeFactor as number | undefined,
      lastResult: row.lastResult as ReviewSchedule['lastResult'],
      consecutivePassCount: (row.consecutivePassCount as number) ?? 0,
      totalFailCount: (row.totalFailCount as number) ?? 0,
      lastReviewedAt: row.lastReviewedAt as string | undefined,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
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
    createBadMove, loadBadMove, listBadMovesByAttempt, listBadMovesByTask, markBadMoveAsNotBad, updateBadMove,
    createRecallSession, loadRecallSession, updateRecallSession, createRecallAttempt, listRecallAttempts,
    createRecallCheckpoint, loadRecallCheckpoint, updateRecallCheckpoint, listCheckpointsByRecallSession,
    createProblem, loadProblem, updateProblem, archiveProblem,
    createMoveComment, loadMoveComment, updateMoveComment,
    createReviewSchedule, findReviewScheduleByItem, findReviewScheduleByTask, listDueReviewItems, updateReviewSchedule,
    listIncompleteAttempts, listIncompleteRecallSessions, listExpiredPendingMoveEvaluations,
    transaction,
  }
}

/**
 * Map a legacy source object + kind to a v0.5 TaskOrigin.
 * Pure function -- no side effects.
 */
export function mapSourceToOrigin(
  source: TrainingTaskSource | null | undefined,
  kind: TrainingTaskKind | string,
): TrainingTask['origin'] | undefined {
  if (!source) return undefined

  const s = source as Record<string, unknown>
  const kindStr = typeof kind === 'string' ? kind : ''

  switch (kindStr) {
    case 'game':
      return {
        provider: 'local',
        externalId: s.gameId as string | undefined,
        raw: source as Record<string, unknown>,
      }
    case 'problem':
      return {
        provider: 'inferred',
        externalId: s.problemId as string | undefined,
        raw: source as Record<string, unknown>,
      }
    case 'snapshot_problem':
      return {
        provider: 'snapshot',
        externalId: s.problemId as string | undefined,
        parentTaskId: s.parentTaskId as string | undefined,
        parentAttemptId: s.parentAttemptId as string | undefined,
        raw: source as Record<string, unknown>,
      }
    case 'recall_segment':
      return {
        provider: 'recall',
        externalId: s.segmentId as string | undefined,
        parentAttemptId: s.sourceAttemptId as string | undefined,
        raw: source as Record<string, unknown>,
      }
    default:
      return {
        provider: 'local',
        raw: source as Record<string, unknown>,
      }
  }
}
