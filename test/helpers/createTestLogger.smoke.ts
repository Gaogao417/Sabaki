import assert from 'assert'
import {createTestLogger} from './createTestLogger.ts'

describe('createTestLogger smoke test', () => {
  it('collects and prints logs', () => {
    const {logger, logs} = createTestLogger()

    logger.info('flow.submit', 'Submit attempt', {tabId: 'tab_1', mode: 'play'})
    logger.warn('flow.reject', 'Invalid transition', {from: 'recall'})
    logger.error('flow.error', 'Something failed', {err: 'timeout'})

    assert.strictEqual(logs.length, 3)
    assert.strictEqual(logs[0].channel, 'flow.submit')
    assert.strictEqual(logs[0].message, 'Submit attempt')
    assert.deepStrictEqual(logs[0].data, {tabId: 'tab_1', mode: 'play'})
    assert.strictEqual(logs[1].channel, 'flow.reject')
    assert.strictEqual(logs[2].channel, 'flow.error')
  })

  it('silent mode suppresses console output', () => {
    const {logger, logs} = createTestLogger({silent: true})

    logger.info('silent.test', 'Should not print')
    assert.strictEqual(logs.length, 1)
  })
})
