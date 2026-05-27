const {expect} = require('@playwright/test')
const {test} = require('./fixtures/electron-app')

const NOW = '2026-05-27T00:00:00.000Z'

async function installGoldenPathHarness(page) {
  await page.evaluate((now) => {
    const ctx = window.__sabaki.getTrainingContext()
    const tasks = {
      kifu: {
        id: 'task_kifu_fixture',
        rootPositionSgf: '(;SZ[19];B[dd];W[qq])',
        title: 'Golden kifu fixture',
        origin: {provider: 'local', externalId: 'golden-kifu'},
        createdAt: now,
        updatedAt: now,
      },
      savedGame: {
        id: 'task_saved_game_fixture',
        rootPositionSgf: '(;SZ[19];B[pd];W[dp])',
        title: 'Golden saved game fixture',
        origin: {provider: 'local', externalId: 'golden-saved-game'},
        createdAt: now,
        updatedAt: now,
      },
      problem: {
        id: 'task_problem_fixture',
        rootPositionSgf: '(;SZ[19];B[dd])',
        sideToMove: 'white',
        prompt: 'Golden problem prompt',
        origin: {provider: 'local', externalId: 'golden-problem'},
        createdAt: now,
        updatedAt: now,
      },
      fox: {
        id: 'task_fox_yiwoo_fixture',
        rootPositionSgf: '(;SZ[19];B[dd];W[qq])',
        title: 'YiWoo Fox fixture',
        origin: {provider: 'fox', externalId: 'YiWoo'},
        createdAt: now,
        updatedAt: now,
      },
      oneOhOne: {
        id: 'task_101_fixture',
        rootPositionSgf: '(;SZ[19];B[dd])',
        sideToMove: 'black',
        prompt: 'Golden 101 problem prompt',
        origin: {provider: '101', externalId: 'golden-101'},
        createdAt: now,
        updatedAt: now,
      },
    }
    const taskById = new Map(Object.values(tasks).map((task) => [task.id, task]))
    const originalLoadTask = ctx.repository.loadTask.bind(ctx.repository)
    const originalFindTaskBySource = ctx.repository.findTaskBySource.bind(ctx.repository)
    const originalImportFoxGame = ctx.taskImportService.importFoxGame.bind(
      ctx.taskImportService,
    )
    const originalImport101Problem = ctx.taskImportService.import101Problem.bind(
      ctx.taskImportService,
    )
    const originalOpenPlayTab = ctx.tabService.openPlayTab.bind(ctx.tabService)
    const originalOpenProblemTab = ctx.tabService.openProblemTab.bind(ctx.tabService)

    window.__sabaki.__goldenPathHarness = {
      openPlayTab: [],
      openProblemTab: [],
      openCalls: [],
      sourceLookups: [],
      imports: [],
    }

    ctx.repository.loadTask = async (taskId) => {
      if (taskById.has(taskId)) return taskById.get(taskId)
      return originalLoadTask(taskId)
    }
    ctx.repository.findTaskBySource = async (source) => {
      const provider = source?.provider || source?.kind
      window.__sabaki.__goldenPathHarness.sourceLookups.push(source)
      if (provider === 'fox') return tasks.fox
      if (provider === '101' || provider === 'problem') return tasks.oneOhOne
      return originalFindTaskBySource(source)
    }
    ctx.taskImportService.importFoxGame = async (input) => {
      window.__sabaki.__goldenPathHarness.imports.push({provider: 'fox', input})
      return tasks.fox
    }
    ctx.taskImportService.import101Problem = async (input) => {
      window.__sabaki.__goldenPathHarness.imports.push({provider: '101', input})
      return tasks.oneOhOne
    }
    ctx.tabService.openPlayTab = async (opts) => {
      window.__sabaki.__goldenPathHarness.openPlayTab.push(opts)
      window.__sabaki.__goldenPathHarness.openCalls.push({kind: 'openPlayTab', opts})
      return originalOpenPlayTab(opts)
    }
    ctx.tabService.openProblemTab = async (opts) => {
      window.__sabaki.__goldenPathHarness.openProblemTab.push(opts)
      window.__sabaki.__goldenPathHarness.openCalls.push({kind: 'openProblemTab', opts})
      return originalOpenProblemTab(opts)
    }

    ctx.libraryProjection = {
      history: [
        {
          id: 'history-current',
          index: 0,
          title: 'Golden current history',
          meta: '当前打开 · 2 手',
        },
      ],
      kifu: [
        {
          id: tasks.kifu.id,
          taskId: tasks.kifu.id,
          title: tasks.kifu.title,
          source: 'local',
        },
      ],
      gameRecords: [
        {
          id: tasks.savedGame.id,
          taskId: tasks.savedGame.id,
          title: tasks.savedGame.title,
          source: 'play',
        },
      ],
      problems: [
        {
          id: tasks.problem.id,
          taskId: tasks.problem.id,
          title: 'Golden problem fixture',
          type: 'best_move',
        },
      ],
      fox: {
        status: 'synced',
        message: 'YiWoo ready',
        rows: [{id: tasks.fox.id, taskId: tasks.fox.id, title: tasks.fox.title}],
      },
      oneOhOne: {
        status: 'synced',
        message: '101 ready',
        rows: [
          {id: tasks.oneOhOne.id, taskId: tasks.oneOhOne.id, title: tasks.oneOhOne.title},
        ],
      },
    }

    const state = ctx.workbenchStore.getState()
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId)
    if (activeTab) ctx.workbenchStore.updateTab(activeTab.id, {})
  }, NOW)
}

