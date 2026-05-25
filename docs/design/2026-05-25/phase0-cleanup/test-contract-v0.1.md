Date: 2026-05-25
Status: pending-confirmation

# 契约草案 -- Phase 0 Cleanup: RecallPolicy + expectedMoveIndexes

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| PRD v0.5 | 4.8 RecallSession | `expectedMoves: string[]` 和 `currentMoveIndex` 是 RecallSession 的核心字段。PRD 不显式定义 RecallPolicy，但要求 RecallSession 绑定 Attempt |
| Architecture v0.5 | 5.8 recallService API | `createRecallFromAttempt(input: { attemptId, recallPolicy? })` 和 `RecallPolicy = 'fullLine' \| 'humanMovesOnly' \| 'sideToMoveOnly'` |
| Architecture v0.5 | 5.8 RecallSession type | `RecallSession` 必须包含 `recallPolicy: RecallPolicy`, `expectedMoves: string[]`, `expectedMoveIndexes: number[]` |
| Architecture v0.5 | 5.8 策略语义 | `fullLine`: 回忆整条 userLine; `humanMovesOnly`: 只回忆 moveActors='human' 的手; `sideToMoveOnly`: 只回忆 sideToMove 对应方的手 |
| Architecture v0.5 | 5.8 默认策略 | Play Mode = fullLine; Problem Mode = humanMovesOnly, 除非显式要求 fullLine |
| Architecture v0.5 | 7.5 recall_sessions 表 | `recall_policy TEXT NOT NULL`, `expected_move_indexes_json TEXT NOT NULL` |
| Architecture v0.5 | 13.2 Repository Tests | "RecallPolicy / expected_move_indexes roundtrip" 是必须覆盖的 repository 测试 |
| Architecture v0.5 | 13.3 Service Tests | "RecallPolicy fullLine / humanMovesOnly / sideToMoveOnly tests" 是必须覆盖的 service 测试 |
| Implementation Plan | Phase 0 task 9 | `RecallSession` 增加 `recallPolicy` 和 `expectedMoveIndexes`: fullLine, humanMovesOnly, sideToMoveOnly |
| Implementation Plan | Phase 0 验收 | "RecallSession 可保存 recallPolicy / expectedMoveIndexes" |

## 1. 用户故事

作为训练系统开发者，我需要 RecallSession 显式保存 recallPolicy 和 expectedMoveIndexes，使得 Recall 的 expectedMoves 不再隐式等于 Attempt.userLine，而是由策略驱动的子集。这确保：

- Play Mode (AI 对弈) 的 Recall 可以要求用户回忆整条线 (包括 AI 手)。
- Problem Mode 的 Recall 默认只回忆人类用户的手，跳过 AI 对手应手。
- sideToMoveOnly 策略允许只回忆执黑或执白一方的手。

## 2. 用户动作

本任务是纯数据层清理，无直接用户动作。间接驱动动作：

1. 用户 Submit Play Mode Attempt -> 系统 createRecallFromAttempt(attemptId, { recallPolicy: 'fullLine' })
2. 用户 Submit Problem Mode Attempt -> 系统 createRecallFromAttempt(attemptId, { recallPolicy: 'humanMovesOnly' })
3. 用户打开旧 RecallSession -> 系统加载旧 session (无 recallPolicy 字段) -> 兼容处理

## 3. 当前阶段

Phase 0 (v0.5 模型收敛)。不涉及 UI 变更，不涉及 Workbench 接线。

## 4. 位置源

- `game-tree`: 不适用
- `scratch`: 不适用
- `problem-attempt`: RecallSession 绑定 TrainingAttempt
- `reference/current`: 不适用

## 5. 变更契约

- RecallSession 新增 `recallPolicy: RecallPolicy` 字段
- RecallSession 新增 `expectedMoveIndexes: number[]` 字段
- RecallPolicy 类型定义: `'fullLine' | 'humanMovesOnly' | 'sideToMoveOnly'`
- DB migration: `training_recall_sessions` 新增 `recall_policy TEXT` 和 `expected_move_indexes_json TEXT` 列
- Repository createRecallSession / loadRecallSession / updateRecallSession 映射新字段
- Legacy compat: 旧 session 没有 recallPolicy 时，默认 'fullLine'；没有 expectedMoveIndexes 时，从 expectedMoves 长度派生 `[0, 1, 2, ...]`

## 6. 预期状态流

