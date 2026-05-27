# 架构审查

Date: 2026-05-27
Role: architecture-reviewer retry
Reviewed implementation commit: `2761140c implementation-agent: fix production diagnostics projection`
Ledger follow-up checked: `881e2b82 workflow: record step3 retry commit`
Previous review: `architecture-review-v0.1.md`

## 1. 结论

Verdict: APPROVED

上一版 REQUEST_CHANGES 的 High finding 已解决。`modeStateResolver` 不再把 production `trainingRuntimeStore` 不拥有的 `runtime.attempt` / `runtime.sourceAttempt` 完整对象当作合法状态前提；现在使用 `runtime` / `tab` 快照里的 active/source attempt id binding，并在缺少完整对象时只投影 `{id}` ref。合法 `play submit`、`problem submit`、`enterAnalysis` 和 `returnFromAnalysis` 已由 production-shaped tests 覆盖，且本次本地复跑通过。

## 2. 严重阻塞问题

无。

### Findings

High: none.

Medium: none.

Low / residual note: `sourceAttemptId()` 允许从 `tab.activeAttemptId` 得到 Recall/Analysis source binding。按当前真源与 production submit 形状，这是可接受的：`WorkbenchTab` 拥有 active id，`trainingRuntimeStore` 只拥有 transient view，不应复制完整 Attempt domain object。但该投影只能证明存在 source id binding，不能证明该 id 对应的持久 Attempt 已冻结或与 RecallSession repository fact 完全一致；这属于 resolver 不读 repository 的预期限制，不阻塞本 slice。

## 3. 架构边界审查

| 边界 | 状态 | 证据 | 关注点 |
|---|---|---|---|
| Parent WorkbenchMode ownership | PASS | `workbenchFlowService.ts:295-345` 只消费 resolver diagnostics；`submit` 在 `:611-662` 经 service 编排 freeze/create recall/runtime region/update tab；`enter/return analysis` 在 `:801-848` 做 pre/postflight。 | `completeRecall` 仍未走 diagnostics，保留为后续风险。 |
| Runtime child region | PASS | `workbenchRuntimeRegion.ts:21-35` owns recall activation/completion/checkpoint transient cleanup。 | 非本 retry 范围的 hint/skip 仍有 runtime setter。 |
| Scratch child region | PASS | `workbenchAnalysisScratchRegion.ts:85-115` owns target/generation/stale guard/write-back adapter. | Legacy Sabaki mode effect remains adapter seam. |
| Overlay child region | PASS | `workbenchOverlayRegion.ts:40-52` delegates to overlayStore on mode transition; no upward mode writer. | 无新风险。 |
| Diagnostics resolver | PASS | `modeStateResolver.ts:66-133`, `:245-311` only derives projection/diagnostics from snapshots; search found no store/repository/service/window imports or setters. | Projection is id-level where production snapshot has no object. |
| Persistent domain facts | PASS | Retry did not add repository/service writes to resolver and did not auto-repair Attempt/RecallSession/Task/SGF. | Frozen status is enforced by submit services, not resolver projection. |

## 4. 状态和事实来源审查

真源证据：

- PRD defines only four user-visible Workbench modes and distinguishes `Problem` entity from `WorkbenchMode.problem`; `TrainingAttempt` is the core fact and is frozen after submit (`docs/product/sabaki-training-prd.md:235-253`).
- PRD requires Snapshot from Play/Problem/Recall to first project into Analysis scratch/current, and Analysis edit bar must not rewrite source `TrainingAttempt.userLine` (`docs/product/sabaki-training-prd.md:255-269`, `:562-614`).
- Architecture requires mode transitions to converge in a testable state machine; `play/problem --submit--> recall` freezes Attempt and creates Recall; `enterAnalysis` saves return target; `returnFromAnalysis` restores previous mode/substate/tree/move index; illegal transitions reject and log (`docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:112-158`, `:727-797`).
- Architecture command path is UI -> container/controller -> service -> store/repository/adapter, with submit going through `workbenchFlowService.submit`, `attemptService.freezeAttempt`, `recallService.createRecallFromAttempt`, and `workbenchStore.updateTab({mode:'recall'})` (`docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:180-199`).
- Architecture says mode transition must go through `workbenchFlowService` / later `workbenchModeService`, while Task / Attempt / RecallSession updates are owned by their services and cannot bypass guards (`docs/architecture/training-context-index.md:42-52`).
- Architecture overview assigns WorkbenchTab/mode/active ids to workbenchStore, recall/problem/attempt runtime projection to training, scratch lifecycle to analysis, and overlay state to overlays (`docs/architecture/workbench-architecture-overview.md:273-300`, `:385-407`, `:474-484`).

No conflict found between retry implementation and true-source product/architecture docs. The retry correctly avoids promoting the previous derived review's object-shaped runtime assumption into source truth.

## 5. 副作用审查

`modeStateResolver` remains side-effect free. It has no direct store/repository/service/engine/overlay/document/global import or call surface, and the test source scan covers those patterns (`test/training/modeStateResolver.test.js:830-860`).

`workbenchFlowService` still owns orchestration side effects, which is the intended layer for this slice. Diagnostics consumption rejects preflight illegal states and surfaces invalid-after-commit postflight states without repair (`workbenchFlowService.ts:295-345`). Runtime cleanup is delegated to `runtimeRegion.onRecallActivated` after recall creation (`workbenchFlowService.ts:617-662`), and scratch/overlay effects are delegated through child regions on analysis enter/return.

No new DB/IPC/engine/window global side effect was introduced in the retry diff.

## 6. 测试质量审查

PASS.

Retry tests execute production modules, not copied logic:

