# Sabaki — Claude Code 项目上下文

## 项目概要

Sabaki 是一个围棋/SGF 编辑器，基于 Electron + React 架构。
- `src/main.js` — Electron 主进程入口
- `src/modules/sabaki.js` — 核心状态管理（类似 store）
- `src/modules/` — 业务逻辑模块（enginesyncer, gametree, territory 等）
- `src/components/` — React UI 组件
- `src/modules/overlays/` — 解析器/执行器层

## 架构边界（不可违反）

- **resolver 不直接修改状态** — 只做意图解析，交给 executor
- **store（sabaki.js）不调用 engine/UI** — 只管理状态
- **component 不直接修改 core store** — 必须通过 resolver/executor
- **禁止 `window.sabaki` 全局查找**，除非明确允许
- **problem 不是 board mode** — 它是独立的交互模式
- **play/recall/analysis 是 tab phase**，不是 mode
- **recall/analysis 不能修改 game tree**（只读操作）

## 必须遵守的工作流

对于业务、状态、架构边界类功能开发，**禁止直接实施**。一口气委托完以下 agent 链，中途不停等确认：

1. **澄清需求** — 委托 `contract-designer` agent 生成测试/验收契约。主 agent 禁止自行编写契约。
2. **契约审查** — 委托 `contract-auditor` agent 审查契约。返回 REQUEST_CHANGES 或 BLOCK 时必须修改契约后重审，不得跳过。
3. **写测试** — 委托 `test-writer` agent 写测试代码，禁止绑定实现细节，写契约测试。主 agent 禁止自行编写测试。
4. **测试审查** — 委托 `test-auditor` agent 审查测试。返回 REQUEST_CHANGES 或 BLOCK 时必须修改测试后重审，不得跳过。
5. **提交测试** — 单独提交初版测试（commit message 标注为测试契约）
6. **实施** — 委托 `implementation-agent` agent 按 ticket 范围实施。主 agent 禁止自行编写生产代码。
7. **跑测试** — 确保通过
8. **提交实现** — 单独提交实现代码
9. **架构审查** — 委托 `architecture-reviewer` agent 审 diff

**主 agent 在工作流中只做编排（按顺序调用 sub-agent）和提交，不做执行（不写契约、不写测试、不写实现代码）。** 违反此约束等同于绕过质量闸门。

### 前端视觉工作流（不可用通用业务契约流程替代）

当任务涉及 UI、CSS、布局、设计 token、响应式、截图验收、Figma/截图还原、纯样式偏差修复时，必须使用前端视觉工作流：

1. **读取视觉真源** — 委托 `frontend-design-source-reader` agent 读取 UI/UX spec、截图、设计稿、现有 CSS/组件，输出视觉真源索引。主 agent 禁止自行读取视觉源。
2. **生成视觉契约** — 委托 `frontend-contract-designer` agent 生成前端视觉契约，归档到 `docs/design/YYYY-MM-DD/<task>/frontend-visual-contract-v0.N.md`。主 agent 禁止自行编写视觉契约。
3. **写视觉测试** — 委托 `visual-test-writer` agent 编写静态 token、computed style、Playwright layout、截图和人工验收测试。主 agent 禁止自行编写视觉测试。
4. **前端实施** — 委托 `frontend-implementation-agent` agent 实施 UI/CSS/组件，并运行相关测试和浏览器截图验收。主 agent 禁止自行编写 CSS/组件代码。
5. **视觉还原审查** — 委托 `visual-fidelity-reviewer` agent 审查 spec 对齐、token、响应式、截图和弱测试风险。

前端视觉任务要对齐的是用户实际看到的 UI，不是组件是否存在、class 是否存在、`data-testid` 是否存在或 callback 是否触发。

### Workbench 接线工作流（不可用前端视觉流程替代）

当任务涉及”已画好的 workbench UI 接入真实训练业务”时，必须使用 Workbench Wiring Workflow：

