Date: 2026-05-27
Role: architecture-reviewer
Subject: diagnostics-region step2.3 implementation
Implementation commit: f379a286 implementation-agent: diagnostics classifier helper

# 架构审查

## 1. 结论

APPROVED

`classifyModeStateDiagnostics` 符合 step2.3-local 范围：它只消费 `resolveModeState` 的只读结果，返回纯 decision payload，不写 store/repository/Sabaki/engine/overlay，不返回 repair/patch/effect surface，也没有提前接入 shared `workbenchFlowService.ts`。DIAG-T06/T07/T08/T09 仍保持 deferred 到 `step3.integration`。

## 2. 严重阻塞问题

无。

## 3. 架构边界审查

| 边界 | 状态 | 证据 | 关注点 |
|---|---|---|---|
| Resolver / diagnostics helper purity | APPROVED | `src/modules/training/workbench/modeStateResolver.ts:154-175` 只读取 `result?.illegal` / `result?.diagnostics`，返回 `action/phase/command/tabId/codes`。`test/training/modeStateResolver.test.js:697-786` 用 frozen resolver result 断言 no repair surface。 | helper 没有 writer、callback、setter、effect 或 repair key。 |
| shared flow integration | APPROVED | `git diff --name-only f379a286^ f379a286` 只有 checklist 和 `modeStateResolver.ts`；没有 `workbenchFlowService.ts` 生产改动。 | 真实 preflight/postflight 接入仍必须由 step3 serial integrator 完成。 |
| diagnostics / reject / invalid-after-commit distinction | APPROVED | `modeStateResolver.ts:160-165` 将 preflight illegal 映射为 `reject`，postflight illegal 映射为 `invalid-after-commit`，diagnostics-only 映射为 `allow`。 | action 字符串使用 `invalid-after-commit`，与测试 `test/training/modeStateResolver.test.js:779` 一致；契约表中个别文字写作 `invalid_after_commit`，本轮代码/测试以 approved test 行为为准。 |
| source/provider demotion | APPROVED | `modeStateResolver.ts:213-233` 仅产生 `source-mode-mismatch` diagnostic；`test/training/modeStateResolver.test.js:639-670` 证明 `WorkbenchTab.mode` 仍是 projection truth。 | 没有按 `origin.provider` 分叉主流程。 |
| store/service ownership | APPROVED | `test/training/modeStateResolver.test.js:789-825` 扫描禁止 store/service/repository/engine/document/global/timer 依赖；生产文件自身无 import。 | step2.3 不声明 store transition 已接线。 |
| hidden global / legacy lookup | APPROVED | source scan 覆盖 `window.sabaki` / `globalThis.sabaki` / `sabaki.js`，且实现无此类引用。 | DIAG-T08 生产 composition 的显式 deps 接入仍 deferred。 |

## 4. 状态和事实来源审查

真源证据：