- `test/training/modeStateResolver.test.js:418-440` proves problem/recall projections remain legal with production runtime-store shape lacking attempt objects and only id bindings.
- `test/training/modeStateResolver.test.js:619-654` keeps illegal coverage for missing problem active attempt and missing recall source binding.
- `test/training/workbenchFlowService.test.js:1429-1612` covers production-shaped `play submit`, `problem submit`, and `enterAnalysis` / `returnFromAnalysis` through real `createWorkbenchFlowService`, real stores, and a provider shaped like `src/modules/sabaki.js:1043-1052`.
- The tests assert final tab/runtime/projection outcomes, not just callback counts.

Commands run:

- `npx mocha --require tsx test/training/modeStateResolver.test.js test/training/workbenchFlowService.test.js` -> 132 passing.
- `npx mocha --require tsx test/overlays/overlayStore.test.js test/overlays/workbenchOverlayRegionBoundary.test.js test/analysis/workbenchAnalysisScratchRegion.test.ts test/analysis/analysisAreaStore.test.js test/training/workbenchRuntimeRegion.test.ts test/training/workbenchFlowService.test.js test/training/recallService.test.js test/training/modeTransitions.test.js test/training/modeStateResolver.test.js` -> 286 passing.

## 7. 范围控制审查

PASS. Retry is narrowly scoped to:

- Retargeting diagnostics projection/invariants from object-shaped `runtime.attempt/sourceAttempt` to id bindings actually present in production snapshots.
- Adding production-shaped happy-path diagnostics tests.
- Updating ledger evidence for the retry.

It does not add new modes, new runtime state, repository facts, UI behavior, or service responsibilities.

## 8. 需要手动检查的文件或行

- `src/modules/training/workbench/modeStateResolver.ts:66-133`, `:245-311`
- `src/modules/training/workbench/workbenchFlowService.ts:295-345`, `:611-662`, `:801-848`
- `src/modules/sabaki.js:1043-1052`
- `test/training/modeStateResolver.test.js:418-440`, `:619-654`, `:830-860`
- `test/training/workbenchFlowService.test.js:1429-1612`
- `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md:40-105`

## 9. 建议操作

可以继续。

Keep the residual risks below visible for later slices, but they do not block step4.

## 10. Workbench 接线闭环追踪（如适用）

| 控件/命令 | Event | Container | Controller | Service/Store | Projection/UI | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Submit from play | `submit` | Existing container/service entry | `workbenchFlowService.submit` | freeze/finalize Attempt, create Recall, update tab, activate runtime region | production-shaped diagnostics sees recall tab + recall runtime without requiring Attempt object | PASS |
| Submit from problem | `submit` | Existing container/service entry | `workbenchFlowService.submit` | `problemFlowService.submitActiveProblem`, create Recall, clear problemView via runtime region | production-shaped diagnostics sees recall tab + recall runtime without `sourceAttempt` object | PASS |
| Enter Analysis | `enterAnalysis` | Existing container/service entry | `workbenchFlowService.enterAnalysis` | update tab, notify overlay region, scratch mode effect creates current snapshot | postflight diagnostics requires scratch/current and passes in production-shaped test | PASS |
| Return from Analysis | `returnFromAnalysis` | Existing container/service entry | `workbenchFlowService.returnFromAnalysis` | restore saved return target, notify overlay/scratch exit | postflight diagnostics allows restored play projection and inactive scratch target | PASS |

## 11. 真源冲突清单（如适用）

| 冲突产物 | 冲突内容 | 统一真源 | 处理建议 |
| --- | --- | --- | --- |
| None | None | `docs/product/`, `docs/architecture/`, `docs/ui_ux/` | None |

## Residual risks

- `completeRecall` still does not run preflight/postflight diagnostics, even though it transitions Recall to Analysis and invokes runtime/overlay/scratch effects. This was already noted in v0.1 and remains a future hardening item.
- `enterRecall(input: {attemptId})` can create Recall without updating `tab.activeAttemptId`; because production `mapRecallSessionToRecallView()` does not include `attemptId`, future diagnostics coverage for this command should either preserve an id binding on tab/runtime or include source attempt id in recall projection.
- Resolver projections with `{id}` refs intentionally do not validate repository facts such as frozen status. Persistent facts must remain enforced by `attemptService` / `recallService` and repository contract tests.
- `sabaki.js` remains a migration facade and production composition point; this is acceptable for the current slice but should not regain domain ownership.

## Evidence checked

- `git diff --stat` / `git diff`: no tracked working-tree diff before this review artifact; unrelated untracked `.harness-build/` ignored.
- `git show --stat --name-only 2761140c` and patch for step3 retry implementation.
- `git show --stat --patch 881e2b82` for retry commit ledger correction.
- Previous REQUEST_CHANGES review: `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/architecture-review-v0.1.md`.
- Checklist/evidence ledger: `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md`; it records step3 retry commit `2761140c`, previous REQUEST_CHANGES, retry verification commands, and focused regression result (`:40`, `:98-105`).
- True source docs under `docs/product/`, `docs/architecture/`, and `docs/ui_ux/` were listed; source conclusions came from the product and architecture files cited above.
- Production files read: `modeStateResolver.ts`, `workbenchFlowService.ts`, `src/modules/sabaki.js`, `trainingRuntimeStore.ts`, `workbenchRuntimeRegion.ts`, `workbenchAnalysisScratchRegion.ts`, `workbenchOverlayRegion.ts`.
- Test files read: `test/training/modeStateResolver.test.js`, `test/training/workbenchFlowService.test.js`.
- Risk searches run for `window.sabaki`, `getTrainingContext`, direct store writes/imports, store DB/engine calls, `origin.provider`, `source`, snapshot/open tab APIs, `runtimeStore.`, `workbenchStore.`, `sourceAttempt`, and diagnostics rejection paths.

可以继续。
