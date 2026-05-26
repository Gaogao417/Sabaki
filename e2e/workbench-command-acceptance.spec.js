const {expect} = require('@playwright/test')
const {test} = require('./fixtures/electron-app')

const SHORTCUT_MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control'

/*
 * Harness/mock manifest: Workbench command acceptance
 * layer: Playwright Electron E2E command scaffold
 * production subject: TrainingWorkbenchContainer -> WorkbenchShell command props
 * real dependencies: renderer app, Workbench stores, LibrarySideDrawer, tabService.openTask
 * mocked globals: selected task import/repository methods return deterministic Fox/101 tasks;
 *   service methods are wrapped as instrumentation while still delegating to production;
 *   toggleThirdPartyPanel is wrapped only as a forbidden legacy-call guard
 * primary assertions: command clicks reach taskImportService or synced task lookup, then
 *   workbenchTabService.openTask; mode commands update active tab; edit-bar commands mutate
 *   scratch/current without mutating the source tree; disabled commands expose reasons and
 *   no-op on click/keyboard; declared-but-unwired keyboard shortcuts are guarded as gaps.
 */

async function getActiveWorkbenchTab(page) {
  return page.evaluate(() => {
    const ctx = window.__sabaki.getTrainingContext()
    const state = ctx.workbenchStore.getState()
    return state.tabs.find((tab) => tab.id === state.activeTabId) || null
  })
}

async function getWorkbenchSnapshot(page) {
  return page.evaluate(() => {
    const ctx = window.__sabaki.getTrainingContext()
    const workbench = ctx.workbenchStore.getState()
    const activeTab =
      workbench.tabs.find((tab) => tab.id === workbench.activeTabId) || null

    return {
      activeTab,
      tabs: workbench.tabs,
      runtime: ctx.runtimeStore.getState(),
      sabaki: {
        mode: window.__sabaki.state.mode,
        selectedTool: window.__sabaki.state.selectedTool,
        treePosition: window.__sabaki.state.treePosition,
        openDrawer: window.__sabaki.state.openDrawer,
        fullScreen: window.__sabaki.state.fullScreen,
      },
    }
  })
}

async function setActiveWorkbenchTab(page, mode, options = {}) {
  await page.evaluate(
    ({mode: nextMode, options: opts}) => {
      const ctx = window.__sabaki.getTrainingContext()
      const now = '2026-05-26T00:00:00.000Z'
      const taskId = opts.taskId ?? `e2e_${nextMode}_task`
      const attemptId =
        opts.activeAttemptId === undefined
          ? nextMode === 'problem'
            ? 'e2e_problem_attempt'
            : undefined
          : opts.activeAttemptId
      const recallSessionId =
        opts.activeRecallSessionId === undefined
          ? nextMode === 'recall'
            ? 'e2e_recall_session'
            : undefined
          : opts.activeRecallSessionId
      const tab = {
        id: opts.id || `e2e_tab_${nextMode}`,
        taskId,
        mode: nextMode,
        activeAttemptId: attemptId,
        activeRecallSessionId: recallSessionId,
        recallSubstate: opts.recallSubstate,
        previousMode: opts.previousMode,
        analysisReturnTarget: opts.analysisReturnTarget,
        analysisContext: opts.analysisContext,
        playerConfig: {
          black: 'human',
          white: 'human',
          problemOpponent: 'ai',
        },
        childTabIds: [],
        parentTabId: null,
        createdAt: now,
        updatedAt: now,
      }

      ctx.workbenchStore.setTabs([tab])
      ctx.workbenchStore.setActiveTab(tab.id)

      if (nextMode === 'recall') {
        ctx.runtimeStore.setActiveRecallSession(recallSessionId)
        ctx.runtimeStore.setRecallView({
          recallSessionId,
          taskId,
          tabId: tab.id,
          moveIndex: 2,
          expectedMoves: [
            {sign: 1, vertex: 'dd'},
            {sign: -1, vertex: 'qq'},
            {sign: 1, vertex: 'pd'},
            {sign: -1, vertex: 'dp'},
          ],
          userAttempts: [
            {vertex: 'dd', isCorrect: true},
            {vertex: 'qq', isCorrect: false},
          ],
          showHint: false,
          completed: false,
          status: 'e2e recall active',
        })
      } else {
        ctx.runtimeStore.setActiveRecallSession(undefined)
        ctx.runtimeStore.setRecallView(null)
      }

      if (nextMode === 'problem') {
        ctx.runtimeStore.setActiveAttempt(attemptId)
        ctx.runtimeStore.setProblemView({
          taskId,
          tabId: tab.id,
          attemptId,
          legacyProblemSession: {hintUsageLabel: '2/5'},
          evalCache: [],
          badMoves: [],
          submitted: false,
          result: null,
        })
      } else {
        ctx.runtimeStore.setActiveAttempt(undefined)
        ctx.runtimeStore.setProblemView(null)
      }

      if (nextMode === 'analysis') {
        window.__sabaki.setMode('analysis')
        if (
          window.__sabaki.state.editWorkspace == null &&
          window.__sabaki.createAnalysisWorkspace
        ) {
          window.__sabaki.setState({
            editWorkspace: window.__sabaki.createAnalysisWorkspace(),
          })
        }
      } else if (window.__sabaki.state.mode !== 'play') {
        window.__sabaki.setMode('play')
      }
    },
    {mode, options},
  )
}

