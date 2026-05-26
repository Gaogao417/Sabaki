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

  return {
    openDrawer: () => {},
    setMode: () => {},
    makeResign: () => {},
    undo: () => {},
    makeMove: () => {},
    getTrainingContext: () => ({
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
    }),
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
})
