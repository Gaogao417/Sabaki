import assert from 'assert'

import { createRecallService } from '../../src/modules/training/recall/recallService.ts'
import { createRecallCheckpointService } from '../../src/modules/training/recall/recallCheckpointService.ts'
import { createTrainingRuntimeStore } from '../../src/modules/training/store/trainingRuntimeStore.ts'
import {
  createPhase3StrictRecallRepository,
  seedPhase3BadMove,
  seedPhase3Checkpoint,
  seedPhase3RecallAttempt,
  seedPhase3RecallSession,
} from './phase3TypedFakes.ts'

// --- Helpers ---

function seedAttempt(repo, overrides = {}) {
  return seedPhase3RecallAttempt(repo, overrides)
}

function seedSession(repo, overrides = {}) {
  return seedPhase3RecallSession(repo, overrides)
}

function seedBadMove(repo, overrides = {}) {
  return seedPhase3BadMove(repo, overrides)
}

function seedCheckpoint(repo, overrides = {}) {
  return seedPhase3Checkpoint(repo, overrides)
}

// --- recallService tests ---

describe('recallService', () => {
  let runtimeStore, repo, checkpointService, service

  beforeEach(() => {
    runtimeStore = createTrainingRuntimeStore()
    repo = createPhase3StrictRecallRepository()
    checkpointService = createRecallCheckpointService({
      repository: repo,
      runtimeStore,
    })
    service = createRecallService({
      repository: repo,
      runtimeStore,
      checkpointService,
    })
  })

  describe('createRecallFromAttempt', () => {
    it('creates a recall session from attempt userLine', async () => {
      seedAttempt(repo)

      const session = await service.createRecallFromAttempt('attempt_1')

      assert.strictEqual(session.taskId, 'task_1')
      assert.strictEqual(session.type, 'line_recall')
      assert.deepStrictEqual(session.expectedMoves, ['D4', 'Q16', 'C3'])
      assert.strictEqual(session.currentMoveIndex, 0)
      assert.strictEqual(session.completed, false)
      assert.strictEqual(session.attemptId, 'attempt_1')
      assert.deepStrictEqual(session.source, { kind: 'attempt', attemptId: 'attempt_1' })
    })

    it('sets active recall session in runtime store', async () => {
      seedAttempt(repo)

      await service.createRecallFromAttempt('attempt_1')
      assert.ok(runtimeStore.getState().activeRecallSessionId)
    })

    it('hydrates recallView in runtime store', async () => {
      seedAttempt(repo)

      const session = await service.createRecallFromAttempt('attempt_1')
      const view = runtimeStore.getState().recallView

      assert.strictEqual(view.recallSessionId, session.id)
      assert.strictEqual(view.taskId, 'task_1')
      assert.strictEqual(view.moveIndex, 0)
      assert.deepStrictEqual(view.expectedMoves.map(move => move.vertex), ['D4', 'Q16', 'C3'])
      assert.deepStrictEqual(view.userAttempts, [])
    })

    it('throws if attempt not found', async () => {
      await assert.rejects(
        () => service.createRecallFromAttempt('nonexistent'),
        /attempt not found/,
      )
    })

    it('persists via repository.createRecallSession', async () => {
      seedAttempt(repo)

      await service.createRecallFromAttempt('attempt_1')
      const createCalls = repo.calls.filter(c => c[0] === 'createRecallSession')
      assert.strictEqual(createCalls.length, 1)
    })
  })

  describe('submitRecallMove', () => {
    let sessionId

    beforeEach(async () => {
      seedAttempt(repo)
      const session = await service.createRecallFromAttempt('attempt_1')
      sessionId = session.id
    })

    it('creates recall attempt with correct result', async () => {
      const ra = await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' })

      assert.strictEqual(ra.isCorrect, true)
      assert.strictEqual(ra.expectedMove, 'D4')
      assert.strictEqual(ra.userMove, 'D4')
      assert.strictEqual(ra.moveNumber, 0)
    })

    it('records incorrect move', async () => {
      const ra = await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'E5' })
      assert.strictEqual(ra.isCorrect, false)
      assert.strictEqual(ra.expectedMove, 'D4')
    })

    it('does NOT advance currentMoveIndex on incorrect move', async () => {
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'E5' })

      const session = repo.store.sessions[sessionId]
      assert.strictEqual(session.currentMoveIndex, 0)
    })

    it('refreshes recallView after an incorrect move', async () => {
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'E5' })

      const view = runtimeStore.getState().recallView
      assert.strictEqual(view.recallSessionId, sessionId)
      assert.strictEqual(view.moveIndex, 0)
      assert.deepStrictEqual(view.userAttempts, [
        {vertex: 'E5', isCorrect: false},
      ])
    })

    it('blocks submission while checkpoint is active', async () => {
      // Move to index 0 then trigger a checkpoint at index 0
      seedBadMove(repo, { moveIndex: 0, severity: 'major' })

      // First correct move triggers checkpoint at index 0
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' })
      assert.ok(runtimeStore.getState().activeCheckpointId)

      // Now try submitting another move — should be blocked
      await assert.rejects(
        () => service.submitRecallMove({ recallSessionId: sessionId, userMove: 'Q16' }),
        /checkpoint active/,
      )
    })

    it('advances currentMoveIndex after move', async () => {
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' })

      const session = repo.store.sessions[sessionId]
      assert.strictEqual(session.currentMoveIndex, 1)
    })

    it('refreshes recallView after a correct move advances', async () => {
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' })

      const view = runtimeStore.getState().recallView
      assert.strictEqual(view.recallSessionId, sessionId)
      assert.strictEqual(view.moveIndex, 1)
      assert.deepStrictEqual(view.userAttempts, [
        {vertex: 'D4', isCorrect: true},
      ])
    })

    it('throws if session not found', async () => {
      await assert.rejects(
        () => service.submitRecallMove({ recallSessionId: 'nonexistent', userMove: 'D4' }),
        /session not found/,
      )
    })

    it('throws if session already completed', async () => {
      repo.store.sessions[sessionId].completed = true

      await assert.rejects(
        () => service.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' }),
        /already completed/,
      )
    })

    it('throws when past end of expectedMoves', async () => {
      // Exhaust all moves
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' })
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'Q16' })
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'C3' })

      await assert.rejects(
        () => service.submitRecallMove({ recallSessionId: sessionId, userMove: 'E5' }),
        /past end/,
      )
    })

    it('triggers checkpoint on major bad move and freezes currentMoveIndex', async () => {
      seedBadMove(repo, { moveIndex: 1, severity: 'major' })

      // Move to index 1
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' })
      assert.strictEqual(repo.store.sessions[sessionId].currentMoveIndex, 1)

      // This move hits the bad move at index 1
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'Q16' })

      // Session should stay at index 1 (checkpoint blocks advance)
      assert.strictEqual(repo.store.sessions[sessionId].currentMoveIndex, 1)
      assert.ok(runtimeStore.getState().activeCheckpointId)
      assert.strictEqual(runtimeStore.getState().recallView.moveIndex, 1)
      assert.deepStrictEqual(
        runtimeStore.getState().recallView.userAttempts.map(attempt => attempt.vertex),
        ['D4', 'Q16'],
      )
    })

    it('triggers checkpoint on severe bad move', async () => {
      seedBadMove(repo, { id: 'bm_severe', moveIndex: 1, severity: 'severe' })

      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' })
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'Q16' })

      assert.ok(runtimeStore.getState().activeCheckpointId)
    })

    it('does NOT trigger checkpoint for minor bad move', async () => {
      seedBadMove(repo, { id: 'bm_minor', moveIndex: 1, severity: 'minor' })

      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'D4' })
      await service.submitRecallMove({ recallSessionId: sessionId, userMove: 'Q16' })

      assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)
      // Advance should proceed normally
      assert.strictEqual(repo.store.sessions[sessionId].currentMoveIndex, 2)
    })
  })

  describe('completeRecall', () => {
    it('marks session as completed', async () => {
      seedAttempt(repo, { userLine: ['D4'] })
      const session = await service.createRecallFromAttempt('attempt_1')
      await service.completeRecall(session.id)

      const updated = repo.store.sessions[session.id]
      assert.strictEqual(updated.completed, true)
      assert.ok(updated.completedAt)
    })

    it('clears active recall session from runtime store', async () => {
      seedAttempt(repo, { userLine: ['D4'] })
      const session = await service.createRecallFromAttempt('attempt_1')
      await service.completeRecall(session.id)

      assert.strictEqual(runtimeStore.getState().activeRecallSessionId, undefined)
    })

    it('P3-T06 completes recall without mutating source Attempt status/result/userLine', async () => {
      seedAttempt(repo, { userLine: ['D4'] })
      const session = await service.createRecallFromAttempt('attempt_1')
      repo.calls.length = 0
      await service.completeRecall(session.id)

      const attempt = repo.store.attempts['attempt_1']
      assert.deepStrictEqual(attempt.userLine, ['D4'])
      assert.strictEqual(attempt.result, 'pending')
      assert.strictEqual(attempt.status, 'submitted')
      assert.strictEqual(
        repo.calls.some(call => call[0] === 'updateAttempt'),
        false,
        'completeRecall must not call repository.updateAttempt',
      )
    })

    it('throws if session not found', async () => {
      await assert.rejects(
        () => service.completeRecall('nonexistent'),
        /session not found/,
      )
    })
  })
})

