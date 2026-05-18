/**
 * Panel Card Structure Contract Tests (Phase U3)
 *
 * Tests that all 8 panel components use .wb-card wrappers with .wb-panel-title
 * headings, as required by the workbench UI cardification phase.
 *
 * Test Legitimacy:
 *   All tests import production panel components.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * Contracts covered:
 *   - PlayModePanel: 3 cards with titles "对局模式", "黑白控制", "当前任务"
 *   - ProblemModePanel: 4 cards with titles "做题模式", "题面与目标", "对方控制", "作答操作"
 *   - RecallModePanel: at least 2 cards, includes "回忆模式" title, has ProgressRing/ModeToggle
 *   - AnalysisModePanel: at least 2 cards, includes "复盘模式" title
 *   - All right panels: at least 1 .wb-card each, each card has .wb-panel-title
 *   - Regression: state overlays, buttons, callbacks, data-testid all preserved
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noopPlayModeProps(overrides = {}) {
  return {
    taskTitle: '测试对局',
    taskDescription: '描述内容',
    moveCount: 5,
    captures: {black: 1, white: 2},
    onMarkDoubtful: () => {},
    onEnterAnalysis: () => {},
    ...overrides,
  }
}

function noopProblemModeProps(overrides = {}) {
  return {
    prompt: '黑先杀白',
    goal: '找到正解',
    passRuleSummary: '规则摘要',
    referenceLines: [{label: '正解', length: 5}],
    blackPlayer: '黑方',
    whitePlayer: '白方',
    onOpponentChange: () => {},
    onRequestHint: () => {},
    ...overrides,
  }
}

function noopRecallModeProps(overrides = {}) {
  return {
    recallOriginalLine: true,
    onRecallToggle: () => {},
    progress: 50,
    currentMove: 5,
    totalMoves: 10,
    correctCount: 4,
    wrongCount: 1,
    status: '',
    onMarkCheckpoint: () => {},
    onVerify: () => {},
    onSkip: () => {},
    onHint: () => {},
    onEndRecall: () => {},
    checkpoints: [],
    activeCheckpointId: null,
    onSubmitCorrection: () => {},
    onRevealAI: () => {},
    onSkipCheckpoint: () => {},
    ...overrides,
  }
}

function noopAnalysisModeProps(overrides = {}) {
  return {
    moveCount: 20,
    captures: {black: 3, white: 4},
    evaluation: '黑优 60%',
    onSnapshot: () => {},
    ...overrides,
  }
}

function noopPlayRightProps(overrides = {}) {
  return {
    moveCount: 10,
    captures: {black: 1, white: 2},
    pendingEval: 0,
    badMoveCount: 0,
    ...overrides,
  }
}

function noopProblemRightProps(overrides = {}) {
  return {
    currentVariation: 1,
    opponentMode: 'ai',
    hint: null,
    aiAnalysisHidden: true,
    referenceLines: [],
    ...overrides,
  }
}

function noopRecallRightProps(overrides = {}) {
  return {
    hintMessage: '提示文字',
    systemCheckpoints: 2,
    manualCheckpoints: 1,
    correctCount: 5,
    wrongCount: 2,
    progress: 60,
    totalMoves: 10,
    ...overrides,
  }
}

function noopAnalysisRightProps(overrides = {}) {
  return {
    moveCount: 15,
    captures: {black: 2, white: 3},
    evaluation: null,
    userOriginalLine: null,
    userCorrection: null,
    aiCandidates: null,
    ...overrides,
  }
}

/**
 * Query helper: find all elements with class `wb-card` inside a container.
 */
function queryAllCards(container) {
  return Array.from(container.querySelectorAll('.wb-card'))
}

/**
 * Query helper: find all elements with class `wb-panel-title` inside a container.
 */
function queryAllPanelTitles(container) {
  return Array.from(container.querySelectorAll('.wb-panel-title'))
}

/**
 * Helper: find a card that contains a panel title with the given text.
 * Returns the card element or null.
 */
function findCardWithTitle(container, titleText) {
  const cards = queryAllCards(container)
  return cards.find(card => {
    const titleEl = card.querySelector('.wb-panel-title')
    return titleEl && titleEl.textContent.trim().includes(titleText)
  }) || null
}

// ===========================================================================
// PlayModePanel card structure
// ===========================================================================

