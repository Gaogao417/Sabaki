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

对于功能开发，**禁止直接实施**。一口气跑完以下流程，中途不停等确认：

1. **澄清需求** — 用 contract-designer 生成测试/验收契约
2. **写测试** — 用 test-writer 写测试代码，禁止绑定实现细节，写契约测试
3. **提交测试** — 单独提交初版测试（commit message 标注为测试契约）
4. **implementation-agent 实施** — 按 ticket 范围实施
5. **跑测试** — 确保通过
6. **提交实现** — 单独提交实现代码
7. **architecture-reviewer 审 diff** — 检查架构边界

### 提交要求（不可跳过）

- 测试和实现必须分两次提交
- 先提交测试，再提交实现
- **每个 Phase 完成后必须单独提交**（含该 Phase 的测试 + 实现，共两次提交）
- Phase 顺序：4 → 5 → 6 → 7，不得跨 Phase 混合提交

## 测试规范

- 优先写契约测试（测行为/状态流），不写调用顺序测试
- 大量 mock 的测试标记为脆弱
- 保护架构边界的测试优先级最高

## codex-ui-ux-frontend 分支指导思想

本分支专注于 **Workbench UI 纯前端实施**，遵循以下原则：

1. **纯前端先行** — 只搭建控件结构和交互骨架，留 prop callback 接口，不做数据绑定、不对接 store、不写业务逻辑。
2. **接口用注释说明意图** — 每个 callback prop 用 JSDoc `@callback` 注释说明预期的调用时机和参数语义，方便后续接线时理解。
3. **四模式颜色** — Play=蓝 `#2563ff`、Problem=琥珀 `#d97706`、Recall=绿 `#169b55`、Analysis=紫 `#7c3aed`。
4. **棋盘占位** — MainBoardStage 保持占位符，Goban 集成属于后续阶段。
5. **参考文档** — 控件与交互缺失分析 + 实施计划见 `docs/design/workbench-frontend-gap-and-plan.md`。

## 常用命令

- `npm test` — 跑测试
- `npm start` — 启动开发
- `npm run build` — 构建
