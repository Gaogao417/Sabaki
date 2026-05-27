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

  it('opens a Fox id input and submits the id to the source handler', async () => {
    const submitted = []
    const {container, fireEvent} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'kifu',
        onOpenFoxGames: async (gameId) => submitted.push(gameId),
      }),
    )

    fireEvent.click(container.querySelector('[data-testid="library-source-fox-id-toggle"]'))
    await Promise.resolve()

    const input = container.querySelector('[data-testid="library-source-fox-id-input"]')
    assert.ok(input, 'Fox id input should appear after clicking the side button')
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
        type: 'kifu',
        onOpenOneOhOneWeiqi: async (problemId) => submitted.push(problemId),
      }),
    )

    fireEvent.click(container.querySelector('[data-testid="library-source-101-id-toggle"]'))
    await Promise.resolve()

    const input = container.querySelector('[data-testid="library-source-101-id-input"]')
    assert.ok(input, '101 id input should appear after clicking the side button')
    input.value = '101_problem_9'

    const form = container.querySelector('.wb-library-drawer__source-id-form')
    form.dispatchEvent(new domWindow.Event('submit', {bubbles: true, cancelable: true}))
    await Promise.resolve()
    await Promise.resolve()

    assert.deepStrictEqual(submitted, ['101_problem_9'])
  })
})