describe('PlayModePanel card structure (U3)', function () {
  let PlayModePanel = null

  before(async function () {
    PlayModePanel = await tryImport('src/components/workbench/panels/PlayModePanel.js')
    if (!PlayModePanel) this.skip()
  })

  it('renders 3 .wb-card elements', () => {
    const {container} = renderToDom(
      h(PlayModePanel, noopPlayModeProps())
    )
    const cards = queryAllCards(container)
    assert.strictEqual(cards.length, 3, `Expected 3 .wb-card elements, got ${cards.length}`)
  })

  it('first card has .wb-panel-title containing "对局模式"', () => {
    const {container} = renderToDom(
      h(PlayModePanel, noopPlayModeProps())
    )
    const card = findCardWithTitle(container, '对局模式')
    assert.ok(card, 'No .wb-card found with .wb-panel-title containing "对局模式"')
  })

  it('second card has .wb-panel-title containing "黑白控制"', () => {
    const {container} = renderToDom(
      h(PlayModePanel, noopPlayModeProps())
    )
    const card = findCardWithTitle(container, '黑白控制')
    assert.ok(card, 'No .wb-card found with .wb-panel-title containing "黑白控制"')
  })

  it('third card has .wb-panel-title containing "当前任务"', () => {
    const {container} = renderToDom(
      h(PlayModePanel, noopPlayModeProps())
    )
    const card = findCardWithTitle(container, '当前任务')
    assert.ok(card, 'No .wb-card found with .wb-panel-title containing "当前任务"')
  })
})

// ===========================================================================
// PlayModePanel regression
// ===========================================================================

describe('PlayModePanel card structure regression (U3)', function () {
  let PlayModePanel = null

  before(async function () {
    PlayModePanel = await tryImport('src/components/workbench/panels/PlayModePanel.js')
    if (!PlayModePanel) this.skip()
  })

  it('state="loading" still renders loading indicator inside card structure', () => {
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopPlayModeProps({state: 'loading'}))
    )
    assert.ok(queryByTestId('loading-indicator'),
      'loading indicator should still be present with card structure')
  })

  it('state="disabled" still renders disabled overlay inside card structure', () => {
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopPlayModeProps({state: 'disabled'}))
    )
    assert.ok(queryByTestId('disabled-overlay'),
      'disabled overlay should still be present with card structure')
  })

  it('state="error" still renders error overlay inside card structure', () => {
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopPlayModeProps({state: 'error'}))
    )
    assert.ok(queryByTestId('error-overlay'),
      'error overlay should still be present with card structure')
  })

  it('state="success" still renders success indicator inside card structure', () => {
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopPlayModeProps({state: 'success'}))
    )
    assert.ok(queryByTestId('success-indicator'),
      'success indicator should still be present with card structure')
  })

  it('data-testid="play-mode-panel" is still present', () => {
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopPlayModeProps())
    )
    assert.ok(queryByTestId('play-mode-panel'),
      'Root data-testid="play-mode-panel" should be preserved')
  })

  it('onMarkDoubtful callback still fires after cardification', () => {
    let called = false
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopPlayModeProps({
        onMarkDoubtful: () => { called = true },
      }))
    )
    const btn = queryByTestId('mark-doubtful-btn')
    assert.ok(btn, 'mark-doubtful-btn should still be present')
    btn.click()
    assert.strictEqual(called, true, 'onMarkDoubtful should fire')
  })

  it('onEnterAnalysis callback still fires after cardification', () => {
    let called = false
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopPlayModeProps({
        onEnterAnalysis: () => { called = true },
      }))
    )
    const btn = queryByTestId('enter-analysis-btn')
    assert.ok(btn, 'enter-analysis-btn should still be present')
    btn.click()
    assert.strictEqual(called, true, 'onEnterAnalysis should fire')
  })
})

// ===========================================================================
// ProblemModePanel card structure
// ===========================================================================

