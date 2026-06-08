import assert from 'assert'
import {createTestLogger, isTestLoggingEnabled} from './createTestLogger.ts'

describe('createTestLogger smoke test', () => {
  it('collects logs without requiring console output', () => {
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

  it('honors the global SABAKI_TEST_LOGS switch', () => {
    const before = process.env.SABAKI_TEST_LOGS

    delete process.env.SABAKI_TEST_LOGS
    assert.strictEqual(isTestLoggingEnabled(), false)

    process.env.SABAKI_TEST_LOGS = '1'
    assert.strictEqual(isTestLoggingEnabled(), true)

    if (before === undefined) delete process.env.SABAKI_TEST_LOGS
    else process.env.SABAKI_TEST_LOGS = before
  })

  it('silent mode suppresses console output regardless of global switch', () => {
    const {logger, logs} = createTestLogger({silent: true})

    logger.info('silent.test', 'Should not print')
    assert.strictEqual(logs.length, 1)
  })
})
