# GTP Console Improvements — Test Contracts v0.1

Date: 2026-05-16 Status: pending-confirmation

## Requirements

1. GTP Console log entries are fully copyable (including command-line
   parameters)
2. GTP Panel as independent Electron BrowserWindow
3. Engine startup argument assembly and HumanSL detection regression tests

---

## R1: GTP Console Log Copyable

### User Story

As a user debugging engine startup, I want to select and copy full text from the
GTP console, including the complete command-line arguments after "Engine
Started", so I can reproduce issues in a terminal.

### State Flow

1. Engine starts, `addEngineLogEntry` called with
   `content: "Engine Started\n$ /path/to/katago gtp -model ..."`
2. `ConsoleResponseEntry` receives `response.content` as string
3. `ContentDisplay` renders via `htmlify()` (wraps coords into spans)
4. User selects text via browser selection or right-click "Copy All Logs"

### Contracts

| ID     | Type        | Classification    | Contract                                                                                                                                                                                                                                                                  | Reason                                                                        | Miss Risk                                                                     |
| ------ | ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| R1-C01 | PURE_LOGIC  | MUST_AUTOMATE     | For a mock `consoleLog` entry with `content` containing `Engine Started\n$ /opt/homebrew/bin/katago gtp -model "/data/model.bin.gz" -config "/data/gtp.cfg"`, `copyAllLogs` text construction produces plain-text output containing the full command line with all flags. | Core copy contract: what user copies must match the original `content`.       | Incomplete engine startup params in copy; startup issues can't be reproduced. |
| R1-C02 | PURE_LOGIC  | MUST_AUTOMATE     | For a mock log entry with analysis content containing coordinate tokens (e.g., `Q16 D4`), the plain text output preserves original coordinates unchanged.                                                                                                                 | Ensure copy doesn't corrupt analysis data.                                    | Copied analysis has truncated/incorrect coordinates.                          |
| R1-C03 | STATE       | MUST_AUTOMATE     | When `consoleLog` entry `response.content` is a multi-line string, the copied output preserves newlines.                                                                                                                                                                  | Newlines are structural for readability.                                      | Pasted log is one unreadable blob.                                            |
| R1-C04 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | User can select text in GTP console including the full command-line params in "Engine Started" line, and successfully copy via Ctrl+C / Cmd+C.                                                                                                                            | Browser text selection behavior; HTML wrapping must not break text selection. | Cannot visually verify via automation.                                        |

### Out of Scope

- Changing `ContentDisplay` rendering mechanism (e.g., disabling `htmlify` for
  console).
- Modifying `addEngineLogEntry` data structure.
- Adding keyboard shortcuts for copy.

### Manual Review Checklist

- [ ] Visually confirm you can select and copy the "Engine Started" line showing
      the engine binary path and all flags.
- [ ] Confirm right-click "Copy All Logs" produces clipboard content with the
      full command line.
- [ ] Confirm coordinate tokens in logs (e.g., `D4`, `Q16`) don't produce weird
      visual artifacts when selected.

---

## R2: GTP Panel as Independent Window

### User Story

As a user, I want the GTP console in its own independent OS window so I can move
it to a second monitor, resize freely, and it doesn't obstruct the board.

### State Flow

1. User triggers open GTP console → main process creates `BrowserWindow`, loads
   console HTML.
2. Main process forwards current `consoleLog` state to GTP window via IPC.
3. GTP window renders `GtpConsole` component, subscribes to state updates.
4. When engine generates new log entries, `addEngineLogEntry` pushes deltas to
   GTP window via IPC.
5. When user submits a command in GTP window, command routes via IPC to main
   window's `engineService`.
6. Closing GTP window destroys `BrowserWindow` but does NOT stop the engine.

### Contracts

| ID     | Type          | Classification    | Contract                                                                                                                                                                                                                                        | Reason                                                                 | Miss Risk                                                          |
| ------ | ------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| R2-C01 | SIDE_EFFECT   | MANUAL_ACCEPTANCE | GTP console opens in a separate OS window, can be moved/resized/minimized independently.                                                                                                                                                        | OS-level window management.                                            | N/A                                                                |
| R2-C02 | SIDE_EFFECT   | MANUAL_ACCEPTANCE | Closing GTP window does not stop or detach the engine. Engine state persists after closing and reopening the console.                                                                                                                           | Protects separation of concerns: UI panel is not engine lifecycle.     | Engine stops when console closes.                                  |
| R2-C03 | STATE         | MUST_AUTOMATE     | When `engineService.consoleLog` gets a new entry, the IPC forwarding layer sends a corresponding delta message so the GTP window can update. After `addEngineLogEntry`, the GTP window's received state matches `engineService`'s `consoleLog`. | State sync is an architecture contract.                                | GTP window shows stale log entries.                                |
| R2-C04 | STATE         | MUST_AUTOMATE     | When user submits a GTP command in the GTP window, the command routes via IPC to the main window and executes on the assigned syncer.                                                                                                           | Command execution routing is an architecture contract.                 | User-typed GTP commands silently dropped.                          |
| R2-C05 | ARCH_BOUNDARY | MUST_AUTOMATE     | GTP window renderer does not import or call `engineService` directly. It receives data only via IPC interface.                                                                                                                                  | Protects single-window architecture, prevents duplicated engine state. | Race conditions, state duplication, dual engine command execution. |
| R2-C06 | SIDE_EFFECT   | MANUAL_ACCEPTANCE | GTP window remembers its position and size across app restarts (persisted to settings).                                                                                                                                                         | Settings persistence is a QoL feature.                                 | N/A                                                                |

