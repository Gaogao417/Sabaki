# GTP Console Improvements — Test Contracts v0.2

Date: 2026-05-16 Status: confirmed Changes from v0.1:
R3 补充 5 个新 case（带空格路径、无 gtp 自动补、空 humanModelPath、sendCommand 异常、未调用 sendCommand），合并 C05 到 C03。R1 拆成两条链路。R2 砍到 3 条核心，窗口记忆移出本轮。

---

## Priority

```
P0: R3 normalizeEngineConfig / detectHumanSL
- 全部自动化
- 不碰 UI
- 不启动真实 engine

P1: R1 Copy All Logs plain-text formatter
- 只测 formatter
- DOM selection 手动验收

P2: R2 IPC architecture boundary
- 先只做 import-boundary test
- IPC sync 和 command routing 等实现稳定后再测
- 独立窗口行为主要手动验收

Deferred: R2 窗口位置/大小持久化
```

---

## R1: Copy All Logs (Plain-Text Formatter)

### Chain A: Copy All Logs uses raw log content, not rendered HTML

| ID     | Type       | Classification | Contract                                                                                                                                                                                                                                                                                                                            |
| ------ | ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1-C01 | PURE_LOGIC | MUST_AUTOMATE  | `copyAllLogs` text construction from raw `consoleLog` entries produces output containing the full command line with all flags, quotes, and paths. Input: entry with `content: 'Engine Started\n$ /opt/homebrew/bin/katago gtp -model "/data/model.bin.gz" -config "/data/gtp.cfg"'`. Output must contain the complete `$ ...` line. |
| R1-C02 | STATE      | MUST_AUTOMATE  | Multi-line `response.content` preserves newlines in copied output.                                                                                                                                                                                                                                                                  |
| R1-C03 | PURE_LOGIC | MUST_AUTOMATE  | Coordinate tokens (e.g., `Q16 D4`) in `response.content` are preserved unchanged in copy output. (Lower priority than C01/C02 — if formatter reads raw content, this should pass trivially.)                                                                                                                                        |

### Chain B: DOM selection copy

| ID     | Type        | Classification    | Contract                                                                                                                                    |
| ------ | ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| R1-C04 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | User can select text in GTP console including full command-line params and copy via Ctrl+C / Cmd+C. HTML wrapping must not break selection. |

### Manual Review Checklist

- [ ] Visually confirm you can select and copy the "Engine Started" line with
      full command.
- [ ] Confirm right-click "Copy All Logs" produces clipboard content with full
      command line.
- [ ] Confirm coordinate tokens don't produce visual artifacts when selected.

---

## R2: GTP Panel as Independent Window (Minimal)

**本轮只做 3 件事：**

1. 能打开独立窗口
2. 关闭窗口不影响 engine
3. GTP 窗口不直接 import engineService/sabaki.js

| ID     | Type          | Classification    | Contract                                                                                            |
| ------ | ------------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| R2-C01 | SIDE_EFFECT   | MANUAL_ACCEPTANCE | GTP console opens in separate OS window, can be moved/resized/minimized independently.              |
| R2-C02 | SIDE_EFFECT   | MANUAL_ACCEPTANCE | Closing GTP window does not stop or detach the engine. Engine state persists after close/reopen.    |
| R2-C03 | ARCH_BOUNDARY | MUST_AUTOMATE     | GTP window renderer does not import `engineService`, `EngineSyncer`, or `sabaki.js`. Uses IPC only. |

### Deferred (NOT this round)

- Window position/size persistence across restarts
- IPC state sync contract (wait until IPC layer is implemented)
- Command routing contract (wait until IPC layer is implemented)

### Manual Review Checklist

- [ ] GTP window opens independently, can be moved to second monitor.
- [ ] Closing GTP window does not stop engine (reopen and confirm log still
      there).
- [ ] Engine analysis results still display correctly in main window.

---

## R3: Engine Startup Argument Assembly & HumanSL Detection

### Contracts — `normalizeEngineConfig`

