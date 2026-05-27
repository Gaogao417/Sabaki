# 架构审查

Date: 2026-05-27
Role: architecture-reviewer
Subject: scratch-region implementation after `dcd2cf5b implementation-agent: analysis scratch region owner`

## 1. 结论

APPROVED

`src/modules/analysis/workbenchAnalysisScratchRegion.ts` 是独立 child-region owner：它通过 injected adapter 处理 Analysis scratch target lifecycle，不写父 `WorkbenchMode`，不写 Attempt/Recall/Task/repository 等持久业务事实。`refreshScratchAnalysis` 增加了 explicit scratch target metadata 和 target/generation stale guard，并继续只写 `editWorkspace` 分支。`src/modules/training/workbench/workbenchFlowService.ts`、`src/modules/sabaki.js` 和 `TrainingWorkbenchContainer` default composition 未在本实现中改动，符合 step3.integration deferral。

## 2. 严重阻塞问题

无。

## 3. 架构边界审查

| 边界 | 状态 | 证据 | 关注点 |
|---|---|---|---|
| Child-region owner | PASS | `src/modules/analysis/workbenchAnalysisScratchRegion.ts:41-117` 使用 module-local `activeTargets` / `generations`，只暴露 `enterAnalysis`、`exitAnalysis`、`getActiveTarget`、`applyScratchAnalysisResult`。 | owner 仍需 step3 默认组合后进入真实 app path。 |
| Parent WorkbenchMode ownership | PASS | scratch region 不调用 `workbenchStore.updateTab`、`setMode` 或 tab service；真实父 mode 仍由 `workbenchFlowService.ts:609-720` 处理。 | `createSabakiModeEffects` legacy default 仍存在，step3 负责组合 wrapper。 |
| Target/generation guard | PASS | `analysisTypes.ts:60-75` 定义 target/result；region `createTarget` 在 `workbenchAnalysisScratchRegion.ts:53-68` 生成 `workspaceId/generation/tabId/targetTab`；stale compare 在 `workbenchAnalysisScratchRegion.ts:70-83` 和 `scratchAnalysis.ts:109-139`。 | broader engine ownership migration 仍为 deferred，不在本 slice。 |
| Scratch analysis write-back | PASS | `scratchAnalysis.ts:215-242` 将 `scratchTarget` 传入 request/update/final path；`scratchAnalysis.ts:298-310` 只写 `editWorkspace` analysis/ownership/pending keys。 | unsupported-engine sync branch没有 async stale 窗口；当前可接受。 |
| Repository / persistent facts | PASS | source scan over implemented analysis files only matched `problem-attempt` comment/type and allowed `sourceMode` union; no repository, Attempt fact, SGF tree, global analysis, DB/IPC writes. | 无。 |
| Shared flow composition deferral | PASS | `git diff dcd2cf5b^ dcd2cf5b -- src/modules/training/workbench/workbenchFlowService.ts src/modules/sabaki.js src/components/TrainingWorkbenchContainer.js` produced no diff. | step3.integration must wire production default composition. |

## 4. 状态和事实来源审查

真源证据：

| 真源 | 约束 | 实现结论 |
|---|---|---|
| `docs/product/sabaki-training-prd.md:235-269` | runtime mode 只有 Play / Problem / Recall / Analysis；Snapshot 持久化前必须先投影到 Analysis scratch/current。 | 本 slice 没新增 mode，也没实现 Snapshot orchestration；step3 deferral 保持有效。 |
| `docs/product/sabaki-training-prd.md:591-614`, `docs/product/sabaki-training-prd.md:1558-1564` | Analysis edit bar 只写 scratch/current working position，不能改 frozen Attempt 或 source game tree。 | scratch region/scratch analysis 没有 Attempt、repository、SGF tree/history/current-node 写入。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:89-116` | UI/Container/Service/Store 边界；mode guard/effect 不能散落在 UI callback。 | 本实现只新增 analysis child-region owner 和 scratch analysis guard；未改 UI callback。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:727-798` | `workbenchFlowService` owns mode orchestration；Analysis 不隐式改 `Attempt.userLine`。 | region 接收 mode-effect intent，不反向改 mode；未写 Attempt。 |
| `docs/architecture/workbench-architecture-overview.md:471-500` | `workbenchStore` owns WorkbenchTab/editWorkspace；`analysisService`/analysis module owns scratch analysis lifecycle/write-back boundary。 | region 只通过 adapter 创建/清理 workspace target；`refreshScratchAnalysis` owns request/write-back guard。 |
| `docs/architecture/workbench-architecture-overview.md:744-772` | scratch-analysis 是 distinct source，不 dirty SGF tree、`SBKV`/`SBKS` 或 global analysis state。 | requestGroup/source 仍为 `scratch-analysis`，source scan 未发现 SGF/global writes。 |
| `docs/architecture/position-source-mutation-contract.md:27-43`, `:133-153`, `:258-260` | `scratch/current` 是 temporary working snapshot；`scratchEdit` 可改 working position，禁止写 current SGF tree/history/current node。 | 本实现符合 scratch-only write boundary。 |
| `docs/ui_ux/workbench-ui-ux-spec.md:803-817`, `:939-952` | Analysis bottom bar / Snapshot command path 语义。 | UI/control placement 与 click wiring 不在本 slice；命令 path 默认组合仍 deferred。 |

派生产物冲突：未发现本实现把 archive contract/audit/checklist 提升为产品事实。已知 Snapshot 路径的 PRD 优先级仍高于架构旧描述；本实现未触碰该路径，step3.integration 仍需按 PRD 收敛。

## 5. 副作用审查

