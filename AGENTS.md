# Sabaki — Codex 仓库上下文

本文件是 Codex 的仓库级 bootstrap、workflow 路由和硬边界入口。`.claude` 和 `CLAUDE.md` 暂时保留作为历史来源；新任务优先遵守本文件、`.codex/hooks.json` 和 `.codex/skills/` / `.codex/agents/`。

## Workflow 入口

任何 Sabaki 业务、状态、架构、Workbench 接线、测试、前端视觉或 workflow 任务，主代理第一步必须按本节选择一个 workflow skill。不得只读 `AGENTS.md` 后直接进入某个角色。

Workflow 选择：

- `$business-contract-workflow` — 业务行为、状态流、resolver/store/service 边界、副作用、核心交互契约、架构敏感实现。
- `$workbench-wiring-workflow` — 已完成视觉的 Workbench UI 接线到 training domain state/service/controller/store。
- `$frontend-visual-workflow` — UI/CSS/layout/design-token/responsive/screenshot/Figma/spec fidelity 和纯视觉偏差。

如果任务混合行为和视觉，先按业务或 Workbench 接线 workflow 处理状态/行为，再按前端视觉 workflow 处理可见表面。

## Role 类型

Workflow skill 负责 step 调度、上下游字段、gate ledger 和并行条件。角色分两类：

- **Agents（独立 gate）**：`contract-designer`、`frontend-contract-designer`、`contract-auditor`、`test-auditor`、`architecture-reviewer`、`visual-fidelity-reviewer`。这些必须用 `.codex/agents/*.toml`，并作为独立子代理执行，除非当前 Codex 工具策略阻止 spawn。
- **Skills（执行/读取角色）**：`phase-intake-slice-planner`、`test-writer`、`implementation-agent`、`frontend-design-source-reader`、`visual-test-writer`、`frontend-implementation-agent`。这些由主代理或明确分派的 worker 执行，必须先处在当前 workflow skill 下。

模型策略只允许 `gpt-5.5`，reasoning 只允许 `medium` / `high` / `xhigh`：

- workflow skill / 路由：`medium`
- 执行/读取 skill：`high`
- contract / audit / review agents：`xhigh`

## Workflow Hard Stop

任何 Phase / implementation-plan / Partial / cleanup / gaps 请求，读完对应 workflow skill
和完成 Phase Intake / Slice Planner 仍不代表可以编辑测试或生产代码。

Phase Intake / Slice Planner 的产物必须是 step 计划，而不是一个总包 gate。串行步骤用 `step1..stepN`，并行步骤用 `step2.1..step2.N`。至少列出：

```text
Step | Do | Mode | Depends on | Can run with | Locks / owner | Next role
```

主代理必须按 step 计划调度后续 workflow：同一 dotted step 组（如 `step2.1..2.N`）且写入/测试范围不冲突的步骤应并行走对应 gate；共享写入文件必须指定一个 serial integrator step。除非 planner 明确标记步骤不可拆，否则不得把多个 ready steps 合并成一个 umbrella contract。

主代理在第一次文件编辑前必须按当前 workflow skill 输出或维护 gate ledger，并确认：

```text
Edit gate check:
workflow = ...
step = ...
contract = APPROVED / missing
contract audit = APPROVED / missing
tests = written / missing
test audit = APPROVED / missing
implementation allowed = yes/no
```

只有 `implementation allowed = yes` 时才允许编辑生产代码；只有当前角色是
`test-writer` 且前置 contract gate 已通过时才允许编辑测试代码。归档、draft、
pending-confirmation 或 superseded contract 只能作为背景资料，不能解锁实现。

如果当前 workflow 要求的独立 gate agent 因当前 Codex 工具策略不能 spawn，
主代理必须在编辑前暂停并请求用户明确授权对应 gate agents；不得自行本地审查、
自行批准或跳过这些 gate。

`AGENTS.md` 只保留仓库级路由、角色类型、模型档位和硬边界。需要调整具体步骤、上下游字段、切片规则、审查规则或视觉/Workbench 流程细节时，修改对应 workflow skill；需要调整独立 gate 提示词时，修改 `.codex/agents/*.toml`。

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
