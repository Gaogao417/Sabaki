/**
 * Creates a test logger that both collects entries AND prints to console.
 *
 * Replaces the manual pattern:
 *   const logs = []
 *   const logger = { info(ch, msg, data) { logs.push({channel: ch, message: msg, data}) } }
 *
 * Usage:
 *   const {logger, logs} = createTestLogger()
 *   // ... use logger in service deps ...
 *   assert.ok(logs.some(l => l.channel.includes('submit')))
 *
 * To suppress console output (e.g. in focused tests):
 *   const {logger, logs} = createTestLogger({silent: true})
 */

import {createLoggerService} from '../../src/modules/logger/LoggerService.js'
import {createConsoleWriter} from '../../src/modules/logger/consoleWriter.js'

export function createTestLogger(opts = {}) {
  const entries = []
  const logs = []

  const consoleWriter = opts.silent ? null : createConsoleWriter()

  const service = createLoggerService({
    bufferSize: 1000,
    writers: consoleWriter ? [consoleWriter] : [],
  })

  // Subscribe to buffer entries into the test-friendly `logs` array
  service.subscribe(entry => {
    entries.push(entry)
    logs.push({
      level: entry.level,
      channel: entry.source,
      message: entry.message,
      data: entry.data,
    })
  })

  // Return a logger shaped like what the deps types expect:
  // { info(channel, message, data?), warn(...), error(...) }
  const logger = {
    info: (ch, msg, data) => service.info(ch, msg, data),
    warn: (ch, msg, data) => service.warn(ch, msg, data),
    error: (ch, msg, data) => service.error(ch, msg, data),
    debug: (ch, msg, data) => service.debug(ch, msg, data),
  }

  return {logger, logs, entries, service}
}
