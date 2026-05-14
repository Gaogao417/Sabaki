/**
 * LoggerService unit tests.
 *
 * Runs in pure Node — no window, no UI, no engineService.
 */

const assert = require('assert')
const {createLoggerService} = require('../src/modules/logger/LoggerService.js')
const {formatTimestamp, toSource} = require('../src/modules/logger/logFormatting.js')
const {safeSerialize} = require('../src/modules/logger/safeSerialize.js')

// ---------------------------------------------------------------------------
// LoggerService core
// ---------------------------------------------------------------------------

describe('LoggerService', () => {
  it('info/warn/error/debug produce entries in buffer', () => {
    let svc = createLoggerService()
    svc.info('test.source', 'Hello')
    svc.warn('test.warn', 'Be careful')
    svc.error('test.err', 'Oops')
    svc.debug('test.dbg', 'Trace')

    let entries = svc.getEntries()
    assert.strictEqual(entries.length, 4)
    assert.strictEqual(entries[0].level, 'info')
    assert.strictEqual(entries[0].source, 'test.source')
    assert.strictEqual(entries[0].message, 'Hello')
    assert.strictEqual(entries[1].level, 'warn')
    assert.strictEqual(entries[2].level, 'error')
    assert.strictEqual(entries[3].level, 'debug')
  })

  it('respects bufferSize and trims old entries', () => {
    let svc = createLoggerService({bufferSize: 3})
    svc.info('a', '1')
    svc.info('a', '2')
    svc.info('a', '3')
    svc.info('a', '4')

    let entries = svc.getEntries()
    assert.strictEqual(entries.length, 3)
    assert.strictEqual(entries[0].message, '2') // oldest trimmed
    assert.strictEqual(entries[2].message, '4')
  })

  it('subscribe receives entries; unsubscribe stops delivery', () => {
    let svc = createLoggerService()
    let received = []
    let unsub = svc.subscribe((entry) => received.push(entry))

    svc.info('test', 'msg1')
    assert.strictEqual(received.length, 1)

    unsub()
    svc.info('test', 'msg2')
    assert.strictEqual(received.length, 1, 'Should not receive after unsubscribe')
  })

  it('getEntries returns a snapshot copy', () => {
    let svc = createLoggerService()
    svc.info('test', 'hi')
    let snap = svc.getEntries()
    svc.info('test', 'again')
    assert.strictEqual(snap.length, 1, 'Snapshot should not grow')
  })

  it('close stops all logging', () => {
    let svc = createLoggerService()
    svc.info('before', 'still works')
    svc.close()
    svc.info('after', 'should not appear')
    assert.strictEqual(svc.getEntries().length, 1)
  })

  it('minLevel filters out lower-severity entries', () => {
    let svc = createLoggerService({minLevel: 'warn'})
    svc.debug('x', 'nope')
    svc.info('x', 'nope')
    svc.warn('x', 'yes')
    svc.error('x', 'yes')
    assert.strictEqual(svc.getEntries().length, 2)
  })

  it('writers receive entries', () => {
    let written = []
    let svc = createLoggerService({
      writers: [{write: (entry) => written.push(entry)}],
    })
    svc.info('src', 'msg', {key: 'val'})
    assert.strictEqual(written.length, 1)
    assert.strictEqual(written[0].source, 'src')
    assert.deepStrictEqual(written[0].data, {key: 'val'})
  })

  it('reconfigure updates minLevel', () => {
    let svc = createLoggerService({minLevel: 'warn'})
    svc.reconfigure({minLevel: 'debug'})
    svc.info('x', 'now allowed')
    assert.strictEqual(svc.getEntries().length, 1)
  })

  it('subscriber exception does not break logging', () => {
    let svc = createLoggerService()
    svc.subscribe(() => { throw new Error('boom') })
    svc.info('test', 'should not throw')
    assert.strictEqual(svc.getEntries().length, 1)
  })

  it('auto-fills time field when not provided', () => {
    let svc = createLoggerService()
    let before = Date.now()
    svc.log({level: 'info', source: 'test', message: 'hi'})
    let after = Date.now()
    let entry = svc.getEntries()[0]
    assert.ok(entry.time >= before && entry.time <= after)
  })

  it('preserves provided time field', () => {
    let svc = createLoggerService()
    let t = 1234567890
    svc.log({level: 'info', source: 'test', message: 'hi', time: t})
    assert.strictEqual(svc.getEntries()[0].time, t)
  })
})

// ---------------------------------------------------------------------------
// logFormatting
// ---------------------------------------------------------------------------

describe('logFormatting', () => {
  it('formatTimestamp formats ISO string to HH:MM:SS', () => {
    let iso = '2025-06-15T14:30:45.123Z'
    let result = formatTimestamp(iso)
    // Result depends on timezone; just check HH:MM:SS pattern
    assert.ok(/^\d{2}:\d{2}:\d{2}$/.test(result), `Expected HH:MM:SS, got ${result}`)
  })

  it('formatTimestamp accepts epoch ms', () => {
    let ms = new Date('2025-01-01T00:00:00Z').getTime()
    let result = formatTimestamp(ms)
    assert.ok(/^\d{2}:\d{2}:\d{2}$/.test(result))
  })

  it('toSource keeps event if already prefixed with category', () => {
    assert.strictEqual(toSource('engine', 'engine.attached'), 'engine.attached')
  })

  it('toSource prefixes category when event is short', () => {
    assert.strictEqual(toSource('engine', 'sync.failed'), 'engine.sync.failed')
  })
})

// ---------------------------------------------------------------------------
// safeSerialize
// ---------------------------------------------------------------------------

describe('safeSerialize', () => {
  it('handles primitives', () => {
    assert.strictEqual(safeSerialize(null), null)
    assert.strictEqual(safeSerialize(42), 42)
    assert.strictEqual(safeSerialize(true), true)
  })

  it('truncates long strings', () => {
    let long = 'x'.repeat(2000)
    let result = safeSerialize(long)
    assert.ok(result.endsWith('...[truncated]'))
    assert.ok(result.length < 1100)
  })

  it('serializes Error objects', () => {
    let err = new Error('test')
    let result = safeSerialize(err)
    assert.strictEqual(result.name, 'Error')
    assert.strictEqual(result.message, 'test')
    assert.ok(result.stack)
  })

  it('handles circular references', () => {
    let obj = {a: 1}
    obj.self = obj
    let result = safeSerialize(obj)
    assert.strictEqual(result.a, 1)
    assert.strictEqual(result.self, '[Circular]')
  })

  it('respects max depth', () => {
    let deep = {a: {b: {c: {d: {e: {f: 'too deep'}}}}}}
    let result = safeSerialize(deep)
    assert.strictEqual(result.a.b.c.d.e, '[MaxDepth]')
  })
})