### Architecture Boundary

- GTP window must NOT import `engineService`, `EngineSyncer`, or `sabaki.js`.
- GTP window must NOT directly call engine syncer methods.
- All data flows through IPC between main window and GTP window.

### Out of Scope

- Hot-reloading GTP window content.
- Tabbed or multi-engine view in GTP window.
- GTP log persistence to disk (beyond what `gtplogger` already provides).

### Manual Review Checklist

- [ ] GTP window opens independently and can be moved away from main window.
- [ ] Commands typed in GTP window are executed by the correct engine.
- [ ] Closing GTP window does not stop the engine (reopen and confirm log is
      still there).
- [ ] GTP window updates in real-time (new log entries appear without manual
      refresh).
- [ ] Engine analysis results still display correctly in main window.

---

## R3: Engine Startup Argument Assembly & HumanSL Detection

### User Story

As a developer, I want engine startup argument construction
(`normalizeEngineConfig`) and HumanSL model detection (`detectHumanSL`) covered
by contract tests so regressions (duplicate `gtp` subcommand, misplaced
`-human-model` flag, false-positive HumanSL detection) are caught automatically.

### State Flow — `normalizeEngineConfig`

1. Receives raw engine config object.
2. If `kind === 'katago'`: strips leading `gtp` from `args`, rebuilds as
   `gtp [flags] [strippedArgs]`.
3. If `enableHumanSL`: inserts `-human-model` flag after `gtp`.
4. Returns normalized config with rebuilt `args`.

### State Flow — `detectHumanSL`

1. Sends `kata-get-models` GTP command.
2. Parses JSON response.
3. Checks if any model has `usesHumanSLProfile === true`.
4. Updates `humanSL` state.

### Contracts

| ID     | Type       | Classification | Contract                                                                                                                                                                                            | Reason                                                                          | Miss Risk                                             |
| ------ | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| R3-C01 | PURE_LOGIC | MUST_AUTOMATE  | `normalizeEngineConfig` with `args: 'gtp -model "/path/model.bin.gz"'` produces `args` that does NOT duplicate the `gtp` subcommand.                                                                | Regression: `gtp gtp` causes engine startup failure.                            | KataGo fails with "unknown command: gtp gtp".         |
| R3-C02 | PURE_LOGIC | MUST_AUTOMATE  | `normalizeEngineConfig` with `args: 'gtp -model "/path/model.bin.gz" -config "/path/gtp.cfg"'` produces `args` where `gtp` appears once, followed by `-model` and `-config` flags in correct order. | Regression: `-model` or `-config` before `gtp` breaks KataGo.                   | KataGo fails with "unknown argument".                 |
| R3-C03 | PURE_LOGIC | MUST_AUTOMATE  | `normalizeEngineConfig` with `enableHumanSL=true` and `humanModelPath` set places `-human-model` after the `gtp` subcommand and before any user-provided args.                                      | HumanSL model path must be after `gtp` for KataGo to parse correctly.           | HumanSL profile doesn't load.                         |
| R3-C04 | PURE_LOGIC | MUST_AUTOMATE  | `normalizeEngineConfig` with empty `args` produces `args` that is `gtp` (subcommand only, no extra args).                                                                                           | Base case: KataGo engine minimal arg is `gtp`.                                  | Edge case regression.                                 |
| R3-C05 | PURE_LOGIC | MUST_AUTOMATE  | `normalizeEngineConfig` with `enableHumanSL=true` and `humanModelPath` set includes `-human-model` flag in `args`.                                                                                  | Ensures HumanSL model is passed to KataGo.                                      | HumanSL functionality silently disabled.              |
| R3-C06 | PURE_LOGIC | MUST_AUTOMATE  | `normalizeEngineConfig` for non-KataGo engines (`kind: 'generic'`) leaves `args` unchanged.                                                                                                         | Generic engines should not have KataGo-specific arg processing.                 | Leela Zero or other engines broken.                   |
| R3-C07 | PURE_LOGIC | MUST_AUTOMATE  | `normalizeEngineConfig` preserves `id`, `name`, `path`, and other engine fields in the returned config.                                                                                             | Config normalization must not discard user settings.                            | Engine config data loss.                              |
| R3-C08 | PURE_LOGIC | MUST_AUTOMATE  | `normalizeEngineConfig` with extra whitespace in `args` (e.g., `  gtp  -model foo  `) still produces correctly formatted `args`.                                                                    | Trailing/leading spaces in user config are common.                              | Whitespace handling breaks engine startup.            |
| R3-C09 | PURE_LOGIC | MUST_AUTOMATE  | `detectHumanSL` returns `true` and sets `modelLoaded=true` when `kata-get-models` returns `[{name: "default", usesHumanSLProfile: true}]`.                                                          | Positive case: HumanSL model detected as loaded.                                | HumanSL features disabled despite model being loaded. |
| R3-C10 | PURE_LOGIC | MUST_AUTOMATE  | `detectHumanSL` returns `false` and sets `modelLoaded=false` when `kata-get-models` returns `[{name: "default", usesHumanSLProfile: false}]`.                                                       | Negative case: engine without HumanSL model must not be detected as loaded.     | Falsely enables HumanSL UI.                           |
| R3-C11 | PURE_LOGIC | MUST_AUTOMATE  | `detectHumanSL` returns `false` when `kata-get-models` returns JSON containing the key name `usesHumanSLProfile` but with value `false` (no regex false positive).                                  | Regression: old `/human/i` regex would match JSON key names containing "human". | False-positive HumanSL detection via string matching. |
| R3-C12 | PURE_LOGIC | MUST_AUTOMATE  | `detectHumanSL` returns `false` when `kata-get-models` is not in the engine's `commands` list.                                                                                                      | Non-KataGo engines don't support `kata-get-models`.                             | Crash on non-KataGo engines.                          |
| R3-C13 | PURE_LOGIC | MUST_AUTOMATE  | `detectHumanSL` returns `false` when `kata-get-models` returns invalid JSON (parse error).                                                                                                          | Robustness: engine response may be malformed.                                   | Crash on empty response.                              |

