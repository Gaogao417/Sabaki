# 测试审计

## 1. 结论

APPROVED

retry v0.3 修复了 v0.2 审计的两个阻塞点：S2R-T04 现在在 Container subscription-triggered `forceUpdate` 期间捕获 `this.render().props`，并要求出现 active Recall surface；S2R-T09 现在把 `snapshotService` 加入 scoped `workbenchFlowService.submit` body guard。当前 5 个 RED 都是 contract v0.2 期望的有效红灯，指向真实 submit 尚未 hydrate active recall projection，而不是 callback-only、mock-only 或 reverse-contract 绿灯。

Targeted command:

```text
npx mocha --require tsx test/training/workbenchFlowService.test.js test/workbench/wiring/submit-to-recall-projection.test.js
=> 81 passing, 5 failing
```

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `docs/workflow-checklists/2026-05-26-submit-to-recall-projection.md` | workflow checklist | 否 | step4 当前 gate；本 artifact 不修改 checklist。 |
| `docs/archive/daily-design/2026-05-26/submit-to-recall-projection/test-contract-v0.2.md` | approved contract | 否 | S2R source rows/test IDs 的真源。 |
| `docs/archive/daily-design/2026-05-26/submit-to-recall-projection/contract-audit-v0.2.md` | approved contract audit | 否 | contract 已批准进入 test-writer。 |
| `docs/archive/daily-design/2026-05-26/submit-to-recall-projection/test-audit-v0.2.md` | prior test audit | 否 | 本轮 retry 标准：修 S2R-T04/S2R-T09。 |
| `test/training/workbenchFlowService.test.js` | service transition/hydration test | 是 | S2R-T03 使用真实 flow/attempt/recall services、真实 stores、typed in-memory repository fake。 |
| `test/workbench/wiring/submit-to-recall-projection.test.js` | Workbench wiring/projection/rendered/boundary tests | 是 | S2R-T01/T02/T04/T05/T06/T07/T08/T09。 |
| `test/training/phase3TypedFakes.ts` | typed repository helper | 是 | `createPhase3StrictRecallRepository` 绑定 `TrainingRepository` subset。 |
| `test/workbench/shared/workbenchSpyFactories.ts` | shared typed spy helpers | 是 | S2R-T02 仅用 `createSpyFlowService`; state-forward tests 不 mock flow service。 |
| `src/components/TrainingWorkbenchContainer.js` | production reference | 是 | 验证 real subscription、handler signature、runtime/workbench projection。 |
| `src/components/WorkbenchShell.js`, `src/components/workbench/shell/ModeActions.js`, `src/components/workbench/panels/ProblemModePanel.js`, `src/components/workbench/panels/RecallModePanel.js` | production reference | 是 | 验证 visible callbacks and rendered Recall panel selection。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | production reference | 是 | 验证 current RED 缺口：submit 只设置 active id，未 hydrate `recallView`。 |

## 3. 阻塞问题

无。

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `test/workbench/wiring/submit-to-recall-projection.test.js:307` S2R-T04 | 已修复 prior blocker | `forceUpdate` wrapper 在订阅驱动更新期间捕获 props，并在 `:326-334` 要求 `mode='recall'`, `state='active'`, `recallSession.active === true`, `totalMoves === attempt.userLine.length`。只改 mode 或只计数无法绿。 | 无。 |
| `test/workbench/wiring/submit-to-recall-projection.test.js:393` S2R-T09 | 已修复 prior blocker | `:416-423` scoped 提取 `workbenchFlowService.submit` body，并禁止 `snapshotService`、source-specific open APIs、`origin.provider`/`source_kind`/`sourceKind`/`source.kind`。 | 无。 |
| `test/workbench/wiring/submit-to-recall-projection.test.js:382` S2R-T07 | 非阻塞残余风险 | Guard 扫描 wiring suite，人工审计确认 S2R service test 没有 success-path `setRecallView`、forced `mode:'recall'` 或 props override；若未来新增 helper，仍需同样审查。 | implementation 后保持人工/静态 review。 |
| `test/workbench/wiring/submit-to-recall-projection.test.js:368` S2R-T08 | RED 合法 | 它先要求真实 submit 创建 active projection，再构造 mismatch fixture；`updateTab(activeRecallSessionId)` 是负向 stale fixture，不是 success-path 手动造绿。 | 无。 |
| `test/training/workbenchFlowService.test.js:99` legacy submit tests | 非 in-scope 弱旧测试 | 旧测试未 await `service.submit`; 不计入 S2R-T03/S2R-T05 coverage。S2R-T03 在 `:153-223` 已用真实 async submit 覆盖本 contract。 | 不阻塞本 gate；后续清理旧测试可单独处理。 |

必查 grep 结论：

