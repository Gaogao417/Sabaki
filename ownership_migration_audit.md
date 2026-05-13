# State Ownership Migration Audit

## Scope

Two worktrees audited against `master` (3595577b):

| Worktree | Branch | Files Changed | Strategy |
|---|---|---|---|
| `engine-state-ownership` | `worktree-engine-state-ownership` | 10 files, +511 −458 | **Full DI** — `engineService` takes a pure `deps` object, zero `sabaki` references |
| `analysis-state-ownership` | `worktree-analysis-state-ownership` | 3 files, +124 −63 | **Store injection** — `engineStateStore` + `analysisStateStore` injected alongside existing `sabaki` param |

---

## 1. Architecture Comparison

### engine-state-ownership: Clean-Room Rewrite

```
createEngineService(deps: EngineServiceDeps)
  └── let state = { ... }      ← OWNED internally
  └── function setState(patch)  ← writes state + calls deps.notifyChange()
  └── ZERO sabaki references   ← verified via grep
```

- `engineService.js` signature changed from `createEngineService(sabaki, deps)` → `createEngineService(deps)`
- All 15 engine-owned fields live in `let state` inside the closure
- `sabaki.js` passes thunks: `getTreePosition: () => this.state.treePosition`, `getMode: () => this.state.mode`, etc.
- `notifyChange: () => this.setState({})` triggers Preact re-render
- `App.js` reads via `sabaki.getPlayServices().engineService.getState()` in `render()`
- Delegation facade in `sabaki.js` deleted (~55 lines of one-liner proxies removed)
- Callers in `menu.js`, `App.js`, drawers updated to call `engineService` directly

### analysis-state-ownership: Incremental Injection

```
createEngineService(sabaki, deps)           ← sabaki still passed
  └── let engineStore = deps.engineStateStore
  └── function engineState() { return engineStore?.getState() ?? sabaki.state }
  └── function writeEngineState(patch) { engineStore?.setState(patch) ?? sabaki.setState(patch) }
```

- `engineService.js` still takes `sabaki` as first argument
- New `engineState.js` and `analysisState.ts` created as separate stores with epoch/transaction
- Both stores **sync back to `sabaki.setState()`** inside their `setState()` — dual-write
- `sabaki.js` still has the delegation facade (not deleted)
- Falls back to `sabaki.state` if store not provided

---

## 2. State Ownership Verdict

### engine-state-ownership ✅ True Ownership

| Criterion | Status | Evidence |
|---|---|---|
| State physically lives inside engineService | ✅ | `let state = { attachedEngineSyncers: [], ... }` at line 110 |
| Zero `sabaki` reference in engineService | ✅ | `grep sabaki engineService.js` → 0 results |
| Reads go through `state.xxx` | ✅ | `state.analyzingEngineSyncerId`, `state.attachedEngineSyncers`, etc. |
| Writes go through `setState(patch)` | ✅ | All `sabaki.setState(...)` replaced with `setState(...)` |
| App.js reads from `engineService.getState()` | ✅ | `let engineState = sabaki.getPlayServices().engineService.getState()` |
| No bypass path via `sabaki.setState()` | ✅ | Delegation facade deleted from `sabaki.js` |

### analysis-state-ownership ⚠️ Partial / Transitional

| Criterion | Status | Evidence |
|---|---|---|
| State physically lives in engineStateStore | ✅ | `engineState.js` line 19: `let state = { ... }` |
| Zero `sabaki` reference in engineService | ❌ | 21 remaining `sabaki.state` reads (mode, editWorkspace, treePosition, gameTrees, etc.) |
| Reads go through `engineState()` | ⚠️ | Engine-owned fields yes; non-engine fields still read `sabaki.state` |
| Writes go through store | ⚠️ | Engine fields via `writeEngineState()`, but `analysis`/`analysisTreePosition` still go to `sabaki.setState()` (line 553, 1131) |
| No bypass path | ❌ | `engineStateStore.setState()` internally calls `sabaki.setState(resolved)` — dual-write |
| Delegation facade removed | ❌ | Still present in `sabaki.js` |

---

## 3. Residual `sabaki.state` Leaks in analysis-state-ownership