| 真源 | 约束 | 审查结论 |
|---|---|---|
| `docs/product/sabaki-training-prd.md:8-25` | 当前 PRD v0.7 是产品能力边界，Architecture v0.5 是模块架构边界。 | 本审查未把 archive contract 当产品真源，只把它作为已批准 step scope。 |
| `docs/product/sabaki-training-prd.md:237-269` | 运行态 WorkbenchMode 只有 Play / Problem / Recall / Analysis；Snapshot 持久化必须经 Analysis scratch/current。 | resolver projection 和 snapshot affordance 测试保持四 mode 边界；classifier 不新增 mode。 |
| `docs/product/sabaki-training-prd.md:116-130`, `:321-357` | Attempt 提交后冻结，Recall/Analysis 引用但不反向改写。 | helper 不写 Attempt/RecallSession；preflight write-order 仍 deferred 到 step3。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:64-110` | UI/Container/Service/Repository/Adapter 边界；禁止 `snapshotService` 打开 Tab、禁止按 `origin.provider` 分叉主流程。 | step2.3 没有 service/composition 改动，也没有 source-specific branching。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:112-158` | mode transition 必须可测试；非法转换 reject/throw 并记录；Analysis 不写 `Attempt.userLine`。 | classifier 提供 `reject` / `invalid-after-commit` 纯决策；真实 logging/throw 接入在 step3。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:162-210`, `:473-575` | 写路径经 Service，workbench/runtime store 所有权明确。 | 本实现没有绕过 owner service，也没有直接 patch store。 |
| `docs/architecture/position-source-mutation-contract.md:109-170`, `:216-263` | resolver 纯读，write/effect 进入 executor；Problem/Recall/Analysis mutation contract 分离。 | `modeStateResolver.ts` 继续只做 projection/diagnostics，未变成 executor。 |
| `docs/architecture/workbench-architecture-overview.md:103-124` | 新行为先过 mode orchestration，不绕过 flow service patch store。 | step2.3 只落纯 helper，没有自己 patch store；flow 接入留给 step3。 |

派生产物冲突：未发现。`test-contract-v0.2.md`、`contract-audit-v0.2.md`、`test-audit-v0.1.md` 均将 `workbenchFlowService.ts` 集成和 DIAG-T06/T07/T08/T09 明确 deferred 到 step3，与真源不冲突。

## 5. 副作用审查

无新增副作用。`classifyModeStateDiagnostics` 不 import 任何模块、不调用 store/service/repository/engine/DB/IPC/UI/global、不订阅 store、不生成 timer、不修改输入对象。它只从 resolver result 中收集 code 数组并返回 plain object。

当前实现也未新增 `window.sabaki`、`getTrainingContext`、`snapshotService`、`openGameTab`、`openProblemTab`、`openSnapshotProblemTab`、`runtimeStore.` 或 `workbenchStore.` 使用。

## 6. 测试质量审查

已执行：

```text
npx mocha --require tsx test/training/modeStateResolver.test.js test/training/modeTransitions.test.js
```

结果：71 passing。

测试质量结论：

| 项 | 状态 | 证据 |
|---|---|---|
| 真实生产代码执行 | APPROVED | `test/training/modeStateResolver.test.js:27-56` require 真实 `modeStateResolver.ts`，没有 mock resolver/helper。 |
| DIAG-T05 helper 行为 | APPROVED | `test/training/modeStateResolver.test.js:697-786` 覆盖 preflight illegal -> reject、preflight diagnostics-only -> allow、postflight illegal -> invalid-after-commit。 |
| no repair surface | APPROVED | `assertNoRepairSurface` 禁止返回 repair/patch/setter/callback/effect/write key；DIAG-T05 三行均调用。 |
| resolver no-mutation | APPROVED | `test/training/modeStateResolver.test.js:672-695` 用 deep-frozen snapshots 覆盖 legal/illegal 输入不变。 |
| 边界扫描 | APPROVED | `test/training/modeStateResolver.test.js:789-825` 扫描 banned imports/calls；该扫描只用于窄架构边界，不伪装 flow behavior。 |
| DIAG-T06/T07/T08/T09 | APPROVED deferred | `test-contract-v0.2.md:285-288` 和 `test-audit-v0.1.md` 明确 deferred 到 step3；本轮测试没有虚假声明 flow/store/composition 接线已完成。 |

## 7. 范围控制审查

实现范围受控。`f379a286` 的 production diff 只在 `modeStateResolver.ts` 新增 classifier helper；没有修改 `workbenchFlowService.ts`、composition、stores、services、repositories、UI 或 tests。

当前工作区存在与本 review 无关的未提交改动：`docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md`、`test/analysis/workbenchAnalysisScratchRegion.test.ts` 和 untracked visual harness build。它们不属于 `f379a286` diagnostics implementation 审查范围，本文件未基于这些改动做批准结论。

## 8. 需要手动检查的文件或行

| 文件或行 | 原因 |
|---|---|
| `src/modules/training/workbench/modeStateResolver.ts:154-175` | classifier helper 的全部实现面，已确认纯读、无 repair writer。 |
| `test/training/modeStateResolver.test.js:697-786` | DIAG-T05 行为与 no-repair surface 的自动化覆盖。 |
| `test/training/modeStateResolver.test.js:789-825` | resolver/helper 边界扫描覆盖范围。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/diagnostics-region/test-contract-v0.2.md:285-288` | DIAG-T06/T07/T08/T09 deferred ledger，step3 必须继续兑现。 |

## 9. 建议操作

可以进入后续 step。step3.integration 必须补真实 flow integration，不得把本轮 helper 的通过误读成 command path 已完成接线。step3 至少需要覆盖：

| Deferred ID | 后续要求 |
|---|---|
| DIAG-T06 | real `workbenchFlowService` preflight illegal state rejects before attempt/repository/region/store writes。 |
| DIAG-T07 | real postflight snapshot after explicit effects，illegal result surfaces invalid-after-commit without repair。 |
| DIAG-T08 | production composition wires explicit diagnostics deps/snapshot provider；无 hidden global/source-specific tab API。 |
| DIAG-T09 | diagnostics-only allowed transition still returns through owner store/subscription/projection path。 |

## 10. Workbench 接线闭环追踪（如适用）

本轮无 UI 控件或 Workbench command 接线改动；step2.3-local 只批准 resolver/helper contract。真实闭环 deferred 到 step3。

| 控件/命令 | Event | Container | Controller | Service/Store | Projection/UI | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| diagnostics classifier | N/A pure helper | N/A | N/A | consumes resolver result only; no store write | returns decision payload only | APPROVED for step2.3-local |
| submit / enterAnalysis / returnFromAnalysis / snapshot | deferred | deferred | deferred | `workbenchFlowService` integration deferred | deferred | step3 required |

## 11. 真源冲突清单（如适用）

| 冲突产物 | 冲突内容 | 统一真源 | 处理建议 |
| --- | --- | --- | --- |
| N/A | 未发现冲突 | PRD v0.7 + Architecture v0.5 + Position Source/Mutation Contract | 无 |

可以继续。
