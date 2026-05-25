# Sabaki — Codex 仓库上下文

本文件是 Codex 的仓库级 bootstrap、workflow 路由和硬边界入口。`.claude` 和 `CLAUDE.md` 暂时保留作为历史来源；新任务优先遵守本文件、`.codex/hooks.json` 和 `.codex/skills/`。

## Workflow 入口

任何 Sabaki 业务、状态、架构、Workbench 接线、测试、前端视觉或 workflow 任务，主代理第一步必须按本节选择一个 workflow skill。不得只读 `AGENTS.md` 后直接进入某个角色。

Workflow 选择：

- `$business-contract-workflow` — 业务行为、状态流、resolver/store/service 边界、副作用、核心交互契约、架构敏感实现。
- `$workbench-wiring-workflow` — 已完成视觉的 Workbench UI 接线到 training domain state/service/controller/store。
- `$frontend-visual-workflow` — UI/CSS/layout/design-token/responsive/screenshot/Figma/spec fidelity 和纯视觉偏差。

如果任务混合行为和视觉，先按业务或 Workbench 接线 workflow 处理状态/行为，再按前端视觉 workflow 处理可见表面。

## Role 类型

Workflow skill 负责 step 调度、上下游字段和并行条件。角色全部作为主代理或明确分派的 worker skill 执行；不要要求不存在的独立审查代理。

- **Workflow / planning skills**：`business-contract-workflow`、`workbench-wiring-workflow`、`frontend-visual-workflow`、`phase-intake-slice-planner`。
- **Execution / review skills**：`test-writer`、`implementation-agent`、`frontend-design-source-reader`、`visual-test-writer`、`frontend-implementation-agent`。必要的 contract、audit、review 作为当前 workflow 下的普通步骤完成，不作为强制门禁。

模型策略只允许 `gpt-5.5`，reasoning 只允许 `medium` / `high` / `xhigh`：

- workflow skill / 路由：`medium`
- 执行/读取 skill：`high`
- 深度审查：`xhigh`（仅在任务明确需要时使用）

## Workflow Planning

任何 Phase / implementation-plan / Partial / cleanup / gaps 请求，先读对应 workflow skill，并用 Phase Intake / Slice Planner 产出可执行 step 计划。

Phase Intake / Slice Planner 的产物必须是 step 计划，而不是一个总包。串行步骤用 `step1..stepN`，并行步骤用 `step2.1..step2.N`。至少列出：

```text
Step | Do | Mode | Depends on | Can run with | Locks / owner | Next role
```

主代理必须按 step 计划调度后续 workflow：同一 dotted step 组（如 `step2.1..2.N`）且写入/测试范围不冲突的步骤可以并行；共享写入文件必须指定一个 serial integrator step。除非 planner 明确标记步骤不可拆，否则不得把多个 ready steps 合并成一个 umbrella step。

开始编辑前，主代理只需要说明当前 `workflow`、`step`、写入范围和验证命令。归档、draft、pending-confirmation 或 superseded contract 只能作为背景资料，不能覆盖当前 product / architecture 真源。

`AGENTS.md` 只保留仓库级路由、角色类型、模型档位和硬边界。需要调整具体步骤、上下游字段、切片规则、审查规则或视觉/Workbench 流程细节时，修改对应 workflow skill。

## 项目概要

Sabaki 是一个围棋/SGF 编辑器，基于 Electron + React 架构。

- `src/main.js` — Electron 主进程入口
- `src/modules/sabaki.js` — 核心状态管理（类似 store）
- `src/modules/` — 业务逻辑模块（enginesyncer, gametree, territory 等）
- `src/components/` — React UI 组件
- `src/modules/overlays/` — 解析器/执行器层

## 架构边界

- **resolver 不直接修改状态** — 只做意图解析，交给 executor
- **store（sabaki.js）不调用 engine/UI** — 只管理状态
- **component 不直接修改 core store** — 必须通过 resolver/executor
- **禁止 `window.sabaki` 全局查找**，除非明确允许
- **problem 不是 board mode** — 它是独立的交互模式
- **play/recall/analysis 是 tab phase**，不是 mode
- **recall/analysis 不能修改 game tree**（只读操作）

## 常用命令

- `npm test` — 跑测试
- `npm start` — 启动开发
- `npm run build` — 构建
