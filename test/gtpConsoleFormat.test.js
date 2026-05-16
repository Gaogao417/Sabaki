/**
 * Copy All Logs — plain-text formatter contract tests.
 *
 * Test contract: docs/design/2026-05-16/gtp-console-improvements/test-contract-v0.2.md
 * Contracts covered: R1-C01, R1-C02, R1-C03
 *
 * Run with: npx mocha --require tsx test/gtpConsoleFormat.test.js
 *
 * Test Legitimacy:
 *   All tests import production code from src/modules/gtpConsoleFormat.js.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   No mocks required — formatGtpEntry is a pure function.
 */

import assert from 'assert'
import {
  formatGtpEntry,
  formatGtpConsoleLogs,
} from '../src/modules/gtpConsoleFormat.js'

// ---------------------------------------------------------------------------
// Tests: formatGtpEntry (R1-C01 through R1-C03)
// ---------------------------------------------------------------------------

describe('formatGtpEntry (Copy All Logs)', () => {
  // ─── R1-C01: full command line with flags, quotes, paths ────────
  //
  // Production subject: gtpConsoleFormat.js -> formatGtpEntry
  // Production bug: command-line flags, quoted paths, or the $ prefix get
  //   truncated or mangled when copying logs.
  // Controlled dependencies: none (pure function, inline data).

  it('R1-C01: preserves full command line including $ prefix, flags, quotes, and paths', () => {
    let entry = {
      name: 'KataGo',
      command: null,
      response: {
        internal: true,
        content:
          'Engine Started\n$ /opt/homebrew/bin/katago gtp -model "/data/model.bin.gz" -config "/data/gtp.cfg"',
      },
      waiting: false,
    }

    let lines = formatGtpEntry(entry)

    // The function returns an array of output lines.
    // For an internal entry (no command, only response), we expect one line
    // containing the full content.
    assert.ok(
      lines.length >= 1,
      `Expected at least 1 line, got ${lines.length}`,
    )

    let joined = lines.join('\n')

    // The full $ line must appear intact
    assert.ok(
      joined.includes('$ /opt/homebrew/bin/katago gtp'),
      `Output must contain the $ command line with gtp subcommand: ${joined}`,
    )
    assert.ok(
      joined.includes('-model "/data/model.bin.gz"'),
      `Output must contain -model flag with quoted path: ${joined}`,
    )
    assert.ok(
      joined.includes('-config "/data/gtp.cfg"'),
      `Output must contain -config flag with quoted path: ${joined}`,
    )
    assert.ok(
      joined.includes('/opt/homebrew/bin/katago'),
      `Output must contain the full executable path: ${joined}`,
    )
  })

  // ─── R1-C02: multi-line content preserves newlines ─────────────
  //
  // Production subject: gtpConsoleFormat.js -> formatGtpEntry
  // Production bug: newlines in response.content are collapsed or stripped,
  //   causing multi-line engine output to appear as a single line.
  // Controlled dependencies: none (pure function, inline data).

  it('R1-C02: multi-line response.content preserves newlines in output', () => {
    let multiLineContent =
      'protocol_version\nlist_commands\nname\nversion\nquit'
    let entry = {
      name: 'KataGo',
      command: {id: 1, name: 'list_commands', args: []},
      response: {id: 1, content: multiLineContent},
      waiting: false,
    }

    let lines = formatGtpEntry(entry)
    let joined = lines.join('\n')

    // The newlines in the original content must be preserved.
    // If newlines were collapsed, we would see only 2 lines total
    // (command line + single response line) instead of preserving the 5 tokens.
    let tokens = multiLineContent.split('\n')
    for (let token of tokens) {
      assert.ok(
        joined.includes(token),
        `Output must contain token "${token}": ${joined}`,
      )
    }

    // Verify structural separation: there must be at least as many newlines
    // in the joined output as in the original content, meaning the lines are
    // not flattened.
    let originalNewlineCount = multiLineContent.split('\n').length - 1
    let outputNewlineCount = joined.split('\n').length - 1
    assert.ok(
      outputNewlineCount >= originalNewlineCount,
      `Output should have at least ${originalNewlineCount} newlines, got ${outputNewlineCount}: ${joined}`,
    )
  })

  // ─── R1-C03: coordinate tokens preserved unchanged ─────────────
  //
  // Production subject: gtpConsoleFormat.js -> formatGtpEntry
  // Production bug: coordinate tokens like "Q16" or "D4" are modified,
  //   lowercased, or stripped in copied text.
  // Controlled dependencies: none (pure function, inline data).

  it('R1-C03: coordinate tokens in response.content are preserved unchanged', () => {
    let entry = {
      name: 'KataGo',
      command: {id: 42, name: 'play', args: ['B', 'Q16']},
      response: {id: 42, content: ''},
      waiting: false,
    }

    let lines = formatGtpEntry(entry)
    let joined = lines.join('\n')

    // The command args contain "Q16" — it must appear in output
    assert.ok(
      joined.includes('Q16'),
      `Output must contain coordinate "Q16": ${joined}`,
    )

    // Also test coordinates inside response content
    let entryWithCoords = {
      name: 'KataGo',
      command: {id: 7, name: 'genmove', args: ['W']},
      response: {id: 7, content: 'D4'},
      waiting: false,
    }

    let lines2 = formatGtpEntry(entryWithCoords)
    let joined2 = lines2.join('\n')

    assert.ok(
      joined2.includes('D4'),
      `Output must contain coordinate "D4" from response content: ${joined2}`,
    )

    // Test multiple coordinates in a single response (e.g. kata-analyze output)
    let entryMultiple = {
      name: 'KataGo',
      command: {id: 10, name: 'kata-analyze', args: ['interval', '1']},
      response: {
        id: 10,
        content:
          'info move Q16 visits 100 winrate 5200\ninfo move D4 visits 50 winrate 5100',
      },
      waiting: false,
    }

    let lines3 = formatGtpEntry(entryMultiple)
    let joined3 = lines3.join('\n')

    assert.ok(
      joined3.includes('Q16'),
      `Output must contain "Q16" in multi-coordinate response: ${joined3}`,
    )
    assert.ok(
      joined3.includes('D4'),
      `Output must contain "D4" in multi-coordinate response: ${joined3}`,
    )
  })
})

