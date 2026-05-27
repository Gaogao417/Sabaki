# 架构审查

## 1. 结论

REQUEST_CHANGES

实现中的 `workbenchOverlayRegion` adapter 本身边界清楚，`workbenchFlowService` 中的调用点也基本放在成功 tab mode patch 之后；但生产训练上下文没有把该 child-region 注入到真实 `flowService`。因此当前通过的测试只证明“手动注入 overlayRegion 的 service 实例”行为正确，不能证明真实 Workbench command path 已经从 legacy `sabaki.setMode` overlay 副作用迁到 overlay child-region。

## 2. 严重阻塞问题

1. **真实生产 `flowService` 没有注入 overlay child-region，WorkBench 闭环不成立。**

   证据：
   - `src/modules/sabaki.js:1025-1036` 创建 `createWorkbenchFlowService({...})` 时没有传入 `overlayRegion`。
   - `src/modules/sabaki.js:1059` 只暴露 `createModeEffects: () => createSabakiModeEffects(this)`。
   - `src/components/TrainingWorkbenchContainer.js:1005-1012` 在运行时给同一个 `flowService` 安装 legacy `modeEffects`。
   - `src/modules/sabaki.js:550-563` 的 legacy `setMode()` 仍直接调用 `getOverlayStore().onModeChange(mode)`，并在进入 `analysis` 时自动 `setTerritoryEnabled(true)`。

   影响：
   - `test/training/workbenchFlowService.test.js:1178-1180`、`:1218-1220`、`:1271-1273` 是手动注入 `overlayRegion` 的 harness；这不覆盖真实 `sabaki.getTrainingContext().flowService`。
   - 真实 UI 事件路径仍可能是 `Container -> flowService -> modeEffects -> sabaki.setMode -> overlayStore`，不是目标的 `Container -> flowService -> overlay child-region -> overlayStore`。
   - `OVR-T09` 的“不自动开启 territory/compare”只在未安装 `createSabakiModeEffects` 的测试 service 中成立；真实 Workbench path 仍可能被 `sabaki.setMode('analysis')` 重新点亮 territory。

   阻塞修复：
   - 在生产 composition root 中创建 `createWorkbenchOverlayRegion({overlayStore: this.getOverlayStore(), logger})`，并传入 `createWorkbenchFlowService({overlayRegion, ...})`。
   - 增加一条生产装配/训练上下文测试，证明真实 `getTrainingContext().flowService` 的 mode transition 会走 production overlay region，而不是只靠测试手动注入。
   - 确保 Workbench flow 下的 Analysis enter 不通过 legacy mode effect 自动开启 territory/compare；如果暂时保留 legacy seam，需要用测试明确隔离“workspace setup”和“overlay default”职责，避免 overlay default 继续由 `sabaki.setMode` 承担。

## 3. 架构边界审查

| 边界 | 状态 | 证据 | 关注点 |
|---|---|---|---|
| `workbenchOverlayRegion` child-region adapter | 通过 | `src/modules/overlays/workbenchOverlayRegion.ts:1-54` 只有 type import、`overlayStore.onModeChange()` 和 logger | Adapter 未引入 Workbench writer、repository、UI、engine、global Sabaki |
| `workbenchFlowService` -> overlay region | 部分通过 | `enterAnalysis`/`returnFromAnalysis`/`completeRecall`/`restartAttempt` 在 tab update 后通知，见 `workbenchFlowService.ts:638-656`, `:707-725`, `:808-825`, `:926-943` | 调用点正确，但真实 production deps 未注入 |
| Rejected transition atomicity | 通过 | `returnFromAnalysis` 在无 `analysisReturnTarget` 时于 `workbenchFlowService.ts:681-694` 先 throw；测试 `workbenchFlowService.test.js:1303-1328` 断言未通知、未清 overlay | 覆盖了主要失败路径；后续可补 overlayRegion throw 隔离策略 |
| ModeEffects ordering | 有阻塞风险 | Flow 先 overlay notify，再 modeEffects；但真实 `createSabakiModeEffects` 会调用 legacy `sabaki.setMode` | 实际路径可能仍由 legacy setMode 清理/开启 overlay |
| 范围控制 | 通过 | implementation commit 只改 `workbenchOverlayRegion.ts`、`workbenchFlowService.ts` | 未扩大到 UI/container/projection/runtime/scratch/engine/snapshot/resolver |

## 4. 状态和事实来源审查

真源证据：
- PRD 固定四个 Workbench mode：`docs/product/sabaki-training-prd.md:235-269`。
- PRD 要求 Snapshot 先进入 Analysis scratch/current source：`docs/product/sabaki-training-prd.md:560-574`。
- Architecture 要求 UI/Container/Service/Store 边界清晰，Service 编排业务动作，Store 不调 Service：`docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:89-116`。
- Architecture 定义 `workbenchFlowService` 负责 mode transition，`enterAnalysis` 保存 return target，`returnFromAnalysis` 只能用保存过的 target，非法转换必须 throw/reject：`docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:727-802`。
- Architecture 定义 `overlayStore` 是显示层 overlay 状态，不承载训练业务：`docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:412-430`。

实现没有新增第五个 mode，也没有把 problem/checkpoint/review 当成 board mode。阻塞点是“事实来源/状态所有权的实际装配”：child-region 作为 owner/adapter 存在，但真实 flow service 没有拿到该 owner，因此单一 overlay transition owner 尚未在生产闭环中成立。

