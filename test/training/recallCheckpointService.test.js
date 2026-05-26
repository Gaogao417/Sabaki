import assert from 'assert'

import { createRecallCheckpointService } from '../../src/modules/training/recall/recallCheckpointService.ts'
import { createRecallService } from '../../src/modules/training/recall/recallService.ts'
import { createTrainingRuntimeStore } from '../../src/modules/training/store/trainingRuntimeStore.ts'

// --- Strict fake repository ---

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function requireRecord(map, id, name) {
  const record = map[id]
  if (!record) throw new Error(`${name} not found: ${id}`)
  return record
}

function createStrictFakeRepo() {
  const store = {
    attempts: {},
    sessions: {},
    recallAttempts: [],
    badMoves: [],
    evaluations: [],
    comments: [],
    checkpoints: {},
    games: {},
  }

  const calls = []

  return {
    store,
    calls,

    // Attempt
    async loadAttempt(id) {
      return clone(store.attempts[id]) || null
    },
    async updateAttempt(id, patch) {
      calls.push(['updateAttempt', id, clone(patch)])
      const current = requireRecord(store.attempts, id, 'attempt')
      store.attempts[id] = { ...current, ...clone(patch) }
    },

    // RecallSession
    async createRecallSession(session) {
      calls.push(['createRecallSession', clone(session)])
      if (store.sessions[session.id]) throw new Error(`duplicate recall session: ${session.id}`)
      store.sessions[session.id] = clone(session)
      return clone(session)
    },
    async loadRecallSession(id) {
      return clone(store.sessions[id]) || null
    },
    async updateRecallSession(id, patch) {
      calls.push(['updateRecallSession', id, clone(patch)])
      const current = requireRecord(store.sessions, id, 'recall session')
      store.sessions[id] = { ...current, ...clone(patch) }
    },

    // RecallAttempt
    async createRecallAttempt(attempt) {
      calls.push(['createRecallAttempt', clone(attempt)])
      store.recallAttempts.push(clone(attempt))
      return clone(attempt)
    },
    async listRecallAttempts(sessionId) {
      return store.recallAttempts.filter(a => a.recallSessionId === sessionId).map(clone)
    },

    // Checkpoint
    async createRecallCheckpoint(checkpoint) {
      calls.push(['createRecallCheckpoint', clone(checkpoint)])
      if (store.checkpoints[checkpoint.id]) throw new Error(`duplicate checkpoint: ${checkpoint.id}`)
      store.checkpoints[checkpoint.id] = clone(checkpoint)
      return clone(checkpoint)
    },
    async loadRecallCheckpoint(id) {
      return clone(store.checkpoints[id]) || null
    },
    async updateRecallCheckpoint(id, patch) {
      calls.push(['updateRecallCheckpoint', id, clone(patch)])
      const current = requireRecord(store.checkpoints, id, 'recall checkpoint')
      store.checkpoints[id] = { ...current, ...clone(patch) }
    },
    async listCheckpointsByRecallSession(sessionId) {
      return Object.values(store.checkpoints).filter(c => c.recallSessionId === sessionId).map(clone)
    },

    // BadMove
    async listBadMovesByAttempt(attemptId) {
      return store.badMoves.filter(bm => bm.attemptId === attemptId).map(clone)
    },
    async loadBadMove(id) {
      return clone(store.badMoves.find(bm => bm.id === id)) || null
    },
    async updateBadMove(badMoveId, patch) {
      calls.push(['updateBadMove', badMoveId, clone(patch)])
      const bm = store.badMoves.find(b => b.id === badMoveId)
      if (!bm) throw new Error(`bad move not found: ${badMoveId}`)
      Object.assign(bm, clone(patch))
    },

    // Evaluation
    async listMoveEvaluationsByAttempt(attemptId) {
      return store.evaluations.filter(ev => ev.attemptId === attemptId).map(clone)
    },

    // Comment
    async createMoveComment(comment) {
      calls.push(['createMoveComment', clone(comment)])
      store.comments.push(clone(comment))
      return clone(comment)
    },

    // Game
    async getGame(id) {
      return clone(store.games[id]) || null
    },

    // Recovery
    async listIncompleteRecallSessions() {
      return Object.values(store.sessions)
        .filter(s => !s.completed)
        .map(clone)
    },
    async listIncompleteAttempts() {
      return Object.values(store.attempts)
        .filter(a => a.status !== 'submitted' && a.status !== 'analyzing')
        .map(clone)
    },
  }
}

