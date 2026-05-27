# Workbench Mode State Machine Implementation Notes

本文记录 `docs/design/workbench-mode-orchestration-contract.md` 的实现澄清。
它不是新的上游合同，而是对当前实现方式、职责边界、迁移方向和测试策略的说明。

## 核心结论

用户真正感知的主状态是 `WorkbenchMode`：

- `play`
- `problem`
- `recall`
- `analysis`

实现上的核心目标不是创建一个万能 dispatcher，而是保证：

1. 所有 Workbench mode 迁移都有统一仲裁点。
2. 每次 mode 迁移后，相关 companion state 被同步到与该 mode 匹配的合法形状。
3. 复杂运行态区域由各自 owner 管理，不被 `workbenchFlowService` 直接变成巨型状态桶。

推荐模型：

```text
Workbench mode transition is the parent state machine.
Overlay, engine, analysis scratch, recall checkpoint, and problem runtime are child regions.
The parent state machine sends transition intent to child region owners.
Each child region handles its own legal transitions, cleanup, async guards, and notifications.
```

## 当前实现层级

当前代码里已经存在几层相关机制：

| 模块 | 当前职责 | 注意事项 |
| --- | --- | --- |
| `modeTransitions.ts` | 纯 transition policy。判断某个 mode + event 是否允许，并返回概念 effect 名称。 | 它不读 store、不写状态、不执行 effect。 |
| `workbenchFlowService.assertTransition` | service-level guard。把真实 tab/context 转成 `resolveTransition` 输入，不合法则 reject。 | 目前仍有 legacy/free-play 例外；不能长期承载业务规则。 |
| `workbenchFlowService` | 当前实际 mode transition + companion sync 主入口。 | 真正的状态同步仍在这里手写，例如 submit、enterAnalysis、returnFromAnalysis。 |
| `modeStateResolver.ts` | 只读 projection / invariant checker。聚合 tab/runtime/overlay/Sabaki snapshot，返回 mode projection 和 illegal diagnostics。 | 它不是 effect runner，不应修改 store 或自动修复状态。 |
| `ModeEnterEffect` / `ModeExitEffect` | `workbenchFlowService` 注入的 analysis enter/exit effect port。 | 当前主要适配 legacy Sabaki analysis workspace。 |

## `assertTransition` 的定位

`assertTransition(tab, method)` 不是状态机本体，也不是状态同步器。

它的定位是：

```text
service method entry
  -> read current WorkbenchTab
  -> call resolveTransition(...)
  -> reject invalid event
  -> allow service method to execute explicit state sync
```

长期目标是让它保持很薄：

- 只做真实 state 到 pure transition input 的适配。
- 不内联新的业务规则。
- legacy 例外集中标记并逐步删除。
- `isAttemptFrozen`、`hasCheckpoint` 等输入应来自真实 state，而不是固定值。

## `modeTransitions` 与 `modeStateResolver` 的区别

二者不应互相替代。

| 问题 | 归属 |
| --- | --- |
| 当前 mode 下某个 event 能不能发生？ | `modeTransitions.ts` |
| service 方法要不要拒绝这个 command？ | `workbenchFlowService.assertTransition` |
| 当前 store/runtime/overlay 快照是否自洽？ | `modeStateResolver.ts` |
| mode 变更后 companion state 如何实际写入？ | `workbenchFlowService` + child region owner |
| UI/board 应该看到什么 projection？ | Container / projection layer，可消费 `modeStateResolver` |

`modeStateResolver` 接入生产后，可以在 transition 前后发现不合理状态，但不应自己修复。

推荐使用方式：

```text
before transition:
  resolveModeState(snapshot)
  -> reject, warn, or allow explicit recovery

during transition:
  workbenchFlowService applies mode sync and calls child region owners

after transition:
  resolveModeState(snapshot)
  -> assert/log diagnostics if the new state is still invalid
```

## 哪些状态可以自动同步

只适合自动同步 transient companion / projection / cache state。
这些状态不是业务事实，mode 变化后可以清空、重建或重新投影。

| 状态 | 合适处理 |
| --- | --- |
| `runtime.problemView` | Problem -> Recall / Analysis 时清理。 |
| `runtime.recallView` | 进入 Recall 时创建 projection；完成 Recall -> Analysis 时清理。 |
| `runtime.activeCheckpointId` / `correctionDraft` | 非 Recall 或离开 checkpoint substate 时清理。 |
| `overlay.territoryEnabled` / `territoryCompareEnabled` | 离开 Analysis 时关闭并 bump generation。 |
| analysis scratch workspace | 进入 Analysis 时创建；离开 Analysis 时销毁或失效。 |
| visible bad move ids / hint display / temporary UI cache | 随 mode 或 substate enter/exit 清理。 |

## 哪些状态不能自动修

业务事实、持久化事实、用户产物不应由 resolver 或 mode sync 静默修复。
发现异常时应 reject、显式 migration、或通过 owner service 的受控 API 处理。

