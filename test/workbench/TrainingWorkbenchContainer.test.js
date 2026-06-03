import assert from 'assert'
import {h} from 'preact'

import {renderToDom} from './preactTestHelper.js'
import TrainingWorkbenchContainer from '../../src/components/TrainingWorkbenchContainer.js'

function createSabakiStub(overrides = {}) {
  const runtimeStore = {
    getState: () => ({}),
    subscribe: () => () => {},
  }

  const workbenchStore = {
    getState: () => ({tabs: [], activeTabId: null}),
    subscribe: () => () => {},
  }
  const trainingContext = {
    runtimeStore,
    workbenchStore,
    legacyTrainingFlowController: {
      showRecallHint: () => {},
      skipRecallMove: () => {},
      endRecallSession: () => {},
      undoProblemMove: () => {},
      submitProblemAttempt: () => {},
      exitProblemMode: () => {},
      advanceReview: () => {},
    },
    ...(overrides.trainingContext || {}),
  }

  return {
    openDrawer: () => {},
    setMode: () => {},
    makeResign: () => {},
    undo: () => {},
    makeMove: () => {},
    getTrainingContext: () => trainingContext,
    ...overrides,
  }
}

describe('TrainingWorkbenchContainer new game wiring', () => {
  it('opens the new game settings dialog from the play action', () => {
    let openedDrawer = null
    const sabaki = createSabakiStub({
      openDrawer: (drawer) => {
        openedDrawer = drawer
      },
    })

    const {queryByTestId, fireEvent} = renderToDom(
      h(TrainingWorkbenchContainer, {sabaki, mode: 'play'}),
    )

    const newGameButton = queryByTestId('mode-action-new-game')
    assert.ok(newGameButton, 'Expected play mode new game action to render')

    fireEvent.click(newGameButton)

    assert.strictEqual(openedDrawer, 'newgame')
  })

  it('opens the left game library drawer from the play mode left panel', async () => {
    const sabaki = createSabakiStub()

    const {queryByTestId, fireEvent} = renderToDom(
      h(TrainingWorkbenchContainer, {
        sabaki,
        mode: 'play',
        gameTrees: [],
        gameIndex: 0,
      }),
    )

    const libraryButton = queryByTestId('open-game-library-btn')
    assert.ok(libraryButton, 'Expected open-game-library button to render')

    fireEvent.click(libraryButton)
    await new Promise((resolve) => setTimeout(resolve, 0))

    const drawer = queryByTestId('library-side-drawer')
    assert.ok(drawer, 'Expected left library drawer to render')
    assert.ok(drawer.textContent.includes('棋谱库'))
  })

  it('opens the library drawer from the topbar command button', async () => {
    const sabaki = createSabakiStub()

    const {container, fireEvent} = renderToDom(
      h(TrainingWorkbenchContainer, {
        sabaki,
        mode: 'play',
        gameTrees: [],
        gameIndex: 0,
      }),
    )

    const libraryButton = container.querySelector('button[aria-label="打开资料库"]')
    assert.ok(libraryButton, 'Expected topbar library command button to render')

    fireEvent.click(libraryButton)
    await new Promise((resolve) => setTimeout(resolve, 0))

    const drawer = container.querySelector('[data-testid="library-side-drawer"]')
    assert.ok(drawer, 'Expected topbar library command to render the library drawer')
    assert.ok(drawer.textContent.includes('棋谱库'))
  })

  it('opens the left wrong-problem drawer from the play mode left panel', async () => {
    const sabaki = createSabakiStub()

    const {queryByTestId, fireEvent} = renderToDom(
      h(TrainingWorkbenchContainer, {
        sabaki,
        mode: 'play',
        gameTrees: [],
        gameIndex: 0,
      }),
    )

    const wrongProblemButton = queryByTestId('open-wrong-problems-btn')
    assert.ok(wrongProblemButton, 'Expected open-wrong-problems button to render')

    fireEvent.click(wrongProblemButton)
    await new Promise((resolve) => setTimeout(resolve, 0))

    const drawer = queryByTestId('library-side-drawer')
    assert.ok(drawer, 'Expected left library drawer to render')
    assert.ok(drawer.textContent.includes('错题库'))
  })

  it('opens visible problem rows through semantic Workbench problem tabs, not legacy startProblem', async () => {
    const calls = {
      createTaskFromLegacyProblem: [],
      openPlayTab: [],
      openProblemTab: [],
      startProblem: [],
      setMode: [],
    }
    const sabaki = createSabakiStub({
      trainingContext: {
        taskImportService: {
          async createTaskFromLegacyProblem(input) {
            calls.createTaskFromLegacyProblem.push(input)
            return {id: 'task_from_visible_problem_row'}
          },
        },
        tabService: {
          async openPlayTab(input) {
            calls.openPlayTab.push(input)
            return {id: 'tab_unexpected_play', taskId: input.taskId, mode: 'play'}
          },
          async openProblemTab(input) {
            calls.openProblemTab.push(input)
            return {id: 'tab_from_visible_problem_row', taskId: input.taskId, mode: 'problem'}
          },
        },
        repository: {
          async loadTask() { return null },
        },
      },
      async startProblem(id) {
        calls.startProblem.push(id)
        throw new Error('sabaki.startProblem should not be called for visible Workbench problem rows')
      },
      setMode(mode) {
        calls.setMode.push(mode)
      },
    })

    const {container, queryByTestId, fireEvent} = renderToDom(
      h(TrainingWorkbenchContainer, {
        sabaki,
        mode: 'play',
        gameTrees: [],
        gameIndex: 0,
        libraryProjection: {
          problems: [{
            id: 'legacy_problem_visible_row',
            title: 'Visible problem row',
            type: 'best_move',
          }],
        },
      }),
    )

    fireEvent.click(queryByTestId('open-wrong-problems-btn'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const problemButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('Visible problem row'))
    assert.ok(problemButton, 'Expected projected problem row button to render')

    fireEvent.click(problemButton)
    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.deepStrictEqual(calls.startProblem, [],
      'visible Workbench problem rows must not call sabaki.startProblem')
    assert.deepStrictEqual(calls.openPlayTab, [],
      'visible Workbench problem rows must not call openPlayTab')
    assert.deepStrictEqual(calls.setMode.filter(mode => mode === 'play'), [],
      'visible Workbench problem rows must not enter legacy play mode')
    assert.deepStrictEqual(calls.createTaskFromLegacyProblem, [{
      problemId: 'legacy_problem_visible_row',
    }])
    assert.deepStrictEqual(calls.openProblemTab, [{
      taskId: 'task_from_visible_problem_row',
    }])
  })
})