// --- Helpers ---

function clone2(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function seedAttempt(repo, overrides = {}) {
  const attempt = {
    id: 'attempt_1',
    taskId: 'task_1',
    tabId: 'tab_1',
    startedAt: '2026-01-01T00:00:00.000Z',
    rootPositionSgf: '(;SZ[9])',
    userLine: ['D4', 'Q16', 'C3'],
    status: 'submitted',
    result: 'pending',
    hintLevelUsed: 0,
    recallCompleted: false,
    analysisOpened: false,
    ...overrides,
  }
  repo.store.attempts[attempt.id] = clone2(attempt)
  return attempt
}

function seedSession(repo, overrides = {}) {
  const session = {
    id: 'session_1',
    taskId: 'task_1',
    type: 'line_recall',
    source: { kind: 'attempt', attemptId: 'attempt_1' },
    startMove: 0,
    expectedMoves: ['D4', 'Q16', 'C3'],
    currentMoveIndex: 0,
    completed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.store.sessions[session.id] = clone2(session)
  return session
}

function seedBadMove(repo, overrides = {}) {
  const bm = {
    id: 'bm_1',
    moveEvaluationId: 'eval_1',
    attemptId: 'attempt_1',
    taskId: 'task_1',
    moveIndex: 1,
    severity: 'major',
    punishSide: 'black',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.store.badMoves.push(clone2(bm))
  return bm
}

function seedCheckpoint(repo, overrides = {}) {
  const cp = {
    id: 'cp_1',
    recallSessionId: 'session_1',
    badMoveId: 'bm_1',
    status: 'pending_correction',
    userCorrectionLine: [],
    aiCandidateLines: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.store.checkpoints[cp.id] = clone2(cp)
  return cp
}

function seedEvaluation(repo, overrides = {}) {
  const ev = {
    id: 'eval_1',
    attemptId: 'attempt_1',
    moveIndex: 1,
    move: 'Q16',
    engineSuggestedLine: ['R17', 'D3'],
    afterScoreLead: 4.0,
    afterWinrate: 0.65,
    status: 'evaluated',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.store.evaluations.push(clone2(ev))
  return ev
}

// =====================================================================
// Phase 5 Test Contracts: Recall Checkpoint / Comment
// =====================================================================

describe('recallCheckpointService — Phase 5 contracts', () => {
  let runtimeStore, repo, service

  beforeEach(() => {
    runtimeStore = createTrainingRuntimeStore()
    repo = createStrictFakeRepo()
    service = createRecallCheckpointService({
      repository: repo,
      runtimeStore,
    })
  })

  // ------------------------------------------------------------------
  // CP01: skipCheckpoint(id) transitions pending_correction to skipped,
  //       sets completedAt, clears activeCheckpointId,
  //       advances session currentMoveIndex by 1
  // ------------------------------------------------------------------
  describe('CP01 — skipCheckpoint: pending_correction -> skipped with state changes', () => {
    it('transitions pending_correction to skipped', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })
      seedSession(repo, { currentMoveIndex: 1 })
      runtimeStore.setActiveCheckpoint('cp_1')

      await service.skipCheckpoint('cp_1')

      const cp = repo.store.checkpoints['cp_1']
      assert.strictEqual(cp.status, 'skipped')
    })

    it('sets completedAt on skipped checkpoint', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })
      seedSession(repo, { currentMoveIndex: 1 })
      runtimeStore.setActiveCheckpoint('cp_1')

      await service.skipCheckpoint('cp_1')

      const cp = repo.store.checkpoints['cp_1']
      assert.ok(cp.completedAt, 'completedAt should be set after skip')
    })

    it('clears activeCheckpointId from runtime store', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })
      seedSession(repo, { currentMoveIndex: 1 })
      runtimeStore.setActiveCheckpoint('cp_1')

      await service.skipCheckpoint('cp_1')

      assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)
    })

    it('advances session currentMoveIndex by 1', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })
      seedSession(repo, { currentMoveIndex: 1 })
      runtimeStore.setActiveCheckpoint('cp_1')

      await service.skipCheckpoint('cp_1')

      const session = repo.store.sessions['session_1']
      assert.strictEqual(session.currentMoveIndex, 2)
    })

    it('refreshes recallView after skip advances recall', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })
      seedSession(repo, { currentMoveIndex: 1 })
      runtimeStore.setActiveCheckpoint('cp_1')

      await service.skipCheckpoint('cp_1')

      const view = runtimeStore.getState().recallView
      assert.strictEqual(view.recallSessionId, 'session_1')
      assert.strictEqual(view.moveIndex, 2)
      assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)
    })
  })

  // ------------------------------------------------------------------
  // CP02: skipCheckpoint(id) transitions ai_revealed to skipped
  // ------------------------------------------------------------------
  describe('CP02 — skipCheckpoint: ai_revealed -> skipped', () => {
    it('transitions ai_revealed to skipped', async () => {
      seedCheckpoint(repo, {
        status: 'ai_revealed',
        userCorrectionLine: ['R17'],
        aiCandidateLines: [{ label: 'AI recommended', moves: ['R17', 'D3'], source: 'engine' }],
      })
      seedSession(repo, { currentMoveIndex: 1 })
      runtimeStore.setActiveCheckpoint('cp_1')

      await service.skipCheckpoint('cp_1')

      const cp = repo.store.checkpoints['cp_1']
      assert.strictEqual(cp.status, 'skipped')
      assert.ok(cp.completedAt)
    })
  })

  // ------------------------------------------------------------------
  // CP03: skipCheckpoint(id) clears correctionDraft in runtime store
  // ------------------------------------------------------------------
  describe('CP03 — skipCheckpoint clears correctionDraft', () => {
    it('clears correctionDraft from runtime store', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })
      seedSession(repo, { currentMoveIndex: 1 })
      runtimeStore.setActiveCheckpoint('cp_1')
      runtimeStore.setCorrectionDraft({ checkpointId: 'cp_1', moves: ['E5', 'F6'] })

      assert.ok(runtimeStore.getState().correctionDraft, 'precondition: draft should exist')

      await service.skipCheckpoint('cp_1')

      assert.strictEqual(runtimeStore.getState().correctionDraft, undefined)
    })
  })

  // ------------------------------------------------------------------
  // CP04: skipCheckpoint(id) throws if checkpoint is commented
  // ------------------------------------------------------------------
  describe('CP04 — skipCheckpoint throws if commented', () => {
    it('throws if checkpoint is already commented', async () => {
      seedCheckpoint(repo, {
        status: 'commented',
        userCommentId: 'comment_1',
      })
      seedSession(repo, { currentMoveIndex: 1 })

      await assert.rejects(
        () => service.skipCheckpoint('cp_1'),
        /cannot skip/,
      )
    })
  })

  // ------------------------------------------------------------------
  // CP05: skipCheckpoint(id) throws if already skipped
  // ------------------------------------------------------------------
  describe('CP05 — skipCheckpoint throws if already skipped', () => {
    it('throws if checkpoint is already skipped', async () => {
      seedCheckpoint(repo, {
        status: 'skipped',
        completedAt: '2026-01-01T01:00:00.000Z',
      })
      seedSession(repo, { currentMoveIndex: 1 })

      await assert.rejects(
        () => service.skipCheckpoint('cp_1'),
        /cannot skip/,
      )
    })
  })

  // ------------------------------------------------------------------
  // CP06: skipCheckpoint(id) throws if already completed (has completedAt)
  // ------------------------------------------------------------------
  describe('CP06 — skipCheckpoint throws if already completed', () => {
    it('throws if checkpoint is commented and has completedAt', async () => {
      seedCheckpoint(repo, {
        status: 'commented',
        userCommentId: 'comment_1',
        completedAt: '2026-01-01T01:00:00.000Z',
      })
      seedSession(repo, { currentMoveIndex: 1 })

      await assert.rejects(
        () => service.skipCheckpoint('cp_1'),
        /cannot skip|already completed/,
      )
    })
  })

  // ------------------------------------------------------------------
  // CP07: skipCheckpoint(id) throws if checkpoint not found
  // ------------------------------------------------------------------
  describe('CP07 — skipCheckpoint throws if not found', () => {
    it('throws if checkpoint does not exist', async () => {
      seedSession(repo, { currentMoveIndex: 1 })

      await assert.rejects(
        () => service.skipCheckpoint('nonexistent'),
        /not found/,
      )
    })
  })

  // ------------------------------------------------------------------
  // CP09: saveComment auto-generates id when input comment.id is falsy
  // ------------------------------------------------------------------
  describe('CP09 — saveComment auto-generates id', () => {
    it('generates a non-empty id when input id is empty string', async () => {
      seedCheckpoint(repo, { status: 'ai_revealed' })

      await service.saveComment({
        checkpointId: 'cp_1',
        comment: {
          id: '',
          target: { kind: 'checkpoint', checkpointId: 'cp_1' },
          content: 'Auto-id test',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      })

      const saved = repo.store.comments[0]
      assert.ok(saved, 'comment should be saved')
      assert.ok(saved.id, 'id should be auto-generated')
      assert.strictEqual(typeof saved.id, 'string')
      assert.strictEqual(saved.id.length > 0, true, 'auto-generated id should be non-empty')
    })

    it('generates a non-empty id when input id is undefined', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })

      await service.saveComment({
        checkpointId: 'cp_1',
        comment: {
          id: undefined,
          target: { kind: 'checkpoint', checkpointId: 'cp_1' },
          content: 'Auto-id test with undefined',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      })

      const saved = repo.store.comments[0]
      assert.ok(saved, 'comment should be saved')
      assert.ok(saved.id, 'id should be auto-generated even when input is undefined')
    })
  })

  // ------------------------------------------------------------------
  // CP10: revealAiCandidateLines idempotent on already ai_revealed
  // ------------------------------------------------------------------
  describe('CP10 — revealAiCandidateLines idempotent on ai_revealed', () => {
    it('returns same result when called twice without error', async () => {
      seedCheckpoint(repo, {
        status: 'pending_correction',
        userCorrectionLine: ['R17'],
      })
      seedBadMove(repo)
      seedEvaluation(repo)

      // First call: pending_correction -> ai_revealed
      const firstResult = await service.revealAiCandidateLines('cp_1')

      const cp = repo.store.checkpoints['cp_1']
      assert.strictEqual(cp.status, 'ai_revealed')

      // Second call: already ai_revealed, should be idempotent
      const secondResult = await service.revealAiCandidateLines('cp_1')

      assert.deepStrictEqual(secondResult, firstResult, 'second call should return same result as first')

      const cpAfter = repo.store.checkpoints['cp_1']
      assert.strictEqual(cpAfter.status, 'ai_revealed')
      assert.deepStrictEqual(cpAfter.aiCandidateLines, firstResult)
    })
  })

  // ------------------------------------------------------------------
  // CP12: startCheckpoint does NOT change tab mode (architecture boundary)
  //       activeCheckpointId is set but tab mode remains whatever it was
  // ------------------------------------------------------------------
  describe('CP12 — startCheckpoint does NOT change tab mode', () => {
    it('only modifies activeCheckpointId, not any mode-setting function', async () => {
      seedSession(repo)
      seedBadMove(repo)

      // Record state before startCheckpoint
      const stateBefore = runtimeStore.getState()
      assert.strictEqual(stateBefore.activeCheckpointId, undefined, 'precondition: no active checkpoint')

      await service.startCheckpoint({
        recallSessionId: 'session_1',
        badMoveId: 'bm_1',
      })

      const stateAfter = runtimeStore.getState()

      // activeCheckpointId should be set
      assert.ok(stateAfter.activeCheckpointId, 'activeCheckpointId should be set')

      // The runtime store does NOT have a "tab mode" field. startCheckpoint
      // may refresh recallView projection for subscribers, but must not
      // create a mode surrogate or touch non-recall companion views.
      assert.strictEqual(stateAfter.recallView.recallSessionId, 'session_1',
        'startCheckpoint should refresh recallView for recall UI projection')
      assert.strictEqual(stateAfter.problemView, null, 'startCheckpoint must not set problemView')
      assert.strictEqual(stateAfter.reviewQueueView, null, 'startCheckpoint must not set reviewQueueView')
      assert.strictEqual(stateAfter.activeAttemptId, undefined, 'startCheckpoint must not set activeAttemptId')
    })

    it('initializes correctionDraft as the checkpoint board source', async () => {
      seedSession(repo, {currentMoveIndex: 1})
      seedBadMove(repo, {moveIndex: 1})

      const cp = await service.startCheckpoint({
        recallSessionId: 'session_1',
        badMoveId: 'bm_1',
      })

      assert.deepStrictEqual(runtimeStore.getState().correctionDraft, {
        checkpointId: cp.id,
        moves: [],
        source: {
          kind: 'recall-checkpoint',
          recallSessionId: 'session_1',
          badMoveId: 'bm_1',
          moveIndex: 1,
        },
      })
    })
  })

  // ------------------------------------------------------------------
  // CP13: saveComment creates MoveComment with target.kind = 'checkpoint'
  //       and target.checkpointId
  // ------------------------------------------------------------------
  describe('CP13 — saveComment target.kind = checkpoint with checkpointId', () => {
    it('persists comment with correct target', async () => {
      seedCheckpoint(repo, { status: 'ai_revealed' })

      await service.saveComment({
        checkpointId: 'cp_1',
        comment: {
          id: 'comment_target_test',
          target: { kind: 'checkpoint', checkpointId: 'cp_1' },
          content: 'Testing target association',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      })

      const saved = repo.store.comments[0]
      assert.ok(saved, 'comment should exist')
      assert.deepStrictEqual(saved.target, { kind: 'checkpoint', checkpointId: 'cp_1' })
    })

    it('target with different checkpointId still passes through correctly', async () => {
      seedCheckpoint(repo, { id: 'cp_other', status: 'ai_revealed', badMoveId: 'bm_1' })
      seedSession(repo)
      seedBadMove(repo)

      await service.saveComment({
        checkpointId: 'cp_other',
        comment: {
          id: 'comment_other',
          target: { kind: 'checkpoint', checkpointId: 'cp_other' },
          content: 'Other checkpoint comment',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      })

      const saved = repo.store.comments.find(c => c.id === 'comment_other')
      assert.ok(saved)
      assert.strictEqual(saved.target.kind, 'checkpoint')
      assert.strictEqual(saved.target.checkpointId, 'cp_other')
    })
  })

  // ------------------------------------------------------------------
  // CP14: saveComment persists via repository.createMoveComment only;
  //       NOT stored inside Attempt or RecallSession
  // ------------------------------------------------------------------
  describe('CP14 — saveComment persists via createMoveComment only', () => {
    it('uses createMoveComment and does not modify attempt or session', async () => {
      seedCheckpoint(repo, { status: 'ai_revealed' })
      seedSession(repo)
      seedAttempt(repo)

      // Clear call log before the action
      repo.calls.length = 0

      await service.saveComment({
        checkpointId: 'cp_1',
        comment: {
          id: 'comment_persist_test',
          target: { kind: 'checkpoint', checkpointId: 'cp_1' },
          content: 'Persistence test',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      })

      // Verify createMoveComment was called
      const createCommentCalls = repo.calls.filter(c => c[0] === 'createMoveComment')
      assert.strictEqual(createCommentCalls.length, 1, 'createMoveComment should be called exactly once')

      // Verify NO calls to updateAttempt or updateRecallSession for the comment
      const updateAttemptCalls = repo.calls.filter(c => c[0] === 'updateAttempt')
      assert.strictEqual(updateAttemptCalls.length, 0, 'saveComment must not modify the attempt')

      // updateRecallSession should not be called (resumeRecall does that)
      const updateSessionCalls = repo.calls.filter(c => c[0] === 'updateRecallSession')
      assert.strictEqual(updateSessionCalls.length, 0, 'saveComment must not modify the session')
    })
  })

  // ------------------------------------------------------------------
  // CP15: submitUserCorrectionLine clears correctionDraft from runtime store
  // ------------------------------------------------------------------
  describe('CP15 — submitUserCorrectionLine clears correctionDraft', () => {
    it('clears correctionDraft after submitting', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })
      runtimeStore.setCorrectionDraft({ checkpointId: 'cp_1', moves: ['E5', 'F6'] })

      assert.ok(runtimeStore.getState().correctionDraft, 'precondition: draft should exist')

      await service.submitUserCorrectionLine({ checkpointId: 'cp_1', moves: ['E5', 'F6'] })

      assert.strictEqual(runtimeStore.getState().correctionDraft, undefined,
        'correctionDraft should be cleared after submit')
    })
  })

  // ------------------------------------------------------------------
  // CP16: Crash recovery — incomplete session + checkpoint discoverable
  // ------------------------------------------------------------------
  describe('CP16 — Crash recovery: incomplete session + checkpoint discoverable', () => {
    it('finds incomplete session with active checkpoint via repository', async () => {
      // Seed an incomplete session with an in-progress checkpoint
      seedSession(repo, {
        id: 'session_crash',
        completed: false,
        currentMoveIndex: 1,
      })
      seedCheckpoint(repo, {
        id: 'cp_crash',
        recallSessionId: 'session_crash',
        status: 'pending_correction',
        completedAt: undefined,
      })

      // Query incomplete sessions
      const incompleteSessions = await repo.listIncompleteRecallSessions()
      assert.ok(incompleteSessions.length >= 1, 'should find at least one incomplete session')

      const crashSession = incompleteSessions.find(s => s.id === 'session_crash')
      assert.ok(crashSession, 'crashed session should be discoverable')

      // Query checkpoints for that session
      const checkpoints = await repo.listCheckpointsByRecallSession('session_crash')
      assert.ok(checkpoints.length >= 1, 'should find at least one checkpoint')

      const crashCheckpoint = checkpoints.find(c => c.id === 'cp_crash')
      assert.ok(crashCheckpoint, 'crashed checkpoint should be discoverable')
      assert.strictEqual(crashCheckpoint.status, 'pending_correction')
      assert.strictEqual(crashCheckpoint.completedAt, undefined, 'incomplete checkpoint has no completedAt')
    })
  })

  // ------------------------------------------------------------------
  // CP17: Skipped checkpoint has completedAt but no userCommentId
  // ------------------------------------------------------------------
  describe('CP17 — Skipped checkpoint: completedAt set, no userCommentId', () => {
    it('has completedAt but no userCommentId after skip', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })
      seedSession(repo, { currentMoveIndex: 1 })
      runtimeStore.setActiveCheckpoint('cp_1')

      await service.skipCheckpoint('cp_1')

      const cp = repo.store.checkpoints['cp_1']
      assert.ok(cp.completedAt, 'completedAt should be set')
      assert.strictEqual(cp.userCommentId, undefined, 'skipped checkpoint should have no userCommentId')
    })
  })

  describe('CP18 — resumeRecall clears correctionDraft', () => {
    it('clears the active correctionDraft when checkpoint resumes recall', async () => {
      seedCheckpoint(repo, {
        status: 'commented',
        userCorrectionLine: ['R17'],
        userCommentId: 'comment_1',
      })
      seedSession(repo, {currentMoveIndex: 1})
      runtimeStore.setActiveCheckpoint('cp_1')
      runtimeStore.setCorrectionDraft({checkpointId: 'cp_1', moves: ['R17']})

      await service.resumeRecall('cp_1')

      assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)
      assert.strictEqual(runtimeStore.getState().correctionDraft, undefined)
      assert.strictEqual(repo.store.sessions.session_1.currentMoveIndex, 2)
    })
  })
})

