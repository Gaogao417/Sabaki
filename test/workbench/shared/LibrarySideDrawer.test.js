import assert from 'assert'
import {h} from 'preact'

import LibrarySideDrawer from '../../../src/components/workbench/shared/LibrarySideDrawer.js'
import {renderToDom, window as domWindow} from '../preactTestHelper.js'

describe('LibrarySideDrawer golden path row routing', () => {
  it('renders only kifu and problem tabs while legacy types map to kifu', () => {
    const {container} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'game-records',
        gameTrees: [],
      }),
    )

    const tabs = Array.from(container.querySelectorAll('.wb-library-drawer__tabs button'))
    assert.deepStrictEqual(tabs.map((tab) => tab.textContent.trim()), [
      '棋谱库',
      '错题库',
    ])
    assert.ok(container.querySelector('[data-testid="library-tab-kifu"]').className.includes('active'))
    assert.strictEqual(container.querySelector('[data-testid="library-tab-history"]'), null)
    assert.strictEqual(container.querySelector('[data-testid="library-tab-game-records"]'), null)
    assert.ok(!container.textContent.includes('历史记录'))
    assert.ok(!container.textContent.includes('历史问题'))
    assert.ok(!container.textContent.includes('对局库'))
  })

  it('combines history, kifu, and game record projections in the kifu library', () => {
    const {container} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'history',
        libraryProjection: {
          history: [{id: 'history_1', title: 'Recent history fixture'}],
          kifu: [{id: 'kifu_1', title: 'Saved kifu fixture'}],
          gameRecords: [{id: 'record_1', title: 'Game record fixture'}],
        },
      }),
    )

    assert.ok(container.textContent.includes('Recent history fixture'))
    assert.ok(container.textContent.includes('Saved kifu fixture'))
    assert.ok(container.textContent.includes('Game record fixture'))
  })

  it('opens projected kifu rows through onOpenLibraryTask', () => {
    const opened = []
    const {container, fireEvent} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'kifu',
        libraryProjection: {
          kifu: [
            {
              id: 'task_kifu_fixture',
              taskId: 'task_kifu_fixture',
              title: 'Golden kifu fixture',
            },
          ],
        },
        onOpenLibraryTask: (row) => opened.push(row),
      }),
    )

    const button = Array.from(container.querySelectorAll('.wb-library-drawer__item button'))
      .find((item) => item.textContent.includes('Golden kifu fixture'))
    assert.ok(button, 'projected kifu row should render as a clickable row')

    fireEvent.click(button)

    assert.deepStrictEqual(opened.map((row) => row.taskId), [
      'task_kifu_fixture',
    ])
  })

  it('opens projected 101 rows through problem task routing', () => {
    const opened = []
    const {container, fireEvent} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'problems',
        libraryProjection: {
          oneOhOne: {
            status: 'synced',
            rows: [
              {
                id: 'task_101_fixture',
                taskId: 'task_101_fixture',
                title: 'Golden 101 problem',
              },
            ],
          },
        },
        onStartProblem: (id, row) => opened.push({id, row}),
      }),
    )

    const button = Array.from(container.querySelectorAll('.wb-library-drawer__item button'))
      .find((item) => item.textContent.includes('Golden 101 problem'))
    assert.ok(button, 'projected 101 row should render as a clickable row')

    fireEvent.click(button)

    assert.deepStrictEqual(opened, [
      {
        id: 'task_101_fixture',
        row: {
          id: 'task_101_fixture',
          taskId: 'task_101_fixture',
          title: 'Golden 101 problem',
        },
      },
    ])
  })

  it('shows source failures with color state instead of visible failure text', () => {
    const {container} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'kifu',
        librarySourceStates: {
          fox: {status: 'error', error: '野狐账号不可用'},
        },
      }),
    )

    const sourceButton = container.querySelector('[data-testid="library-source-fox"]')
    assert.ok(sourceButton, 'Fox source button should render')
    assert.ok(
      sourceButton.className.includes('wb-library-drawer__source--error'),
      'Failed source should expose the error state class for color styling',
    )
    assert.ok(!sourceButton.textContent.includes('失败'), 'Failure state should not render literal "失败" text')
    assert.strictEqual(sourceButton.getAttribute('title'), '野狐账号不可用')
  })

  it('renders Fox only in the kifu library and 101 only in the problem library', () => {
    const {container: kifuContainer} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'kifu',
      }),
    )

    assert.ok(
      kifuContainer.querySelector('[data-testid="library-source-fox"]'),
      'Kifu library should render the Fox source button',
    )
    assert.strictEqual(
      kifuContainer.querySelector('[data-testid="library-source-101"]'),
      null,
      'Kifu library should not render the 101 source button',
    )

    const {container: problemContainer} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'problems',
      }),
    )

    assert.ok(
      problemContainer.querySelector('[data-testid="library-source-101"]'),
      'Problem library should render the 101 source button',
    )
    assert.strictEqual(
      problemContainer.querySelector('[data-testid="library-source-fox"]'),
      null,
      'Problem library should not render the Fox source button',
    )
  })

  it('opens a Fox id input and submits the id to the source handler', async () => {
    const submitted = []
    const {container, fireEvent} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'kifu',
        onOpenFoxGames: async (gameId) => submitted.push(gameId),
      }),
    )

    const toggle = container.querySelector('[data-testid="library-source-fox-id-toggle"]')
    assert.strictEqual(
      container.querySelector('[data-testid="library-source-fox-id-input"]'),
      null,
      'Fox id input should be collapsed by default',
    )
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'false')

    fireEvent.click(toggle)
    await Promise.resolve()

    const input = container.querySelector('[data-testid="library-source-fox-id-input"]')
    assert.ok(input, 'Fox id input should appear after clicking the side button')
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'true')
    input.value = 'fox_game_42'

    const form = container.querySelector('.wb-library-drawer__source-id-form')
    form.dispatchEvent(new domWindow.Event('submit', {bubbles: true, cancelable: true}))
    await Promise.resolve()
    await Promise.resolve()

    assert.deepStrictEqual(submitted, ['fox_game_42'])
  })

  it('opens a 101 id input and submits the id to the source handler', async () => {
    const submitted = []
    const {container, fireEvent} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'problems',
        onOpenOneOhOneWeiqi: async (problemId) => submitted.push(problemId),
      }),
    )

    const toggle = container.querySelector('[data-testid="library-source-101-id-toggle"]')
    assert.strictEqual(
      container.querySelector('[data-testid="library-source-101-id-input"]'),
      null,
      '101 id input should be collapsed by default',
    )
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'false')

    fireEvent.click(toggle)
    await Promise.resolve()

    const input = container.querySelector('[data-testid="library-source-101-id-input"]')
    assert.ok(input, '101 id input should appear after clicking the side button')
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'true')
    input.value = '101_problem_9'

    const form = container.querySelector('.wb-library-drawer__source-id-form')
    form.dispatchEvent(new domWindow.Event('submit', {bubbles: true, cancelable: true}))
    await Promise.resolve()
    await Promise.resolve()

    assert.deepStrictEqual(submitted, ['101_problem_9'])
  })

  it('toggles history and all locally without adding legacy tabs', async () => {
    const {container, fireEvent} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'kifu',
        libraryProjection: {
          kifu: [
            {
              id: 'history_row',
              title: 'History scoped row',
              black: '柯洁',
              white: '申真谞',
              scope: 'history',
            },
            {
              id: 'all_row',
              title: 'All scoped row',
              black: '朴廷桓',
              white: '李轩豪',
              scope: 'all',
            },
          ],
        },
      }),
    )

    const historyToggle = container.querySelector('[data-testid="library-scope-history"]')
    const allToggle = container.querySelector('[data-testid="library-scope-all"]')
    assert.ok(historyToggle.className.includes('active'), 'History should be active by default for kifu')
    assert.ok(container.textContent.includes('柯洁 / 申真谞'))
    assert.ok(!container.textContent.includes('朴廷桓 / 李轩豪'))

    fireEvent.click(allToggle)
    await Promise.resolve()

    assert.ok(allToggle.className.includes('active'), 'All toggle should become active')
    assert.strictEqual(container.querySelector('[data-testid="library-tab-history"]'), null)
    assert.strictEqual(container.querySelector('[data-testid="library-tab-game-records"]'), null)
    assert.ok(container.textContent.includes('朴廷桓 / 李轩豪'))
  })

  it('keeps only one filter popover open at a time', async () => {
    const {container, fireEvent} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'kifu',
        libraryProjection: {
          kifu: [{id: 'kifu_1', black: '柯洁', white: '申真谞'}],
        },
      }),
    )

    fireEvent.click(container.querySelector('[data-testid="library-filter-kifu-players"]'))
    await Promise.resolve()
    assert.ok(container.querySelector('[data-testid="library-popover-kifu-players"]'))

    fireEvent.click(container.querySelector('[data-testid="library-filter-kifu-date"]'))
    await Promise.resolve()
    assert.strictEqual(container.querySelector('[data-testid="library-popover-kifu-players"]'), null)
    assert.ok(container.querySelector('[data-testid="library-popover-kifu-date"]'))
  })

  it('renders separated kifu filter controls without mixing their popover content', async () => {
    const {container, fireEvent} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'kifu',
        libraryProjection: {
          kifu: [{id: 'kifu_1', black: '柯洁', white: '申真谞', rule: '中国规则', timeControl: '30m + 读秒'}],
        },
      }),
    )

    for (const id of [
      'library-filter-kifu-sort',
      'library-filter-kifu-players',
      'library-filter-kifu-date',
      'library-filter-kifu-rules',
      'library-filter-kifu-timeControls',
    ]) {
      assert.ok(container.querySelector(`[data-testid="${id}"]`), `Missing ${id}`)
    }

    fireEvent.click(container.querySelector('[data-testid="library-filter-kifu-players"]'))
    await Promise.resolve()
    const players = container.querySelector('[data-testid="library-popover-kifu-players"]')
    assert.ok(players.textContent.includes('黑方'))
    assert.ok(players.textContent.includes('白方'))
    assert.ok(players.querySelector('input'))
    assert.ok(!players.textContent.includes('本周'), 'Player popover must not contain date shortcuts')

    fireEvent.click(container.querySelector('[data-testid="library-filter-kifu-date"]'))
    await Promise.resolve()
    const date = container.querySelector('[data-testid="library-popover-kifu-date"]')
    assert.ok(date.textContent.includes('本周'))
    assert.ok(date.textContent.includes('本月'))
    assert.ok(!date.querySelector('input'), 'Date popover should stay calendar/shortcut based')

    fireEvent.click(container.querySelector('[data-testid="library-filter-kifu-rules"]'))
    await Promise.resolve()
    const rules = container.querySelector('[data-testid="library-popover-kifu-rules"]')
    assert.ok(rules.textContent.includes('中国规则'))
    assert.ok(!rules.textContent.includes('快棋'), 'Rule popover must not contain time-control chips')

    fireEvent.click(container.querySelector('[data-testid="library-filter-kifu-timeControls"]'))
    await Promise.resolve()
    const time = container.querySelector('[data-testid="library-popover-kifu-timeControls"]')
    assert.ok(time.textContent.includes('快棋'))
    assert.ok(time.textContent.includes('30m + 读秒'))
    assert.ok(!time.textContent.includes('中国规则'), 'Time popover must not contain rule chips')
  })

  it('renders separated problem filter controls without mixing their popover content', async () => {
    const {container, fireEvent} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'problems',
        libraryProjection: {
          oneOhOne: {
            rows: [{id: '58312', qid: 'Q-58312', type: '死活', difficulty: '2D', description: '角部净活'}],
          },
        },
      }),
    )

    for (const id of [
      'library-filter-problem-sort',
      'library-filter-problem-query',
      'library-filter-problem-date',
      'library-filter-problem-difficulty',
      'library-filter-problem-types',
    ]) {
      assert.ok(container.querySelector(`[data-testid="${id}"]`), `Missing ${id}`)
    }

    fireEvent.click(container.querySelector('[data-testid="library-filter-problem-query"]'))
    await Promise.resolve()
    const query = container.querySelector('[data-testid="library-popover-problem-query"]')
    assert.ok(query.querySelector('input'))
    assert.ok(query.textContent.includes('Q-58312'))
    assert.ok(!query.textContent.includes('10K'), 'Query popover must not contain difficulty chips')

    fireEvent.click(container.querySelector('[data-testid="library-filter-problem-difficulty"]'))
    await Promise.resolve()
    const difficulty = container.querySelector('[data-testid="library-popover-problem-difficulty"]')
    assert.ok(difficulty.textContent.includes('10K'))
    assert.ok(difficulty.textContent.includes('5D'))
    assert.strictEqual(difficulty.querySelector('input'), null, 'Difficulty must use range chips, not inputs')

    fireEvent.click(container.querySelector('[data-testid="library-filter-problem-types"]'))
    await Promise.resolve()
    const types = container.querySelector('[data-testid="library-popover-problem-types"]')
    assert.ok(types.textContent.includes('死活'))
    assert.ok(types.textContent.includes('手筋'))
    assert.ok(!types.textContent.includes('10K'), 'Type popover must not contain difficulty chips')
  })

  it('keeps right-side kifu tiles lightweight and hides problem-style QID text', () => {
    const {container} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'kifu',
        libraryProjection: {
          kifu: [
            {
              id: 'kifu_qid_guard',
              title: 'Q-999 should not render in the tile',
              qid: 'Q-999',
              black: '柯洁',
              white: '申真谞',
              date: '2026-05-28',
              result: 'W+2.5',
            },
          ],
        },
      }),
    )

    const tile = container.querySelector('[data-testid="library-kifu-tile"]')
    assert.ok(tile.textContent.includes('柯洁 / 申真谞'))
    assert.ok(tile.textContent.includes('2026-05-28 · W+2.5'))
    assert.ok(!tile.textContent.includes('Q-999'), 'Kifu tile should not render problem-style QID text')
  })

  it('keeps right-side problem tiles focused on QID and type', () => {
    const {container} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'problems',
        libraryProjection: {
          oneOhOne: {
            rows: [
              {
                id: '58312',
                qid: 'Q-58312',
                type: '死活',
                difficulty: '2D',
                description: '角部净活',
              },
            ],
          },
        },
      }),
    )

    const tile = container.querySelector('[data-testid="library-problem-tile"]')
    assert.ok(tile.textContent.includes('死活 Q-58312'))
    assert.ok(tile.textContent.includes('2D · 角部净活'))
  })
})
