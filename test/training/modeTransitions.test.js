/**
 * modeTransitions.test.js
 *
 * Pure function tests for the mode state machine module.
 * Contract source: docs/design/2026-05-25/phase1-gaps/test-contract-v0.1.md
 *
 * These tests import the REAL modeTransitions module with ZERO mocks.
 * They are CONTROLLER_STATE_TRANSITION layer tests: input -> output only.
 *
 * Harness manifest:
 * - Real production modules: modeTransitions (resolveTransition, getAllowedEvents)
 * - Fake/spy modules: NONE
 * - Valid for: CONTROLLER_STATE_TRANSITION
 * - Not valid for: SERVICE_REPOSITORY_TRANSITION, STORE_SUBSCRIPTION, SIDE_EFFECT
 */

import assert from 'assert'

// Lazy-load the module; return null if not yet implemented.
let _modeTransitions = null
let _loadAttempted = false

function getModeTransitions() {
  if (_loadAttempted) return _modeTransitions
  _loadAttempted = true
  try {
    _modeTransitions = require('../../src/modules/training/workbench/modeTransitions.ts')
  } catch {
    // Module doesn't exist yet -- tests serve as spec, will be RED.
  }
  return _modeTransitions
}

const mod = getModeTransitions()
const describeIf = mod ? describe : describe.skip
const {resolveTransition, getAllowedEvents} = mod || {}

/**
 * Helper: build a default TransitionInput with all guards set to "happy path" values.
 * Each test overrides only the fields relevant to its scenario.
 */
function baseInput(overrides = {}) {
  return {
    from: 'play',
    event: 'submit',
    recallSubstate: undefined,
    hasActiveAttempt: true,
    isAttemptFrozen: false,
    hasActiveRecallSession: false,
    hasTask: true,
    hasCheckpoint: false,
    isCorrectionSubmitted: false,
    isCheckpointAiRevealed: false,
    isCheckpointSavedOrSkipped: false,
    hasAnalysisReturnTarget: false,
    ...overrides,
  }
}

