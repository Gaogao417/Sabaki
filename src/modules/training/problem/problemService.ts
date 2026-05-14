import type { Problem, BadMove } from '../types/index'
import type { TrainingRepository } from '../repository/trainingRepository'

export type ProblemService = {
  createProblem(input: CreateProblemInput): Promise<Problem>
  loadProblem(problemId: string): Promise<Problem | null>
  updateProblem(problemId: string, patch: Partial<Problem>): Promise<void>
  archiveProblem(problemId: string): Promise<void>
  createPunishmentProblemFromBadMove(badMoveId: string): Promise<Problem>
}

export type CreateProblemInput = {
  type?: Problem['type']
  positionSgf: string
  sideToMove: 'black' | 'white'
  title?: string
  positionDescription?: string
  taskGoal?: string
  status?: Problem['status']

  sourceProblemId?: string
  sourceTaskId?: string
  sourceAttemptId?: string
  sourceMoveIndex?: number
}

export type ProblemServiceDeps = {
  repository: TrainingRepository
  logger?: { info(channel: string, message: string, data?: Record<string, unknown>): void }
}

function generateId(): string {
  return `prob_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function createProblemService(deps: ProblemServiceDeps): ProblemService {
  const { repository, logger } = deps

  async function createProblem(input: CreateProblemInput): Promise<Problem> {
    const now = new Date().toISOString()
    const problem: Problem = {
      id: generateId(),
      type: input.type ?? 'best_move',
      positionSgf: input.positionSgf,
      sideToMove: input.sideToMove,
      title: input.title,
      positionDescription: input.positionDescription ?? '',
      taskGoal: input.taskGoal ?? '',
      referenceLines: [],
      passRule: { requireNoSevereBadMove: false, compareWithReference: false },
      tags: [],
      difficulty: undefined,
      status: input.status ?? 'inbox',
      sourceProblemId: input.sourceProblemId,
      sourceTaskId: input.sourceTaskId,
      sourceAttemptId: input.sourceAttemptId,
      sourceMoveIndex: input.sourceMoveIndex,
      createdAt: now,
      updatedAt: now,
    }

    const saved = await repository.createProblem(problem)

    logger?.info('problem.create', 'Problem created', {
      problemId: saved.id,
      type: saved.type,
      status: saved.status,
    })

    return saved
  }

  async function loadProblem(problemId: string): Promise<Problem | null> {
    return repository.loadProblem(problemId)
  }

  async function updateProblem(problemId: string, patch: Partial<Problem>): Promise<void> {
    await repository.updateProblem(problemId, patch)
  }

  async function archiveProblem(problemId: string): Promise<void> {
    await repository.archiveProblem(problemId)
  }

  async function createPunishmentProblemFromBadMove(badMoveId: string): Promise<Problem> {
    const badMove = await repository.loadBadMove(badMoveId)
    if (!badMove) {
      throw new Error(`problemService.createPunishmentProblemFromBadMove: bad move not found (id=${badMoveId})`)
    }

    const evaluations = await repository.listMoveEvaluationsByAttempt(badMove.attemptId)
    const evaluation = evaluations.find(e => e.id === badMove.moveEvaluationId)

    let positionSgf = evaluation?.positionBeforeSgf ?? ''
    if (!positionSgf) {
      const task = await repository.loadTask(badMove.taskId)
      positionSgf = task?.rootPositionSgf ?? ''
    }

    const scoreDrop = Math.round(evaluation?.scoreDrop ?? 0)
    const description =
      `Auto-generated punishment problem. ` +
      `The solver played ${badMove.move ?? evaluation?.move ?? '?'}, causing a ${badMove.severity} loss of ~${scoreDrop} points. ` +
      `Find the punishment move.`

    const problem = await createProblem({
      type: 'punishment',
      positionSgf,
      sideToMove: badMove.punishSide,
      title: `Punishment (move ${badMove.moveIndex})`,
      positionDescription: description,
      taskGoal: `Find the punishment move after the mistake.`,
      status: 'inbox',
      sourceTaskId: badMove.taskId,
      sourceAttemptId: badMove.attemptId,
      sourceMoveIndex: badMove.moveIndex,
    })

    await repository.updateBadMove(badMoveId, { generatedProblemId: problem.id })

    logger?.info('problem.punishment', 'Punishment problem created from bad move', {
      problemId: problem.id,
      badMoveId,
      severity: badMove.severity,
      moveIndex: badMove.moveIndex,
    })

    return problem
  }

  return {
    createProblem,
    loadProblem,
    updateProblem,
    archiveProblem,
    createPunishmentProblemFromBadMove,
  }
}