| 状态 | 不应静默修复的原因 |
| --- | --- |
| `Attempt.userLine` / `result` / `status` | 训练记录事实；错误修改会污染学习历史。 |
| `RecallSession` / `RecallAttempt` | 复盘历史事实。 |
| `Problem` / `Task` | 业务实体。 |
| `MoveEvaluation` / `BadMove` | 评价事实。 |
| SGF game tree / document tree | 用户棋谱数据。 |
| checkpoint comment | 用户输入内容。 |
| review schedule | 复习计划事实。 |

## Child Region State Machines

复杂运行态区域适合各自抽象出小状态机或 transition owner。
`workbenchFlowService` 只向它们发送 mode transition intent，不直接修改内部细节。

### Overlay Region

Owner: `overlayStore` 或未来 `overlayRegion`.

职责：

- Analysis 中允许 territory / compare。
- 离开 Analysis 时关闭 territory / compare。
- bump generation，忽略 late async ownership result。
- 不反向修改 Workbench mode。

接口示例：

```ts
overlayRegion.onWorkbenchModeTransition({
  fromMode,
  toMode,
  reason,
  analysisContext,
})
```

### Analysis Scratch Region

Owner: analysis/scratch adapter.

职责：

- 进入 Analysis 时创建 `scratch/current` workspace。
- schedule scratch analysis。
- 用 `workspaceId` / generation guard 忽略 stale result。
- 离开 Analysis 时 teardown 或 mark inactive。
- 不写 source Attempt 或 formal game tree。

### Engine Region

Owner: engine/analysis service.

职责：

- 区分 game-tree live target 与 scratch target。
- 每个 async result 带 target id / workspace id。
- 离开 mode 后 stale result 只能被 ignore。

### Recall Checkpoint Region

Owner: recall checkpoint service / runtime projection.

职责：

- `normal -> checkpoint_correction -> checkpoint_ai_revealed -> checkpoint_commenting -> normal`
- checkpoint 是 Recall substate，不是第五个 Workbench mode。
- 不写 source Attempt protected fields。

### Problem Runtime Region

Owner: problem flow service.

职责：

- problem move / undo 同步 problemView、Attempt line、board source。
- submit 后 freeze/finalize attempt，清 problemView。
- submit 后禁止继续写 frozen Attempt line。

## Pitfalls And Mitigations

| 风险 | 规避方式 |
| --- | --- |
| 只按 `nextMode` sync，丢失来源上下文 | transition API 必须带 `fromMode`、`toMode`、`reason`、`returnTarget`、`source context`。 |
| `workbenchFlowService` 变成巨型 mode switch | 只编排 transition 和 effect ordering；实际写入交给 child region owner / domain service。 |
| Resolver 自动修状态，掩盖旁路写入 | Resolver 只返回 diagnostics；自动清理只允许发生在显式 mode enter/exit effect 中。 |
| 只测 `mode` 导致 fake green | 测最终 outcome：业务事实、tab/runtime active id、projection、rendered UI 都成立。 |
| 测试锁死 setter 顺序 | 采用 outcome-based assertions，不要求每个 setter 独立 notify 或固定调用顺序。 |
| async callback 晚到污染新 mode | 所有 async result 带 `workspaceId` / `sessionId` / generation guard。 |
| legacy path 绕过状态机 | 对 visible command 加 owner-path 测试；逐步删除 `sabaki.setMode` / legacy open path 作为业务真源。 |
| `modeTransitions` 与 `assertTransition` 漂移 | `assertTransition` 保持薄适配；纯 transition table 是唯一 policy source。 |
| runtime projection 被当成业务真源 | `runtimeStore` 只保存 active projection/cache；完整事实仍在 repository/service。 |

## Recommended Migration Path

1. Keep `workbenchFlowService` as the single mode transition orchestration entry.
2. Make `assertTransition` a thin adapter over `modeTransitions.resolveTransition`.
3. Introduce child region transition adapters around existing hand-written sync:
   - `runtimeRegion`
   - `overlayRegion`
   - `analysisScratchRegion`
   - `engineRegion`
   - `recallCheckpointRegion`
4. Move direct `runtimeStore.setX` / overlay cleanup / workspace setup calls behind those adapters step by step.
5. Use `modeStateResolver` as preflight/postflight invariant checker and projection source, not as a writer.
6. Add tests at three layers:
   - pure transition policy tests;
   - child region transition tests;
   - flow service outcome tests from real command to final state/projection/render.

## Test Strategy

Required tests should prefer outcome over implementation details:

```text
Given Problem active attempt + problemView
When submit
Then Attempt is finalized/frozen
And RecallSession is created
And tab.mode is recall
And runtime.problemView is null
And runtime active recall ids match
And rendered Recall surface is active
```

Avoid tests that only assert:

- `setRecallView` was called in a specific order.
- `mode === 'recall'` with no recall surface.
- handler prop name appears in source text.
- diagnostics exist but no production caller consumes them.

## Final Design Principle

Use one parent state machine and several child region state machines:

```text
WorkbenchMode transition owns user-visible mode changes.
Child regions own their own state transitions and cleanup.
Persistent domain facts are written only through domain services/repositories.
Resolver diagnoses and projects; it does not repair.
```