The `engineService.js` in `analysis-state-ownership` still has **21 direct `sabaki.state` reads** and **3 direct `sabaki.setState` calls**:

### Reads (via `sabaki.state`):
| Location | Field | Should Be Owned By |
|---|---|---|
| L534, L1108 | `sabaki.state.mode` | sabaki (UI state — OK to read) |
| L535, L1135, L1138 | `sabaki.state.editWorkspace` | sabaki / future analysisStore |
| L541 | `sabaki.state.gameTrees[sabaki.state.gameIndex]` | documentStore |
| L550, L589, L595, L994, L1295, L1309 | `sabaki.state.treePosition` | documentStore |
| L848 | `sabaki.state.engineGameOngoing` | engineStateStore ← **BUG: should use `engineState()`** |

> [!WARNING]
> **Line 848** reads `sabaki.state.engineGameOngoing` instead of `engineState().engineGameOngoing` inside the `generateMove` commit callback. This is a clear bypass of the store — the commit check in `startEngineGame` uses the store, but the `commit` callback inside `generateMove` goes around it.

### Writes (via `sabaki.setState`):
| Location | Fields Written | Issue |
|---|---|---|
| L553 | `analysis`, `analysisTreePosition` | These are analysis-owned fields being written to `sabaki.state` directly |
| L1131 | `analysis`, `analysisTreePosition`, `editWorkspace` | Mixed: analysis fields + editWorkspace |

---

## 4. CTA (Check-Then-Act) Vulnerability Audit

### engine-state-ownership

| CTA Site | Status | Analysis |
|---|---|---|
| `startAnalysis` (L1116) | ⚠️ **Not fixed** | Still uses `if (state.analyzingEngineSyncerId === syncerId) return` — but since `state` is closure-private and JS is single-threaded, this is **safe in practice**. No `await` between check and `setState`. |
| `startEngineGame` (L862) | ✅ **Safe** | `state.engineGameOngoing` read + write are synchronous. The `while` loop's `await generateMove` checks `state.engineGameOngoing === gameId` which is now internal. |
| `analysis-update` handler (L584) | ⚠️ **No epoch guard** | Handler reads `state.analyzingEngineSyncerId` synchronously then writes `setState({analysis, analysisTreePosition})` synchronously. Since there's no `await` in the handler, no interleaving is possible. Safe in practice but no defense-in-depth. |
| `quickAnalyzeAllNodes` (L1242) | ❌ **Gutted** | Function body returns `null` — the full implementation was removed. Quick analysis is broken in this worktree. |

### analysis-state-ownership

| CTA Site | Status | Analysis |
|---|---|---|
| `startAnalysis` (L1063) | ✅ **Fixed with transaction** | Uses `engineStore.transaction(check, patch)` for atomic check+set. Falls back to non-atomic path if store not provided. |
| `startEngineGame` (L834) | ✅ **Safe** | Uses `engineState()` for all reads, `writeEngineState()` for writes. |
| `analysis-update` handler (L522) | ✅ **Epoch guard added** | Captures `handlerEpoch` at entry, checks `engineStore.getEpoch() !== handlerEpoch` before writing. |
| `quickAnalyzeAllNodes` (L1198) | ✅ **Intact** | Full implementation preserved, reads via `engineState()`. |

---

## 5. Cross-Cutting Issues

### Issue A: `analysis` and `analysisTreePosition` Ownership Split

Both worktrees handle this differently:

- **engine-state-ownership**: These fields live inside `engineService.state` (lines 57-58). Engine owns them alongside engine lifecycle state. This is **architecturally questionable** — `analysis` results are semantically analysis-domain, not engine-domain.
- **analysis-state-ownership**: `analysisState.ts` declares these as analysis-owned (lines 16-17), but `engineService.js` line 553 still writes them to `sabaki.setState()`, bypassing the store entirely.

> [!IMPORTANT]
> Neither worktree has cleanly resolved who owns `analysis` and `analysisTreePosition`. The engine worktree puts them in the wrong domain. The analysis worktree declares the right domain but doesn't enforce the write path.

### Issue B: `editWorkspace` — Nobody Owns It