```
createRecallFromAttempt(attemptId, { recallPolicy })
  -> repository.loadAttempt(attemptId)
  -> deriveExpectedMoves(attempt, recallPolicy) -> { expectedMoves, expectedMoveIndexes }
  -> repository.createRecallSession({ ..., recallPolicy, expectedMoves, expectedMoveIndexes })
  -> loadRecallSession(sessionId) -> session 包含 recallPolicy + expectedMoveIndexes
```

Legacy read path:
```
loadRecallSession(oldSessionId)
  -> DB row 没有 recall_policy 列 -> default 'fullLine'
  -> DB row 没有 expected_move_indexes_json 列 -> default [0, 1, ..., expectedMoves.length - 1]
```

## 7. 允许的副作用

- DB migration 新增 `recall_policy` 和 `expected_move_indexes_json` 列
- 类型文件 `src/modules/training/types/recall.ts` 新增 `RecallPolicy` type export 和 RecallSession 字段
- Repository mapper 处理新列的 JSON 序列化/反序列化
- recallService 的 `createRecallFromAttempt` 接受可选 `recallPolicy` 参数

## 8. 禁止的副作用

- 不得修改 UI 组件
- 不得修改 WorkbenchTab 或 workbenchStore
- 不得引入新的 Service
- 不得删除旧 RecallSession 字段 (source, type, startMove, endMove 保持兼容)
- 不得让 RecallPolicy 驱动 mode 转换或 UI 分支

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| P0-T01 | PURE_LOGIC | MUST_AUTOMATE | RecallPolicy 类型包含 'fullLine', 'humanMovesOnly', 'sideToMoveOnly' 三个值 | 高 | 编译期保证 |
| P0-T02 | STATE | MUST_AUTOMATE | createRecallSession 包含 recallPolicy 和 expectedMoveIndexes 时，loadRecallSession 返回完整值 | 高 | 数据完整性 |
| P0-T03 | STATE | MUST_AUTOMATE | createRecallSession 不含 recallPolicy 时，loadRecallSession 返回默认 'fullLine' | 高 | 兼容性 |
| P0-T04 | STATE | MUST_AUTOMATE | createRecallSession 不含 expectedMoveIndexes 时，loadRecallSession 返回 [0..N-1] | 高 | 兼容性 |
| P0-T05 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | DB migration 新增 recall_policy 和 expected_move_indexes_json 列，现有行不受影响 | 高 | 迁移安全 |
| P0-T06 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | migrate() 执行两次不崩溃 | 高 | 幂等性 |
| P0-T07 | PURE_LOGIC | MUST_AUTOMATE | deriveExpectedMoves(fullLine, attempt) 返回 attempt.userLine 和全部 index | 高 | 策略正确性 |
| P0-T08 | PURE_LOGIC | MUST_AUTOMATE | deriveExpectedMoves(humanMovesOnly, attempt) 过滤 moveActors='human' 的手 | 高 | 策略正确性 |
| P0-T09 | PURE_LOGIC | MUST_AUTOMATE | deriveExpectedMoves(sideToMoveOnly, attempt) 过滤 sideToMove 对应方的手 | 高 | 策略正确性 |
| P0-T10 | PURE_LOGIC | MUST_AUTOMATE | deriveExpectedMoves(humanMovesOnly) 当 moveActors 为 undefined 时，退化为 fullLine | 中 | 防御性 |
| P0-T11 | PURE_LOGIC | MUST_AUTOMATE | deriveExpectedMoves(sideToMoveOnly) 当 sideToMove 为 undefined 时，退化为 fullLine | 中 | 防御性 |
| P0-T12 | STATE | MUST_AUTOMATE | updateRecallSession 能更新 currentMoveIndex 到 expectedMoveIndexes 范围内的值 | 中 | 正常操作 |
| P0-T13 | STATE | MUST_AUTOMATE | 旧 DB 行 (无 recall_policy 列) load 后 recallPolicy = 'fullLine' | 高 | 向后兼容 |
| P0-T14 | STATE | MUST_AUTOMATE | 旧 DB 行 (无 expected_move_indexes_json 列) load 后 expectedMoveIndexes = [0..N-1] | 高 | 向后兼容 |
| P0-T15 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | recallPolicy 不影响 WorkbenchMode 转换 | 中 | 边界保护 |

## 10. 必须自动化的测试

### Group A: RecallPolicy 类型与纯函数 (unit)

