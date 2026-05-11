# Workbench Architecture Overview

本文是 Gabaki / Sabaki 训练工作台的全景设计文档。它不替代
`position-source-mutation-contract.md`，而是说明整个重构如何从产品目标、
状态模型、交互边界、分析能力、overlay 和 workspace 编排上收束到一张图里。

## Summary

重构目标不是继续完善一个通用 SGF 编辑器，而是把产品削成围棋训练工作台：

- `play`: 真实对局，落子写入 game tree。
- `recall / training`: 训练答题，写入 session / attempt，不自由编辑棋盘。
- `scratch analysis`: 摆棋分析，写入 scratch snapshot，不污染当前 SGF tree。
- `variation analysis`: 棋谱内试变化，写入 game-tree variation 或未来临时 variation。

底层不再让 `mode` 决定一切，而是先回答两个问题：

- 当前棋盘局面来自哪里？见 `PositionSource`。
- 用户操作允许写到哪里？见 `MutationContract`。

Workspace 只负责默认组合和控件布局；它不能直接成为棋盘读写权限边界。

## Product Direction

### Core Capabilities

核心能力围绕训练和分析：

- 对局练习：正常落子、悔棋、认输、引擎对局、基础分析。
- 回忆训练：从棋谱或题目读取答案，记录正确、错误、提示和跳过。
- 摆棋分析：任意摆黑白子、删除、拖动、设置下一手、引擎分析、保存为题目。
- 变化分析：从当前棋谱节点试变化，并可与实战局面比较。
- Overlay 辅助：territory、territory compare、heatmap、human preference 等可组合显示。

### Legacy Policy

以下功能先冻结或从新工作台中心隐藏，不在新架构里继续扩展：

- `scoring`
- `estimator`
- `find`
- `guess`
- `autoplay`
- 原生 SGF edit 工具

冻结不等于立即删除。第一阶段要求是：新代码不继续扩大这些旧模式的职责，旧入口能保留兼容就保留兼容。

`guess` 与 `recall` 产品语义重叠。长期方向是保留 `recall / training`，`guess` 作为 legacy 冻结，等待 recall 稳定后再决定删除或迁移。

## Architecture Layers

### 1. Position Source

`PositionSource` 是棋盘读来源：

- `game-tree`: 从当前 SGF game tree node 读局面。
- `scratch`: 从临时 snapshot 读局面，默认不污染 SGF tree。

设计细节以 [Position Source and Mutation Contract](position-source-mutation-contract.md)
为准。全景层只要求所有棋盘渲染、分析、overlay 和交互都能明确拿到当前 source。

### 2. Scratch Position

`scratch analysis` 的核心数据是 scratch position。它应沿用现有 snapshot 的
`signMap` 形状，而不是新建一套 `stones[]` 主结构。

最小字段：

```ts
type ScratchPosition = {
  id: string
  width: number
  height: number
  signMap: number[][]
  nextPlayer: 1 | -1
  role?: 'current' | 'reference' | 'problem-attempt'
  komi?: number
  rules?: string
  source?: {
    type: 'game-tree-node' | 'manual' | 'problem'
    id?: string
  }
}
```

原因：

- 兼容 `study.js` 里的 snapshot helper。
- 兼容 `boardFromSnapshot` / `snapshotToGameTree`。
- 兼容现有 engine analysis 和 overlay 输入。
- 能直接表达 current / reference / problem attempt 等角色。

### 3. Mutation Contract

`MutationContract` 是棋盘写权限：

- `playMove`: 写 game tree、写 history、更新当前行棋方、触发正常对局分析。
- `scratchEdit`: 只写 scratch position，可触发分析，可保存为题目。
- `recallAnswer`: 只写训练 session / attempt，不自由编辑局面。
- `variationMove`: 写 game-tree variation，或未来写临时 variation。

关键原则：

- Overlay 不写棋局。
- Workspace 不直接写棋局。
- Scratch edit 不写当前 SGF tree。
- Recall answer 不复用 play move 的写路径。
- Variation move 不复用 scratch edit 的写路径。

### 4. Board Interaction

棋盘交互层只负责把用户输入转成对应 contract 的 action。

目标拆分：

- `playInteraction`: 点击空点就是真实落子。
- `scratchSetupInteraction`: 摆黑、摆白、删除、拖动、设置下一手。
- `recallAnswerInteraction`: 点击候选点，检查答案并记录尝试。
- `variationInteraction`: 从 game-tree node 试变化。
- `legacyInteraction`: 暂时承接 scoring / estimator / find / guess / autoplay。

验收标准是：看一个 interaction 就能知道它写哪里，不能再靠大段 `mode`
分支推断副作用。

### 5. Analysis

Analysis 必须分成两类：

#### Scratch Analysis

用于摆棋、讲棋、生成题目。

- `PositionSource = scratch`
- `MutationContract = scratchEdit`
- 分析对象是 scratch position。
- 分析结果可用于 overlay、侧栏、题目保存。
- 不修改当前 SGF tree。

#### Variation Analysis

用于棋谱内试变化。

- `PositionSource = game-tree`
- `MutationContract = variationMove`
- 分析对象是当前 game-tree position 或 variation position。
- 可以和实战主线、reference snapshot 或上一手 ownership 比较。

第一阶段优先稳定 scratch analysis；variation analysis 先保留 contract 和入口语义，避免过早扩大重构面。

### 6. Overlay Composition

Overlay 不重写。现有 `BoardOverlayStack`、`paintMap`、`markerMap`、
`composeMarkerMaps` 仍是优先实现路径。