// --- recallCheckpointService tests ---

describe('recallCheckpointService', () => {
  let runtimeStore, repo, service

  beforeEach(() => {
    runtimeStore = createTrainingRuntimeStore()
    repo = createPhase3StrictRecallRepository()
    service = createRecallCheckpointService({
      repository: repo,
      runtimeStore,
    })
  })

  describe('shouldTriggerCheckpoint', () => {
    it('returns bad move for major severity at matching move index', async () => {
      seedSession(repo)
      seedBadMove(repo, { moveIndex: 1, severity: 'major' })

      const result = await service.shouldTriggerCheckpoint({
        recallSessionId: 'session_1',
        moveIndex: 1,
      })

      assert.ok(result)
      assert.strictEqual(result.id, 'bm_1')
    })

    it('returns bad move for severe severity', async () => {
      seedSession(repo)
      seedBadMove(repo, { id: 'bm_severe', moveIndex: 1, severity: 'severe' })

      const result = await service.shouldTriggerCheckpoint({
        recallSessionId: 'session_1',
        moveIndex: 1,
      })

      assert.ok(result)
      assert.strictEqual(result.id, 'bm_severe')
    })

    it('returns null for minor severity', async () => {
      seedSession(repo)
      seedBadMove(repo, { id: 'bm_minor', moveIndex: 0, severity: 'minor' })

      const result = await service.shouldTriggerCheckpoint({
        recallSessionId: 'session_1',
        moveIndex: 0,
      })

      assert.strictEqual(result, null)
    })

    it('returns null if bad move already has checkpoint', async () => {
      seedSession(repo)
      seedBadMove(repo, { moveIndex: 0, severity: 'major', recallCheckpointId: 'cp_existing' })

      const result = await service.shouldTriggerCheckpoint({
        recallSessionId: 'session_1',
        moveIndex: 0,
      })

      assert.strictEqual(result, null)
    })

    it('returns null for non-attempt source', async () => {
      seedSession(repo, { source: { kind: 'game', gameId: 'game_1' } })

      const result = await service.shouldTriggerCheckpoint({
        recallSessionId: 'session_1',
        moveIndex: 0,
      })

      assert.strictEqual(result, null)
    })

    it('returns null if no bad move at move index', async () => {
      seedSession(repo)
      seedBadMove(repo, { moveIndex: 5, severity: 'major' })

      const result = await service.shouldTriggerCheckpoint({
        recallSessionId: 'session_1',
        moveIndex: 1,
      })

      assert.strictEqual(result, null)
    })
  })

  describe('startCheckpoint', () => {
    it('creates checkpoint with pending_correction status', async () => {
      seedSession(repo)
      seedBadMove(repo)

      const cp = await service.startCheckpoint({
        recallSessionId: 'session_1',
        badMoveId: 'bm_1',
      })

      assert.strictEqual(cp.status, 'pending_correction')
      assert.strictEqual(cp.badMoveId, 'bm_1')
      assert.strictEqual(cp.recallSessionId, 'session_1')
      assert.deepStrictEqual(cp.userCorrectionLine, [])
    })

    it('sets active checkpoint in runtime store', async () => {
      seedSession(repo)
      seedBadMove(repo)

      await service.startCheckpoint({ recallSessionId: 'session_1', badMoveId: 'bm_1' })
      assert.ok(runtimeStore.getState().activeCheckpointId)
    })

    it('refreshes recallView when checkpoint starts', async () => {
      seedSession(repo, { currentMoveIndex: 1 })
      seedBadMove(repo)

      const cp = await service.startCheckpoint({ recallSessionId: 'session_1', badMoveId: 'bm_1' })
      const view = runtimeStore.getState().recallView

      assert.strictEqual(runtimeStore.getState().activeCheckpointId, cp.id)
      assert.strictEqual(view.recallSessionId, 'session_1')
      assert.strictEqual(view.moveIndex, 1)
      assert.deepStrictEqual(view.expectedMoves.map(move => move.vertex), ['D4', 'Q16', 'C3'])
    })

    it('links checkpoint back to bad move to prevent duplicate trigger', async () => {
      seedSession(repo)
      seedBadMove(repo)

      const cp = await service.startCheckpoint({ recallSessionId: 'session_1', badMoveId: 'bm_1' })

      const bm = repo.store.badMoves.find(b => b.id === 'bm_1')
      assert.strictEqual(bm.recallCheckpointId, cp.id)
    })

    it('throws if recall session not found', async () => {
      seedBadMove(repo)

      await assert.rejects(
        () => service.startCheckpoint({ recallSessionId: 'missing_session', badMoveId: 'bm_1' }),
        /session not found/,
      )
    })

    it('throws if badMove not found', async () => {
      seedSession(repo)

      await assert.rejects(
        () => service.startCheckpoint({ recallSessionId: 'session_1', badMoveId: 'nonexistent' }),
        /badMove not found/,
      )
    })
  })

  describe('submitUserCorrectionLine', () => {
    it('saves correction line', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })

      await service.submitUserCorrectionLine({ checkpointId: 'cp_1', moves: ['E5', 'F6'] })

      const cp = repo.store.checkpoints['cp_1']
      assert.deepStrictEqual(cp.userCorrectionLine, ['E5', 'F6'])
    })

    it('throws if not in pending_correction status', async () => {
      seedCheckpoint(repo, { status: 'commented' })

      await assert.rejects(
        () => service.submitUserCorrectionLine({ checkpointId: 'cp_1', moves: ['E5'] }),
        /pending_correction/,
      )
    })

    it('throws if checkpoint not found', async () => {
      await assert.rejects(
        () => service.submitUserCorrectionLine({ checkpointId: 'nonexistent', moves: ['E5'] }),
        /not found/,
      )
    })
  })

  describe('revealAiCandidateLines', () => {
    it('reveals AI lines from MoveEvaluation and updates status', async () => {
      seedCheckpoint(repo, { status: 'pending_correction', userCorrectionLine: ['E5'] })
      seedBadMove(repo)
      repo.store.evaluations.push({
        id: 'eval_1',
        attemptId: 'attempt_1',
        moveIndex: 1,
        move: 'D4',
        engineSuggestedLine: ['F6', 'G7'],
        afterScoreLead: 3.5,
        afterWinrate: 0.62,
        status: 'evaluated',
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      const lines = await service.revealAiCandidateLines('cp_1')

      assert.strictEqual(lines.length, 1)
      assert.strictEqual(lines[0].label, 'AI recommended')
      assert.deepStrictEqual(lines[0].moves, ['F6', 'G7'])
      assert.strictEqual(lines[0].source, 'engine')
      assert.strictEqual(lines[0].scoreLead, 3.5)
      assert.strictEqual(lines[0].winrate, 0.62)

      const cp = repo.store.checkpoints['cp_1']
      assert.strictEqual(cp.status, 'ai_revealed')
      assert.strictEqual(cp.aiCandidateLines.length, 1)
    })

    it('returns empty array when no engineSuggestedLine but still updates status', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })
      seedBadMove(repo)
      repo.store.evaluations.push({
        id: 'eval_1',
        attemptId: 'attempt_1',
        moveIndex: 1,
        move: 'D4',
        status: 'evaluated',
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      const lines = await service.revealAiCandidateLines('cp_1')
      assert.deepStrictEqual(lines, [])

      const cp = repo.store.checkpoints['cp_1']
      assert.strictEqual(cp.status, 'ai_revealed')
      assert.deepStrictEqual(cp.aiCandidateLines, [])
    })

    it('throws if badMove not found', async () => {
      seedCheckpoint(repo, { status: 'pending_correction', badMoveId: 'bm_missing' })

      await assert.rejects(
        () => service.revealAiCandidateLines('cp_1'),
        /badMove not found/,
      )
    })

    it('throws if checkpoint not in valid status', async () => {
      seedCheckpoint(repo, { status: 'commented' })

      await assert.rejects(
        () => service.revealAiCandidateLines('cp_1'),
        /pending_correction/,
      )
    })
  })

  describe('saveComment', () => {
    it('saves comment and updates checkpoint to commented', async () => {
      seedCheckpoint(repo, {
        status: 'ai_revealed',
        userCorrectionLine: ['E5'],
        aiCandidateLines: [{ label: 'AI recommended', moves: ['F6'], source: 'engine' }],
      })

      await service.saveComment({
        checkpointId: 'cp_1',
        comment: {
          id: 'comment_1',
          target: { kind: 'checkpoint', checkpointId: 'cp_1' },
          content: 'My original was too passive',
          templateAnswers: { originalBadBecause: 'Lost sente' },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      })

      assert.strictEqual(repo.store.comments.length, 1)
      assert.strictEqual(repo.store.comments[0].content, 'My original was too passive')

      const cp = repo.store.checkpoints['cp_1']
      assert.strictEqual(cp.status, 'commented')
      assert.strictEqual(cp.userCommentId, 'comment_1')
    })

    it('allows saveComment from pending_correction status', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })

      await service.saveComment({
        checkpointId: 'cp_1',
        comment: {
          id: 'comment_2',
          target: { kind: 'checkpoint', checkpointId: 'cp_1' },
          content: 'Quick note',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      })

      const cp = repo.store.checkpoints['cp_1']
      assert.strictEqual(cp.status, 'commented')
    })

    it('throws if checkpoint already commented', async () => {
      seedCheckpoint(repo, { status: 'commented' })

      await assert.rejects(
        () => service.saveComment({
          checkpointId: 'cp_1',
          comment: {
            id: 'comment_dup',
            target: { kind: 'checkpoint', checkpointId: 'cp_1' },
            content: 'dup',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        }),
        /cannot save comment/,
      )
    })
  })

  describe('resumeRecall', () => {
    it('advances session move index and clears active checkpoint', async () => {
      seedCheckpoint(repo, {
        status: 'commented',
        userCorrectionLine: ['E5'],
        userCommentId: 'comment_1',
      })
      seedSession(repo, { currentMoveIndex: 1 })
      runtimeStore.setActiveCheckpoint('cp_1')

      await service.resumeRecall('cp_1')

      assert.strictEqual(repo.store.sessions['session_1'].currentMoveIndex, 2)
      assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)
      assert.strictEqual(runtimeStore.getState().recallView.moveIndex, 2)
      assert.ok(repo.store.checkpoints['cp_1'].completedAt)
    })

    it('allows resume from skipped status', async () => {
      seedCheckpoint(repo, { status: 'skipped' })
      seedSession(repo, { currentMoveIndex: 1 })

      await service.resumeRecall('cp_1')

      assert.strictEqual(repo.store.sessions['session_1'].currentMoveIndex, 2)
    })

    it('throws if checkpoint is in pending_correction status', async () => {
      seedCheckpoint(repo, { status: 'pending_correction' })
      seedSession(repo, { currentMoveIndex: 1 })

      await assert.rejects(
        () => service.resumeRecall('cp_1'),
        /commented/,
      )
    })

    it('throws if checkpoint is in ai_revealed status', async () => {
      seedCheckpoint(repo, { status: 'ai_revealed' })
      seedSession(repo, { currentMoveIndex: 1 })

      await assert.rejects(
        () => service.resumeRecall('cp_1'),
        /commented/,
      )
    })

    it('throws if checkpoint already completed', async () => {
      seedCheckpoint(repo, {
        status: 'commented',
        completedAt: '2026-01-01T01:00:00.000Z',
      })
      seedSession(repo, { currentMoveIndex: 1 })

      await assert.rejects(
        () => service.resumeRecall('cp_1'),
        /already completed/,
      )
    })

    it('throws if checkpoint not found', async () => {
      await assert.rejects(
        () => service.resumeRecall('nonexistent'),
        /not found/,
      )
    })

    it('throws if session not found', async () => {
      seedCheckpoint(repo, { status: 'commented', recallSessionId: 'missing_session' })

      await assert.rejects(
        () => service.resumeRecall('cp_1'),
        /session not found/,
      )
    })
  })

  describe('Recall → Checkpoint → Comment → Resume integration', () => {
    let runtimeStore2, repo2, checkpointService2, recallService2

    beforeEach(() => {
      runtimeStore2 = createTrainingRuntimeStore()
      repo2 = createPhase3StrictRecallRepository()
      checkpointService2 = createRecallCheckpointService({
        repository: repo2,
        runtimeStore: runtimeStore2,
      })
      recallService2 = createRecallService({
        repository: repo2,
        runtimeStore: runtimeStore2,
        checkpointService: checkpointService2,
      })
    })

    it('full flow: create session → recall moves → checkpoint → correct → reveal → comment → resume → complete', async () => {
      seedAttempt(repo2)
      seedBadMove(repo2, { moveIndex: 1, severity: 'major' })
      repo2.store.evaluations.push({
        id: 'eval_1',
        attemptId: 'attempt_1',
        moveIndex: 1,
        move: 'Q16',
        engineSuggestedLine: ['R17', 'D3'],
        afterScoreLead: 4.0,
        afterWinrate: 0.65,
        status: 'evaluated',
        createdAt: '2026-01-01T00:00:00.000Z',
      })

      // Create recall session
      const session = await recallService2.createRecallFromAttempt('attempt_1')
      assert.strictEqual(session.expectedMoves.length, 3)

      // Recall move 0: correct
      const ra0 = await recallService2.submitRecallMove({ recallSessionId: session.id, userMove: 'D4' })
      assert.strictEqual(ra0.isCorrect, true)

      // Recall move 1: hits major bad move → checkpoint triggers
      const ra1 = await recallService2.submitRecallMove({ recallSessionId: session.id, userMove: 'Q16' })
      assert.strictEqual(ra1.moveNumber, 1)

      // Session frozen at index 1
      const frozenSession = repo2.store.sessions[session.id]
      assert.strictEqual(frozenSession.currentMoveIndex, 1)

      // Active checkpoint exists
      const cpId = runtimeStore2.getState().activeCheckpointId
      assert.ok(cpId)

      // Bad move now linked to checkpoint
      const bm = repo2.store.badMoves.find(b => b.id === 'bm_1')
      assert.strictEqual(bm.recallCheckpointId, cpId)

      // Submit correction line
      await checkpointService2.submitUserCorrectionLine({ checkpointId: cpId, moves: ['R17', 'C4'] })

      // Reveal AI candidate lines
      const aiLines = await checkpointService2.revealAiCandidateLines(cpId)
      assert.strictEqual(aiLines.length, 1)
      assert.deepStrictEqual(aiLines[0].moves, ['R17', 'D3'])

      const cpAfterReveal = repo2.store.checkpoints[cpId]
      assert.strictEqual(cpAfterReveal.status, 'ai_revealed')
      assert.deepStrictEqual(cpAfterReveal.userCorrectionLine, ['R17', 'C4'])

      // Save comment
      await checkpointService2.saveComment({
        checkpointId: cpId,
        comment: {
          id: 'comment_int',
          target: { kind: 'checkpoint', checkpointId: cpId },
          content: 'My Q16 was too slow, R17 is better',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      })

      const cpAfterComment = repo2.store.checkpoints[cpId]
      assert.strictEqual(cpAfterComment.status, 'commented')

      // Resume recall
      await checkpointService2.resumeRecall(cpId)

      // Session advanced to index 2
      const resumedSession = repo2.store.sessions[session.id]
      assert.strictEqual(resumedSession.currentMoveIndex, 2)
      assert.strictEqual(runtimeStore2.getState().activeCheckpointId, undefined)

      // Complete last move
      const ra2 = await recallService2.submitRecallMove({ recallSessionId: session.id, userMove: 'C3' })
      assert.strictEqual(ra2.isCorrect, true)

      // Complete recall
      await recallService2.completeRecall(session.id)

      const finalSession = repo2.store.sessions[session.id]
      assert.strictEqual(finalSession.completed, true)
      assert.strictEqual(finalSession.currentMoveIndex, 3)

      const finalAttempt = repo2.store.attempts['attempt_1']
      assert.strictEqual(finalAttempt.recallCompleted, false)
      assert.strictEqual(finalAttempt.status, 'submitted')
    })
  })
})
