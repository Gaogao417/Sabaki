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
})
