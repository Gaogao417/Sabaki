# Sabaki Documentation Index

Welcome to the Sabaki/Gabaki developer documentation. This repository has been structured to separate product requirements, technical architecture, visual specifications, development guides, and historical archives.

## 1. Product Blueprints (PRDs)
*What we are building and why.*

- [Sabaki Training System PRD](product/sabaki-training-prd.md) — Unified training system core specification.
- [FoxWQ Game Import PRD](product/fox_game_import_prd.md) — Auto-import and recall of Fox WQ games.
- [101weiqi Error Sync PRD](product/101weiqi_error_sync_prd.md) — 101weiqi personal wrong-answer sets offline synchronization.

## 2. Technical Architecture
*How components, services, repositories, and state machines are wired together.*

- [Workbench Architecture Overview](architecture/workbench-architecture-overview.md) — Core architecture, directories, and dependencies.
- [Position Source and Mutation Contract](architecture/position-source-mutation-contract.md) — Multi-source position bindings, attempt loops, and recall flow contracts.
- [Sabaki Function Module Mapping](architecture/sabaki-function-module-mapping.md) — Mapping of legacy Sabaki components to new training modules.
- [Sabaki State Field Mapping](architecture/sabaki-state-field-mapping.md) — State synchronization contract between document store and runtime stores.
- [Training Context Index](architecture/training-context-index.md) — Module registries, lifecycle methods, and entry points.

## 3. UI/UX Visual Specifications
*Fidelity specs, responsive layouts, design tokens, and status feedback.*

- [Workbench UI/UX Spec](ui_ux/workbench-ui-ux-spec.md) — High-fidelity layout, keyboard accessibility, and component naming.
- [FoxWQ Game Import UI/UX Spec](ui_ux/fox_game_import_ui_ux.md) — Visual mockups and panel interactions for FoxWQ history search.
- [Global Header Status Spec](ui_ux/global_header_status_spec.md) — Global Header status indicators and persistent background sync Toast specs.
- [Visual Reference Gallery](ui_ux/workbench-ref-pics/) — Folder containing high-resolution visual layout benchmarks.

## 4. Development Guides & Conduct
*Coding standards, test expectations, and environment setup.*

- [Workbench Coding Conduct](guides/workbench-coding-conduct.md) — Clean code rules, boundaries, and pure visual component rules.
- [Workbench Test Writing Conduct](guides/workbench-test-writing-conduct.md) — Layered testing, fakes/spies specifications, and mock rules.
- [Workbench Phase 0 Behavior Baseline Tests](guides/workbench-phase0-behavior-baseline-tests.md) — Reference suite for state mutations and board events.
- [Building & Testing](guides/building-tests.md) — Dev server setup, packaging, and test runner configurations.
- [Debugging Guide](guides/debugging.md) — DevTools, sourcemaps, and process attachment workflows.

## 5. User Guides & Customization
- [Engines Config](guides/engines.md) — Connecting GTP engines (KataGo, Leela Zero, etc.).
- [Markdown Guide](guides/markdown.md) — Markdown syntax for game comments.
- [Theme Directory & Custom Textures](guides/theme-directory.md) — Board and stone texture folder structure.
- [Create Custom Themes](guides/create-themes.md) — Designing custom Go board textures.
- [Userstyle Tutorial](guides/userstyle-tutorial.md) — Overriding UI styles with CSS.
- [Engine Analysis Integration](guides/engine-analysis-integration.md) — Customizing KataGo live analysis overlays.

## 6. Archives & Historical Documents
*Deprecated versions, design spikes, and old progress reports.*

- [Daily Design Spike Log](archive/daily-design/) — Chronological archive of test-writing contracts by day.
- [Legacy PRD Versions](archive/prd-versions/) — Versioned PRD archive (v0.2 to v0.5).
- [Legacy Architecture Versions](archive/architecture-versions/) — Archived implementation plans.
- [Visual Refactor Screenshot Plan](archive/design-reports/design-report-ui-refactor-screenshot-plan.md)
- [Territory & Analysis UX spike](archive/design-reports/design-report-territory-analysis-ux.md)
- [Territory Overlay Spike](archive/design-reports/design-report-territory-overlay.md)
- [Management Hub Refactor Audit](archive/management_hub_refactor.md)
- [Management Hub Entrypoint Audit](archive/management_hub_entrypoint_audit.md)
- [Workbench Frontend Gaps Plan](archive/workbench-frontend-gap-and-plan.md)
- [Overlay Ownership Migration](archive/overlay-ownership-migration.md)
