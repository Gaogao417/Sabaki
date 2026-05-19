/**
 * W2 UI Policy Tests
 *
 * Tests for workbenchUiPolicy: computeModeBarPolicy and getModeTransitionAction.
 * Pure function tests — no store, no service, no UI.
 *
 * Source of truth alignment:
 *   - Architecture v0.5 §5.3 MODE_TRANSITIONS table
 *   - Architecture v0.5 §10.2 workbenchUiPolicy
 *   - W1 §2.3 "segmented mode control is a request, not permission"
 *   - PRD v0.5 §0.4 flow convergence: submit → recall, analysis is flexible
 */

import assert from 'assert'

import {
  computeModeBarPolicy,
  getModeTransitionAction,
} from '../../../src/modules/training/workbench/workbenchUiPolicy.ts'

// --- computeModeBarPolicy ---

describe('computeModeBarPolicy', () => {
  function policy(currentMode, overrides = {}) {
    return computeModeBarPolicy({
      currentMode,
      previousMode: overrides.previousMode,
      activeAttemptId: overrides.activeAttemptId,
      activeRecallSessionId: overrides.activeRecallSessionId,
    })
  }

  describe('from play mode', () => {
    let p
    before(() => { p = policy('play', {activeAttemptId: 'att_1'}) })

    it('enables play (current mode)', () => assert.strictEqual(p.play.enabled, true))
    it('enables analysis', () => assert.strictEqual(p.analysis.enabled, true))
    it('disables problem', () => {
      assert.strictEqual(p.problem.enabled, false)
      assert.ok(p.problem.reason)
    })
    it('disables recall', () => {
      assert.strictEqual(p.recall.enabled, false)
      assert.ok(p.recall.reason.includes('提交'))
    })
  })

  describe('from problem mode', () => {
    let p
    before(() => { p = policy('problem', {activeAttemptId: 'att_1'}) })

    it('enables problem (current mode)', () => assert.strictEqual(p.problem.enabled, true))
    it('enables analysis', () => assert.strictEqual(p.analysis.enabled, true))
    it('disables play', () => {
      assert.strictEqual(p.play.enabled, false)
      assert.ok(p.play.reason)
    })
    it('disables recall', () => {
      assert.strictEqual(p.recall.enabled, false)
      assert.ok(p.recall.reason.includes('提交'))
    })
  })

  describe('from recall mode', () => {
    let p
    before(() => { p = policy('recall', {activeRecallSessionId: 'rs_1'}) })

    it('enables recall (current mode)', () => assert.strictEqual(p.recall.enabled, true))
    it('enables analysis', () => assert.strictEqual(p.analysis.enabled, true))
    it('disables play', () => {
      assert.strictEqual(p.play.enabled, false)
      assert.ok(p.play.reason.includes('回忆'))
    })
    it('disables problem', () => {
      assert.strictEqual(p.problem.enabled, false)
      assert.ok(p.problem.reason.includes('回忆'))
    })
  })

  describe('from analysis mode (with previousMode=play)', () => {
    let p
    before(() => { p = policy('analysis', {previousMode: 'play'}) })

    it('enables analysis (current mode)', () => assert.strictEqual(p.analysis.enabled, true))
    it('enables play (previousMode)', () => assert.strictEqual(p.play.enabled, true))
    it('disables problem', () => {
      assert.strictEqual(p.problem.enabled, false)
      assert.ok(p.problem.reason.includes('返回'))
    })
    it('disables recall', () => {
      assert.strictEqual(p.recall.enabled, false)
      assert.ok(p.recall.reason.includes('返回'))
    })
  })

  describe('from analysis mode (no previousMode)', () => {
    let p
    before(() => { p = policy('analysis') })

    it('enables analysis only', () => {
      assert.strictEqual(p.analysis.enabled, true)
      assert.strictEqual(p.play.enabled, false)
      assert.strictEqual(p.problem.enabled, false)
      assert.strictEqual(p.recall.enabled, false)
    })
  })

  it('always enables exactly currentMode + analysis (when not in analysis)', () => {
    const modes = ['play', 'problem', 'recall']
    for (const mode of modes) {
      const p = policy(mode)
      const enabled = Object.entries(p).filter(([, v]) => v.enabled)
      assert.strictEqual(enabled.length, 2, `${mode}: expected 2 enabled modes, got ${enabled.length}`)
      assert.strictEqual(p[mode].enabled, true, `${mode}: current mode should be enabled`)
      assert.strictEqual(p.analysis.enabled, true, `${mode}: analysis should be enabled`)
    }
  })
})

// --- getModeTransitionAction ---

describe('getModeTransitionAction', () => {
  function action(currentMode, targetMode, overrides = {}) {
    return getModeTransitionAction(
      {
        currentMode,
        previousMode: overrides.previousMode,
        activeAttemptId: overrides.activeAttemptId,
        activeRecallSessionId: overrides.activeRecallSessionId,
      },
      targetMode,
    )
  }

  describe('from play', () => {
    it('returns noop for play', () => assert.strictEqual(action('play', 'play'), 'noop'))
    it('returns enterAnalysis for analysis', () => assert.strictEqual(action('play', 'analysis'), 'enterAnalysis'))
    it('returns null for problem', () => assert.strictEqual(action('play', 'problem'), null))
    it('returns null for recall', () => assert.strictEqual(action('play', 'recall'), null))
  })

  describe('from problem', () => {
    it('returns enterAnalysis for analysis', () => assert.strictEqual(action('problem', 'analysis'), 'enterAnalysis'))
    it('returns null for play', () => assert.strictEqual(action('problem', 'play'), null))
    it('returns null for recall', () => assert.strictEqual(action('problem', 'recall'), null))
  })

  describe('from recall', () => {
    it('returns enterAnalysis for analysis', () => assert.strictEqual(action('recall', 'analysis'), 'enterAnalysis'))
    it('returns null for play', () => assert.strictEqual(action('recall', 'play'), null))
    it('returns null for problem', () => assert.strictEqual(action('recall', 'problem'), null))
  })

  describe('from analysis', () => {
    it('returns returnFromAnalysis for previousMode', () => {
      assert.strictEqual(action('analysis', 'play', {previousMode: 'play'}), 'returnFromAnalysis')
    })
    it('returns noop for analysis', () => assert.strictEqual(action('analysis', 'analysis'), 'noop'))
    it('returns null for non-previousMode', () => {
      assert.strictEqual(action('analysis', 'problem', {previousMode: 'play'}), null)
    })
    it('returns null when no previousMode and target is not analysis', () => {
      assert.strictEqual(action('analysis', 'play'), null)
    })
  })
})