| ID     | Type       | Classification | Contract                                                                                                                                                                       |
| ------ | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R3-C01 | PURE_LOGIC | MUST_AUTOMATE  | `args: 'gtp -model "/path/model.bin.gz"'` → `gtp` appears exactly once. No `gtp gtp`.                                                                                          |
| R3-C02 | PURE_LOGIC | MUST_AUTOMATE  | `args: 'gtp -model ... -config ...'` → `gtp` appears once, followed by `-model` and `-config` in correct order.                                                                |
| R3-C03 | PURE_LOGIC | MUST_AUTOMATE  | `enableHumanSL=true` + `humanModelPath` set → `-human-model` placed after `gtp`, before user args. Flag and path are present in output. (Subsumes old C05.)                    |
| R3-C04 | PURE_LOGIC | MUST_AUTOMATE  | Empty `args` → produces `gtp` (subcommand only).                                                                                                                               |
| R3-C06 | PURE_LOGIC | MUST_AUTOMATE  | `kind: 'generic'` → `args` unchanged.                                                                                                                                          |
| R3-C07 | PURE_LOGIC | MUST_AUTOMATE  | Preserves `id`, `name`, `path`, and other engine fields.                                                                                                                       |
| R3-C08 | PURE_LOGIC | MUST_AUTOMATE  | Extra whitespace in `args` → correctly formatted output.                                                                                                                       |
| R3-N01 | PURE_LOGIC | MUST_AUTOMATE  | `args: '-model "/path with spaces/model.bin.gz" -config "/path with spaces/gtp.cfg"'` (no `gtp` prefix) → `gtp` is auto-prepended; quoted paths with spaces are not split.     |
| R3-N02 | PURE_LOGIC | MUST_AUTOMATE  | `args: '-model foo -config bar'` (no `gtp` prefix) → `gtp` is auto-prepended.                                                                                                  |
| R3-N03 | PURE_LOGIC | MUST_AUTOMATE  | `enableHumanSL=true` but `humanModelPath` is empty → uses default model path (`getUserDataDirectory()/models/b18c384nbt-humanv0.bin.gz`). `-human-model` is present in output. |
| R3-N04 | PURE_LOGIC | MUST_AUTOMATE  | `args` with `gtp` appearing inside a flag value (e.g., `-config "/path/gtp.cfg"`) → only strips leading `gtp` subcommand, not `gtp` inside paths.                              |

### Contracts — `detectHumanSL`

| ID     | Type       | Classification | Contract                                                                                            |
| ------ | ---------- | -------------- | --------------------------------------------------------------------------------------------------- |
| R3-C09 | PURE_LOGIC | MUST_AUTOMATE  | `kata-get-models` returns `[{usesHumanSLProfile: true}]` → returns `true`, `modelLoaded=true`.      |
| R3-C10 | PURE_LOGIC | MUST_AUTOMATE  | `kata-get-models` returns `[{usesHumanSLProfile: false}]` → returns `false`, `modelLoaded=false`.   |
| R3-C11 | PURE_LOGIC | MUST_AUTOMATE  | JSON key `usesHumanSLProfile` present but value `false` → returns `false`. No regex false positive. |
| R3-C12 | PURE_LOGIC | MUST_AUTOMATE  | `kata-get-models` not in `commands` list → returns `false`. `sendCommand` is NOT called.            |
| R3-C13 | PURE_LOGIC | MUST_AUTOMATE  | `kata-get-models` returns invalid JSON → returns `false`, no crash.                                 |
| R3-N05 | PURE_LOGIC | MUST_AUTOMATE  | `sendCommand` rejects / throws → returns `false`, sets `lastError`, no crash.                       |

### Test Approach

**Structural assertions for `normalizeEngineConfig`:**

- `gtp` appears exactly once as subcommand (check leading position)
- `gtp` appears before all flags (`-model`, `-config`, `-human-model`)
- All original flags are preserved
- Quoted paths with spaces survive intact

**Mock approach for `detectHumanSL`:**

- Mock `controller.sendCommand` and `controller.process`
- No actual engine process spawned

### Manual Review Checklist

- [ ] Test cases cover reported bugs (gtp duplication, -human-model before gtp,
      /human/i false positive, path with spaces)
- [ ] No actual engine process launched in tests
- [ ] Structural assertions, not exact string matches

---

## Summary

| Requirement                      | MUST_AUTOMATE | MANUAL_ACCEPTANCE |
| -------------------------------- | :-----------: | :---------------: |
| R1: Copy All Logs                |       3       |         1         |
| R2: Independent Window (minimal) |       1       |         2         |
| R3: Arg Assembly / HumanSL       |      16       |         0         |
| **Total**                        |    **20**     |       **3**       |

## Related Files

- `src/modules/engine/engineService.js` — `normalizeEngineConfig`,
  `addEngineLogEntry`
- `src/modules/enginesyncer.js` — `detectHumanSL`
- `src/components/sidebars/GtpConsole.js` — `copyAllLogs`
- `src/components/EngineFloatingPanel.js` — current floating panel
- `src/main.js` — `BrowserWindow` creation, `ipcMain`
- `test/engineConfigNormalize.test.js` — existing R3 tests (to extend)