describe('ProblemModePanel card structure (U3)', function () {
  let ProblemModePanel = null

  before(async function () {
    ProblemModePanel = await tryImport('src/components/workbench/panels/ProblemModePanel.js')
    if (!ProblemModePanel) this.skip()
  })

  it('renders 4 .wb-card elements', () => {
    const {container} = renderToDom(
      h(ProblemModePanel, noopProblemModeProps())
    )
    const cards = queryAllCards(container)
    assert.strictEqual(cards.length, 4, `Expected 4 .wb-card elements, got ${cards.length}`)
  })

  it('has card with .wb-panel-title containing "做题模式"', () => {
    const {container} = renderToDom(
      h(ProblemModePanel, noopProblemModeProps())
    )
    const card = findCardWithTitle(container, '做题模式')
    assert.ok(card, 'No .wb-card found with .wb-panel-title containing "做题模式"')
  })

  it('has card with .wb-panel-title containing "题面与目标"', () => {
    const {container} = renderToDom(
      h(ProblemModePanel, noopProblemModeProps())
    )
    const card = findCardWithTitle(container, '题面与目标')
    assert.ok(card, 'No .wb-card found with .wb-panel-title containing "题面与目标"')
  })

  it('has card with .wb-panel-title containing "对方控制"', () => {
    const {container} = renderToDom(
      h(ProblemModePanel, noopProblemModeProps())
    )
    const card = findCardWithTitle(container, '对方控制')
    assert.ok(card, 'No .wb-card found with .wb-panel-title containing "对方控制"')
  })

  it('has card with .wb-panel-title containing "作答操作"', () => {
    const {container} = renderToDom(
      h(ProblemModePanel, noopProblemModeProps())
    )
    const card = findCardWithTitle(container, '作答操作')
    assert.ok(card, 'No .wb-card found with .wb-panel-title containing "作答操作"')
  })
})

// ===========================================================================
// ProblemModePanel regression
// ===========================================================================

describe('ProblemModePanel card structure regression (U3)', function () {
  let ProblemModePanel = null

  before(async function () {
    ProblemModePanel = await tryImport('src/components/workbench/panels/ProblemModePanel.js')
    if (!ProblemModePanel) this.skip()
  })

  it('data-testid="problem-mode-panel" is still present', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemModePanel, noopProblemModeProps())
    )
    assert.ok(queryByTestId('problem-mode-panel'),
      'Root data-testid="problem-mode-panel" should be preserved')
  })

  it('onRequestHint callback still fires after cardification', () => {
    let called = false
    const {queryByTestId} = renderToDom(
      h(ProblemModePanel, noopProblemModeProps({
        onRequestHint: () => { called = true },
      }))
    )
    const btn = queryByTestId('request-hint-btn')
    assert.ok(btn, 'request-hint-btn should still be present')
    btn.click()
    assert.strictEqual(called, true, 'onRequestHint should fire')
  })

  it('state overlays still work after cardification', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemModePanel, noopProblemModeProps({state: 'error'}))
    )
    assert.ok(queryByTestId('error-overlay'),
      'error overlay should still work with card structure')
  })
})

// ===========================================================================
// RecallModePanel card structure
// ===========================================================================

describe('RecallModePanel card structure (U3)', function () {
  let RecallModePanel = null

  before(async function () {
    RecallModePanel = await tryImport('src/components/workbench/panels/RecallModePanel.js')
    if (!RecallModePanel) this.skip()
  })

  it('renders at least 2 .wb-card elements', () => {
    const {container} = renderToDom(
      h(RecallModePanel, noopRecallModeProps({recallOriginalLine: true}))
    )
    const cards = queryAllCards(container)
    assert.ok(cards.length >= 2, `Expected at least 2 .wb-card elements, got ${cards.length}`)
  })

  it('has card with .wb-panel-title containing "回忆模式"', () => {
    const {container} = renderToDom(
      h(RecallModePanel, noopRecallModeProps({recallOriginalLine: true}))
    )
    const card = findCardWithTitle(container, '回忆模式')
    assert.ok(card, 'No .wb-card found with .wb-panel-title containing "回忆模式"')
  })

  it('card structure contains ProgressRing element (by class) when recallOriginalLine=true', () => {
    const {container} = renderToDom(
      h(RecallModePanel, noopRecallModeProps({recallOriginalLine: true}))
    )
    // ProgressRing renders with data-testid="progress-ring"
    const ring = container.querySelector('[data-testid="progress-ring"]')
    assert.ok(ring, 'ProgressRing should be present when recallOriginalLine=true')
  })

  it('card structure contains ModeToggle element when active', () => {
    const {container} = renderToDom(
      h(RecallModePanel, noopRecallModeProps({recallOriginalLine: true}))
    )
    // ModeToggle renders with data-testid="mode-toggle"
    const toggle = container.querySelector('[data-testid="mode-toggle"]')
    assert.ok(toggle, 'ModeToggle should be present')
  })
})

// ===========================================================================
// RecallModePanel regression
// ===========================================================================