0. **真源优先** — 必须先读 `docs/product/sabaki-training-prd.md`、`docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` 和 `docs/architecture/gabaki-sabaki-training-implementation-plan.md`。它们是产品、架构与迁移执行真源；`docs/ui_ux/workbench-ui-ux-spec.md` 只提供 UI/control placement；所有 W0 inventory、completion plan、test contract 都是派生产物。
1. **接线契约** — 委托 `contract-designer` agent 明确 `UI event -> container callback -> controller command -> service/adapter/repository -> store/Sabaki state -> projection -> UI` 全链路，并引用 PRD/Architecture v0.5 证据。契约必须指定每个 handler 被哪个命名 UI 组件消费。主 agent 禁止自行编写接线契约。
2. **契约审查** — 委托 `contract-auditor` agent 审查契约。返回 REQUEST_CHANGES 或 BLOCK 时必须修改契约后重审，不得跳过。
3. **接线测试** — 委托 `test-writer` agent 编写 container/controller/store/projection 测试，必须覆盖状态前进和状态回流，不能只测 callback 被调用。每个非 deferred handler 必须有测试证明命名 UI 组件消费它。主 agent 禁止自行编写接线测试。
4. **测试审查** — 委托 `test-auditor` agent 审查测试。返回 REQUEST_CHANGES 或 BLOCK 时必须修改测试后重审，不得跳过。
5. **提交测试** — 单独提交测试契约。
6. **接线实施** — 委托 `implementation-agent` agent 实施最小接线，panel 仍保持 presentational，依赖只通过 container/controller/context/adapter 进入。主 agent 禁止自行编写接线代码。
7. **跑测试和手动点击** — 验证 store/service 状态变化会通过订阅回到 UI。
8. **提交实现** — 单独提交实现。
9. **架构审查** — 委托 `architecture-reviewer` agent 检查直接 service import、重复状态、store 副作用、隐藏全局和弱测试。

Workbench 接线任务要证明控件真的驱动业务状态，业务状态也真的驱动 UI；不是证明页面好看，也不是证明按钮能触发一个 mock callback。

若任何派生产物与 PRD/Architecture v0.5 冲突，派生产物作废并重写；不得在冲突产物上继续写测试或实施。

### 提交要求（不可跳过）

- 测试和实现必须分两次提交
- 先提交测试，再提交实现
- **每个 Phase 完成后必须单独提交**（含该 Phase 的测试 + 实现，共两次提交）
- Phase 顺序：4 → 5 → 6 → 7，不得跨 Phase 混合提交

## 测试规范

- 优先写契约测试（测行为/状态流），不写调用顺序测试
- 大量 mock 的测试标记为脆弱
- 保护架构边界的测试优先级最高

## 代码注释规范

- 当前项目中的新增代码注释使用中文，除非是在引用外部 API、协议字段、错误原文或已有英文术语。

## 前端视觉测试规范

前端视觉测试不得只证明结构存在。以下只能作为辅助测试，不能作为主验收：

- 组件存在
- `data-testid` 存在
- class 字符串存在
- 按钮数量正确
- callback 触发
- CSS 中出现某个 media query 字符串

前端主验收应优先覆盖：

- shell 行列、grid 宽度、棋盘最小尺寸、gap、padding
- toolbar、bottom bar、drawer、card 的高度、圆角、阴影、分组
- spec token 名称和值，禁止 JS 硬编码模式色
- 中文文案精确匹配
- hover / active / disabled / empty / loading / success / error 状态
- 指定 viewport 的响应式折叠和截图验收

前端视觉工作流说明见 `.claude/workflows/frontend-visual-workflow.md`。
Workbench 接线工作流说明见 `.claude/workflows/workbench-wiring-workflow.md`。

## 常用命令

- `npm test` — 跑测试
- `npm start` — 启动开发
- `npm run build` — 构建