async function installCommandInstrumentation(page) {
  await page.evaluate(() => {
    const ctx = window.__sabaki.getTrainingContext()
    const calls = {
      enterAnalysis: [],
      returnFromAnalysis: [],
      submit: [],
      completeRecall: [],
      snapshot: [],
      undo: [],
      redo: [],
      makeMove: [],
      infoOverlay: [],
    }

    const originals = {
      enterAnalysis: ctx.flowService.enterAnalysis.bind(ctx.flowService),
      returnFromAnalysis:
        ctx.flowService.returnFromAnalysis.bind(ctx.flowService),
      submit: ctx.flowService.submit.bind(ctx.flowService),
      completeRecall: ctx.flowService.completeRecall.bind(ctx.flowService),
      snapshotFromCurrentContext:
        ctx.flowService.snapshotFromCurrentContext.bind(ctx.flowService),
      undo: window.__sabaki.undo.bind(window.__sabaki),
      redo: window.__sabaki.redo.bind(window.__sabaki),
      makeMove: window.__sabaki.makeMove.bind(window.__sabaki),
      flashInfoOverlay: window.__sabaki.flashInfoOverlay?.bind(
        window.__sabaki,
      ),
    }

    ctx.flowService.enterAnalysis = (tabId, options) => {
      calls.enterAnalysis.push({tabId, options})
      return originals.enterAnalysis(tabId, options)
    }
    ctx.flowService.returnFromAnalysis = (input) => {
      calls.returnFromAnalysis.push(input)
      return originals.returnFromAnalysis(input)
    }
    ctx.flowService.submit = async (tabId) => {
      calls.submit.push({tabId})
      return originals.submit(tabId)
    }
    ctx.flowService.completeRecall = (tabId) => {
      calls.completeRecall.push({tabId})
      return originals.completeRecall(tabId)
    }
    ctx.flowService.snapshotFromCurrentContext = async (tabId) => {
      calls.snapshot.push({tabId})
      return originals.snapshotFromCurrentContext(tabId)
    }
    window.__sabaki.undo = () => {
      calls.undo.push({})
    }
    window.__sabaki.redo = () => {
      calls.redo.push({})
    }
    window.__sabaki.makeMove = (vertex, opts) => {
      calls.makeMove.push({vertex, opts})
      return originals.makeMove(vertex, opts)
    }
    window.__sabaki.flashInfoOverlay = (message) => {
      calls.infoOverlay.push(message)
      return originals.flashInfoOverlay?.(message)
    }

    window.__sabaki.__e2eCommandInstrumentation = {
      calls,
      restore() {
        ctx.flowService.enterAnalysis = originals.enterAnalysis
        ctx.flowService.returnFromAnalysis = originals.returnFromAnalysis
        ctx.flowService.submit = originals.submit
        ctx.flowService.completeRecall = originals.completeRecall
        ctx.flowService.snapshotFromCurrentContext =
          originals.snapshotFromCurrentContext
        window.__sabaki.undo = originals.undo
        window.__sabaki.redo = originals.redo
        window.__sabaki.makeMove = originals.makeMove
        if (originals.flashInfoOverlay) {
          window.__sabaki.flashInfoOverlay = originals.flashInfoOverlay
        }
      },
    }
  })
}