允许副作用已限制在 child-region 和 scratch analysis boundary：

- `enterAnalysis` 生成 active scratch target 并委托 adapter `createOrStampWorkspace` / `scheduleScratchAnalysis`。
- `exitAnalysis` 通过 adapter 清理 workspace，并把 target 标记为 inactive。
- `refreshScratchAnalysis` 只调用 engine-facing `runBoardAnalysis`，并只通过 `deps.setState({editWorkspace: ...})` 写 analysis/ownership/pending。
- stale target 或 generation mismatch 时，update/final result 不写新的 workspace、global analysis、SGF tree 或 source facts。

未发现禁止副作用：没有 `window.sabaki`、repository/DB/IPC、documentStore、runtime store、overlay internals、direct WorkbenchMode writer、source-specific tab API、`SBKV`/`SBKS` 写入。

## 6. 测试质量审查

执行：

```text
npx mocha --require tsx test/analysis/workbenchAnalysisScratchRegion.test.ts
```

结果：10 passing。

测试质量结论：

- Tests import real `refreshScratchAnalysis`、real `createWorkbenchFlowService`、real `createWorkbenchStore` and the production scratch region module.
- SCR-T02/T03 assert target lifecycle, adapter payload target, upstream transition payload, and no WorkbenchTab mutation.
- SCR-T04/T05B assert stale update/final zero-write behavior through production `refreshScratchAnalysis` guard path.
- SCR-T06B asserts request metadata carries explicit `scratchTarget`.
- SCR-T07 uses real flow/store with injected production region; it does not mock `workbenchFlowService` or `workbenchStore.updateTab`.
- SCR-T08/T10 source scans cover forbidden globals, repository/persistent fact writes, direct mode writers, source-specific tab APIs, and global/SGF analysis writes.

Residual risks:

- Production default `ctx.createModeEffects()` composition is still deferred to step3, so focused tests prove the seam and owner, not full app default wiring.
- Rendered UI/projection and Snapshot-from-non-Analysis end-to-end command path remain deferred/out of this architecture slice.
- Full engine ownership migration beyond scratch request target metadata remains deferred.

## 7. 范围控制审查

PASS. Production changes are limited to:

- `src/modules/analysis/workbenchAnalysisScratchRegion.ts`
- `src/modules/analysis/scratchAnalysis.ts`
- `src/modules/analysis/analysisTypes.ts`
- `src/modules/analysis/index.ts`

The implementation did not modify `workbenchFlowService.ts`, default Sabaki composition, UI components, resolver policy, runtime companion region, overlay region, snapshot service, repository, or tests. No unrelated feature or new runtime mode was introduced.

## 8. 需要手动检查的文件或行

| 文件或行 | 原因 |
|---|---|
| `src/modules/analysis/workbenchAnalysisScratchRegion.ts:85-115` | Verify integration in step3 preserves child-region-only writes and stale-result rejection. |
| `src/modules/analysis/scratchAnalysis.ts:215-242` | Verify any later engine callback changes keep `scratchTarget` metadata on request/update/final paths. |
| `src/modules/analysis/scratchAnalysis.ts:298-310` | Verify later edits keep write-back editWorkspace-only. |
| `src/modules/training/workbench/workbenchFlowService.ts:643-720` | Step3 must compose scratch region through mode effects without moving scratch ownership into parent flow. |
| `src/modules/sabaki.js` default `createModeEffects` composition | Step3 must wrap legacy mode effects with scratch region adapter without restoring global lookup or direct mode repair. |

## 9. 建议操作

- Proceed to step3.integration.
- In step3, wire production default composition through the existing mode-effects seam and keep `workbenchFlowService.ts` as orchestration, not scratch-state owner.
- Add/keep integration coverage for default composition, Snapshot guard path, and UI projection only in their approved scopes.

## 10. Workbench 接线闭环追踪（如适用）

| 控件/命令 | Event | Container | Controller | Service/Store | Projection/UI | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Enter Analysis | deferred UI event | existing container path deferred | `workbenchFlowService.enterAnalysis` emits mode effect | injected `createWorkbenchAnalysisScratchRegion.enterAnalysis` creates target and delegates adapter | scratch projection after default composition deferred | PASS for owner/seam; full default wiring step3 |
| Return from Analysis | deferred UI event | existing container path deferred | `workbenchFlowService.returnFromAnalysis` emits exit effect | scratch region invalidates target and clears through adapter | previous mode projection after default composition deferred | PASS for owner/seam; full default wiring step3 |
| Scratch analysis refresh | scheduled by adapter/service | N/A | N/A | `refreshScratchAnalysis` sends `scratchTarget` and guards stale target/generation before editWorkspace write-back | Analysis panel consumes editWorkspace state downstream | PASS |
| Snapshot from non-Analysis | deferred UI event | deferred | deferred to step3 flow orchestration | must enter Analysis scratch/current before persistence | deferred | DEFERRED by approved contract |

## 11. 真源冲突清单（如适用）

| 冲突产物 | 冲突内容 | 统一真源 | 处理建议 |
| --- | --- | --- | --- |
| None in implementation diff | 本实现未引入与 product/architecture/ui_ux 真源冲突的新行为。 | `docs/product/` > `docs/architecture/` > `docs/ui_ux/` | 无需修复。 |
| Known deferred Snapshot ambiguity | 架构旧段落允许 any mode snapshot 直达新 tab；PRD 要求先进入 Analysis scratch/current。 | `docs/product/sabaki-training-prd.md:255-269`, `:562-574` | step3.integration 按 PRD 实现/验证，不由 step2.2 处理。 |

可以继续。
