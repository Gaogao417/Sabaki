# 评估：c4e209a9 以来的所有权迁移提交

## 结论先行

**你的怀疑基本正确。** 这 12 个提交主要完成了 **代码的物理搬运**（~2600 行从 sabaki.js 移出），但在 **状态所有权的真正澄清** 上收效甚微。核心问题是：**状态的真正 owner 仍然是 `sabaki.state`**，新模块只是借着 closure 捕获的 `sabaki` 引用去读写同一块 mutable state。

---

## 量化概览

| 指标 | 迁移前 | 迁移后 | 变化 |
|------|--------|--------|------|
| `sabaki.js` 行数 | 5249 | 3812 | -27% |
| `engineService.js` 中 `sabaki.state/setState` 引用 | — | **74 次** | 🔴 |
| `documentStore.js` 中 `sabaki.state/setState/history` 引用 | — | **48 次** | 🔴 |
| `overlayStore.ts` 中 `sabaki.state/setState` 引用 | — | **25 次** | 🔴 |
| `analysisLifecycle.ts` 中 `sabaki` 引用 | — | **0 次** | 🟢 唯一的例外 |

---

## 逐模块评判

### 🟢 `analysisLifecycle.ts` — 唯一真正的所有权转移

这是所有新模块中 **唯一一个做对了的**：

```typescript
export type AnalysisLifecycleDeps = {
  getState: () => Record<string, any>
  setState: (patch: Record<string, any>) => void
  engineService: { ... }
  cache: AnalysisCache
  // ...
}
```

- **零 `sabaki` 引用**。所有依赖通过 typed interface 注入
- 有自己的 internal state（`analysisRequestId`、`auxAnalysisRequestId`）
- 可以独立测试，可以在非 sabaki 环境中复用
- **这才是真正的所有权转移**

> [!TIP]
> `analysisLifecycle.ts` 是整个重构中唯一证明了"可以做到"的模块。其他模块都应该以它为标杆。

---

### 🔴 `engineService.js` — 最严重的"换皮"

**74 次 `sabaki.state/setState` 直接引用。** 典型代码：

```javascript
export function createEngineService(sabaki, deps = {}) {
  // ...
  syncer.on('analysis-update', () => {
    if (sabaki.state.analyzingEngineSyncerId === syncer.id) {
      let tree = sabaki.state.gameTrees[sabaki.state.gameIndex]
      // ...
      sabaki.setState({ analysis: syncer.analysis, ... })
    }
  })
}
```

**问题**：
1. 直接通过 closure 捕获 `sabaki`，读写 `sabaki.state` — **模块没有自己的状态**
2. `window.sabaki.setting.userDataDirectory` 这种全局引用散落在模块内部
3. 在 `sabaki.js` 里仍然保留完整的 delegation facade（~50 行一对一转发）
4. 结果：**搬了 1636 行代码，但 sabaki 仍然是 state 的 single source of truth**

这不是"ownership migration"，这是 **"method extraction with retained state coupling"**。

---

### 🔴 `overlayStore.ts` — 最薄的一层"皮"

仅 145 行，25 次 `sabaki.state/setState` 引用。所有 state 读写都直接穿透：

```typescript
export function createOverlayStore(sabaki, deps = {}) {
  async function setTerritoryEnabled(territoryEnabled) {
    if (territoryEnabled === sabaki.state.territoryEnabled) return true  // 直读
    sabaki.setState({ territoryEnabled: true })                          // 直写
    // ...
    if (sabaki.state.mode !== 'analysis' && ...) {                       // 又直读
      resolveAnalyzeMove(sabaki.state.treePosition)                      // 又直读
    }
  }
}
```

**结果**：`overlayStore` 不拥有 `territoryEnabled`，不拥有 `territoryCompareEnabled`，不拥有任何状态。它只是一组操作 sabaki.state 的 procedure，恰好被放到了另一个文件里。

---

### 🟡 `documentStore.js` — 中间地带

```javascript
export function createDocumentStore(sabaki, deps = {}) {
  function setCurrentTreePosition(tree, treePosition, opts) {
    let navigated = treePosition !== sabaki.state.treePosition  // 直读
    sabaki.setState({ ... })                                      // 直写
    sabaki.events.emit('navigate')                                // 直用
  }
}
```

- 有一些 private state（`autoscrollId`、`copyVariationData`） — **微弱的进步**
- 但核心操作（`gameTrees`、`treePosition`、`gameCurrents`、`history`）全部读写 `sabaki.state` 和 `sabaki.history`
- `sabaki.history` 和 `sabaki.historyPointer` 的直接 mutation 尤其刺眼 — 这些应该是 documentStore 的 private state