// ---------------------------------------------------------------------------
// Tests: formatGtpConsoleLogs (app log data field)
// ---------------------------------------------------------------------------

describe('formatGtpConsoleLogs (app logs)', () => {
  it('R1-C04: app log entries include data field in copied output', () => {
    let result = formatGtpConsoleLogs({
      consoleLog: [],
      appLogs: [
        {
          time: 1715868623000,
          level: 'debug',
          source: 'engine.creating',
          message: 'Creating engine',
          data: {
            name: 'KataGo',
            path: '/opt/homebrew/bin/katago',
            args: 'gtp -model "/data/model.bin.gz"',
          },
        },
      ],
      logFilter: 'all',
    })

    assert.ok(
      result.includes('/opt/homebrew/bin/katago'),
      `App log copy must include data.path: ${result}`,
    )
    assert.ok(
      result.includes('gtp -model'),
      `App log copy must include data.args: ${result}`,
    )
  })

  it('R1-C05: app log entries without data field produce clean output', () => {
    let result = formatGtpConsoleLogs({
      consoleLog: [],
      appLogs: [
        {
          time: 1715868623000,
          level: 'info',
          source: 'state.created',
          message: 'Application state initialized',
        },
      ],
      logFilter: 'all',
    })

    assert.ok(
      result.includes('Application state initialized'),
      `App log must include message: ${result}`,
    )
    assert.ok(
      !result.includes('undefined'),
      `App log must not contain "undefined" when data is missing: ${result}`,
    )
  })
})
