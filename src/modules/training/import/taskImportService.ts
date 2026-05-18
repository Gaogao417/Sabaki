import type { TrainingTask, TaskOrigin, TaskPassRule, ProblemArea } from '../types/task'
import type { ReferenceLine } from '../types/recall'
import type { TrainingRepository } from '../repository/trainingRepository'

// --- Input types ---

export type CreateTrainingTaskInput = {
  positionSgf: string
  sideToMove?: 'black' | 'white'
  title?: string
  prompt?: string
  goal?: string
  passRule?: TaskPassRule
  referenceLines?: ReferenceLine[]
  problemArea?: ProblemArea
  tags?: string[]
  difficulty?: number
}

export type SnapshotTaskInput = {
  parentTaskId: string
  parentAttemptId?: string
  positionSgf: string
  sideToMove: 'black' | 'white'
  referenceLines?: ReferenceLine[]
  moveIndex?: number
  snapshotReason?: string
}

// --- Service type ---

export type TaskImportService = {
  importFoxGame(input: { gameId: string }): Promise<TrainingTask>
  importLocalSgf(input: { filePath: string; title?: string }): Promise<TrainingTask>
  import101Problem(input: { problemId: string }): Promise<TrainingTask>
  createManualTask(input: CreateTrainingTaskInput): Promise<TrainingTask>
  createTaskFromSnapshot(input: SnapshotTaskInput): Promise<TrainingTask>
  createTaskFromBadMove(input: { badMoveId: string }): Promise<TrainingTask>
}

// --- Dependencies ---

export type TaskImportServiceDeps = {
  repository: TrainingRepository
  foxAdapter?: {
    fetchSgf(gameId: string): Promise<{
      success: boolean
      data?: string
      error?: string
    }>
  }
  weiqi101Db?: {
    getWeiqi101Problem(
      problemId: string
    ): Promise<Record<string, unknown> | null>
  }
  sgfAdapter?: {
    parse(sgf: string): unknown[]
    extractRootPosition(trees: unknown[]): string
  }
  fileAdapter?: { readFile(path: string): Promise<string> }
  logger?: {
    info(
      channel: string,
      message: string,
      data?: Record<string, unknown>
    ): void
  }
}

// --- Helpers ---

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function nowISO(): string {
  return new Date().toISOString()
}

function extractFileName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  const fileName = parts[parts.length - 1]
  return fileName.replace(/\.sgf$/i, '') || fileName
}

// --- Factory ---

