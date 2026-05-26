const {expect} = require('@playwright/test')
const {test} = require('./fixtures/electron-app')

/*
 * Harness/mock manifest: Workbench command acceptance
 * layer: Playwright Electron E2E command scaffold
 * production subject: TrainingWorkbenchContainer -> WorkbenchShell command props
 * real dependencies: renderer app, Workbench stores, LibrarySideDrawer, tabService.openTask
 * mocked globals: selected task import/repository methods return deterministic Fox/101 tasks;
 *   toggleThirdPartyPanel is wrapped only as a forbidden legacy-call guard
 * primary assertions: command clicks reach taskImportService or synced task lookup, then
 *   workbenchTabService.openTask; mode commands update active tab; edit-bar smoke changes
 *   selected tool without mutating the source tree
 *
 * Deferred edit-bar exit condition: replace the smoke with a scratch/current mutation
 * assertion once the scratch edit executor can be driven from this command surface without
 * production-only pointer event setup.
 */

async function getActiveWorkbenchTab(page) {
  return page.evaluate(() => {
    const ctx = window.__sabaki.getTrainingContext()
    const state = ctx.workbenchStore.getState()
    return state.tabs.find((tab) => tab.id === state.activeTabId) || null
  })
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
      const tab = await originalOpenTask(opts)
      window.__sabaki.__e2eLibraryCommandHarness.openTask.push({
        opts,
        result: {
          id: tab.id,
          taskId: tab.taskId,
          mode: tab.mode,
        },
      })
      return tab
    }

    window.__sabaki.toggleThirdPartyPanel = (panel) => {
      window.__sabaki.__e2eLibraryCommandHarness.legacyThirdPartyCalls.push(
        panel,
      )
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

  test('mode command enters analysis and returns through the same command path', async ({
    page,
  }) => {
    await page.evaluate(() => window.__sabaki.setMode('play'))
    await page.waitForSelector('[data-testid="mode-bar"]')

    await page.locator('[data-testid="mode-action-analysis"]').click()

    await expect(async () => {
      const tab = await getActiveWorkbenchTab(page)
      expect(tab.mode).toBe('analysis')
      expect(tab.analysisReturnTarget.mode).toBe('play')
    }).toPass({timeout: 5000})

    await page.locator('[data-testid="mode-action-return"]').click()

    await expect(async () => {
      const tab = await getActiveWorkbenchTab(page)
      expect(tab.mode).toBe('play')
      expect(tab.analysisReturnTarget).toBeUndefined()
    }).toPass({timeout: 5000})
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
    await page.locator('[data-testid="library-source-101"]').click()

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

  test('analysis edit-bar tool-selection smoke keeps source game tree unchanged', async ({
    page,
  }) => {
    await page.evaluate(() => window.__sabaki.setMode('play'))
    await page.waitForSelector('[data-testid="mode-bar"]')
    await page.locator('[data-testid="mode-action-analysis"]').click()
    await page.waitForSelector(
      '.wb-bottom-action-bar--analysis [data-testid="annotation-tool-btn-line"]',
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
      }
    })

    await page
      .locator(
        '.wb-bottom-action-bar--analysis .wb-bottom-action-bar__visual [data-testid="annotation-tool-btn-line"]',
      )
      .click()

    await expect(async () => {
      const selectedTool = await page.evaluate(
        () => window.__sabaki.state.selectedTool,
      )
      expect(selectedTool).toBe('line')
    }).toPass({timeout: 3000})

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
      }
    })

    expect(after).toEqual(before)
  })
})