// =====================================================================
// Integration tests requiring recallService + checkpointService together
// =====================================================================

describe('recallCheckpointService — Phase 5 integration contracts', () => {
  let runtimeStore, repo, checkpointService, recallService

  beforeEach(() => {
    runtimeStore = createTrainingRuntimeStore()
    repo = createStrictFakeRepo()
    checkpointService = createRecallCheckpointService({
      repository: repo,
      runtimeStore,
    })
    recallService = createRecallService({
      repository: repo,
      runtimeStore,
      checkpointService,
    })
  })

  // ------------------------------------------------------------------
  // CP08: Full skip flow — recall hits bad move -> checkpoint -> skip ->
  //       session advances -> recall continues -> complete
  // ------------------------------------------------------------------
  describe('CP08 — Full skip integration flow', () => {
    it('skip checkpoint and complete recall successfully', async () => {
      seedAttempt(repo)
      seedBadMove(repo, { moveIndex: 1, severity: 'major' })

      // Create recall session
      const session = await recallService.createRecallFromAttempt('attempt_1')
      const sessionId = session.id

      // Move 0: correct
      await recallService.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' })

      // Move 1: hits bad move, triggers checkpoint
      await recallService.submitRecallMove({ recallSessionId: sessionId, userMove: 'Q16' })

      const cpId = runtimeStore.getState().activeCheckpointId
      assert.ok(cpId, 'checkpoint should be active after bad move')

      // Session frozen at index 1
      assert.strictEqual(repo.store.sessions[sessionId].currentMoveIndex, 1)

      // Skip the checkpoint
      await checkpointService.skipCheckpoint(cpId)

      // After skip: session advances, checkpoint cleared
      assert.strictEqual(repo.store.sessions[sessionId].currentMoveIndex, 2)
      assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)

      // Continue recall: move 2 correct
      const ra2 = await recallService.submitRecallMove({ recallSessionId: sessionId, userMove: 'C3' })
      assert.strictEqual(ra2.isCorrect, true)

      // Complete recall
      await recallService.completeRecall(sessionId)

      const finalSession = repo.store.sessions[sessionId]
      assert.strictEqual(finalSession.completed, true)

      const finalAttempt = repo.store.attempts['attempt_1']
      assert.strictEqual(finalAttempt.recallCompleted, false)
      assert.strictEqual(finalAttempt.status, 'submitted')
    })
  })

  // ------------------------------------------------------------------
  // CP11: Multiple checkpoints at different indices
  // ------------------------------------------------------------------
  describe('CP11 — Multiple sequential checkpoints at different indices', () => {
    it('handles two checkpoints in sequence', async () => {
      // Set up: 5-move recall with bad moves at index 1 and index 3
      seedAttempt(repo, { userLine: ['D4', 'Q16', 'C3', 'E5', 'F6'] })
      seedBadMove(repo, { id: 'bm_idx1', moveIndex: 1, severity: 'major' })
      seedBadMove(repo, { id: 'bm_idx3', moveIndex: 3, severity: 'severe' })

      const session = await recallService.createRecallFromAttempt('attempt_1')
      const sessionId = session.id

      // Move 0: correct, no checkpoint
      await recallService.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' })
      assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)

      // Move 1: hits bad move at index 1
      await recallService.submitRecallMove({ recallSessionId: sessionId, userMove: 'Q16' })
      const cp1Id = runtimeStore.getState().activeCheckpointId
      assert.ok(cp1Id, 'first checkpoint should be active')

      // Skip first checkpoint
      await checkpointService.skipCheckpoint(cp1Id)
      assert.strictEqual(repo.store.sessions[sessionId].currentMoveIndex, 2)
      assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)

      // Move 2: correct, no checkpoint
      await recallService.submitRecallMove({ recallSessionId: sessionId, userMove: 'C3' })
      assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)

      // Move 3: hits bad move at index 3
      await recallService.submitRecallMove({ recallSessionId: sessionId, userMove: 'E5' })
      const cp2Id = runtimeStore.getState().activeCheckpointId
      assert.ok(cp2Id, 'second checkpoint should be active')
      assert.notStrictEqual(cp2Id, cp1Id, 'second checkpoint should be a different checkpoint')

      // Comment + resume second checkpoint
      await checkpointService.saveComment({
        checkpointId: cp2Id,
        comment: {
          id: 'comment_cp2',
          target: { kind: 'checkpoint', checkpointId: cp2Id },
          content: 'Second checkpoint comment',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      })
      await checkpointService.resumeRecall(cp2Id)

      // Move 4: correct
      const ra4 = await recallService.submitRecallMove({ recallSessionId: sessionId, userMove: 'F6' })
      assert.strictEqual(ra4.isCorrect, true)

      // Complete recall
      await recallService.completeRecall(sessionId)

      const finalSession = repo.store.sessions[sessionId]
      assert.strictEqual(finalSession.completed, true)

      // Verify both checkpoints exist and have distinct final states
      const allCheckpoints = await repo.listCheckpointsByRecallSession(sessionId)
      assert.strictEqual(allCheckpoints.length, 2)

      const cp1Final = allCheckpoints.find(c => c.id === cp1Id)
      const cp2Final = allCheckpoints.find(c => c.id === cp2Id)
      assert.strictEqual(cp1Final.status, 'skipped')
      assert.strictEqual(cp2Final.status, 'commented')
      assert.ok(cp1Final.completedAt)
      assert.ok(cp2Final.completedAt)
    })
  })

  // ------------------------------------------------------------------
  // CP18: Skip + resume does not accidentally complete session
  // ------------------------------------------------------------------
  describe('CP18 — Skip + resume does not accidentally complete session', () => {
    it('session is not completed after skip; completeRecall still needed', async () => {
      seedAttempt(repo, { userLine: ['D4', 'Q16', 'C3'] })
      seedBadMove(repo, { moveIndex: 1, severity: 'major' })

      const session = await recallService.createRecallFromAttempt('attempt_1')
      const sessionId = session.id

      // Move 0: correct
      await recallService.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' })

      // Move 1: hits bad move
      await recallService.submitRecallMove({ recallSessionId: sessionId, userMove: 'Q16' })
      const cpId = runtimeStore.getState().activeCheckpointId
      assert.ok(cpId)

      // Skip checkpoint
      await checkpointService.skipCheckpoint(cpId)

      // After skip, session should NOT be completed
      const sessionAfterSkip = repo.store.sessions[sessionId]
      assert.strictEqual(sessionAfterSkip.completed, false,
        'session should NOT be completed just from skipping a checkpoint')
      assert.strictEqual(sessionAfterSkip.completedAt, undefined,
        'session completedAt should not be set from skip')

      // Continue: move 2 correct
      await recallService.submitRecallMove({ recallSessionId: sessionId, userMove: 'C3' })

      // Session still not completed until explicit completeRecall
      const sessionBeforeComplete = repo.store.sessions[sessionId]
      assert.strictEqual(sessionBeforeComplete.completed, false,
        'session should NOT auto-complete even after all moves done')

      // Now complete explicitly
      await recallService.completeRecall(sessionId)

      const sessionAfterComplete = repo.store.sessions[sessionId]
      assert.strictEqual(sessionAfterComplete.completed, true,
        'session should be completed after explicit completeRecall')
    })
  })
})
