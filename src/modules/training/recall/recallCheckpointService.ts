import type {
  BadMove,
  RecallCheckpoint,
  ReferenceLine,
  MoveComment,
} from '../types/index'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { TrainingRuntimeStore } from '../store/trainingRuntimeStore'

export type RecallCheckpointService = {
  shouldTriggerCheckpoint(input: {
    recallSessionId: string
    moveIndex: number
  }): Promise<BadMove | null>

  startCheckpoint(input: {
    recallSessionId: string
    badMoveId: string
  }): Promise<RecallCheckpoint>

  submitUserCorrectionLine(input: {
    checkpointId: string
    moves: string[]
  }): Promise<void>

  revealAiCandidateLines(checkpointId: string): Promise<ReferenceLine[]>

  saveComment(input: {
    checkpointId: string
    comment: MoveComment
  }): Promise<void>

  skipCheckpoint(checkpointId: string): Promise<void>

  resumeRecall(checkpointId: string): Promise<void>
}

export type RecallCheckpointServiceDeps = {
  repository: TrainingRepository
  runtimeStore: TrainingRuntimeStore
  logger?: {
    info(channel: string, message: string, data?: Record<string, unknown>): void
  }
}

export function createRecallCheckpointService(deps: RecallCheckpointServiceDeps): RecallCheckpointService {
  const { repository, runtimeStore, logger } = deps

  async function shouldTriggerCheckpoint(input: {
    recallSessionId: string
    moveIndex: number
  }): Promise<BadMove | null> {
    const session = await repository.loadRecallSession(input.recallSessionId)
    if (!session) return null

    // Only trigger for attempt-sourced recall sessions
    const source = session.source as { kind: string; attemptId?: string }
    if (source.kind !== 'attempt' || !source.attemptId) return null

    const badMoves = await repository.listBadMovesByAttempt(source.attemptId)

    // Find a bad move at this move index with major/severe severity
    const triggering = badMoves.find(
      bm => bm.moveIndex === input.moveIndex && (bm.severity === 'major' || bm.severity === 'severe')
    )

    // Don't trigger if already checkpointed
    if (triggering?.recallCheckpointId) return null

    return triggering ?? null
  }

  async function startCheckpoint(input: {
    recallSessionId: string
    badMoveId: string
  }): Promise<RecallCheckpoint> {
    const session = await repository.loadRecallSession(input.recallSessionId)
    if (!session) {
      throw new Error(`recallCheckpointService.startCheckpoint: recall session not found (id=${input.recallSessionId})`)
    }

    const badMove = await repository.loadBadMove(input.badMoveId)
    if (!badMove) {
      throw new Error(`recallCheckpointService.startCheckpoint: badMove not found (id=${input.badMoveId})`)
    }

    const now = new Date().toISOString()
    const id = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const checkpoint: RecallCheckpoint = {
      id,
      recallSessionId: input.recallSessionId,
      badMoveId: input.badMoveId,
      status: 'pending_correction',
      userCorrectionLine: [],
      aiCandidateLines: [],
      createdAt: now,
    }

    await repository.createRecallCheckpoint(checkpoint)

    // Link checkpoint back to bad move to prevent duplicate triggers
    await repository.updateBadMove(input.badMoveId, { recallCheckpointId: id })

    runtimeStore.setActiveCheckpoint(id)

    logger?.info('checkpoint.start', 'Checkpoint started', {
      checkpointId: id,
      badMoveId: input.badMoveId,
      sessionId: input.recallSessionId,
    })

    return checkpoint
  }

  async function submitUserCorrectionLine(input: {
    checkpointId: string
    moves: string[]
  }): Promise<void> {
    const checkpoint = await repository.loadRecallCheckpoint(input.checkpointId)
    if (!checkpoint) {
      throw new Error(`recallCheckpointService.submitUserCorrectionLine: checkpoint not found (id=${input.checkpointId})`)
    }
    if (checkpoint.status !== 'pending_correction') {
      throw new Error(`recallCheckpointService.submitUserCorrectionLine: expected status 'pending_correction', got '${checkpoint.status}'`)
    }

    await repository.updateRecallCheckpoint(input.checkpointId, {
      userCorrectionLine: input.moves,
    })

    runtimeStore.setCorrectionDraft(undefined)

    logger?.info('checkpoint.correction', 'User correction line submitted', {
      checkpointId: input.checkpointId,
      moveCount: input.moves.length,
    })
  }

  async function revealAiCandidateLines(checkpointId: string): Promise<ReferenceLine[]> {
    const checkpoint = await repository.loadRecallCheckpoint(checkpointId)
    if (!checkpoint) {
      throw new Error(`recallCheckpointService.revealAiCandidateLines: checkpoint not found (id=${checkpointId})`)
    }
    if (checkpoint.status !== 'pending_correction' && checkpoint.status !== 'ai_revealed') {
      throw new Error(`recallCheckpointService.revealAiCandidateLines: expected status 'pending_correction' or 'ai_revealed', got '${checkpoint.status}'`)
    }

    const badMove = await repository.loadBadMove(checkpoint.badMoveId)
    if (!badMove) {
      throw new Error(`recallCheckpointService.revealAiCandidateLines: badMove not found (id=${checkpoint.badMoveId})`)
    }

    // Load the MoveEvaluation to get engine suggested line
    const evaluations = await repository.listMoveEvaluationsByAttempt(badMove.attemptId)
    const evaluation = evaluations.find(ev => ev.moveIndex === badMove.moveIndex)

    const aiLines: ReferenceLine[] = []

    if (evaluation?.engineSuggestedLine && evaluation.engineSuggestedLine.length > 0) {
      aiLines.push({
        label: 'AI recommended',
        moves: evaluation.engineSuggestedLine,
        source: 'engine',
        scoreLead: evaluation.afterScoreLead,
        winrate: evaluation.afterWinrate,
      })
    }

    await repository.updateRecallCheckpoint(checkpointId, {
      status: 'ai_revealed',
      aiCandidateLines: aiLines,
    })

    logger?.info('checkpoint.reveal', 'AI candidate lines revealed', {
      checkpointId,
      lineCount: aiLines.length,
    })

    return aiLines
  }

  async function saveComment(input: {
    checkpointId: string
    comment: MoveComment
  }): Promise<void> {
    const checkpoint = await repository.loadRecallCheckpoint(input.checkpointId)
    if (!checkpoint) {
      throw new Error(`recallCheckpointService.saveComment: checkpoint not found (id=${input.checkpointId})`)
    }
    if (checkpoint.status === 'commented' || checkpoint.status === 'skipped') {
      throw new Error(`recallCheckpointService.saveComment: cannot save comment on ${checkpoint.status} checkpoint (id=${input.checkpointId})`)
    }

    const now = new Date().toISOString()
    const savedComment: MoveComment = {
      ...input.comment,
      id: input.comment.id || `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: input.comment.createdAt || now,
      updatedAt: now,
    }

    await repository.createMoveComment(savedComment)

    await repository.updateRecallCheckpoint(input.checkpointId, {
      status: 'commented',
      userCommentId: savedComment.id,
    })

    logger?.info('checkpoint.comment', 'Comment saved', {
      checkpointId: input.checkpointId,
      commentId: savedComment.id,
    })
  }

  async function skipCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = await repository.loadRecallCheckpoint(checkpointId)
    if (!checkpoint) {
      throw new Error(`recallCheckpointService.skipCheckpoint: checkpoint not found (id=${checkpointId})`)
    }
    if (checkpoint.status === 'commented' || checkpoint.status === 'skipped') {
      throw new Error(`recallCheckpointService.skipCheckpoint: cannot skip checkpoint in '${checkpoint.status}' status (id=${checkpointId})`)
    }
    if (checkpoint.completedAt) {
      throw new Error(`recallCheckpointService.skipCheckpoint: checkpoint already completed (id=${checkpointId})`)
    }

    const session = await repository.loadRecallSession(checkpoint.recallSessionId)
    if (!session) {
      throw new Error(`recallCheckpointService.skipCheckpoint: session not found (id=${checkpoint.recallSessionId})`)
    }

    const now = new Date().toISOString()
    await repository.updateRecallCheckpoint(checkpointId, {
      status: 'skipped',
      completedAt: now,
    })

    await repository.updateRecallSession(session.id, {
      currentMoveIndex: session.currentMoveIndex + 1,
    })

    runtimeStore.setActiveCheckpoint(undefined)
    runtimeStore.setCorrectionDraft(undefined)

    logger?.info('checkpoint.skip', 'Checkpoint skipped', {
      checkpointId,
      sessionId: session.id,
    })
  }

  async function resumeRecall(checkpointId: string): Promise<void> {
    const checkpoint = await repository.loadRecallCheckpoint(checkpointId)
    if (!checkpoint) {
      throw new Error(`recallCheckpointService.resumeRecall: checkpoint not found (id=${checkpointId})`)
    }
    if (checkpoint.status !== 'commented' && checkpoint.status !== 'skipped') {
      throw new Error(`recallCheckpointService.resumeRecall: expected status 'commented' or 'skipped', got '${checkpoint.status}'`)
    }
    if (checkpoint.completedAt) {
      throw new Error(`recallCheckpointService.resumeRecall: checkpoint already completed (id=${checkpointId})`)
    }

    const session = await repository.loadRecallSession(checkpoint.recallSessionId)
    if (!session) {
      throw new Error(`recallCheckpointService.resumeRecall: session not found (id=${checkpoint.recallSessionId})`)
    }

    const now = new Date().toISOString()
    await repository.updateRecallCheckpoint(checkpointId, {
      completedAt: now,
    })

    // Advance past the bad move
    await repository.updateRecallSession(session.id, {
      currentMoveIndex: session.currentMoveIndex + 1,
    })

    runtimeStore.setActiveCheckpoint(undefined)

    logger?.info('checkpoint.resume', 'Resumed recall after checkpoint', {
      checkpointId,
      sessionId: session.id,
    })
  }

  return {
    shouldTriggerCheckpoint,
    startCheckpoint,
    submitUserCorrectionLine,
    revealAiCandidateLines,
    saveComment,
    skipCheckpoint,
    resumeRecall,
  }
}