---

## 架构问题总结

### 1. sabaki.js 成了 Delegation Facade

迁移后的 sabaki.js 尾部有 ~130 行的纯转发代码：

```javascript
setCurrentTreePosition(tree, treePosition, options) {
  this.getPlayServices().documentStore.setCurrentTreePosition(tree, treePosition, options)
}
goStep(step) {
  this.getPlayServices().documentStore.goStep(step)
}
attachEngines(engines) {
  return this.getPlayServices().engineService.attachEngines(engines)
}
// ... 还有 ~40 个这样的方法
```

> [!WARNING]
> 这种模式是典型的 **"中间人反模式"（Middle Man）**。sabaki.js 不再做任何实际工作，但所有调用者仍然经过它。这既没有减少耦合，也没有提供新的抽象层。

### 2. 双向依赖环

```
sabaki.js → createEngineService(sabaki) → sabaki.state/setState
sabaki.js → createOverlayStore(sabaki) → sabaki.ensureAnalysisReady()
                                        → sabaki.state/setState
sabaki.js → createDocumentStore(sabaki) → sabaki.state/setState
                                         → sabaki.events.emit()
                                         → sabaki.editAnalysisId
                                         → sabaki.history (直接 mutation!)
```

每个新模块 capture 了 `sabaki` 本身的引用，形成 **闭环依赖**。这意味着：
- 无法独立实例化任何一个 store
- 无法在 test 中用 mock state 替换
- 无法用 React/Preact 的 signal/atom 替换 state layer

### 3. 真正的"状态所有权"没有转移

| 状态 | 声明位置 | 读取位置 | 写入位置 | Owner？ |
|------|----------|----------|----------|---------|
| `attachedEngineSyncers` | `App.js` (initial state) | engineService, sabaki.js | engineService → `sabaki.setState()` | **仍然是 sabaki** |
| `analyzingEngineSyncerId` | `App.js` | engineService, overlayStore | engineService → `sabaki.setState()` | **仍然是 sabaki** |
| `territoryEnabled` | `App.js` | overlayStore | overlayStore → `sabaki.setState()` | **仍然是 sabaki** |
| `gameTrees`, `treePosition` | `App.js` | documentStore, engineService | documentStore → `sabaki.setState()` | **仍然是 sabaki** |
| `history`, `historyPointer` | `sabaki.js` instance | documentStore | documentStore → `sabaki.history = ...` | **仍然是 sabaki** |
| analysis request counters | `analysisLifecycle.ts` | analysisLifecycle | analysisLifecycle (module-level let) | **✅ analysisLifecycle** |

**结论**：除了 analysisLifecycle 的几个 counter，没有任何状态的所有权真正转移了。

---

## 什么算"真正的所有权转移"？

以 `engineService` 为例，真正的所有权转移应该是：

```typescript
// engineStore.ts — owns its state
class EngineStore {
  private syncers: Map<string, EngineSyncer> = new Map()
  private analyzingSyncerId: string | null = null
  private consoleLog: LogEntry[] = []
  
  // State reads: callers read from here, not from sabaki
  getSyncers(): ReadonlyMap<string, EngineSyncer> { ... }
  getAnalyzingSyncer(): EngineSyncer | null { ... }
  
  // State writes: this module decides what to update
  attachEngine(config: EngineConfig): EngineSyncer { ... }
  detachEngine(syncerId: string): void { ... }
  
  // Notifications: emit events, not setState
  readonly onChange: EventEmitter<EngineState>
}
```

当前的实现距离这个目标相差甚远。

---

## 总评

| 维度 | 评分 | 说明 |
|------|------|------|
| 代码物理拆分 | ⭐⭐⭐ | sabaki.js 缩小了 27%，新文件结构合理 |
| 逻辑分组 | ⭐⭐⭐ | 功能按 domain 分到了正确的文件 |
| 状态所有权转移 | ⭐ | 几乎没有，除了 analysisLifecycle |
| 可测试性提升 | ⭐ | 大部分新模块无法脱离 sabaki 实例测试 |
| 依赖关系改善 | ⭐ | 双向依赖环反而更复杂了 |
| 总体评价 | **换皮为主，实质所有权转移微乎其微** | |

你的直觉是对的——这些提交花了大量精力把代码从 A 文件搬到了 B 文件，但 B 文件里的代码仍然 **读写 A 的状态**。这不是重构，这是重新整理抽屉。真正的所有权转移需要让每个 store **拥有自己的 state 并通过 event/subscription 通知外界**，而不是通过 closure 捕获 sabaki 然后 `sabaki.setState()`。