describe('RecallModePanel card structure regression (U3)', function () {
  let RecallModePanel = null

  before(async function () {
    RecallModePanel = await tryImport('src/components/workbench/panels/RecallModePanel.js')
    if (!RecallModePanel) this.skip()
  })

  it('data-testid="recall-mode-panel" is still present', () => {
    const {queryByTestId} = renderToDom(
      h(RecallModePanel, noopRecallModeProps())
    )
    assert.ok(queryByTestId('recall-mode-panel'),
      'Root data-testid="recall-mode-panel" should be preserved')
  })

  it('state overlays still work after cardification', () => {
    const {queryByTestId} = renderToDom(
      h(RecallModePanel, noopRecallModeProps({state: 'disabled'}))
    )
    assert.ok(queryByTestId('disabled-overlay'),
      'disabled overlay should still work with card structure')
  })

  it('onMarkCheckpoint callback still fires after cardification', () => {
    let called = false
    const {queryByTestId} = renderToDom(
      h(RecallModePanel, noopRecallModeProps({
        recallOriginalLine: true,
        onMarkCheckpoint: () => { called = true },
      }))
    )
    const btn = queryByTestId('mark-checkpoint-btn')
    assert.ok(btn, 'mark-checkpoint-btn should still be present')
    btn.click()
    assert.strictEqual(called, true, 'onMarkCheckpoint should fire')
  })
})

// ===========================================================================
// AnalysisModePanel card structure
// ===========================================================================

describe('AnalysisModePanel card structure (U3)', function () {
  let AnalysisModePanel = null

  before(async function () {
    AnalysisModePanel = await tryImport('src/components/workbench/panels/AnalysisModePanel.js')
    if (!AnalysisModePanel) this.skip()
  })

  it('renders at least 2 .wb-card elements', () => {
    const {container} = renderToDom(
      h(AnalysisModePanel, noopAnalysisModeProps())
    )
    const cards = queryAllCards(container)
    assert.ok(cards.length >= 2, `Expected at least 2 .wb-card elements, got ${cards.length}`)
  })

  it('has card with .wb-panel-title containing "复盘模式"', () => {
    const {container} = renderToDom(
      h(AnalysisModePanel, noopAnalysisModeProps())
    )
    const card = findCardWithTitle(container, '复盘模式')
    assert.ok(card, 'No .wb-card found with .wb-panel-title containing "复盘模式"')
  })
})

// ===========================================================================
// AnalysisModePanel regression
// ===========================================================================

describe('AnalysisModePanel card structure regression (U3)', function () {
  let AnalysisModePanel = null

  before(async function () {
    AnalysisModePanel = await tryImport('src/components/workbench/panels/AnalysisModePanel.js')
    if (!AnalysisModePanel) this.skip()
  })

  it('data-testid="analysis-mode-panel" is still present', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisModePanel, noopAnalysisModeProps())
    )
    assert.ok(queryByTestId('analysis-mode-panel'),
      'Root data-testid="analysis-mode-panel" should be preserved')
  })

  it('onSnapshot callback still fires after cardification', () => {
    let called = false
    const {queryByTestId} = renderToDom(
      h(AnalysisModePanel, noopAnalysisModeProps({
        onSnapshot: () => { called = true },
      }))
    )
    const btn = queryByTestId('snapshot-btn')
    assert.ok(btn, 'snapshot-btn should still be present')
    btn.click()
    assert.strictEqual(called, true, 'onSnapshot should fire')
  })

  it('state overlays still work after cardification', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisModePanel, noopAnalysisModeProps({state: 'loading'}))
    )
    assert.ok(queryByTestId('loading-indicator'),
      'loading indicator should still work with card structure')
  })
})

// ===========================================================================
// PlayRightPanel card structure
// ===========================================================================

describe('PlayRightPanel card structure (U3)', function () {
  let PlayRightPanel = null

  before(async function () {
    PlayRightPanel = await tryImport('src/components/workbench/panels/PlayRightPanel.js')
    if (!PlayRightPanel) this.skip()
  })

  it('renders at least 1 .wb-card element', () => {
    const {container} = renderToDom(
      h(PlayRightPanel, noopPlayRightProps())
    )
    const cards = queryAllCards(container)
    assert.ok(cards.length >= 1, `Expected at least 1 .wb-card, got ${cards.length}`)
  })

  it('every .wb-card has a .wb-panel-title child', () => {
    const {container} = renderToDom(
      h(PlayRightPanel, noopPlayRightProps())
    )
    const cards = queryAllCards(container)
    for (const card of cards) {
      const title = card.querySelector('.wb-panel-title')
      assert.ok(title, `.wb-card is missing a .wb-panel-title child (card content: "${card.textContent.substring(0, 50)}...")`)
    }
  })

  it('data-testid="play-right-panel" is still present', () => {
    const {queryByTestId} = renderToDom(
      h(PlayRightPanel, noopPlayRightProps())
    )
    assert.ok(queryByTestId('play-right-panel'),
      'Root data-testid="play-right-panel" should be preserved')
  })
})

