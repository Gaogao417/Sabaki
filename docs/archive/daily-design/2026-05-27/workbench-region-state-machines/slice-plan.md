# Workbench Region State Machines Slice Plan

Date: 2026-05-27
Workflow: business-contract-workflow
Planner: phase-intake-slice-planner
Status: slice-plan

## Source Truth Refs

| Ref | Role |
| --- | --- |
| `AGENTS.md` | Active repository-level guardrails, including Workbench state-machine implementation principles. |
| `docs/design/workbench-mode-orchestration-contract.md` | Highest-priority source of truth for Workbench mode, companion state, transition effects, and ownership boundaries. |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | Implementation clarification for parent Workbench mode state machine and child region state machines. |
| `src/modules/training/workbench/modeTransitions.ts` | Current pure transition policy. |
| `src/modules/training/workbench/workbenchFlowService.ts` | Current concrete mode transition and companion-sync orchestration entry. |
| `src/modules/training/workbench/modeStateResolver.ts` | Current read-only projection / invariant diagnostics helper. |
| `src/modules/overlays/overlayStore.ts` | Current overlay owner and territory/compare guard implementation. |

## Current State / Remaining Gaps

- `modeTransitions.ts` already covers core mode events as pure policy, but returned effects are still conceptual strings.
- `workbenchFlowService` is the practical mode transition entry for submit, enter/return analysis, recall completion, and snapshot guard.
- `ModeEnterEffect` / `ModeExitEffect` exist for analysis workspace enter/exit, currently as legacy Sabaki effect ports.
- `modeStateResolver` can diagnose illegal companion state, but production flow does not yet use it as a preflight/postflight invariant checker.
- Overlay state is guarded in `overlayStore`, but mode transition orchestration does not call an explicit overlay child-region transition owner.
- Full parent + child region migration is oversized and should be split.

## Out Of Scope

- No new Workbench runtime mode.
- No rewrite of board resolver or focused executors.
- No persistence schema changes.
- No broad engine ownership migration in the first slice.
- No automatic repair of persistent domain facts such as Attempt, RecallSession, Task, SGF tree, comments, or review schedule.
- No frontend visual redesign.

## Step List

| Step | Do | Mode | Depends on | Can run with | Locks / owner | Next role |
| --- | --- | --- | --- | --- | --- | --- |
| step1 | Design and implement the first child-region vertical slice: overlay region transition boundary for Workbench mode enter/exit, with outcome tests proving non-analysis modes clear territory/compare and late/pending overlay state is not revived. | serial | none | none | `src/modules/overlays/*`, `src/modules/training/workbench/workbenchFlowService.ts`, overlay tests | contract-designer |
| step2.1 | Runtime companion region slice: route problem/recall/checkpoint transient cleanup through a runtime-region owner instead of scattered `runtimeStore.setX` calls. | parallel-ready | step1 | step2.2, step2.3 | `src/modules/training/store/trainingRuntimeStore.ts`, `src/modules/training/workbench/*runtime*`, flow tests | contract-designer |
| step2.2 | Analysis scratch region slice: wrap existing `ModeEnterEffect` / `ModeExitEffect` with explicit scratch-region target/generation semantics and stale-result tests. | parallel-ready | step1 | step2.1, step2.3 | `src/modules/analysis/*`, `src/modules/training/workbench/workbenchFlowService.ts`, scratch tests | contract-designer |
| step2.3 | Transition invariant diagnostics slice: add preflight/postflight `modeStateResolver` consumption in flow service as diagnostics/reject policy, not writer/repair logic. | parallel-ready | step1 | step2.1, step2.2 | `modeStateResolver.ts`, `workbenchFlowService.ts`, diagnostics tests | contract-designer |
| step3 | Integrate runtime/scratch/diagnostics slices, resolve shared `workbenchFlowService` edits, and run full focused regression set. | serial | step2.1, step2.2, step2.3 | none | `workbenchFlowService.ts`, integration tests | implementation-agent |
| step4 | Architecture review of parent/child-region boundary, remaining legacy seams, and evidence ledger update. | serial | step3 | none | docs + review only | architecture-reviewer |

## Step Size Notes

- The full migration is `SPLIT_REQUIRED`; it mixes overlay, runtime, analysis scratch, engine, resolver diagnostics, and service orchestration.
- `step1` is intentionally the first complete vertical slice because overlay has an existing owner (`overlayStore`), concrete mode-dependent transient state, and clear outcome assertions.
- `step2.1` and `step2.2` can run in parallel after `step1` only if their contracts keep write scopes disjoint. Both may need a later `step3` integration due to `workbenchFlowService` shared wiring.
- `step2.3` must not turn `modeStateResolver` into a writer; it may only reject, warn, or log diagnostics.

## Shared Locks / Integrators

| Scope | Lock Rule |
| --- | --- |
| `src/modules/training/workbench/workbenchFlowService.ts` | Shared integration point. Parallel branches must not merge competing edits directly; use a serial integrator step. |
| `src/modules/overlays/*` | Owned by step1 for the first slice. Other branches should not modify overlay internals until step1 lands. |
| `src/modules/training/store/trainingRuntimeStore.ts` | Owned by step2.1. |
| `src/modules/analysis/*` | Owned by step2.2. |
| `modeStateResolver.ts` | Owned by step2.3. |

## Gate Ledger Seed

| Gate | Required Evidence | Exit Condition |
| --- | --- | --- |
| Contract source alignment | AGENTS, mode orchestration contract, implementation notes, current overlayStore and flowService evidence | No conflict between parent mode ownership and child overlay owner. |
| Contract audit | Approved step1 contract before tests | Contract distinguishes diagnostics, repair, and transient cleanup. |
| Test-first | Focused overlay region / flow service outcome tests fail before implementation or are marked existing-green with a justified regression guard | Tests prove final overlay state, not just setter calls. |
| Test audit | Approved tests before production edits | No mocked flow service for state-forward path; no callback-only fake green. |
| Implementation | Overlay child region transition API or adapter lands behind owner boundary | Flow service calls owner API; overlayStore remains owner of overlay state. |
| Verification | Focused tests plus existing mode/overlay regressions | `modeTransitions`, `modeStateResolver`, `workbenchFlowService`, and overlay tests pass. |
| Architecture review | Review after stable diff | No child region mutates WorkbenchMode; no persistent fact auto-repair. |