| Pattern | 命中 | 审计结论 |
| --- | --- | --- |
| `assert.ok(true`, `assert(true`, `TODO`, `GAP`, `current behavior`, `current implementation`, `passthrough`, `when implemented`, `not yet implemented`, `.skip(` in S2R tests | 无 in-scope 命中 | 未发现 placeholder pass、逆向契约测试或核心 skip。 |
| `if (!` | `phase3TypedFakes.ts` typed helper guards; `workbenchFlowService.test.js:1222` legacy infer fallback | 非 S2R success-path 静默通过；不影响本 contract。 |
| `Contract:` | `submit-to-recall-projection.test.js:4`; legacy phase1 comment at `workbenchFlowService.test.js:936` | 注释引用契约，非风险。 |
| `function createSpy.*Service` / `const createSpy.*Service` / `as any` | shared factory hits | S2R state-forward tests不用这些 mock；S2R-T02 使用 `createSpyFlowService`，其 `:82-155` 用 `satisfies SpyWorkbenchFlowService` 绑定生产接口。 |

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| PRD §5.2 Workbench runtime mode fixed set | Submit 后进入四 mode 中的 `recall`，不新增 runtime mode | S2R-T03 `test/training/workbenchFlowService.test.js:153`; S2R-T05 `test/workbench/wiring/submit-to-recall-projection.test.js:337` | covered | T03/T05 使用真实 submit；当前 RED 不是 mode，而是 active surface。 |
| Architecture §0.4 `play/problem + submit + activeAttempt && !frozen` | freeze attempt、create RecallSession、`mode='recall'`、`recallSubstate='normal'` | S2R-T03 `test/training/workbenchFlowService.test.js:153-223` | covered | 真实 flow/attempt/recall services 与 typed repository fake；failure 在 `runtime.recallView` hydration。 |
| Architecture §9.4 submit command chain | visible/container submit 到 service/repository/store/runtime active id | S2R-T01/T02 `submit-to-recall-projection.test.js:271-305`; S2R-T03 `workbenchFlowService.test.js:153-223`; S2R-T04 `submit-to-recall-projection.test.js:307-334` | covered | UI callback/delegation 不声称 state-forward；state-forward 由真实 service test 覆盖。 |
| UI/UX top actions + left panel | Problem submit controls exist; submit 后左侧切到 active Recall panel | S2R-T01 `:271`; S2R-T06 `:356-365` | covered | T06 rendered Shell/RecallModePanel 当前 RED，证明 empty UI 尚未修复。 |
| Service/runtime projection seam | Submit hydrate transient active `runtimeStore.recallView` with matching ids | S2R-T03 `workbenchFlowService.test.js:207-222`; S2R-T05 `submit-to-recall-projection.test.js:342-353`; S2R-T08 `:371-379` | covered | 当前 RED meaningful：service 未 hydrate `recallView`。 |
| Store subscription/projection return | real submit 后 Container subscription-driven update observes active Recall props | S2R-T04 `submit-to-recall-projection.test.js:307-334` | covered | v0.2 blocker 已修：不再只断言 `forceUpdateCount` / mode。 |
| Rendered Recall UI return | Shell selects real RecallModePanel and shows active progress, not empty state | S2R-T06 `submit-to-recall-projection.test.js:356-365` | covered | 渲染真实 `WorkbenchShell`/`RecallModePanel`，不是 props-only fake green。 |
| Fake-green exclusions | No success-path `setRecallView`, forced recall mode, or props override | S2R-T07 `submit-to-recall-projection.test.js:382-390` + manual grep | covered | 未发现手动 asserted-state mutation；negative stale mismatch fixture allowed by contract。 |
| Source-specific / presentational boundary | No source-specific submit path, snapshot submit orchestration, or UI direct service/store/repository dependency | S2R-T09 `submit-to-recall-projection.test.js:393-433` | covered | `snapshotService` 已加入 scoped submit guard；presentational files guard仍在。 |
| Play top end visible path | Deferred Play end-to-recall UI path | S2R-FU-PLAY-END | deferred-with-approved-reason | Contract v0.2 lines 191, 295 include reason and exit condition。 |
| Legacy App mount gate | Full App `sabaki.state.mode` gate migration | S2R-FU-APP-GATE / S2R-M02 | deferred-with-approved-reason | Contract v0.2 lines 192, 296 include reason and exit condition。 |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | 会失败 | S2R imports real Container/Shell/services/stores at `submit-to-recall-projection.test.js:23-34` and `workbenchFlowService.test.js:3-15`; in-scope tests no skip。 |
| 被测 handler 改成 noop 时，测试会失败吗？ | 会失败 | S2R-T02 expects `flowService.calls.submit` with active tab id at `submit-to-recall-projection.test.js:294-305`; T05/T06 depend on real submit outcome。 |
| Container 不传关键 props 时，测试会失败吗？ | 会失败 | S2R-T05 asserts `mode/state/currentMove/totalMoves/progress/recallSession.active` at `:347-353`; S2R-T06 asserts rendered active progress at `:361-365`。 |
| resolver 忽略 mode/context 时，测试会失败吗？ | 不适用 | Contract path is Container -> service; no resolver subject。 |
| executor/service 写错 store 或漏写 store 时，测试会失败吗？ | 会失败 | S2R-T03 checks tab/runtime active ids and `recallView`; S2R-T04/T05/T06 check subscription/projection/rendered return。 |
| store 更新后 UI projection 不变时，测试会失败吗？ | 会失败 | S2R-T04 requires subscription-captured active props; S2R-T05/T06 require final projected/rendered active Recall surface。 |
| 当前未完成实现是否导致目标 contract 测试红灯？ | 是 | Targeted run has 5 failures: missing `runtime.recallView`, S2R-T04 active surface not observed, S2R-T05 state `empty` vs `active`, S2R-T06 empty text still rendered, S2R-T08 active-projection precondition fails。 |

## 7. 结论与后续

Tests are valid RED tests for contract v0.2. No callback-only fake green, wrong-layer state-forward mock, reverse-contract assertion, success-path manual state mutation, or missing `snapshotService` guard remains in the audited S2R surface.

Proceed to implementation with these tests as the gate. Keep S2R-T07/T09 boundary guards under review if implementation introduces new helper files or aliases around forbidden dependencies.
