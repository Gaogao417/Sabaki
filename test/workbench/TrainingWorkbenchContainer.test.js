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

  it('opens the game library drawer from the play mode left panel', () => {
    let openedDrawer = null
    const sabaki = createSabakiStub({
      openDrawer: (drawer) => {
        openedDrawer = drawer
      },
    })

    const {queryByTestId, fireEvent} = renderToDom(
      h(TrainingWorkbenchContainer, {sabaki, mode: 'play'}),
    )

    const libraryButton = queryByTestId('open-game-library-btn')
    assert.ok(libraryButton, 'Expected open-game-library button to render')

    fireEvent.click(libraryButton)

    assert.strictEqual(openedDrawer, 'gamechooser')
  })

  it('opens the wrong-problem drawer from the play mode left panel', () => {
    let openedDrawer = null
    const sabaki = createSabakiStub({
      openDrawer: (drawer) => {
        openedDrawer = drawer
      },
    })

    const {queryByTestId, fireEvent} = renderToDom(
      h(TrainingWorkbenchContainer, {sabaki, mode: 'play'}),
    )

    const wrongProblemButton = queryByTestId('open-wrong-problems-btn')
    assert.ok(wrongProblemButton, 'Expected open-wrong-problems button to render')

    fireEvent.click(wrongProblemButton)

    assert.strictEqual(openedDrawer, 'training')
  })
})