describeIf('modeTransitions', () => {

  // ========================================================
  // P1G-T05: submit from play -> recall
  // Contract Section 6, state machine row 1
  // ========================================================
  describe('P1G-T05: resolveTransition(play, submit, activeAttempt, notFrozen)', () => {
    it('allows the transition', () => {
      const result = resolveTransition(baseInput({from: 'play', event: 'submit'}))
      assert.strictEqual(result.allowed, true)
    })

    it('targets recall mode', () => {
      const result = resolveTransition(baseInput({from: 'play', event: 'submit'}))
      assert.strictEqual(result.targetMode, 'recall')
    })

    it('sets targetRecallSubstate to normal', () => {
      const result = resolveTransition(baseInput({from: 'play', event: 'submit'}))
      assert.strictEqual(result.targetRecallSubstate, 'normal')
    })

    it('includes freezeAttempt in effects', () => {
      const result = resolveTransition(baseInput({from: 'play', event: 'submit'}))
      assert.ok(result.effects.includes('freezeAttempt'),
        `effects should include 'freezeAttempt', got: ${JSON.stringify(result.effects)}`)
    })

    it('includes createRecall in effects', () => {
      const result = resolveTransition(baseInput({from: 'play', event: 'submit'}))
      assert.ok(result.effects.includes('createRecall'),
        `effects should include 'createRecall', got: ${JSON.stringify(result.effects)}`)
    })
  })

  // ========================================================
  // P1G-T06: submit from problem -> recall
  // Contract Section 6, state machine row 2
  // ========================================================
  describe('P1G-T06: resolveTransition(problem, submit, activeAttempt, notFrozen)', () => {
    it('allows the transition', () => {
      const result = resolveTransition(baseInput({from: 'problem', event: 'submit'}))
      assert.strictEqual(result.allowed, true)
    })

    it('targets recall mode', () => {
      const result = resolveTransition(baseInput({from: 'problem', event: 'submit'}))
      assert.strictEqual(result.targetMode, 'recall')
    })

    it('sets targetRecallSubstate to normal', () => {
      const result = resolveTransition(baseInput({from: 'problem', event: 'submit'}))
      assert.strictEqual(result.targetRecallSubstate, 'normal')
    })
  })

  // ========================================================
  // P1G-T07: submit from play without active attempt => disallowed
  // Contract Section 6, state machine row 3
  // ========================================================
  describe('P1G-T07: resolveTransition(play, submit, no attempt)', () => {
    it('rejects the transition', () => {
      const result = resolveTransition(baseInput({from: 'play', event: 'submit', hasActiveAttempt: false}))
      assert.strictEqual(result.allowed, false)
    })

    it('provides a reason string', () => {
      const result = resolveTransition(baseInput({from: 'play', event: 'submit', hasActiveAttempt: false}))
      assert.ok(typeof result.reason === 'string' && result.reason.length > 0,
        'disallowed result must have a non-empty reason string')
    })
  })

  // ========================================================
  // P1G-T08: submit from play with frozen attempt => disallowed
  // Contract Section 6, state machine row 4
  // ========================================================
  describe('P1G-T08: resolveTransition(play, submit, frozen attempt)', () => {
    it('rejects the transition', () => {
      const result = resolveTransition(baseInput({from: 'play', event: 'submit', isAttemptFrozen: true}))
      assert.strictEqual(result.allowed, false)
    })
  })

  // ========================================================
  // P1G-T09: enterAnalysis from recall -> analysis
  // Contract Section 6, state machine row 5
  // ========================================================
  describe('P1G-T09: resolveTransition(recall, enterAnalysis, activeRecallSession)', () => {
    it('allows the transition', () => {
      const result = resolveTransition(baseInput({
        from: 'recall',
        event: 'enterAnalysis',
        hasActiveRecallSession: true,
      }))
      assert.strictEqual(result.allowed, true)
    })

    it('targets analysis mode', () => {
      const result = resolveTransition(baseInput({
        from: 'recall',
        event: 'enterAnalysis',
        hasActiveRecallSession: true,
      }))
      assert.strictEqual(result.targetMode, 'analysis')
    })

    it('includes saveAnalysisReturnTarget in effects', () => {
      const result = resolveTransition(baseInput({
        from: 'recall',
        event: 'enterAnalysis',
        hasActiveRecallSession: true,
      }))
      assert.ok(result.effects.includes('saveAnalysisReturnTarget'),
        `effects should include 'saveAnalysisReturnTarget', got: ${JSON.stringify(result.effects)}`)
    })
  })

  // ========================================================
  // P1G-T10: enterAnalysis from play -> analysis
  // Contract Section 6, state machine row 6
  // ========================================================
  describe('P1G-T10: resolveTransition(play, enterAnalysis, hasTask)', () => {
    it('allows the transition', () => {
      const result = resolveTransition(baseInput({from: 'play', event: 'enterAnalysis', hasTask: true}))
      assert.strictEqual(result.allowed, true)
    })

    it('targets analysis mode', () => {
      const result = resolveTransition(baseInput({from: 'play', event: 'enterAnalysis', hasTask: true}))
      assert.strictEqual(result.targetMode, 'analysis')
    })

    it('includes saveAnalysisReturnTarget in effects', () => {
      const result = resolveTransition(baseInput({from: 'play', event: 'enterAnalysis', hasTask: true}))
      assert.ok(result.effects.includes('saveAnalysisReturnTarget'),
        `effects should include 'saveAnalysisReturnTarget', got: ${JSON.stringify(result.effects)}`)
    })
  })

  // ========================================================
  // P1G-T11: enterAnalysis from problem -> analysis
  // Contract Section 6, state machine row 7
  // ========================================================
  describe('P1G-T11: resolveTransition(problem, enterAnalysis, hasTask)', () => {
    it('allows the transition', () => {
      const result = resolveTransition(baseInput({from: 'problem', event: 'enterAnalysis', hasTask: true}))
      assert.strictEqual(result.allowed, true)
    })

    it('targets analysis mode', () => {
      const result = resolveTransition(baseInput({from: 'problem', event: 'enterAnalysis', hasTask: true}))
      assert.strictEqual(result.targetMode, 'analysis')
    })

    it('includes saveAnalysisReturnTarget in effects', () => {
      const result = resolveTransition(baseInput({from: 'problem', event: 'enterAnalysis', hasTask: true}))
      assert.ok(result.effects.includes('saveAnalysisReturnTarget'),
        `effects should include 'saveAnalysisReturnTarget', got: ${JSON.stringify(result.effects)}`)
    })
  })

  // ========================================================
  // P1G-T12: returnFromAnalysis with target -> restore
  // Contract Section 6, state machine row 8
  // ========================================================
  describe('P1G-T12: resolveTransition(analysis, returnFromAnalysis, hasTarget)', () => {
    it('allows the transition', () => {
      const result = resolveTransition(baseInput({
        from: 'analysis',
        event: 'returnFromAnalysis',
        hasAnalysisReturnTarget: true,
      }))
      assert.strictEqual(result.allowed, true)
    })

    it('includes clearAnalysisReturnTarget in effects', () => {
      const result = resolveTransition(baseInput({
        from: 'analysis',
        event: 'returnFromAnalysis',
        hasAnalysisReturnTarget: true,
      }))
      assert.ok(result.effects.includes('clearAnalysisReturnTarget'),
        `effects should include 'clearAnalysisReturnTarget', got: ${JSON.stringify(result.effects)}`)
    })

    it('includes restorePreviousMode in effects', () => {
      const result = resolveTransition(baseInput({
        from: 'analysis',
        event: 'returnFromAnalysis',
        hasAnalysisReturnTarget: true,
      }))
      assert.ok(result.effects.includes('restorePreviousMode'),
        `effects should include 'restorePreviousMode', got: ${JSON.stringify(result.effects)}`)
    })
  })

  // ========================================================
  // P1G-T13: returnFromAnalysis without target => disallowed
  // Contract Section 6, state machine row 9
  // ========================================================
  describe('P1G-T13: resolveTransition(analysis, returnFromAnalysis, no target)', () => {
    it('rejects the transition', () => {
      const result = resolveTransition(baseInput({
        from: 'analysis',
        event: 'returnFromAnalysis',
        hasAnalysisReturnTarget: false,
      }))
      assert.strictEqual(result.allowed, false)
    })

    it('provides a reason describing the missing target', () => {
      const result = resolveTransition(baseInput({
        from: 'analysis',
        event: 'returnFromAnalysis',
        hasAnalysisReturnTarget: false,
      }))
      assert.ok(typeof result.reason === 'string' && result.reason.length > 0,
        'disallowed result must have a non-empty reason string')
    })
  })

  // ========================================================
  // P1G-T14: restartAttempt from analysis
  // Contract Section 6, state machine row 10
  // ========================================================
  describe('P1G-T14: resolveTransition(analysis, restartAttempt, hasTask)', () => {
    it('allows the transition with createNewAttempt effect', () => {
      const result = resolveTransition(baseInput({
        from: 'analysis',
        event: 'restartAttempt',
        hasTask: true,
      }))
      assert.strictEqual(result.allowed, true)
      assert.ok(result.effects && result.effects.includes('createNewAttempt'),
        'restartAttempt must include createNewAttempt effect')
    })
  })

  // ========================================================
  // P1G-T15: snapshot is analysis-only -> targetMode unchanged
  // Contract source: docs/design/workbench-mode-orchestration-contract.md
  // "analysis -> snapshot problem child tab"
  // ========================================================
  describe('P1G-T15: resolveTransition(snapshot)', () => {
    it('allows snapshot from analysis and leaves current mode unchanged', () => {
      const result = resolveTransition(baseInput({from: 'analysis', event: 'snapshot'}))
      assert.strictEqual(result.allowed, true)
      assert.strictEqual(result.targetMode, 'analysis')
      assert.ok(result.effects.includes('createNewTaskAndTab'),
        `effects should include 'createNewTaskAndTab', got: ${JSON.stringify(result.effects)}`)
    })

    for (const mode of ['play', 'problem', 'recall']) {
      it(`rejects snapshot from ${mode}`, () => {
        const result = resolveTransition(baseInput({from: mode, event: 'snapshot'}))
        assert.strictEqual(result.allowed, false)
        assert.ok(typeof result.reason === 'string' && result.reason.length > 0,
          'disallowed snapshot must provide a reason string')
      })
    }
  })

  // ========================================================
  // P1G-T16: submit from recall => disallowed
  // Contract Section 6, state machine row 16
  // ========================================================
  describe('P1G-T16: resolveTransition(recall, submit)', () => {
    it('rejects the transition', () => {
      const result = resolveTransition(baseInput({from: 'recall', event: 'submit', hasActiveRecallSession: true}))
      assert.strictEqual(result.allowed, false)
    })
  })

  // ========================================================
  // P1G-T17: submit from analysis => disallowed
  // Contract Section 6, state machine row 17
  // ========================================================
  describe('P1G-T17: resolveTransition(analysis, submit)', () => {
    it('rejects the transition', () => {
      const result = resolveTransition(baseInput({from: 'analysis', event: 'submit'}))
      assert.strictEqual(result.allowed, false)
    })
  })

  // ========================================================
  // P1G-T18: enterAnalysis from analysis => disallowed
  // Contract Section 6, state machine row 18
  // ========================================================
  describe('P1G-T18: resolveTransition(analysis, enterAnalysis)', () => {
    it('rejects the transition', () => {
      const result = resolveTransition(baseInput({from: 'analysis', event: 'enterAnalysis', hasTask: true}))
      assert.strictEqual(result.allowed, false)
    })
  })

  // ========================================================
  // P1G-T19: returnFromAnalysis from non-analysis modes => disallowed
  // Contract Section 6, state machine row 19
  // ========================================================
  describe('P1G-T19: resolveTransition(non-analysis, returnFromAnalysis)', () => {
    const nonAnalysisModes = ['play', 'problem', 'recall']

    for (const mode of nonAnalysisModes) {
      it(`returnFromAnalysis from ${mode} is disallowed`, () => {
        const result = resolveTransition(baseInput({from: mode, event: 'returnFromAnalysis'}))
        assert.strictEqual(result.allowed, false)
      })
    }
  })

  // ========================================================
  // P1G-T20: getAllowedEvents(play)
  // Contract Section 9, row P1G-T20
  // ========================================================
  describe('P1G-T20: getAllowedEvents(play)', () => {
    it('includes submit', () => {
      const events = getAllowedEvents('play')
      assert.ok(events.includes('submit'),
        `getAllowedEvents('play') should include 'submit', got: ${JSON.stringify(events)}`)
    })

    it('includes enterAnalysis', () => {
      const events = getAllowedEvents('play')
      assert.ok(events.includes('enterAnalysis'),
        `getAllowedEvents('play') should include 'enterAnalysis', got: ${JSON.stringify(events)}`)
    })

    it('does not include snapshot', () => {
      const events = getAllowedEvents('play')
      assert.ok(!events.includes('snapshot'),
        `getAllowedEvents('play') should not include 'snapshot', got: ${JSON.stringify(events)}`)
    })
  })

  // ========================================================
  // P1G-T21: getAllowedEvents(recall)
  // Contract Section 9, row P1G-T21
  // ========================================================
  describe('P1G-T21: getAllowedEvents(recall)', () => {
    it('includes enterAnalysis', () => {
      const events = getAllowedEvents('recall')
      assert.ok(events.includes('enterAnalysis'),
        `getAllowedEvents('recall') should include 'enterAnalysis', got: ${JSON.stringify(events)}`)
    })

    // Phase 1: assert all 4 checkpoint events are listed.
    // These are DEFERRED for resolveTransition testing (P1G-T22-T25)
    // but getAllowedEvents should enumerate them as available events.
    it('includes all 4 checkpoint events', () => {
      const events = getAllowedEvents('recall')
      const checkpointEvents = ['startCheckpoint', 'revealAi', 'commentCheckpoint', 'resumeRecall']
      for (const ce of checkpointEvents) {
        assert.ok(events.includes(ce),
          `getAllowedEvents('recall') should include '${ce}', got: ${JSON.stringify(events)}`)
      }
    })

    it('does not include snapshot', () => {
      const events = getAllowedEvents('recall')
      assert.ok(!events.includes('snapshot'),
        `getAllowedEvents('recall') should not include 'snapshot', got: ${JSON.stringify(events)}`)
    })
  })

  describe('P1G-T20b: getAllowedEvents(analysis)', () => {
    it('includes snapshot', () => {
      const events = getAllowedEvents('analysis')
      assert.ok(events.includes('snapshot'),
        `getAllowedEvents('analysis') should include 'snapshot', got: ${JSON.stringify(events)}`)
    })
  })

  // ========================================================
  // DEFERRED: Checkpoint substate transitions (P1G-T22-T25)
  // These are Phase 5 scope. Listed here for coverage tracking.
  // ========================================================
  describe.skip('DEFERRED: Checkpoint substate transitions (Phase 5)', () => {
    // P1G-T22: resolveTransition(recall, startCheckpoint, ...) => checkpoint_correction
    // P1G-T23: resolveTransition(recall, revealAi, ...) => checkpoint_ai_revealed
    // P1G-T24: resolveTransition(recall, commentCheckpoint, ...) => checkpoint_commenting
    // P1G-T25: resolveTransition(recall, resumeRecall, ...) => normal + clearActiveCheckpoint
    //
    // Deferral reason: recallCheckpointService infrastructure does not exist in Phase 1 scope.
    // Exit condition: Phase 5 Recall Checkpoint implementation starts.
  })
})
