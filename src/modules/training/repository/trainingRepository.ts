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

  async function updateBadMove(badMoveId: string, patch: Partial<BadMove>): Promise<void> {
    const mapped: Record<string, unknown> = {}
    if (patch.recallCheckpointId !== undefined) mapped.recallCheckpointId = patch.recallCheckpointId
    if (patch.generatedProblemId !== undefined) mapped.generatedProblemId = patch.generatedProblemId
    if (patch.userMarkedAsNotBad !== undefined) mapped.userMarkedAsNotBad = patch.userMarkedAsNotBad
    await db.updateTrainingBadMove(badMoveId, mapped)
  }

  // --- Remaining stubs (Phase 3+) ---

  async function createRecallSession(session: RecallSession): Promise<RecallSession> {
    const row = await db.createTrainingRecallSession({
      id: session.id,
      taskId: session.taskId,
      tabId: session.tabId,
      type: session.type,
      source: session.source,
      startMove: session.startMove,
      endMove: session.endMove,
      expectedMoves: session.expectedMoves,
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
    await db.updateTrainingRecallSession(sessionId, mapped)
  }

  async function createRecallAttempt(attempt: RecallAttempt): Promise<RecallAttempt> {
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
    await db.updateTrainingRecallCheckpoint(checkpointId, mapped)
  }

  async function listCheckpointsByRecallSession(sessionId: string): Promise<RecallCheckpoint[]> {
    const rows = await db.listTrainingRecallCheckpointsBySession(sessionId)
    return rows.map(mapRecallCheckpointRow)
  }

  async function createProblem(problem: Problem): Promise<Problem> {
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
    await db.updateProblem(problemId, mapped)
  }

  async function archiveProblem(problemId: string): Promise<void> {
    await db.archiveProblem(problemId)
  }

  async function createMoveComment(comment: MoveComment): Promise<MoveComment> {
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
    await db.updateTrainingMoveComment(commentId, mapped)
  }

  async function createReviewSchedule(schedule: ReviewSchedule): Promise<ReviewSchedule> {
    const row = await db.upsertReviewSchedule({
      id: schedule.id,
      itemId: schedule.itemId,
      itemType: schedule.itemType,
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
    return db.transaction(() => fn())
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

  function mapRecallSessionRow(row: Record<string, unknown>): RecallSession {
    return {
      id: row.id as string,
      taskId: row.taskId as string,
      tabId: (row.tabId as string) ?? undefined,
      type: (row.type as 'line_recall') ?? 'line_recall',
      source: typeof row.source === 'string' ? JSON.parse(row.source) : row.source,
      startMove: (row.startMove as number) ?? 0,
      endMove: (row.endMove as number) ?? undefined,
      expectedMoves: typeof row.expectedMoves === 'string' ? JSON.parse(row.expectedMoves) : (row.expectedMoves as string[]),
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
    return {
      id: row.id as string,
      itemId: row.itemId as string,
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
    createReviewSchedule, listDueReviewItems, updateReviewSchedule,
    listIncompleteAttempts, listIncompleteRecallSessions, listExpiredPendingMoveEvaluations,
    transaction,
  }
}