// ===========================================================================
// ProblemRightPanel card structure
// ===========================================================================

describe('ProblemRightPanel card structure (U3)', function () {
  let ProblemRightPanel = null

  before(async function () {
    ProblemRightPanel = await tryImport('src/components/workbench/panels/ProblemRightPanel.js')
    if (!ProblemRightPanel) this.skip()
  })

  it('renders at least 1 .wb-card element', () => {
    const {container} = renderToDom(
      h(ProblemRightPanel, noopProblemRightProps())
    )
    const cards = queryAllCards(container)
    assert.ok(cards.length >= 1, `Expected at least 1 .wb-card, got ${cards.length}`)
  })

  it('every .wb-card has a .wb-panel-title child', () => {
    const {container} = renderToDom(
      h(ProblemRightPanel, noopProblemRightProps())
    )
    const cards = queryAllCards(container)
    for (const card of cards) {
      const title = card.querySelector('.wb-panel-title')
      assert.ok(title, `.wb-card is missing a .wb-panel-title child (card content: "${card.textContent.substring(0, 50)}...")`)
    }
  })

  it('data-testid="problem-right-panel" is still present', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemRightPanel, noopProblemRightProps())
    )
    assert.ok(queryByTestId('problem-right-panel'),
      'Root data-testid="problem-right-panel" should be preserved')
  })
})

// ===========================================================================
// RecallRightPanel card structure
// ===========================================================================

describe('RecallRightPanel card structure (U3)', function () {
  let RecallRightPanel = null

  before(async function () {
    RecallRightPanel = await tryImport('src/components/workbench/panels/RecallRightPanel.js')
    if (!RecallRightPanel) this.skip()
  })

  it('renders at least 1 .wb-card element', () => {
    const {container} = renderToDom(
      h(RecallRightPanel, noopRecallRightProps())
    )
    const cards = queryAllCards(container)
    assert.ok(cards.length >= 1, `Expected at least 1 .wb-card, got ${cards.length}`)
  })

  it('every .wb-card has a .wb-panel-title child', () => {
    const {container} = renderToDom(
      h(RecallRightPanel, noopRecallRightProps())
    )
    const cards = queryAllCards(container)
    for (const card of cards) {
      const title = card.querySelector('.wb-panel-title')
      assert.ok(title, `.wb-card is missing a .wb-panel-title child (card content: "${card.textContent.substring(0, 50)}...")`)
    }
  })

  it('data-testid="recall-right-panel" is still present', () => {
    const {queryByTestId} = renderToDom(
      h(RecallRightPanel, noopRecallRightProps())
    )
    assert.ok(queryByTestId('recall-right-panel'),
      'Root data-testid="recall-right-panel" should be preserved')
  })
})

// ===========================================================================
// AnalysisRightPanel card structure
// ===========================================================================

describe('AnalysisRightPanel card structure (U3)', function () {
  let AnalysisRightPanel = null

  before(async function () {
    AnalysisRightPanel = await tryImport('src/components/workbench/panels/AnalysisRightPanel.js')
    if (!AnalysisRightPanel) this.skip()
  })

  it('renders at least 1 .wb-card element', () => {
    const {container} = renderToDom(
      h(AnalysisRightPanel, noopAnalysisRightProps())
    )
    const cards = queryAllCards(container)
    assert.ok(cards.length >= 1, `Expected at least 1 .wb-card, got ${cards.length}`)
  })

  it('every .wb-card has a .wb-panel-title child', () => {
    const {container} = renderToDom(
      h(AnalysisRightPanel, noopAnalysisRightProps())
    )
    const cards = queryAllCards(container)
    for (const card of cards) {
      const title = card.querySelector('.wb-panel-title')
      assert.ok(title, `.wb-card is missing a .wb-panel-title child (card content: "${card.textContent.substring(0, 50)}...")`)
    }
  })

  it('data-testid="analysis-right-panel" is still present', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisRightPanel, noopAnalysisRightProps())
    )
    assert.ok(queryByTestId('analysis-right-panel'),
      'Root data-testid="analysis-right-panel" should be preserved')
  })
})