async function getCommandInstrumentation(page) {
  return page.evaluate(
    () => window.__sabaki.__e2eCommandInstrumentation.calls,
  )
}

async function setLibraryProjection(page, projection) {
  await page.evaluate((nextProjection) => {
    const ctx = window.__sabaki.getTrainingContext()
    ctx.libraryProjection = nextProjection
    const state = ctx.workbenchStore.getState()
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId)
    if (activeTab) ctx.workbenchStore.updateTab(activeTab.id, {})
  }, projection)
}

async function focusBody(page) {
  await page.locator('body').click({position: {x: 20, y: 20}})
}

function vertexSelector([x, y]) {
  return `#goban > .shudan-content > .shudan-vertices > .shudan-vertex[data-x="${x}"][data-y="${y}"]`
}

async function dispatchMouseEvent(locator, type, init = {}) {
  await locator.evaluate(
    (element, {eventType, eventInit}) => {
      element.dispatchEvent(
        new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window,
          ...eventInit,
        }),
      )
    },
    {eventType: type, eventInit: init},
  )
}

async function clickVertex(page, vertex, options = {}) {
  const locator = page.locator(vertexSelector(vertex))
  const button = options.button ?? 0
  await dispatchMouseEvent(locator, 'mousedown', {button})
  await dispatchMouseEvent(locator, 'mouseup', {button})
}