Both worktrees still treat `editWorkspace` as owned by `sabaki.state`. In `stopAnalysis`:
- engine-state-ownership: returns a patch object for sabaki to apply (L1179-1191)
- analysis-state-ownership: writes directly to `sabaki.setState({editWorkspace: ...})` (L1131-1145)

This is correct for now (editWorkspace is a future migration target), but it means `stopAnalysis` has split write paths — engine fields to store, editWorkspace to sabaki.

### Issue C: `inferredState` Accessor

Both worktrees still access `sabaki.inferredState.analyzingEngineSyncer` and `sabaki.inferredState.gameTree` from `analysisService.ts`. This is a computed/derived value that depends on the engine state — if `attachedEngineSyncers` is now owned by engineService, the `inferredState` derivation in `sabaki.js` needs to read from the store too.

In engine-state-ownership, `sabaki.js` still computes `inferredState` from `this.state` — but `attachedEngineSyncers` no longer lives in `this.state`. This means `inferredState.analyzingEngineSyncer` will be `null` after the migration.

> [!CAUTION]
> **engine-state-ownership has a correctness bug**: `inferredState` derivation still reads `this.state.attachedEngineSyncers` and `this.state.analyzingEngineSyncerId`, but those fields now live only inside `engineService.state`. Unless `getPlayServices().engineService.getState()` is merged into inferredState computation, all analysis and overlay code that reads `inferredState.analyzingEngineSyncer` will break silently (return `null`).

---

## 6. Final Verdict

### engine-state-ownership

| Aspect | Grade | Notes |
|---|---|---|
| Ownership transfer | **A** | Complete. Zero sabaki references in engineService. |
| Delegation removal | **A** | ~55 lines of proxy methods deleted from sabaki.js. |
| App.js adaptation | **A** | Reads from `engineService.getState()` in render. |
| CTA fixes | **C** | No transaction/epoch mechanisms. Relies on JS single-thread. |
| `quickAnalyzeAllNodes` | **F** | Function gutted, feature broken. |
| `inferredState` correctness | **F** | `analyzingEngineSyncer` derivation will return `null`. |
| `analysis`/`analysisTreePosition` domain | **C** | Put in engine domain rather than analysis domain. |

### analysis-state-ownership

| Aspect | Grade | Notes |
|---|---|---|
| Ownership transfer | **C** | Store exists but `sabaki` param still passed; 21 `sabaki.state` reads remain. |
| Delegation removal | **F** | Facade still present in sabaki.js. |
| App.js adaptation | **F** | Not done — still reads from `sabaki.state`. |
| CTA fixes | **A** | Transaction + epoch guard implemented correctly. |
| `quickAnalyzeAllNodes` | **A** | Full implementation preserved and migrated. |
| `inferredState` correctness | **B** | Dual-write to `sabaki.state` means inferredState still works. |
| `analysis`/`analysisTreePosition` domain | **B** | `analysisState.ts` has the right declaration but write path not enforced. |

---

## 7. Recommended Merge Strategy

Neither worktree is merge-ready in isolation. The best path is to **combine strengths**:

1. **Base**: Use `engine-state-ownership`'s clean DI architecture (zero sabaki refs, deps injection, delegation removal)
2. **Port from analysis-state-ownership**:
   - `engineState.js` → Adopt the `transaction()` and `epoch` mechanisms
   - `analysisState.ts` → Keep as the future analysis state owner
   - CTA fixes: port the `startAnalysis` transaction and `analysis-update` epoch guard
3. **Fix engine-state-ownership bugs**:
   - Restore `quickAnalyzeAllNodes` implementation (port from analysis-state-ownership, using `state.xxx` reads)
   - Fix `inferredState` derivation to read from `engineService.getState()`
   - Move `analysis`/`analysisTreePosition` out of engineService state → keep in `sabaki.state` for now, migrate to `analysisState` in a separate phase
4. **Do NOT dual-write**: The `engineStateStore.setState()` → `sabaki.setState()` sync in analysis-state-ownership creates two sources of truth. The engine-state-ownership approach (state only in service, `notifyChange` triggers re-render) is cleaner.

```
Priority: engine-state-ownership architecture + analysis-state-ownership CTA fixes
         → fix inferredState bug
         → restore quickAnalyzeAllNodes
         → separate analysis/analysisTreePosition ownership phase
```
