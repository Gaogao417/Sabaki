const {expect} = require('@playwright/test')
const {test} = require('./fixtures/electron-app')

function vertexSelector([x, y]) {
  return `#goban > .shudan-content > .shudan-vertices > .shudan-vertex[data-x="${x}"][data-y="${y}"]`
}

async function installAiHarness(page) {
  await page.evaluate(() => {
    const syncer = {
      id: 'e2e_black_engine',
      engine: {name: 'E2E Black AI'},
      commands: ['genmove'],
      busy: false,
      _suspended: false,
      on() {},
      removeListener() {},
      controller: {
        on() {},
        removeListener() {},
      },
    }

    window.__sabaki.__workbenchNewGameAiHarness = {
      requestMove: [],
      legacyGenerateMove: [],
      legacyStartEngineGame: [],
    }
    window.__sabaki.setState({
      mode: 'play',
      engines: [{name: 'E2E Black AI', enabled: true}],
    })
    window.__sabaki.getOrAttachEngine = () => syncer

    const playServices = window.__sabaki.getPlayServices()
    playServices.engineService.generateMove = async (...args) => {
      window.__sabaki.__workbenchNewGameAiHarness.legacyGenerateMove.push(args)
      return null
    }
    playServices.engineService.startEngineGame = async (...args) => {
      window.__sabaki.__workbenchNewGameAiHarness.legacyStartEngineGame.push(args)
      return null
    }
    playServices.engineService.requestMove = async (input) => {
      const calls = window.__sabaki.__workbenchNewGameAiHarness.requestMove
      calls.push(input)
      return calls.length === 1
        ? {move: 'dd', candidates: ['dd']}
        : {move: 'dp', candidates: ['dp']}
    }
  })
}

async function activeAttempt(page) {
  return page.evaluate(async () => {
    const ctx = window.__sabaki.getTrainingContext()
    const state = ctx.workbenchStore.getState()
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId)
    const attempt = activeTab?.activeAttemptId
      ? await ctx.repository.loadAttempt(activeTab.activeAttemptId)
      : null
    return {activeTab, attempt}
  })
}

test.describe('Workbench new game AI', () => {
  test('dialog opens from the workbench new game action', async ({page}) => {
    await page.evaluate(() => window.__sabaki.setMode('play'))

    await page.locator('[data-testid="mode-action-new-game"]:visible').click()

    const dialog = page.locator('.new-game-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('新对局设置')
    await expect(dialog).toContainText('对局双方')
    await expect(dialog).toContainText('规则设置')
    await expect(dialog).toContainText('用时规则')
    await expect(dialog).toContainText('高级选项')
    await expect(dialog).toContainText('本地玩家')
    await expect(dialog).toContainText('开始对局')
    await expect(page.locator('#info.show')).toHaveCount(0)
  })

  test('black AI starts first and continues after a white human move through Workbench Play', async ({
    page,
  }) => {
    await installAiHarness(page)

    await page.locator('[data-testid="mode-action-new-game"]:visible').click()
    const dialog = page.locator('.new-game-dialog')
    await expect(dialog).toBeVisible()
    await dialog
      .locator('.new-game-dialog__player-row')
      .filter({hasText: '黑方'})
      .getByRole('button', {name: 'AI'})
      .click()
    await dialog.getByRole('button', {name: /开始对局/}).click()
    await expect(dialog).toHaveCount(0)

    await expect(async () => {
      const {activeTab, attempt} = await activeAttempt(page)
      expect(activeTab).toMatchObject({
        mode: 'play',
        playerConfig: {
          black: 'ai',
          white: 'human',
          ai: {engineId: 'e2e_black_engine', autoPlay: true},
        },
      })
      expect(attempt.userLine).toEqual(['dd'])
      expect(attempt.moveActors.map((actor) => actor.actor)).toEqual(['ai'])
    }).toPass({timeout: 5000})

    await expect(page.locator(vertexSelector([3, 3]))).toHaveClass(
      /shudan-sign_1/,
    )

    await page.locator(vertexSelector([16, 16])).click()

    await expect(async () => {
      const {attempt} = await activeAttempt(page)
      expect(attempt.userLine).toEqual(['dd', 'qq', 'dp'])
      expect(attempt.moveActors.map((actor) => actor.actor)).toEqual([
        'ai',
        'human',
        'ai',
      ])
    }).toPass({timeout: 5000})

    await expect(page.locator(vertexSelector([16, 16]))).toHaveClass(
      /shudan-sign_-1/,
    )
    await expect(page.locator(vertexSelector([3, 15]))).toHaveClass(
      /shudan-sign_1/,
    )

    const harness = await page.evaluate(
      () => window.__sabaki.__workbenchNewGameAiHarness,
    )
    expect(harness.requestMove).toHaveLength(2)
    expect(harness.requestMove.map((call) => call.engineId)).toEqual([
      'e2e_black_engine',
      'e2e_black_engine',
    ])
    expect(harness.legacyGenerateMove).toEqual([])
    expect(harness.legacyStartEngineGame).toEqual([])
  })
})
