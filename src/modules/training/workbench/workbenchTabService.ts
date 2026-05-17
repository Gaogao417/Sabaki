import type { WorkbenchTab, WorkbenchMode, TrainingTask, PlayerConfig } from '../types/index'
import type { WorkbenchStore } from '../store/workbenchStore'
import type { TrainingRuntimeStore } from '../store/trainingRuntimeStore'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { LegacySabakiAdapter } from '../adapter/legacySabakiAdapter'
import type { AttemptService } from '../attempt/attemptService'
import type { PlayTrainingMonitor } from '../attempt/playTrainingMonitor'

export type SgfParser = {
  parse(sgf: string): unknown[]
}

export type OpenProblemTabOptions = {
  parentTabId?: string
  legacyCompatibility?: boolean
}

export type OpenTaskOptions = {
  taskId: string
  mode?: WorkbenchMode
  parentTabId?: string
  playerConfig?: PlayerConfig
}

export type WorkbenchTabService = {
  openGameTab(gameId: string): Promise<WorkbenchTab>
  openProblemTab(problemId: string, options?: OpenProblemTabOptions): Promise<WorkbenchTab>
  openTask(opts: OpenTaskOptions): Promise<WorkbenchTab>
  openSnapshotProblemTab(problemId: string, options: { parentTabId: string }): Promise<WorkbenchTab>
  closeTab(tabId: string): Promise<void>
  switchTab(tabId: string): void
}

export type WorkbenchTabServiceDeps = {
  workbenchStore: WorkbenchStore
  repository: TrainingRepository
  legacyAdapter: LegacySabakiAdapter
  sgfParser: SgfParser
  runtimeStore?: TrainingRuntimeStore
  attemptService?: AttemptService
  monitor?: PlayTrainingMonitor
  logger?: { info(channel: string, message: string, data?: Record<string, unknown>): void }
}

export function inferDefaultMode(task: TrainingTask): WorkbenchMode {
  if (task.prompt || task.goal || task.passRule || task.referenceLines) return 'problem'
  return 'play'
}

