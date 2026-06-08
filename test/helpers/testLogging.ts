import {createLoggerService} from '../../src/modules/logger/LoggerService.js'
import {createConsoleWriter} from '../../src/modules/logger/consoleWriter.js'

export function isTestLoggingEnabled(env = process.env): boolean {
  const value = env.SABAKI_TEST_LOGS
  return value === '1' || value === 'true' || value === 'yes'
}

export function createTestLogger(opts: {silent?: boolean} = {}) {
  const entries: unknown[] = []
  const logs: Array<{
    level: unknown
    channel: unknown
    message: unknown
    data: unknown
  }> = []

  const shouldPrint = opts.silent === true ? false : isTestLoggingEnabled()
  const service = createLoggerService({
    bufferSize: 1000,
    writers: shouldPrint ? [createConsoleWriter()] : [],
  })

  service.subscribe(entry => {
    if (entry == null || typeof entry !== 'object') return

    const logEntry = entry as {
      level?: unknown
      source?: unknown
      message?: unknown
      data?: unknown
    }
    entries.push(entry)
    logs.push({
      level: logEntry.level,
      channel: logEntry.source,
      message: logEntry.message,
      data: logEntry.data,
    })
  })

  const logger = {
    info: (ch: string, msg: string, data?: Record<string, unknown>) =>
      service.info(ch, msg, data),
    warn: (ch: string, msg: string, data?: Record<string, unknown>) =>
      service.warn(ch, msg, data),
    error: (ch: string, msg: string, data?: Record<string, unknown>) =>
      service.error(ch, msg, data),
    debug: (ch: string, msg: string, data?: Record<string, unknown>) =>
      service.debug(ch, msg, data),
  }

  return {logger, logs, entries, service}
}