**P0-T01**: RecallPolicy 类型编译检查
- 前置: RecallPolicy type 已定义
- 操作: 验证 'fullLine', 'humanMovesOnly', 'sideToMoveOnly' 是合法值
- 预期: TypeScript 编译通过；非法值编译失败

**P0-T07**: deriveExpectedMoves(fullLine, attempt)
- 前置: attempt.userLine = ['D4', 'Q16', 'C3']，moveActors = ['human', 'ai', 'human']
- 操作: deriveExpectedMoves('fullLine', attempt)
- 预期: { expectedMoves: ['D4', 'Q16', 'C3'], expectedMoveIndexes: [0, 1, 2] }

**P0-T08**: deriveExpectedMoves(humanMovesOnly, attempt)
- 前置: attempt.userLine = ['D4', 'Q16', 'C3']，moveActors = ['human', 'ai', 'human']
- 操作: deriveExpectedMoves('humanMovesOnly', attempt)
- 预期: { expectedMoves: ['D4', 'C3'], expectedMoveIndexes: [0, 2] }

**P0-T09**: deriveExpectedMoves(sideToMoveOnly, attempt)
- 前置: task.sideToMove = 'black'，attempt.userLine = ['D4', 'Q16', 'C3']，moveActors = ['human', 'ai', 'human']，落子颜色序列为 [black, white, black]
- 操作: deriveExpectedMoves('sideToMoveOnly', attempt, task.sideToMove)
- 预期: { expectedMoves: ['D4', 'C3'], expectedMoveIndexes: [0, 2] }

**P0-T10**: deriveExpectedMoves(humanMovesOnly) 当 moveActors undefined
- 前置: attempt.userLine = ['D4', 'Q16']，moveActors = undefined
- 操作: deriveExpectedMoves('humanMovesOnly', attempt)
- 预期: 退化为 fullLine 结果: { expectedMoves: ['D4', 'Q16'], expectedMoveIndexes: [0, 1] }

**P0-T11**: deriveExpectedMoves(sideToMoveOnly) 当 sideToMove undefined
- 前置: attempt.userLine = ['D4', 'Q16']，sideToMove = undefined
- 操作: deriveExpectedMoves('sideToMoveOnly', attempt)
- 预期: 退化为 fullLine 结果: { expectedMoves: ['D4', 'Q16'], expectedMoveIndexes: [0, 1] }

### Group B: Repository Roundtrip (integration, real SQLite)

**P0-T02**: createRecallSession with recallPolicy + expectedMoveIndexes roundtrip
- 前置: 种子 task + attempt 存在
- 操作:
  ```
  repo.createRecallSession({
    id: 'rs_02', taskId, attemptId,
    recallPolicy: 'humanMovesOnly',
    expectedMoves: ['D4', 'C3'],
    expectedMoveIndexes: [0, 2],
    ...
  })
  ```
- 预期: `repo.loadRecallSession('rs_02')` 返回 recallPolicy='humanMovesOnly', expectedMoveIndexes=[0, 2]

**P0-T03**: createRecallSession without recallPolicy defaults to 'fullLine'
- 前置: 种子 task + attempt 存在
- 操作: `repo.createRecallSession({ id: 'rs_03', taskId, attemptId, expectedMoves: ['D4'], ... })`
- 预期: `repo.loadRecallSession('rs_03')` 返回 recallPolicy='fullLine'

**P0-T04**: createRecallSession without expectedMoveIndexes defaults to [0..N-1]
- 前置: 种子 task + attempt 存在
- 操作: `repo.createRecallSession({ id: 'rs_04', taskId, attemptId, expectedMoves: ['D4', 'Q16', 'C3'], ... })`
- 预期: `repo.loadRecallSession('rs_04')` 返回 expectedMoveIndexes=[0, 1, 2]

**P0-T12**: updateRecallSession advances currentMoveIndex within expectedMoveIndexes range
- 前置: session with expectedMoveIndexes=[0, 2, 5], currentMoveIndex=0
- 操作: `repo.updateRecallSession('rs_12', { currentMoveIndex: 2 })`
- 预期: loadRecallSession returns currentMoveIndex=2

### Group C: DB Migration (integration, real SQLite)

**P0-T05**: migration adds recall_policy and expected_move_indexes_json columns
- 前置: fresh SQLite DB
- 操作: `PRAGMA table_info(training_recall_sessions)` after migrate()
- 预期: column list includes 'recall_policy' and 'expected_move_indexes_json'