### Test Approach

**`normalizeEngineConfig` (R3-C01 to R3-C08)**:

Create `engineService` with mocked deps (`getUserDataDirectory` returns temp
path, `notifyChange` is noop). Call
`service.normalizeEngineConfig(engineConfig)`. Assert `result.args`.

Assertions should check structural properties, not exact string values:

- `gtp` appears exactly once
- `gtp` appears before `-model`, `-config`, `-human-model`
- All original flags are preserved

**`detectHumanSL` (R3-C09 to R3-C13)**:

Create `EngineSyncer` with mocked controller (avoid actual process spawn). Mock
`controller.sendCommand` to return various JSON responses. Call
`syncer.detectHumanSL()`. Assert `syncer.humanSL.modelLoaded` and return value.

### Out of Scope

- `normalizeEngineConfig` integration with actual engine execution (covered by
  `katagoBundledModels.test.js`).
- `setHumanSLProfile` or `updateRawHumanPolicy` methods.
- `ControllerStateTracker` behavior.

### Manual Review Checklist

- [ ] Review test input cases: do they cover the reported bugs (gtp duplication,
      -human-model before gtp, /human/i false positive)?
- [ ] Confirm tests don't launch actual engine processes (all controller
      interactions are mocked).
- [ ] Confirm `normalizeEngineConfig` tests check structural properties, not
      exact string matches.

---

## Summary

| Requirement                | MUST_AUTOMATE | MANUAL_ACCEPTANCE | DO_NOT_TEST |
| -------------------------- | :-----------: | :---------------: | :---------: |
| R1: Console Copyable       |       3       |         1         |      0      |
| R2: Independent Window     |       3       |         4         |      0      |
| R3: Arg Assembly / HumanSL |      13       |         0         |      0      |
| **Total**                  |    **19**     |       **5**       |    **0**    |

## Priority

1. **R3** — Highest. Pure logic, no UI dependency, directly prevents known
   regressions. Can write and run immediately.
2. **R1** — Medium. Needs a small extraction (plain-text formatting logic) to be
   easily testable.
3. **R2** — Lowest. Most contracts are manual acceptance; automated contracts
   need IPC layer designed and implemented first.

## Related Files

- `src/modules/engine/engineService.js` — `normalizeEngineConfig`,
  `addEngineLogEntry`, `attachEngines`
- `src/modules/enginesyncer.js` — `detectHumanSL`, `setHumanSLState`
- `src/components/sidebars/GtpConsole.js` — `copyAllLogs`,
  `ConsoleResponseEntry`
- `src/components/ContentDisplay.js` — `htmlify`
- `src/components/EngineFloatingPanel.js` — current floating panel
- `src/main.js` — `BrowserWindow` creation, `ipcMain` handlers
- `test/enginePathTests.js` — existing engine tests (reference)
- `test/katagoBundledModels.test.js` — existing KataGo tests (reference)
