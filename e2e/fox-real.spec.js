const {expect} = require('@playwright/test')
const {test} = require('./fixtures/electron-app')

const FOX_USER_ID = 'YiWoo'
const RUN_REAL_FOX = process.env.SABAKI_E2E_REAL_FOX === '1'

test.describe('Real Fox data wiring', () => {
  test.skip(!RUN_REAL_FOX, 'Set SABAKI_E2E_REAL_FOX=1 to hit the real FoxWQ API')

  test('YiWoo public games can be fetched, imported as a TrainingTask, and opened', async ({
    page,
  }) => {
    const result = await page.evaluate(async (userId) => {
      const user = await window.sabaki.fox.queryUserByName(userId)
      if (!user.success) return {stage: 'query-user', user}

      const list = await window.sabaki.fox.fetchGameList(user.uid, '')
      if (!list.success || !Array.isArray(list.games) || list.games.length === 0) {
        return {stage: 'fetch-list', user, list}
      }

      const first = list.games.find((game) => game.chessid != null)
      const chessid = String(first.chessid)
      const ctx = window.__sabaki.getTrainingContext()
      const task = await ctx.taskImportService.importFoxGame({gameId: chessid})
      const tab = await ctx.tabService.openTask({taskId: task.id})

      return {
        stage: 'done',
        uid: user.uid,
        chessid,
        task: {
          id: task.id,
          provider: task.origin?.provider,
          externalId: task.origin?.externalId,
          rootPositionSgfLength: task.rootPositionSgf?.length || 0,
        },
        tab: {
          id: tab.id,
          taskId: tab.taskId,
          mode: tab.mode,
        },
      }
    }, FOX_USER_ID)

    expect(result.stage).toBe('done')
    expect(result.uid).toMatch(/^\d+$/)
    expect(result.task).toMatchObject({
      provider: 'fox',
      externalId: result.chessid,
    })
    expect(result.task.rootPositionSgfLength).toBeGreaterThan(10)
    expect(result.tab).toMatchObject({
      taskId: result.task.id,
      mode: 'play',
    })
  })
})