**P0-T06**: migrate() twice does not crash
- 前置: fresh SQLite DB
- 操作: migrate() twice
- 预期: second migrate() does not throw; existing data survives

### Group D: Legacy Compat (integration, real SQLite)

**P0-T13**: legacy row without recall_policy loads as 'fullLine'
- 前置: 用 raw SQL 插入旧格式 training_recall_sessions 行 (无 recall_policy 列值)
- 操作: `repo.loadRecallSession('legacy_rs')`
- 预期: session.recallPolicy === 'fullLine'

**P0-T14**: legacy row without expected_move_indexes_json loads as [0..N-1]
- 前置: 用 raw SQL 插入旧格式行，expected_moves_json = '["D4","Q16","C3"]'，无 expected_move_indexes_json 列值
- 操作: `repo.loadRecallSession('legacy_rs')`
- 预期: session.expectedMoveIndexes === [0, 1, 2]

### Group E: Architecture Boundary (unit)

**P0-T15**: RecallPolicy does not drive WorkbenchMode
- 前置: RecallPolicy type 定义完成
- 操作: 检查 RecallPolicy 值是否出现在 modeTransition 逻辑中
- 预期: RecallPolicy 不作为 WorkbenchMode 转换的 guard 或 effect 条件
- 注: 此项为代码审查契约，可由 architecture-reviewer 在 PR review 时确认

## 11. 仅手动验收

无。所有验收均可自动化。

## 12. 不测试

| 项目 | 原因 |
| --- | --- |
| RecallPolicy 对 UI 渲染的影响 | Phase 0 不涉及 UI 变更 |
| recallPolicy 在 Review 流程中的表现 | Review 打开的是普通 Task，不直接读 recallPolicy |
| sideToMoveOnly 策略在 board state 中的体现 | Phase 0 只收敛模型，不接 UI |
| 旧迁移路径 (v0.4 RecallSource 到 v0.5 RecallPolicy 的数据迁移) | 旧 session 保留 source_json，新 session 使用 recallPolicy；无需批量迁移旧数据 |

## 13. 脆弱测试警告

| 测试 ID | 脆弱点 | 缓解 |
| --- | --- | --- |
| P0-T05 | 检查列名是否在 PRAGMA table_info 结果中 | 只检查列名存在，不检查列顺序或类型 |
| P0-T02/03/04 | 依赖 repo.createRecallSession 和 repo.loadRecallSession 的完整 roundtrip | 这是 architecture v0.5 明确要求的 repository roundtrip 测试，不是实现细节 |
| P0-T08/09 | 依赖 moveActors 数组结构和 sideToMove 颜色映射 | 这是 architecture v0.5 定义的策略语义，不是临时实现 |

**弱测试禁令提醒**: 测试不得只验证 "mapper 函数被调用一次" 或 "SQL 语句包含某个字符串"。必须验证 roundtrip 后的数据完整性。

## 14. 超出范围

| 项目 | 原因 |
| --- | --- |
| recallService.createRecallFromAttempt 接受 recallPolicy 参数 | 属于 recallService 重构，不是 Phase 0 类型收敛 |
| RecallPolicy 在 workbenchFlowService.submit 中的传递 | 属于 Phase 1+ 接线 |
| expectedMoves 视图模型投影到 UI | 属于 Workbench 接线任务 |
| RecallSubstate (normal / checkpoint_*) 与 RecallPolicy 的交互 | 属于 Phase 4 |

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 origin.provider 当作 RecallPolicy 分支 | 否 | RecallPolicy 由 mode (Play/Problem) 和显式参数决定，不依赖 origin | 无需处理 |
| 是否引入 source-specific API | 否 | 只新增 RecallPolicy enum，不新增 openXxxTab | 无需处理 |
| 是否让 snapshotService 承担流程编排 | 否 | 本任务不涉及 snapshotService | 无需处理 |
| 是否让 container 直接写 store | 否 | 本任务不涉及 container | 无需处理 |
| 是否让 UI component 直接依赖 service/store/repository | 否 | 本任务不涉及 UI | 无需处理 |
| 是否删除旧 RecallSession 字段 | 否 | source, type, startMove, endMove 保留为兼容字段 | Architecture v0.5 7.5 说明: "MVP 不再有 source_json / type / start_move / end_move" -- 但当前是兼容过渡期，旧列保留 |
| RecallSession 是否缺少 attemptId | 否 | Phase 0 task 7 已落地 attemptId | 无需处理 |
| DB migration 是否破坏现有 phase0Migration 测试 | 待验证 | 现有 28 个测试需要通过 | 实施后必须跑全量测试 |