export function createWorkbenchTabService(deps: WorkbenchTabServiceDeps): WorkbenchTabService {
  const {
    workbenchStore,
    repository,
    legacyAdapter,
    sgfParser,
    runtimeStore,
    attemptService,
    monitor,
    logger,
  } = deps

  function generateId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  function createTaskFromProblem(problemId: string, problem: Record<string, unknown>): TrainingTask {
    const now = new Date().toISOString()
    return {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      kind: 'problem',
      source: { kind: 'problem', problemId },
      rootPositionSgf: problem.position_sgf ?? problem.positionSgf ?? '',
      sideToMove: (problem.side_to_move ?? problem.sideToMove ?? 'black') as 'black' | 'white',
      title: (problem.title ?? undefined) as string | undefined,
      createdAt: now,
      updatedAt: now,
    }
  }

  function createTaskFromGame(gameId: string, game: Record<string, unknown>): TrainingTask {
    const now = new Date().toISOString()
    return {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      kind: 'game',
      source: { kind: 'game', gameId },
      rootPositionSgf: game.sgf ?? '',
      sideToMove: undefined,
      title: (game.title ?? undefined) as string | undefined,
      createdAt: now,
      updatedAt: now,
    }
  }

  function createTabForTask(task: TrainingTask, options?: { parentTabId?: string }): WorkbenchTab {
    const now = new Date().toISOString()
    return {
      id: generateId(),
      taskId: task.id,
      mode: 'play' as WorkbenchMode,
      childTabIds: [],
      parentTabId: options?.parentTabId,
      createdAt: now,
      updatedAt: now,
    }
  }

  async function setupLegacyCompatibility(
    problem: Record<string, unknown>,
    problemId: string,
  ): Promise<void> {
    const positionSgf = problem.positionSgf ?? problem.position_sgf ?? ''
    const trees = sgfParser.parse(positionSgf)
    if (!trees || trees.length === 0) {
      throw new Error(`workbenchTabService.openProblemTab: failed to parse SGF for problem ${problemId}`)
    }
    const tree = trees[0]

    await legacyAdapter.loadGameTrees([tree])
    legacyAdapter.setCurrentTreePosition(tree, (tree as { root: { id: string } }).root.id)
    legacyAdapter.getSabaki().setMode('play')
    legacyAdapter.startAnalysisIfEngineReady((tree as { root: { id: string } }).root.id)
  }

  async function openProblemTab(problemId: string, options?: OpenProblemTabOptions): Promise<WorkbenchTab> {
    const problem = await repository.getProblem(problemId)
    if (!problem) {
      throw new Error(`workbenchTabService.openProblemTab: problem not found (id=${problemId})`)
    }

    logger?.info('problem.start', 'Problem started', {
      problemId: problem.id,
      type: problem.type,
      sideToMove: problem.sideToMove,
    })

    // Create new-system Task + Tab
    const task = createTaskFromProblem(problemId, problem)
    const tab = createTabForTask(task, options)

    // Link parent → child
    if (options?.parentTabId) {
      const parent = workbenchStore.getState().tabs.find(t => t.id === options.parentTabId)
      if (!parent) {
        throw new Error(`workbenchTabService.openProblemTab: parent tab not found (id=${options.parentTabId})`)
      }
      workbenchStore.updateTab(options.parentTabId, {
        childTabIds: [...parent.childTabIds, tab.id],
      })
    }

    // Legacy setup can still fail on bad SGF. Keep it before DB writes so
    // opening a legacy problem remains all-or-nothing during migration.
    if (options?.legacyCompatibility !== false) {
      await setupLegacyCompatibility(problem, problemId)
    }

    const savedTask = await repository.createTask(task)
    const attempt = attemptService
      ? await attemptService.createAttempt({
        taskId: savedTask.id,
        tabId: tab.id,
        rootPositionSgf: savedTask.rootPositionSgf,
      })
      : null

    if (attempt && runtimeStore) {
      runtimeStore.setProblemView({
        taskId: savedTask.id,
        tabId: tab.id,
        attemptId: attempt.id,
        problemId,
        legacyProblemSession: problem,
        evalCache: [],
        badMoves: [],
        submitted: false,
        result: null,
      })

      monitor?.startForAttempt({
        attemptId: attempt.id,
        taskId: savedTask.id,
      })
    }

    workbenchStore.addTab(tab)
    workbenchStore.setActiveTab(tab.id)

    return tab
  }

  async function openGameTab(gameId: string): Promise<WorkbenchTab> {
    const game = await repository.getGame(gameId)
    if (!game) {
      throw new Error(`workbenchTabService.openGameTab: game not found (id=${gameId})`)
    }

    const task = createTaskFromGame(gameId, game)
    const tab = createTabForTask(task)

    workbenchStore.addTab(tab)
    workbenchStore.setActiveTab(tab.id)

    return tab
  }

  async function openTask(opts: OpenTaskOptions): Promise<WorkbenchTab> {
    const task = await repository.loadTask(opts.taskId)
    if (!task) {
      throw new Error(`workbenchTabService.openTask: task not found (id=${opts.taskId})`)
    }

    const mode = opts.mode ?? inferDefaultMode(task)

    if (opts.parentTabId) {
      const parent = workbenchStore.getState().tabs.find(t => t.id === opts.parentTabId)
      if (!parent) {
        throw new Error(`workbenchTabService.openTask: parent tab not found (id=${opts.parentTabId})`)
      }
    }

    const now = new Date().toISOString()
    const tab: WorkbenchTab = {
      id: generateId(),
      taskId: task.id,
      mode,
      parentTabId: opts.parentTabId,
      childTabIds: [],
      playerConfig: opts.playerConfig,
      createdAt: now,
      updatedAt: now,
    }

    if (opts.parentTabId) {
      const parent = workbenchStore.getState().tabs.find(t => t.id === opts.parentTabId)
      workbenchStore.updateTab(opts.parentTabId, {
        childTabIds: [...parent.childTabIds, tab.id],
      })
    }

    workbenchStore.addTab(tab)
    workbenchStore.setActiveTab(tab.id)
    return tab
  }

  async function openSnapshotProblemTab(problemId: string, options: { parentTabId: string }): Promise<WorkbenchTab> {
    return openProblemTab(problemId, { parentTabId: options.parentTabId })
  }

  async function closeTab(tabId: string): Promise<void> {
    const state = workbenchStore.getState()
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab) return

    // Unlink from parent
    if (tab.parentTabId) {
      const parent = state.tabs.find(t => t.id === tab.parentTabId)
      if (parent) {
        workbenchStore.updateTab(tab.parentTabId, {
          childTabIds: parent.childTabIds.filter(id => id !== tabId),
        })
      }
    }

    // Remove child tabs
    for (const childId of tab.childTabIds) {
      await closeTab(childId)
    }

    workbenchStore.removeTab(tabId)
  }

  function switchTab(tabId: string): void {
    const state = workbenchStore.getState()
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab) {
      throw new Error(`workbenchTabService.switchTab: tab not found (id=${tabId})`)
    }
    workbenchStore.setActiveTab(tabId)
  }

  return {
    openProblemTab,
    openGameTab,
    openTask,
    openSnapshotProblemTab,
    closeTab,
    switchTab,
  }
}