async function installLibraryCommandHarness(page) {
  await page.evaluate(() => {
    const ctx = window.__sabaki.getTrainingContext()
    const now = '2026-05-26T00:00:00.000Z'
    const tasks = {
      fox: {
        id: 'e2e_task_fox_synced',
        rootPositionSgf: '(;SZ[19])',
        title: 'E2E Fox synced game',
        origin: {provider: 'fox', externalId: 'e2e-fox-game'},
        createdAt: now,
        updatedAt: now,
      },
      101: {
        id: 'e2e_task_101_synced',
        rootPositionSgf: '(;SZ[19])',
        sideToMove: 'black',
        prompt: 'E2E 101 problem prompt',
        tags: ['101weiqi'],
        origin: {provider: '101', externalId: 'e2e-101-problem'},
        createdAt: now,
        updatedAt: now,
      },
      visibleProblem: {
        id: 'e2e_task_visible_problem_row',
        rootPositionSgf: '(;SZ[19];B[dd])',
        sideToMove: 'black',
        prompt: 'E2E visible problem row prompt',
        origin: {provider: 'local', externalId: 'e2e-visible-problem-row'},
        createdAt: now,
        updatedAt: now,
      },
    }
    const taskById = new Map(
      Object.values(tasks).map((task) => [task.id, task]),
    )

    window.__sabaki.__e2eLibraryCommandHarness = {
      imports: [],
      sourceLookups: [],
      loadTask: [],
      openTask: [],
      legacyThirdPartyCalls: [],
      legacyStartProblemCalls: [],
      legacySetModeCalls: [],
    }

    if (typeof ctx.taskImportService.importFoxGame !== 'function') {
      throw new Error('taskImportService.importFoxGame must exist for Fox library command wiring')
    }
    if (typeof ctx.taskImportService.import101Problem !== 'function') {
      throw new Error('taskImportService.import101Problem must exist for 101 library command wiring')
    }
    if (typeof ctx.repository.findTaskBySource !== 'function') {
      throw new Error('repository.findTaskBySource must exist for library command lookup wiring')
    }
    if (typeof ctx.repository.loadTask !== 'function') {
      throw new Error('repository.loadTask must exist for opened library task projection')
    }
    if (typeof ctx.tabService.openTask !== 'function') {
      throw new Error('tabService.openTask must exist for library command tab opening')
    }

    const originalImportFoxGame = ctx.taskImportService.importFoxGame?.bind(
      ctx.taskImportService,
    )
    const originalImport101Problem =
      ctx.taskImportService.import101Problem?.bind(ctx.taskImportService)
    const originalFindTaskBySource = ctx.repository.findTaskBySource?.bind(
      ctx.repository,
    )
    const originalLoadTask = ctx.repository.loadTask?.bind(ctx.repository)
    const originalOpenTask = ctx.tabService.openTask.bind(ctx.tabService)
    const originalStartProblem = window.__sabaki.startProblem?.bind(window.__sabaki)
    const originalSetMode = window.__sabaki.setMode?.bind(window.__sabaki)

    ctx.taskImportService.importFoxGame = async (input) => {
      window.__sabaki.__e2eLibraryCommandHarness.imports.push({
        provider: 'fox',
        input,
      })
      return tasks.fox
    }

    ctx.taskImportService.import101Problem = async (input) => {
      window.__sabaki.__e2eLibraryCommandHarness.imports.push({
        provider: '101',
        input,
      })
      return tasks['101']
    }

    ctx.repository.findTaskBySource = async (source) => {
      const provider =
        source?.provider ||
        (source?.kind === 'game' ? 'fox' : null) ||
        (source?.kind === 'problem' ? '101' : null)

      window.__sabaki.__e2eLibraryCommandHarness.sourceLookups.push({
        provider,
        source,
      })
      if (provider === 'fox') return tasks.fox
      if (provider === '101') return tasks['101']
      return originalFindTaskBySource ? originalFindTaskBySource(source) : null
    }

    ctx.repository.loadTask = async (taskId) => {
      window.__sabaki.__e2eLibraryCommandHarness.loadTask.push(taskId)
      if (taskById.has(taskId)) return taskById.get(taskId)
      return originalLoadTask ? originalLoadTask(taskId) : null
    }

    ctx.tabService.openTask = async (opts) => {
      const record = {
        opts,
        result: null,
      }
      window.__sabaki.__e2eLibraryCommandHarness.openTask.push(record)
      const tab = await originalOpenTask(opts)
      record.result = {
        id: tab.id,
        taskId: tab.taskId,
        mode: tab.mode,
      }
      return tab
    }

    window.__sabaki.toggleThirdPartyPanel = (panel) => {
      window.__sabaki.__e2eLibraryCommandHarness.legacyThirdPartyCalls.push(
        panel,
      )
    }

    window.__sabaki.startProblem = async (problemId) => {
      window.__sabaki.__e2eLibraryCommandHarness.legacyStartProblemCalls.push(
        problemId,
      )
      if (originalStartProblem) return originalStartProblem(problemId)
      return null
    }

    window.__sabaki.setMode = (mode, ...args) => {
      window.__sabaki.__e2eLibraryCommandHarness.legacySetModeCalls.push(mode)
      if (originalSetMode) return originalSetMode(mode, ...args)
      return null
    }

    window.__sabaki.__e2eLibraryCommandHarness.restore = () => {
      if (originalImportFoxGame) {
        ctx.taskImportService.importFoxGame = originalImportFoxGame
      }
      if (originalImport101Problem) {
        ctx.taskImportService.import101Problem = originalImport101Problem
      }
      if (originalFindTaskBySource) {
        ctx.repository.findTaskBySource = originalFindTaskBySource
      }
      if (originalLoadTask) ctx.repository.loadTask = originalLoadTask
      ctx.tabService.openTask = originalOpenTask
      if (originalStartProblem) window.__sabaki.startProblem = originalStartProblem
      if (originalSetMode) window.__sabaki.setMode = originalSetMode
    }
  })
}

async function getLibraryCommandHarness(page) {
  return page.evaluate(() => {
    const calls = window.__sabaki.__e2eLibraryCommandHarness
    return {
      imports: calls.imports,
      sourceLookups: calls.sourceLookups,
      loadTask: calls.loadTask,
      openTask: calls.openTask,
      legacyThirdPartyCalls: calls.legacyThirdPartyCalls,
      legacyStartProblemCalls: calls.legacyStartProblemCalls,
      legacySetModeCalls: calls.legacySetModeCalls,
    }
  })
}

