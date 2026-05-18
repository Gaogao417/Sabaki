/**
 * StoneStatus Contract Tests (Phase U2)
 *
 * Test contract: docs/design/2026-05-19/phase-u2-structural/test-contract-v0.1.md
 * Contracts covered: T-U2-1a, T-U2-1b, T-U2-1c
 *
 * Test Legitimacy:
 *   All tests import the production StoneStatus component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper; props are inline.
 *
 * NOTE: StoneStatus is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let StoneStatus = null

describe('StoneStatus (T-U2-1)', function () {
  before(async function () {
    StoneStatus = await tryImport('src/components/workbench/shell/StoneStatus.js')
    if (!StoneStatus) this.skip()
  })

  // --- T-U2-1a: renders black stone indicator (.wb-stone-indicator--black) and capture count ---
  // Production subject: StoneStatus component
  // Production import path: src/components/workbench/shell/StoneStatus.js
  // Production bug: StoneStatus does not render a .wb-stone-indicator--black element,
  //   or does not display the black capture count
  // Controlled dependencies: props are inline test data
  it('T-U2-1a: renders black stone indicator with capture count', () => {
    const {container} = renderToDom(
      h(StoneStatus, {
        blackCaptures: 3,
        whiteCaptures: 5,
        currentPlayer: 'black',
      })
    )

    const blackIndicator = container.querySelector('.wb-stone-indicator--black')
    assert.ok(blackIndicator, 'Expected element with class .wb-stone-indicator--black')

    // The black capture count should appear in the component output
    assert.ok(
      container.textContent.includes('3'),
      'Expected black capture count "3" in rendered output'
    )
  })

  // --- T-U2-1b: renders white stone indicator (.wb-stone-indicator--white) and capture count ---
  // Production subject: StoneStatus component
  // Production import path: src/components/workbench/shell/StoneStatus.js
  // Production bug: StoneStatus does not render a .wb-stone-indicator--white element,
  //   or does not display the white capture count
  // Controlled dependencies: props are inline test data
  it('T-U2-1b: renders white stone indicator with capture count', () => {
    const {container} = renderToDom(
      h(StoneStatus, {
        blackCaptures: 3,
        whiteCaptures: 5,
        currentPlayer: 'black',
      })
    )

    const whiteIndicator = container.querySelector('.wb-stone-indicator--white')
    assert.ok(whiteIndicator, 'Expected element with class .wb-stone-indicator--white')

    // The white capture count should appear in the component output
    assert.ok(
      container.textContent.includes('5'),
      'Expected white capture count "5" in rendered output'
    )
  })

  // --- T-U2-1c: current turn has active marker ---
  // Production subject: StoneStatus component
  // Production import path: src/components/workbench/shell/StoneStatus.js
  // Production bug: StoneStatus does not distinguish the current player's indicator
  //   (no active marker on the indicator corresponding to currentPlayer)
  // Controlled dependencies: props are inline test data
  it('T-U2-1c: current player indicator has active marker', () => {
    const {container} = renderToDom(
      h(StoneStatus, {
        blackCaptures: 0,
        whiteCaptures: 0,
        currentPlayer: 'black',
      })
    )

    // When currentPlayer is 'black', the black indicator should have an active state
    const blackIndicator = container.querySelector('.wb-stone-indicator--black')
    assert.ok(blackIndicator, 'Expected .wb-stone-indicator--black element')

    const blackClassList = blackIndicator.className || ''
    assert.ok(
      blackClassList.includes('--active') || blackClassList.includes('active'),
      `Black indicator should have active class when currentPlayer="black", got "${blackClassList}"`
    )

    // White indicator should NOT be active
    const whiteIndicator = container.querySelector('.wb-stone-indicator--white')
    assert.ok(whiteIndicator, 'Expected .wb-stone-indicator--white element')

    const whiteClassList = whiteIndicator.className || ''
    assert.ok(
      !(whiteClassList.includes('--active') || whiteClassList.includes('active')),
      `White indicator should NOT have active class when currentPlayer="black", got "${whiteClassList}"`
    )
  })

  // --- T-U2-1c (supplement): white turn has active marker ---
  it('T-U2-1c: white player indicator has active marker when currentPlayer=white', () => {
    const {container} = renderToDom(
      h(StoneStatus, {
        blackCaptures: 2,
        whiteCaptures: 1,
        currentPlayer: 'white',
      })
    )

    const whiteIndicator = container.querySelector('.wb-stone-indicator--white')
    assert.ok(whiteIndicator, 'Expected .wb-stone-indicator--white element')

    const whiteClassList = whiteIndicator.className || ''
    assert.ok(
      whiteClassList.includes('--active') || whiteClassList.includes('active'),
      `White indicator should have active class when currentPlayer="white", got "${whiteClassList}"`
    )

    const blackIndicator = container.querySelector('.wb-stone-indicator--black')
    assert.ok(blackIndicator, 'Expected .wb-stone-indicator--black element')

    const blackClassList = blackIndicator.className || ''
    assert.ok(
      !(blackClassList.includes('--active') || blackClassList.includes('active')),
      `Black indicator should NOT have active class when currentPlayer="white", got "${blackClassList}"`
    )
  })
})
