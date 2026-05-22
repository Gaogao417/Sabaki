# Fix: problemArea 类型统一 + engineMoveAdapter 移除

Date: 2026-05-18
Status: pending

## Gap Analysis

| # | 差距 | 严重性 | 说明 |
|---|-----|--------|------|
| G1 | ProblemArea 用矩形 `{x1,y1,x2,y2}` 而引擎要顶点列表 `[number,number][]` | P0 | 类型不统一，problemArea 无法直接传引擎 |
| G2 | engineMoveAdapter 抽象了不存在的 `engineConnection.analyze()` 接口 | P0 | 死代码，真正的引擎路径是 engineService.buildAnalyzeArgs |
| G3 | aiMoveService 通过 engineMoveAdapter 传面积，但引擎实际收不到 | P0 | problemArea 约束不到达引擎 |
| G4 | 两种面积类型并存，无转换逻辑 | P1 | 维护者困惑 |

## User Stories

**US-1:** 作为开发者，我希望 `ProblemArea` 使用与 `analysisAreaVertices` 一致的顶点列表类型 `[number, number][]`，这样训练模块和引擎分析模块共享同一面积类型。

**US-2:** 作为开发者，我希望 `engineMoveAdapter` 被移除，因为它抽象了一个不存在的引擎接口。真正的引擎路径是 `engineService.buildAnalyzeArgs()` 生成 GTP `allow` 命令。

**US-3:** 作为开发者，我希望 `aiMoveService` 直接使用真实的引擎路径将 `problemArea` 传给引擎。

**US-4:** 作为开发者，我希望 DB 中旧的矩形格式 problemArea 在读取时向后兼容地迁移到顶点列表格式。

## Test/Acceptance Contract Table

### Group A: ProblemArea 类型统一

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| C01 | PURE_LOGIC | MUST_AUTOMATE | `ProblemArea` 类型为 `[number, number][]`，与 `analysisAreaVertices` 一致 | critical | 两种面积类型长期并存 |
| C02 | PURE_LOGIC | MUST_AUTOMATE | `isCoordInArea(coord, vertices)` 当 coord 出现在 vertices 列表中时返回 true | critical | 后置过滤误判 |
| C03 | PURE_LOGIC | MUST_AUTOMATE | `isCoordInArea(coord, vertices)` 当 coord 未出现在 vertices 列表中时返回 false | critical | 后置过滤误判 |
| C04 | STATE | MUST_AUTOMATE | `isCoordInArea` 在 vertices 为 undefined 或空数组时返回 false | high | 边界异常 |

### Group B: engineMoveAdapter 移除

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| C05 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `training/index.ts` 不再导出 `createEngineMoveAdapter` | high | 死代码残留 |
| C06 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `aiMoveService` 的 deps 接口不包含 `engineMoveAdapter` 字段 | critical | 对虚构接口的依赖保留 |
| C07 | ARCHITECTURE_BOUNDARY | MANUAL_ACCEPTANCE | 文件 `src/modules/training/adapter/engineMoveAdapter.ts` 已删除 | high | 死代码残留 |

### Group C: aiMoveService 使用真实引擎路径

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| C08 | SIDE_EFFECT | MUST_AUTOMATE | `requestAiMove` 在 problem 模式且 task.problemArea 非空时，将顶点列表传递给引擎 deps（格式兼容 `analysisAreaVertices`） | critical | 面积约束不到达引擎 |
| C09 | STATE | MUST_AUTOMATE | `requestAiMove` 在 problem 模式且 task.problemArea 非空时，对引擎返回的着法做后置过滤（着法坐标必须在顶点列表中） | critical | 面积外着法未被拦截 |
| C10 | STATE | MUST_AUTOMATE | `requestAiMove` 在非 problem 模式时（play 等）不进行面积约束 | high | 非问题模式被错误约束 |
| C11 | STATE | MUST_AUTOMATE | `requestAiMove` 在 task.problemArea 为 undefined 或空数组时不进行面积约束 | high | 无面积任务被错误约束 |
| C12 | STATE | MUST_AUTOMATE | `shouldAiMove` 纯函数行为不变（确认无回归） | medium | AI 自动下棋逻辑回归 |

### Group D: Repository 向后兼容

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| C13 | STATE | MUST_AUTOMATE | `mapTaskRow` 对 DB 中矩形格式 `{x1,y1,x2,y2}` 的 problemArea 转换为顶点列表（集合语义：所有 x1<=x<=x2 且 y1<=y<=y2 的坐标对） | critical | 旧数据加载失败 |
| C14 | STATE | MUST_AUTOMATE | `mapTaskRow` 对已经是顶点列表格式的 problemArea 直接透传 | high | 新数据被错误转换 |
| C15 | STATE | MUST_AUTOMATE | `mapTaskRow` 对 problemArea 为 null 或缺失时返回 undefined | high | 无面积任务崩溃 |

### Group E: 架构边界

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| C16 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `aiMoveService` 不依赖 `engineConnection.analyze()` 接口 | critical | 新的虚构接口替换旧的 |
| C17 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | 训练模块中无任何文件 import engineMoveAdapter | high | 残留引用导致运行时错误 |

## 状态流

```
Type: ProblemArea = [number, number][]

Task created:
  -> task.problemArea = [[0,0],[1,0],[2,0],...]

Task loaded from DB:
  -> 矩形格式 -> 展开为顶点列表
  -> 顶点列表 -> 直接透传
  -> null/缺失 -> undefined

AI move (problem mode):
  -> requestAiMove reads task.problemArea (vertex list)
  -> passes to engine deps as analysisAreaVertices
  -> engine analyzes with GTP allow constraint
  -> post-filter: isCoordInArea(move, vertices)
  -> pass -> return move; fail -> return null
```