test.describe('Workbench command acceptance', () => {
  test.beforeEach(async ({electronApp, page}) => {
    const browserWindow = await electronApp.browserWindow(page)
    await browserWindow.evaluate((win) => win.setContentSize(1280, 800))
    await expect(async () => {
      const viewport = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }))
      expect(viewport.width).toBeGreaterThanOrEqual(1000)
      expect(viewport.height).toBeGreaterThanOrEqual(700)
    }).toPass({timeout: 5000})
  })

  test('canonical command states project for Play, Problem, Recall, Analysis, Library, and edit bar', async ({
    page,
  }) => {
    const scenarios = [
      {
        mode: 'play',
        activeActions: [
          'mode-action-analysis',
          'mode-action-save',
          'mode-action-resign',
          'mode-action-end',
        ],
        absentActions: ['mode-action-submit', 'mode-action-return'],
      },
      {
        mode: 'problem',
        activeActions: [
          'mode-action-submit',
          'mode-action-analysis',
          'mode-action-abandon',
        ],
        absentActions: ['mode-action-save', 'mode-action-return'],
      },
      {
        mode: 'recall',
        activeActions: [
          'mode-action-end',
          'mode-action-continue',
          'mode-action-analysis',
        ],
        absentActions: ['mode-action-submit', 'mode-action-save'],
      },
      {
        mode: 'analysis',
        options: {
          previousMode: 'problem',
          analysisReturnTarget: {mode: 'problem'},
          analysisContext: {taskId: 'e2e_analysis_task', source: 'problem'},
        },
        activeActions: [
          'mode-action-snapshot',
          'mode-action-settings',
          'mode-action-return',
        ],
        absentActions: ['mode-action-submit', 'mode-action-save'],
      },
    ]

    for (const scenario of scenarios) {
      await setActiveWorkbenchTab(page, scenario.mode, scenario.options)

      await expect(page.locator('.workbench-shell')).toHaveAttribute(
        'data-mode',
        scenario.mode,
      )
      await expect(page.locator('[data-testid="mode-bar"]')).toHaveClass(
        new RegExp(`wb-mode-bar--${scenario.mode}`),
      )
      await expect(
        page.locator(`[data-testid="mode-bar-${scenario.mode}"]`),
      ).toHaveClass(/wb-segmented-control__item--active/)
      await expect(
        page.locator(`[data-testid="mode-bar-${scenario.mode}"]`),
      ).not.toHaveAttribute('aria-disabled', 'true')
      await expect(
        page.locator('[data-testid="bottom-action-bar"]'),
      ).toHaveClass(new RegExp(`wb-bottom-action-bar--${scenario.mode}`))

      for (const testId of scenario.activeActions) {
        await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible()
      }
      for (const testId of scenario.absentActions) {
        await expect(page.locator(`[data-testid="${testId}"]`)).toHaveCount(0)
      }
    }

    await expect(
      page.locator(
        '.wb-bottom-action-bar--analysis [data-testid="annotation-tool-btn-stone_1"]',
      ).first(),
    ).toHaveAttribute('aria-pressed', 'true')

    await setLibraryProjection(page, {
      history: [
        {
          id: 'e2e_history_projection',
          title: 'E2E projected history command sentinel',
          meta: 'projection path',
        },
      ],
    })
    await page.locator('button[aria-label="打开资料库"]').click()
    await expect(
      page.locator('[data-testid="library-side-drawer"]'),
    ).toBeVisible()
    await expect(
      page
        .locator('[data-testid="library-side-drawer"]')
        .getByText('E2E projected history command sentinel')
        .first(),
    ).toBeVisible()
  })

  test('mode command enters analysis and returns through the same command path', async ({
    page,
  }) => {
    await installCommandInstrumentation(page)
    await setActiveWorkbenchTab(page, 'play')
    await page.waitForSelector('[data-testid="mode-bar"]')

    await page.locator('[data-testid="mode-action-analysis"]').click()

    await expect(async () => {
      const tab = await getActiveWorkbenchTab(page)
      const calls = await getCommandInstrumentation(page)
      expect(tab.mode).toBe('analysis')
      expect(tab.analysisReturnTarget.mode).toBe('play')
      expect(calls.enterAnalysis).toHaveLength(1)
      expect(calls.enterAnalysis[0].options.reason).toBe('manual')
    }).toPass({timeout: 5000})

    await page.locator('[data-testid="mode-action-return"]').click()

    await expect(async () => {
      const tab = await getActiveWorkbenchTab(page)
      const calls = await getCommandInstrumentation(page)
      expect(tab.mode).toBe('play')
      expect(tab.analysisReturnTarget).toBeUndefined()
      expect(calls.returnFromAnalysis).toHaveLength(1)
      expect(calls.returnFromAnalysis[0].reason).toBe('return')
    }).toPass({timeout: 5000})
  })

  test('disabled segmented command exposes a reason and is a click/keyboard no-op', async ({
    page,
  }) => {
    await installCommandInstrumentation(page)
    await setActiveWorkbenchTab(page, 'problem')

    const blockedPlay = page.locator('[data-testid="mode-bar-play"]')
    await expect(blockedPlay).toHaveAttribute('aria-disabled', 'true')
    await expect(blockedPlay).toHaveAttribute('title', '请先提交或放弃当前题目')

    const before = await getWorkbenchSnapshot(page)

    await blockedPlay.evaluate((button) => {
      button.click()
      for (const key of ['Enter', ' ']) {
        button.dispatchEvent(
          new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}),
        )
        button.dispatchEvent(
          new KeyboardEvent('keyup', {key, bubbles: true, cancelable: true}),
        )
      }
    })

    await expect(async () => {
      const after = await getWorkbenchSnapshot(page)
      const calls = await getCommandInstrumentation(page)
      expect(after.activeTab.mode).toBe('problem')
      expect(after.activeTab.id).toBe(before.activeTab.id)
      expect(after.activeTab.activeAttemptId).toBe(
        before.activeTab.activeAttemptId,
      )
      expect(calls.enterAnalysis).toEqual([])
      expect(calls.returnFromAnalysis).toEqual([])
      expect(calls.submit).toEqual([])
      expect(calls.completeRecall).toEqual([])
      expect(calls.snapshot).toEqual([])
    }).toPass({timeout: 3000})
  })

  test('keyboard shortcuts use real handlers or record no-op gaps without mutating Workbench state', async ({
    page,
  }) => {
    await installCommandInstrumentation(page)
    await setActiveWorkbenchTab(page, 'play')
    await focusBody(page)

    const before = await getWorkbenchSnapshot(page)

    for (const key of ['A', 'S', 'H', 'Enter', 'Space']) {
      await page.keyboard.press(key)
    }

    let calls = await getCommandInstrumentation(page)
    let after = await getWorkbenchSnapshot(page)

    expect(after.activeTab).toEqual(before.activeTab)
    expect(after.sabaki.mode).toBe(before.sabaki.mode)
    expect(calls.enterAnalysis).toEqual([])
    expect(calls.returnFromAnalysis).toEqual([])
    expect(calls.submit).toEqual([])
    expect(calls.snapshot).toEqual([])
    expect(calls.makeMove).toEqual([])

    await page.keyboard.press('Control+Z')
    if (SHORTCUT_MODIFIER === 'Meta') {
      await page.keyboard.press('Meta+Z')
    }

    calls = await getCommandInstrumentation(page)
    after = await getWorkbenchSnapshot(page)

    expect(calls.undo.length).toBeGreaterThanOrEqual(1)
    expect(after.activeTab).toEqual(before.activeTab)
  })

  test('library Fox and 101 commands import or resolve synced tasks, then open Workbench task tabs', async ({
    page,
  }) => {
    await installLibraryCommandHarness(page)

    await page.locator('button[aria-label="打开资料库"]').click()
    await expect(
      page.locator('[data-testid="library-side-drawer"]'),
    ).toBeVisible()

    await page.locator('[data-testid="library-tab-kifu"]').click()
    await expect(page.getByText('本地棋谱')).toBeVisible()

    await page.locator('[data-testid="library-tab-game-records"]').click()
    await expect(page.getByText('对局记录')).toBeVisible()

    await page.locator('[data-testid="library-tab-history"]').click()
    await expect(page.getByText('最近历史')).toBeVisible()

    await page.locator('[data-testid="library-source-fox"]').click()
    await expect(page.locator('[data-testid="library-source-fox"]')).toHaveAttribute(
      'data-status',
      'synced',
    )
    await page.locator('[data-testid="library-source-101"]').click()
    await expect(page.locator('[data-testid="library-source-101"]')).toHaveAttribute(
      'data-status',
      'synced',
    )

    await expect(async () => {
      const calls = await getLibraryCommandHarness(page)
      const touchedProviders = new Set([
        ...calls.imports.map((call) => call.provider),
        ...calls.sourceLookups.map((call) => call.provider),
      ])
      const openedTaskIds = calls.openTask.map((call) => call.opts.taskId)

      expect(calls.legacyThirdPartyCalls).toEqual([])
      expect(touchedProviders.has('fox')).toBe(true)
      expect(touchedProviders.has('101')).toBe(true)
      expect(openedTaskIds).toEqual(
        expect.arrayContaining(['e2e_task_fox_synced', 'e2e_task_101_synced']),
      )
    }).toPass({timeout: 5000})
  })

  test('visible library problem row opens a Workbench problem task without legacy startProblem', async ({
    page,
  }) => {
    await installLibraryCommandHarness(page)
    await setActiveWorkbenchTab(page, 'play')
    await setLibraryProjection(page, {
      problems: [{
        id: 'e2e_task_visible_problem_row',
        taskId: 'e2e_task_visible_problem_row',
        title: 'E2E visible problem row',
        type: 'best_move',
      }],
    })

    await page.locator('[data-testid="open-wrong-problems-btn"]').evaluate(
      (button) => button.click(),
    )
    await expect(
      page.locator('[data-testid="library-side-drawer"]'),
    ).toBeVisible()

    const problemRow = page
      .locator('[data-testid="library-side-drawer"] .wb-library-drawer__item button')
      .filter({hasText: 'E2E visible problem row'})
    await expect(problemRow).toBeVisible()
    await problemRow.evaluate((button) => button.click())

    await expect(async () => {
      const calls = await getLibraryCommandHarness(page)
      expect(calls.openTask.map((call) => call.opts)).toEqual(
        expect.arrayContaining([{
          taskId: 'e2e_task_visible_problem_row',
          mode: 'problem',
        }]),
      )
      expect(calls.legacyStartProblemCalls).toEqual([])
      expect(calls.legacySetModeCalls.filter((mode) => mode === 'play')).toEqual([])
    }).toPass({timeout: 5000})
  })

  test('101 and Fox sync fixture states render loading, empty, error, syncing, and success without import/openTask side effects', async ({
    page,
  }) => {
    await installLibraryCommandHarness(page)
    await setActiveWorkbenchTab(page, 'play')
    await setLibraryProjection(page, {
      loading: 'E2E library loading state',
      empty: 'E2E library empty state',
      errors: ['E2E library error state'],
      fox: {
        status: 'syncing',
        message: 'E2E Fox syncing 12/32',
        rows: [{id: 'fox_syncing_row', title: 'E2E Fox syncing row'}],
      },
      oneOhOne: {
        status: 'synced',
        message: 'E2E 101 success synced',
        rows: [{id: '101_success_row', title: 'E2E 101 success row'}],
      },
    })

    await page.locator('button[aria-label="打开资料库"]').click()
    await expect(
      page.locator('[data-testid="library-side-drawer"]'),
    ).toBeVisible()

    await page.locator('[data-testid="library-tab-kifu"]').click()
    await expect(page.getByText('E2E library loading state')).toBeVisible()
    await expect(page.getByText('E2E library empty state')).toBeVisible()
    await expect(page.getByText('E2E library error state')).toBeVisible()
    await expect(page.locator('[data-testid="library-source-fox"]')).toHaveAttribute(
      'data-status',
      'syncing',
    )
    await expect(page.locator('[data-testid="library-source-101"]')).toHaveAttribute(
      'data-status',
      'synced',
    )
    await expect(page.locator('[data-testid="library-source-101"]')).toContainText(
      '已同步',
    )

    await setLibraryProjection(page, {
      fox: {
        status: 'loading',
        disabledReason: 'E2E Fox loading disabled reason',
      },
      oneOhOne: {
        status: 'error',
        error: 'E2E 101 auth expired',
        disabled: true,
        disabledReason: 'E2E 101 error disabled reason',
      },
    })

    const foxButton = page.locator('[data-testid="library-source-fox"]')
    const oneOhOneButton = page.locator('[data-testid="library-source-101"]')
    await expect(foxButton).toBeDisabled()
    await expect(foxButton).toHaveAttribute('aria-busy', 'true')
    await expect(foxButton).toHaveAttribute(
      'title',
      'E2E Fox loading disabled reason',
    )
    await expect(oneOhOneButton).toBeDisabled()
    await expect(oneOhOneButton).toHaveAttribute(
      'title',
      'E2E 101 error disabled reason',
    )

    const before = await getLibraryCommandHarness(page)
    await foxButton.evaluate((button) => button.click())
    await oneOhOneButton.evaluate((button) => button.click())

    const after = await getLibraryCommandHarness(page)
    expect(after.imports).toEqual(before.imports)
    expect(after.sourceLookups).toEqual(before.sourceLookups)
    expect(after.openTask).toEqual(before.openTask)
    expect(after.legacyThirdPartyCalls).toEqual([])
  })

  test('analysis edit-bar tool command mutates scratch/current and keeps source game tree unchanged', async ({
    page,
  }) => {
    await setActiveWorkbenchTab(page, 'play')
    await page.waitForSelector('[data-testid="mode-bar"]')
    await page.locator('[data-testid="mode-action-analysis"]').click()
    await page.waitForSelector(
      '.wb-bottom-action-bar--analysis [data-testid="annotation-tool-btn-stone_-1"]',
    )

    const before = await page.evaluate(() => {
      const tree =
        window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
      let count = 0
      const walk = (node) => {
        count++
        for (const child of node.children) walk(child)
      }
      walk(tree.root)
      return {
        treePosition: window.__sabaki.state.treePosition,
        nodeCount: count,
        currentSignMap: JSON.stringify(
          window.__sabaki.state.editWorkspace.currentSnapshot.signMap,
        ),
      }
    })

    await dispatchMouseEvent(
      page.locator(
        '.wb-bottom-action-bar--analysis .wb-bottom-action-bar__visual [data-testid="annotation-tool-btn-stone_-1"]',
      ),
      'click',
    )

    await expect(async () => {
      const selectedTool = await page.evaluate(
        () => window.__sabaki.state.selectedTool,
      )
      expect(selectedTool).toBe('stone_-1')
    }).toPass({timeout: 3000})

    await clickVertex(page, [4, 4], {button: 0})

    await expect(async () => {
      const sign = await page.evaluate(() => {
        const ws = window.__sabaki.state.editWorkspace
        return ws.currentSnapshot.signMap[4][4]
      })
      expect(sign).toBe(-1)
    }).toPass({timeout: 5000})

    const after = await page.evaluate(() => {
      const tree =
        window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
      let count = 0
      const walk = (node) => {
        count++
        for (const child of node.children) walk(child)
      }
      walk(tree.root)
      return {
        treePosition: window.__sabaki.state.treePosition,
        nodeCount: count,
        currentSignMap: JSON.stringify(
          window.__sabaki.state.editWorkspace.currentSnapshot.signMap,
        ),
      }
    })

    expect(after.treePosition).toBe(before.treePosition)
    expect(after.nodeCount).toBe(before.nodeCount)
    expect(after.currentSignMap).not.toBe(before.currentSignMap)
  })
})