async function latestOpen(page) {
  return page.evaluate(() => {
    const harness = window.__sabaki.__goldenPathHarness
    const calls = harness.openCalls
    return calls[calls.length - 1] || null
  })
}

async function activeTab(page) {
  return page.evaluate(() => {
    const ctx = window.__sabaki.getTrainingContext()
    const state = ctx.workbenchStore.getState()
    return state.tabs.find((tab) => tab.id === state.activeTabId) || null
  })
}

async function clickLibraryRow(page, text) {
  const row = page
    .locator('[data-testid="library-side-drawer"] .wb-library-drawer__item button')
    .filter({hasText: text})
    .first()
  await expect(row).toBeVisible()
  await row.click()
}

async function ensureLibraryOpen(page) {
  if (await page.locator('[data-testid="library-side-drawer"]').isVisible()) {
    return
  }

  await page.locator('button[aria-label="打开资料库"]').click()
  await expect(page.locator('[data-testid="library-side-drawer"]')).toBeVisible()
}

async function closeLibraryIfOpen(page) {
  const drawer = page.locator('[data-testid="library-side-drawer"]')
  if (!(await drawer.isVisible())) return

  await drawer.locator('.wb-library-drawer__close').click()
  await expect(drawer).toHaveCount(0)
}

test.describe('Workbench golden path smoke', () => {
  test.beforeEach(async ({electronApp, page}) => {
    const browserWindow = await electronApp.browserWindow(page)
    await browserWindow.evaluate((win) => win.setContentSize(1280, 800))
    await expect(page.locator('[data-testid="main-board-stage"]')).toBeVisible()
    await page.evaluate(() => window.__sabaki.setMode('play'))
  })

  test('new game opens settings and can start a configured human game', async ({
    page,
  }) => {
    await page.locator('[data-testid="mode-action-new-game"]:visible').click()

    const dialog = page.locator('.new-game-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('新对局设置')
    await expect(dialog).toContainText('对局双方')
    await expect(dialog).toContainText('用时规则')

    await dialog.getByRole('button', {name: /开始对局/}).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('#goban')).toBeVisible()
  })

  test('history, kifu, saved game, problem, Fox, and 101 entries open Workbench targets', async ({
    page,
  }) => {
    await installGoldenPathHarness(page)

    await ensureLibraryOpen(page)

    await clickLibraryRow(page, 'Golden current history')
    expect(await activeTab(page)).toMatchObject({mode: 'play'})

    await ensureLibraryOpen(page)
    await page.locator('[data-testid="library-tab-kifu"]').click()
    await clickLibraryRow(page, 'Golden kifu fixture')
    expect(await latestOpen(page)).toMatchObject({
      kind: 'openPlayTab',
      opts: {taskId: 'task_kifu_fixture'},
    })
    expect(await activeTab(page)).toMatchObject({
      taskId: 'task_kifu_fixture',
      mode: 'play',
    })

    await ensureLibraryOpen(page)
    await page.locator('[data-testid="library-tab-game-records"]').click()
    await clickLibraryRow(page, 'Golden saved game fixture')
    expect(await latestOpen(page)).toMatchObject({
      kind: 'openPlayTab',
      opts: {taskId: 'task_saved_game_fixture'},
    })

    await ensureLibraryOpen(page)
    await page.locator('[data-testid="library-tab-problems"]').click()
    await clickLibraryRow(page, 'Golden problem fixture')
    expect(await latestOpen(page)).toMatchObject({
      kind: 'openProblemTab',
      opts: {taskId: 'task_problem_fixture'},
    })
    expect(await activeTab(page)).toMatchObject({
      taskId: 'task_problem_fixture',
      mode: 'problem',
    })

    await closeLibraryIfOpen(page)
    await ensureLibraryOpen(page)
    await page.locator('[data-testid="library-source-fox"]').click()
    expect(await latestOpen(page)).toMatchObject({
      kind: 'openPlayTab',
      opts: {taskId: 'task_fox_yiwoo_fixture'},
    })

    await closeLibraryIfOpen(page)
    await ensureLibraryOpen(page)
    await page.locator('[data-testid="library-source-101"]').click()
    expect(await latestOpen(page)).toMatchObject({
      kind: 'openProblemTab',
      opts: {taskId: 'task_101_fixture'},
    })
  })
})