export function createTaskImportService(
  deps: TaskImportServiceDeps
): TaskImportService {
  const {
    repository,
    foxAdapter,
    weiqi101Db,
    sgfAdapter,
    fileAdapter,
    logger,
  } = deps

  async function importFoxGame(input: {
    gameId: string
  }): Promise<TrainingTask> {
    const result = await foxAdapter!.fetchSgf(input.gameId)

    if (!result.success) {
      throw new Error(
        `Fox fetch failed: ${result.error || 'unknown error'}`
      )
    }

    const sgf = result.data!
    const trees = sgfAdapter!.parse(sgf)
    const rootPositionSgf = sgfAdapter!.extractRootPosition(trees)

    const now = nowISO()
    const task: TrainingTask = {
      id: generateId(),
      rootPositionSgf,
      origin: {
        provider: 'fox',
        externalId: input.gameId,
      },
      createdAt: now,
      updatedAt: now,
    }

    logger?.info('taskImport.fox', 'Imported Fox game as task', {
      gameId: input.gameId,
      taskId: task.id,
    })

    return repository.createTask(task)
  }

  async function importLocalSgf(input: {
    filePath: string
    title?: string
  }): Promise<TrainingTask> {
    const sgf = await fileAdapter!.readFile(input.filePath)
    const trees = sgfAdapter!.parse(sgf)
    const rootPositionSgf = sgfAdapter!.extractRootPosition(trees)

    const now = nowISO()
    const task: TrainingTask = {
      id: generateId(),
      rootPositionSgf,
      title: input.title ?? extractFileName(input.filePath),
      origin: {
        provider: 'local',
        raw: { filePath: input.filePath },
      },
      createdAt: now,
      updatedAt: now,
    }

    logger?.info('taskImport.local', 'Imported local SGF as task', {
      filePath: input.filePath,
      taskId: task.id,
    })

    return repository.createTask(task)
  }

  async function import101Problem(input: {
    problemId: string
  }): Promise<TrainingTask> {
    const problem = await weiqi101Db!.getWeiqi101Problem(input.problemId)

    if (!problem) {
      throw new Error(
        `101 problem not found: ${input.problemId}`
      )
    }

    const now = nowISO()
    const task: TrainingTask = {
      id: generateId(),
      rootPositionSgf: (problem.sgf as string) || '',
      sideToMove:
        (problem.sideToMove as 'black' | 'white' | undefined) ?? 'black',
      prompt:
        (problem.prompt as string | undefined) ?? 'Find the best move',
      goal: problem.goal as string | undefined,
      difficulty: problem.difficulty as number | undefined,
      tags: ['101weiqi'],
      origin: {
        provider: '101',
        externalId: input.problemId,
      },
      createdAt: now,
      updatedAt: now,
    }

    logger?.info('taskImport.101', 'Imported 101 problem as task', {
      problemId: input.problemId,
      taskId: task.id,
    })

    return repository.createTask(task)
  }

  async function createManualTask(
    input: CreateTrainingTaskInput
  ): Promise<TrainingTask> {
    const now = nowISO()

    const task: TrainingTask = {
      id: generateId(),
      rootPositionSgf: input.positionSgf,
      sideToMove: input.sideToMove,
      title: input.title,
      prompt: input.prompt,
      goal: input.goal,
      passRule: input.passRule,
      referenceLines: input.referenceLines,
      problemArea: input.problemArea,
      tags: input.tags,
      difficulty: input.difficulty,
      origin: {
        provider: 'manual',
      },
      createdAt: now,
      updatedAt: now,
    }

    logger?.info('taskImport.manual', 'Created manual task', {
      taskId: task.id,
    })

    return repository.createTask(task)
  }

  async function createTaskFromSnapshot(
    input: SnapshotTaskInput
  ): Promise<TrainingTask> {
    const now = nowISO()

    const origin: TaskOrigin = {
      provider: 'snapshot',
      parentTaskId: input.parentTaskId,
      raw: input.snapshotReason ? { snapshotReason: input.snapshotReason } : undefined,
    }
    if (input.parentAttemptId) {
      origin.parentAttemptId = input.parentAttemptId
    }
    if (input.moveIndex !== undefined) {
      origin.parentMoveIndex = input.moveIndex
    }

    const task: TrainingTask = {
      id: generateId(),
      rootPositionSgf: input.positionSgf,
      sideToMove: input.sideToMove,
      referenceLines: input.referenceLines,
      origin,
      createdAt: now,
      updatedAt: now,
    }

    logger?.info('taskImport.snapshot', 'Created task from snapshot', {
      parentTaskId: input.parentTaskId,
      taskId: task.id,
    })

    return repository.createTask(task)
  }

  async function createTaskFromBadMove(input: {
    badMoveId: string
  }): Promise<TrainingTask> {
    const badMove = await repository.loadBadMove(input.badMoveId)

    if (!badMove) {
      throw new Error(`Bad move not found: ${input.badMoveId}`)
    }

    const now = nowISO()

    const origin: TaskOrigin = {
      provider: 'bad_move',
      parentTaskId: badMove.taskId,
      parentAttemptId: badMove.attemptId,
      parentMoveIndex: badMove.moveIndex,
    }

    const task: TrainingTask = {
      id: generateId(),
      rootPositionSgf: badMove.positionBeforeSgf ?? '',
      sideToMove: badMove.punishSide,
      prompt: 'Find the punishment for the mistake',
      origin,
      createdAt: now,
      updatedAt: now,
    }

    const saved = await repository.createTask(task)

    await repository.updateBadMove(input.badMoveId, {
      generatedTaskId: saved.id,
    })

    logger?.info('taskImport.badMove', 'Created task from bad move', {
      badMoveId: input.badMoveId,
      taskId: saved.id,
    })

    return saved
  }

  return {
    importFoxGame,
    importLocalSgf,
    import101Problem,
    createManualTask,
    createTaskFromSnapshot,
    createTaskFromBadMove,
  }
}
