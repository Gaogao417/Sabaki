/**
 * ProblemRightPanel Contract Tests (Phase 6)
 *
 * Contracts covered: T-6.2a through T-6.2d
 *
 * Test Legitimacy:
 *   All tests import the production ProblemRightPanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let ProblemRightPanel = null

function noopProps(overrides = {}) {
  return {
    currentVariation: 0,
    opponentMode: 'ai',
    hint: null,
    aiAnalysisHidden: true,
    referenceLines: [],
    pendingEval: 0,
    badMoveCount: 0,
    ...overrides,
  }
}

describe('ProblemRightPanel (T-6.2)', function () {
  before(async function () {
    ProblemRightPanel = await tryImport('src/components/workbench/panels/ProblemRightPanel.js')
    if (!ProblemRightPanel) this.skip()
  })

  // --- T-6.2a: renders root with data-testid and answer draft info ---
  it('T-6.2a: renders root element with current variation and opponent mode', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemRightPanel, noopProps({
        currentVariation: 3,
        opponentMode: 'human',
      }))
    )

    const root = queryByTestId('problem-right-panel')
    assert.ok(root, 'Root element with data-testid="problem-right-panel" not found')

    assert.ok(
      root.textContent.includes('3'),
      'Root should contain currentVariation "3"'
    )
    assert.ok(
      root.textContent.includes('human'),
      'Root should contain opponentMode "human"'
    )
  })

  // --- T-6.2b: renders hint card when hint is provided ---
  it('T-6.2b: renders hint card section with hint text', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemRightPanel, noopProps({
        hint: 'Try the attachment',
      }))
    )

    const hintCard = queryByTestId('hint-card')
    assert.ok(hintCard, 'Hint card with data-testid="hint-card" not found')
    assert.ok(
      hintCard.textContent.includes('Try the attachment'),
      'Hint card should contain the hint text'
    )
  })

  // --- T-6.2c: shows AI analysis hidden message when aiAnalysisHidden is true ---
  it('T-6.2c: shows AI answer hidden message when aiAnalysisHidden is true', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemRightPanel, noopProps({
        aiAnalysisHidden: true,
      }))
    )

    const root = queryByTestId('problem-right-panel')
    assert.ok(
      root.textContent.includes('AI 答案默认隐藏'),
      'Should show AI analysis hidden message when aiAnalysisHidden is true'
    )
  })

  // --- T-6.2d: renders reference line summary when provided ---
  it('T-6.2d: renders reference lines when provided', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemRightPanel, noopProps({
        referenceLines: [
          {label: '正解', length: 5},
          {label: '变化1', length: 3},
        ],
      }))
    )

    const root = queryByTestId('problem-right-panel')
    assert.ok(
      root.textContent.includes('正解'),
      'Should contain reference line label "正解"'
    )
    assert.ok(
      root.textContent.includes('变化1'),
      'Should contain reference line label "变化1"'
    )
  })

  it('P4-T04: renders pending evaluation and bad move status', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemRightPanel, noopProps({
        pendingEval: 2,
        badMoveCount: 1,
      }))
    )

    const root = queryByTestId('problem-right-panel')
    assert.ok(root.textContent.includes('pending 评价'),
      'Problem right panel must label pending MoveEvaluation status')
    assert.ok(root.textContent.includes('坏棋记录'),
      'Problem right panel must label BadMove status')
    assert.ok(root.textContent.includes('2'),
      'Problem right panel must render pendingEval count')
    assert.ok(root.textContent.includes('1'),
      'Problem right panel must render badMoveCount')
  })
})