需要补的是 composition contract：

```ts
type OverlayLayer = {
  id: string
  priority: number
  opacity: number
  hitTest: boolean
  source: 'ownership' | 'territoryDiff' | 'heatmap' | 'humanPreference'
  renderMode: 'paint' | 'marker' | 'tooltip' | 'sidebar'
}
```

必须明确：

- 谁是主视觉 paint layer。
- 谁只能做 marker。
- 谁只能进 tooltip 或 sidebar。
- 多个 paint layer 同时开启时按什么优先级和透明度合成。
- hover / hit test 读取哪个 layer 的语义。

Overlay 输入来自 `PositionSource` 派生出的 board、ownership、diff、analysis
metadata。Overlay 不能直接修改 board、game tree 或 scratch position。

### 7. Workspace

Workspace 是任务层，只负责编排默认组合：

| Workspace | Position source | Mutation contract | Default overlay | Main controls |
| --- | --- | --- | --- | --- |
| Play | `game-tree` | `playMove` | Minimal | 新对局、悔棋、认输、引擎 |
| Recall | `game-tree` or `scratch/problem-attempt` | `recallAnswer` | Hidden | 提示、跳过、进度、结束 |
| Scratch Analysis | `scratch/current` | `scratchEdit` | Territory / ownership | 摆黑、摆白、删除、下一手、保存题目 |
| Variation Analysis | `game-tree` | `variationMove` | Compare / territory | 候选点、变化树、回到实战、snapshot |

Workspace 可以设置默认值，但不拥有底层写权限。

## Data Flow

### Play Move

```txt
User click
  -> playInteraction
  -> playMove contract
  -> game tree mutation
  -> history
  -> board render
  -> engine analysis / overlay refresh
```

### Scratch Edit

```txt
User click or drag
  -> scratchSetupInteraction
  -> scratchEdit contract
  -> scratch position mutation
  -> scratch board render
  -> scratch engine analysis
  -> overlay refresh
  -> optional save as problem
```

### Recall Answer

```txt
User click
  -> recallAnswerInteraction
  -> recallAnswer contract
  -> compare with expected move
  -> write attempt/session
  -> advance, hint, wrong state, or completion
```

### Overlay Render

```txt
PositionSource
  -> board + analysis + ownership + marker data
  -> overlay composition
  -> paintMap / markerMap / tooltip / sidebar
  -> Goban render
```

## Implementation Roadmap

### Phase 0: Freeze Legacy Direction

- Document that scoring, estimator, find, guess, autoplay, and SGF edit are legacy.
- Keep old behavior compatible where practical.
- Stop adding new workbench behavior to legacy mode branches.

### Phase 1: Stabilize Contracts

- Keep `src/modules/position-contracts.ts` as the shared contract module.
- Ensure `sabaki.js` can expose the active `PositionSource` and `MutationContract`.
- Ensure current `editWorkspace.currentSnapshot` and `referenceSnapshot` are valid scratch positions.
- Add tests for workspace-to-contract mapping.

### Phase 2: Promote Scratch Board

- Treat analysis workspace as scratch analysis by default.
- Ensure add stone, remove stone, drag stone, set next player, and save problem all write only scratch position.
- Ensure scratch analysis can run through engine without dirtying current SGF tree.
- Keep the old `editWorkspace` name internally until the behavior is stable.

### Phase 3: Split Board Interaction

- Extract board click/drag paths by contract.
- Keep legacy modes behind a legacy fallback.
- Prevent scratch actions from calling game-tree mutation helpers.
- Prevent recall actions from calling play move helpers.

### Phase 4: Clarify Analysis Workspaces

- Product UI may still show one "Analysis" entry initially.
- Internally distinguish `scratch-analysis` and `variation-analysis`.
- Build scratch analysis first.
- Add variation analysis only after game-tree write semantics are explicit.

### Phase 5: Overlay Composition Contract

- Keep the current overlay rendering path.
- Add layer priority, opacity, render mode, and hit-test semantics.
- Verify territory, territory compare, heatmap, and human preference do not fight for the same visual channel without rules.

### Phase 6: Workspace Composition

- Move layout defaults, controls, and overlay defaults into workspace-level presets.
- Workspace selects defaults; interaction and mutation contracts enforce behavior.
- New features should target workspace + contract, not raw `mode`.

## Open Research Questions

These questions should be answered before large code movement:

- Can existing `editWorkspace` become the permanent scratch analysis state, or does it need a renamed wrapper?
- Does engine analysis for scratch positions currently convert snapshots to temporary game trees, and does that affect cache keys or history?
- Which existing overlay data depends on `treePosition`, and which only needs board + ownership?
- Should variation analysis write real game-tree variations in phase one, or use temporary variations first?
- What exact payload is saved when scratch position becomes a problem: snapshot, next player, rules, komi, reference answer, key points, engine evaluation?
- Which legacy UI entrances should be hidden first without deleting code?

## Current Code Anchors

- `src/modules/position-contracts.ts`: shared contract types and helpers.
- `src/modules/study.js`: snapshot helpers and scratch-compatible board conversion.
- `src/modules/sabaki.js`: current state owner, legacy mode switch, edit workspace, interaction dispatch.
- `src/components/overlays/BoardOverlayStack.js`: current overlay composition entry point.
- `src/components/MainView.js`: current bridge from state to Goban props.
- `src/components/WorkbenchShell.js`: current workspace shell and layout coordinator.

The intended direction is evolutionary: define the boundaries first, then move code behind those boundaries in small PRs.