## 5. 副作用审查

新增 adapter 没有引入 DB、IPC、engine、repository、snapshot、UI 或 `window.sabaki` 副作用。`workbenchFlowService` 也没有直接操作 overlay internals，只调用 `overlayRegion?.onWorkbenchModeTransition(...)`。

阻塞副作用仍来自未拆开的 legacy path：`sabaki.setMode()` 继续做 overlay cleanup 和 Analysis territory auto-enable。只要真实 Workbench path 仍通过 `createSabakiModeEffects -> sabaki.setMode` 承担 overlay 行为，本 step 的 overlay child-region 所有权就没有真正落地。

## 6. 测试质量审查

测试质量总体比 callback-only 强：
- `test/overlays/overlayStore.test.js` 使用真实 `createOverlayStore`，覆盖 subscriber/notify 和 late async generation。
- `test/overlays/workbenchOverlayRegionBoundary.test.js:15-100` 扫描 adapter/store 的 forbidden imports 和 parent writer API。
- `test/training/workbenchFlowService.test.js:1160-1330` 使用真实 `createWorkbenchFlowService`、真实 `workbenchStore`、真实 `overlayStore`、production adapter decorator，并断言最终 tab/overlay state。

未覆盖的关键风险：
- 没有测试真实 production composition root 是否向 `createWorkbenchFlowService` 注入 overlayRegion。
- 没有测试安装 `createSabakiModeEffects` 后，Workbench `enterAnalysis` 是否仍会通过 legacy `sabaki.setMode('analysis')` 自动开启 territory。

因此当前测试会在生产装配缺失时仍然通过，属于本次架构 review 发现的 fake-green gap。

## 7. 范围控制审查

实现没有改 UI/container/projection、runtime/scratch/engine/snapshot/resolver diagnostics，符合 step1 的小切片边界。修复阻塞问题时也应保持最小范围：只补生产装配和必要测试，不借机改 scratch lifecycle、runtime cleanup、engine target 或视觉状态。

## 8. 需要手动检查的文件或行

- `src/modules/sabaki.js:1025-1036`：真实 `createWorkbenchFlowService` deps。
- `src/modules/sabaki.js:550-563`：legacy `setMode()` 的 overlay cleanup / auto-enable side effect。
- `src/components/TrainingWorkbenchContainer.js:1005-1012`：runtime 安装 `createSabakiModeEffects`。
- `src/modules/training/workbench/workbenchFlowService.ts:647-656`, `:716-725`, `:816-825`, `:934-943`：overlayRegion 通知点。
- `test/training/workbenchFlowService.test.js:1174-1330`：当前只覆盖手动注入 overlayRegion 的 service 实例。

## 9. 建议操作

1. 在 `src/modules/sabaki.js` 的 training context 装配中创建并注入 production `overlayRegion`。
2. 补一条装配级测试，证明真实 training context 的 `flowService` 有 overlayRegion 行为。
3. 对 `createSabakiModeEffects` 与 `sabaki.setMode('analysis')` 的 territory auto-enable 做隔离：Workbench v0.5 flow 不应把 overlay default 交给 legacy mode effect。
4. 修复后重跑已给出的 168-test 命令，并追加新装配测试命令。

## 10. Workbench 接线闭环追踪（如适用）

| 控件/命令 | Event | Container | Controller | Service/Store | Projection/UI | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Mode segmented -> Analysis | `ModeBar.onModeChange('analysis')` | `TrainingWorkbenchContainer.handleModeChange` 调 `flowService.enterAnalysis` | 当前无独立 controller | 测试中：`flowService -> workbenchStore -> overlayRegion -> overlayStore`；生产中：`flowService` 未注入 overlayRegion，后续 `modeEffects -> sabaki.setMode` 仍承担 overlay 副作用 | overlay props 由现有 store/projection 读取 | REQUEST_CHANGES |
| Return from Analysis | Return action / previous mode segment | `handleModeChange` 或 return handler 调 `flowService.returnFromAnalysis` | 当前无独立 controller | 测试中闭环成立；生产中 overlay cleanup 仍可能依赖 legacy `sabaki.setMode('play')` | overlay flags 最终可能清理，但 owner path 不符合 step1 目标 | REQUEST_CHANGES |
| Restart attempt from Analysis | Restart command | Container 调 `flowService.restartAttempt` | 当前无独立 controller | 测试中通过 injected region 清 overlay；生产中未证明 injected region 存在 | 未触碰 projection | REQUEST_CHANGES |

## 11. 真源冲突清单（如适用）

| 冲突产物 | 冲突内容 | 统一真源 | 处理建议 |
| --- | --- | --- | --- |
| 当前 implementation 装配 | Adapter/port 已实现，但真实 `flowService` 未注入 overlay child-region，生产路径仍依赖 legacy `sabaki.setMode` overlay 副作用 | Architecture 0.3/5.3：Service 编排 mode transition；overlayStore 只拥有显示层状态；mode guard/effect 不散落在 UI/legacy callback | 注入 production overlayRegion，并把 legacy mode effect 的 overlay default 隔离出去 |
| 当前测试覆盖 | 手动注入 overlayRegion 的 service 测试通过，但未覆盖 production training context | Architecture command path 与 Workbench wiring 闭环要求 | 增加装配级测试，避免 fake green |

修复阻塞问题前不要继续。