## 16. 测试分层契约表

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0-T07 | PURE_LOGIC | deriveExpectedMoves (fullLine) | RecallPolicy type, attempt shape | none | none | none | expectedMoves = userLine, expectedMoveIndexes = [0..N-1] | P0-T02 |
| P0-T08 | PURE_LOGIC | deriveExpectedMoves (humanMovesOnly) | RecallPolicy type, attempt shape | none | none | none | expectedMoves = filtered human moves, expectedMoveIndexes = original indices | P0-T02 |
| P0-T09 | PURE_LOGIC | deriveExpectedMoves (sideToMoveOnly) | RecallPolicy type, attempt shape, sideToMove | none | none | none | expectedMoves = filtered by color, expectedMoveIndexes = original indices | P0-T02 |
| P0-T10 | PURE_LOGIC | deriveExpectedMoves (humanMovesOnly, no moveActors) | RecallPolicy type, attempt shape | none | none | none | fallback to fullLine | P0-T03 |
| P0-T11 | PURE_LOGIC | deriveExpectedMoves (sideToMoveOnly, no sideToMove) | RecallPolicy type, attempt shape | none | none | none | fallback to fullLine | P0-T03 |
| P0-T02 | SERVICE_REPOSITORY_TRANSITION | repo.createRecallSession -> repo.loadRecallSession | real SQLite, real migrate, real trainingDbApi, real trainingRepository | none | none | none | roundtrip preserves recallPolicy + expectedMoveIndexes | not-covered (Phase 0 terminal) |
| P0-T03 | SERVICE_REPOSITORY_TRANSITION | repo.createRecallSession (no recallPolicy) -> repo.loadRecallSession | real SQLite, real migrate, real trainingDbApi, real trainingRepository | none | none | none | recallPolicy defaults to 'fullLine' | not-covered (Phase 0 terminal) |
| P0-T04 | SERVICE_REPOSITORY_TRANSITION | repo.createRecallSession (no expectedMoveIndexes) -> repo.loadRecallSession | real SQLite, real migrate, real trainingDbApi, real trainingRepository | none | none | none | expectedMoveIndexes defaults to [0..N-1] | not-covered (Phase 0 terminal) |
| P0-T05 | SIDE_EFFECT_BOUNDARY | migrate() | real SQLite, real DbClient | none | none | none | new columns exist after migration | P0-T06 |
| P0-T06 | SIDE_EFFECT_BOUNDARY | migrate() twice | real SQLite, real DbClient | none | none | none | second migrate() does not throw | not-covered (Phase 0 terminal) |
| P0-T12 | SERVICE_REPOSITORY_TRANSITION | repo.updateRecallSession(currentMoveIndex) -> repo.loadRecallSession | real SQLite, real migrate, real trainingDbApi, real trainingRepository | none | none | none | currentMoveIndex updated correctly | not-covered (Phase 0 terminal) |
| P0-T13 | SERVICE_REPOSITORY_TRANSITION | repo.loadRecallSession(legacy row) | real SQLite, raw SQL seed | none | none | none | recallPolicy = 'fullLine' for legacy row | not-covered (Phase 0 terminal) |
| P0-T14 | SERVICE_REPOSITORY_TRANSITION | repo.loadRecallSession(legacy row) | real SQLite, raw SQL seed | none | none | none | expectedMoveIndexes = [0..N-1] for legacy row | not-covered (Phase 0 terminal) |
| P0-T15 | ARCHITECTURE_BOUNDARY | code review | production source code | none | none | none | RecallPolicy not used in modeTransition guards | architecture-reviewer |

## 17. 任务并行建议

本任务规模较小 (类型 + migration + mapper)，不建议并行 worker。按顺序执行：

1. 类型定义 (`recall.ts`: RecallPolicy + RecallSession 新字段)
2. DB migration (`migrate.js`: 新增列)
3. Repository mapper (`trainingRepository.ts`: 序列化/反序列化 + 默认值)
4. 纯函数 `deriveExpectedMoves` (可放在 `recallService.ts` 或独立模块)
5. 测试 (所有 P0-T01 到 P0-T15)

