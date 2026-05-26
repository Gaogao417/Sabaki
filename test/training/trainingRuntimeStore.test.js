import assert from 'assert'

import { createTrainingRuntimeStore } from '../../src/modules/training/store/trainingRuntimeStore.ts'
import { createPhase3AiMovePending } from './phase3TypedFakes.ts'

describe('trainingRuntimeStore', () => {
  it('P3-T01 stores and clears AiMovePending by request id', () => {
    const store = createTrainingRuntimeStore()
    let notifications = 0
    store.subscribe(() => notifications++)

    const pending = createPhase3AiMovePending()

    store.setAiMovePending(pending)

    assert.deepStrictEqual(store.getState().pendingAiMove, pending)
    assert.deepStrictEqual(store.getState().supersededAiMoveRequestIds, [])
    assert.strictEqual(notifications, 1)

    store.clearAiMovePending('different_request')

    assert.deepStrictEqual(store.getState().pendingAiMove, pending)
    assert.strictEqual(notifications, 1)

    store.clearAiMovePending('ai_req_1')

    assert.strictEqual(store.getState().pendingAiMove, undefined)
    assert.strictEqual(notifications, 2)
  })

  it('P3-T01b records superseded AiMove request ids', () => {
    const store = createTrainingRuntimeStore()

    store.setAiMovePending(createPhase3AiMovePending({requestId: 'ai_req_old'}))
    store.setAiMovePending(createPhase3AiMovePending({requestId: 'ai_req_new'}))
    store.clearAiMovePending('ai_req_new')

    assert.deepStrictEqual(store.getState().supersededAiMoveRequestIds, ['ai_req_old'])
    assert.strictEqual(store.hasSupersededAiMoveRequest('ai_req_old'), true)
    assert.strictEqual(store.hasSupersededAiMoveRequest('ai_req_new'), false)
  })

  it('appends checkpoint correction draft moves for the active checkpoint', () => {
    const store = createTrainingRuntimeStore()
    let notifications = 0
    store.subscribe(() => notifications++)

    store.setActiveCheckpoint('cp_1')
    store.appendCorrectionDraftMove({
      checkpointId: 'cp_1',
      move: 'dd',
      source: {kind: 'recall-checkpoint', recallSessionId: 'rs_1'},
    })
    store.appendCorrectionDraftMove({checkpointId: 'cp_1', move: 'pp'})

    assert.deepStrictEqual(store.getState().correctionDraft, {
      checkpointId: 'cp_1',
      moves: ['dd', 'pp'],
      source: {kind: 'recall-checkpoint', recallSessionId: 'rs_1'},
    })
    assert.strictEqual(notifications, 3)
  })

  it('clears stale correction draft when checkpoint lifecycle ends or changes', () => {
    const store = createTrainingRuntimeStore()

    store.setActiveCheckpoint('cp_1')
    store.setCorrectionDraft({checkpointId: 'cp_1', moves: ['dd']})
    store.setActiveCheckpoint(undefined)
    assert.strictEqual(store.getState().correctionDraft, undefined)

    store.setActiveCheckpoint('cp_1')
    store.setCorrectionDraft({checkpointId: 'cp_1', moves: ['pp']})
    store.setActiveCheckpoint('cp_2')
    assert.strictEqual(store.getState().correctionDraft, undefined)
    assert.strictEqual(store.getState().activeCheckpointId, 'cp_2')
  })
})