### 文件变更范围

| 文件 | 变更类型 |
| --- | --- |
| `src/modules/training/types/recall.ts` | 新增 RecallPolicy export, RecallSession 增加 recallPolicy + expectedMoveIndexes |
| `src/modules/db/migrate.js` | 新增 _tryAlter ADD COLUMN recall_policy, expected_move_indexes_json |
| `src/modules/training/repository/trainingRepository.ts` | mapRecallSessionRow 处理新字段; createRecallSession 传递新字段 |
| `src/modules/training/recall/recallService.ts` | (可选) 新增 deriveExpectedMoves 纯函数; 或独立模块 |
| `test/training/phase0Migration.test.js` | 新增 Group 7: RecallPolicy / expectedMoveIndexes 测试 |
| `test/training/recallRepository.test.js` | 新增 recallPolicy roundtrip 测试 |
| `test/training/recallService.test.js` | 新增 deriveExpectedMoves 测试 |

### 与现有测试的共存

现有 `phase0Migration.test.js` 有 28 个测试 (T-01 到 T-28)。新增测试应作为新的 Group 7 追加到同一文件，或作为独立 describe block。不得修改现有测试。

现有 `recallRepository.test.js` 和 `recallService.test.js` 的现有测试不得被破坏。新测试追加到文件末尾。

## 18. 实施注意事项

### deriveExpectedMoves 纯函数的位置

Architecture v0.5 5.8 定义 RecallPolicy 语义为 recallService 范围。建议将 `deriveExpectedMoves` 放在 `recallService.ts` 文件内或作为同级独立模块。此函数:

- 输入: `policy: RecallPolicy`, `attempt: TrainingAttempt`, `sideToMove?: 'black' | 'white'`
- 输出: `{ expectedMoves: string[], expectedMoveIndexes: number[] }`
- 纯函数: 不依赖 store, service, DB, adapter
- 退化策略: 当 moveActors 或 sideToMove 不可用时，退化为 fullLine

### sideToMoveOnly 的颜色判断

sideToMoveOnly 需要知道每手的颜色。当前 Attempt 不直接存储每手颜色。有两种方案：

1. 从 `attempt.rootPositionSgf` + move index 推导 (root position 的 sideToMove 决定第 0 手颜色)
2. 从 `task.sideToMove` + move index 推导 (假设黑白交替)

Architecture v0.5 语义是 "只回忆 TrainingTask.sideToMove 对应一方的手"，即方案 2:
- task.sideToMove = 'black', moveIndex % 2 === 0 -> black 的手
- task.sideToMove = 'white', moveIndex % 2 === 1 -> white 的手
- task.sideToMove undefined -> 退化为 fullLine

这是围棋的基本约束 (黑白交替落子)。test-writer 应基于此逻辑写测试。

### Legacy compat 默认值规则

| 字段 | 旧行缺失时的默认值 | 依据 |
| --- | --- | --- |
| recallPolicy | 'fullLine' | Architecture v0.5 5.8 默认策略: Play = fullLine |
| expectedMoveIndexes | [0, 1, ..., expectedMoves.length - 1] | fullLine 的 index 就是连续序列 |

### 不需要的 Mock

所有 P0-T02 到 P0-T14 的测试使用真实 SQLite + 真实 migrate + 真实 trainingDbApi + 真实 trainingRepository。禁止 mock repository、db client 或 mapper。

P0-T07 到 P0-T11 的纯函数测试直接调用 `deriveExpectedMoves`，无 mock。

### 现有 phase0Migration.test.js 的种子数据

现有测试使用 `seedLegacyRecallSession` helper 插入旧格式行。P0-T13 和 P0-T14 应复用此 helper 或类似 raw SQL 方法插入旧格式行，然后通过 `repo.loadRecallSession` 读取。

### 测试文件组织建议

- P0-T05, P0-T06, P0-T13, P0-T14: 追加到 `test/training/phase0Migration.test.js`
- P0-T02, P0-T03, P0-T04, P0-T12: 追加到 `test/training/recallRepository.test.js`
- P0-T07, P0-T08, P0-T09, P0-T10, P0-T11: 追加到 `test/training/recallService.test.js`
- P0-T01: 由 TypeScript 编译保证，或作为 smoke test 验证 type export
- P0-T15: 代码审查契约，architecture-reviewer 在 PR review 时确认
