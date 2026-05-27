# Architecture Review: Workbench Parent / Child Region State Machines

Date: 2026-05-27
Role: architecture-reviewer
Reviewed commit: `2a66e5ac implementation-agent: integrate workbench regions`

## Verdict: REQUEST_CHANGES

Step3 integrates overlay/runtime/scratch/diagnostics into the parent `workbenchFlowService`, but the production diagnostics provider in `src/modules/sabaki.js` does not provide the domain facts that `modeStateResolver` now treats as required invariants. As a result, real production `submit` paths can throw `WorkbenchModeInvariantError` after or before state changes even though the underlying parent/child-region transition is otherwise valid.

This blocks approving the slice. Fix the production diagnostics input shape, or relax/retarget the resolver invariants to fields actually supplied by the active production projection, then add happy-path integration coverage that uses the production-style `getModeStateInput`.

## Findings

### High: production diagnostics input rejects valid Workbench transitions

`src/modules/sabaki.js:1043-1051` wires `getModeStateInput` to:

- `tab: workbenchStore.getState().tabs.find(...)`
- `runtime: runtimeStore.getState()`
- `overlay: overlayStore.getState()`
- `sabaki.state/editWorkspace`

But `modeStateResolver` requires fields that `trainingRuntimeStore` does not own:

- `modeStateResolver.ts:244-250` rejects `problem` when `runtime.activeAttemptId == null || runtime.attempt == null`.
- `modeStateResolver.ts:256-261` rejects `recall` when `runtime.activeRecallSessionId == null || runtime.recallView == null`, and separately when `runtime.sourceAttempt == null`.
- `trainingRuntimeStore.ts:47-72` has `activeAttemptId`, `activeRecallSessionId`, views and transient cache, but no `attempt` or `sourceAttempt` object.

The failure is not theoretical. A production-shaped harness with real `workbenchStore`, real `trainingRuntimeStore`, and the step3 `getModeStateInput` shape produces:

```text
play submit -> WorkbenchModeInvariantError invalid-after-commit ["missing-frozen-source-attempt"]
problem submit -> WorkbenchModeInvariantError reject ["missing-problem-attempt"]
```

This violates the true-source behavior that `play/problem --submit--> recall` freezes/finalizes the Attempt, creates Recall, and enters `mode=recall` (`docs/product/sabaki-training-prd.md:237-250`; `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:135-148`, `:727-775`).

The postflight case is especially risky: `workbenchFlowService.ts:655-662` updates the tab to recall and activates the runtime region before calling postflight diagnostics. The exception then reports invalid-after-commit without repair, leaving a committed state while surfacing command failure. That is acceptable only when the postflight snapshot is accurate. Here the invalid state is caused by an incomplete diagnostics projection.

Required change:

- Either enrich `getModeStateInput` with the actual active `attempt` / frozen `sourceAttempt` from the repository/service projection, or change `modeStateResolver` illegal checks to use only authoritative runtime/tab facts available in this production snapshot.
- Add flow tests for valid `play -> recall` and `problem -> recall` with production-style `getModeStateInput`; they must assert no invariant error, final tab/runtime projection, and no domain fact auto-repair.

### Medium: step3 tests prove illegal diagnostics handling, but miss production happy-path diagnostics

`test/training/workbenchFlowService.test.js:1402-1480` covers:

- illegal preflight overlay state rejects before submit writes;
- illegal postflight analysis state surfaces `invalid-after-commit` without repair.

That is useful, but it does not cover a legal transition with the production `src/modules/sabaki.js:1043-1051` snapshot provider. `npx mocha --require tsx test/training/workbenchFlowService.test.js` still passes 100 tests, so current automation can pass while the real production diagnostics provider rejects normal submit flows.

Required change:

- Add at least one production-shaped diagnostics happy path for submit and one for enter/return Analysis, using the same fields production supplies or a shared provider factory.

### Medium: evidence ledger is stale for step3 commit

The checklist still says `step3.integration ... commit: pending` at `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md:40`, while the reviewed integration commit is `2a66e5ac`. This weakens the gate ledger for step4 because the slice evidence chain does not point to the stable implementation commit being reviewed.

Required change:

- Update the checklist ledger to record `commit: 2a66e5ac` for step3 before rerunning step4.

## Residual Risks

- `completeRecall` does not currently run preflight/postflight diagnostics, even though it transitions recall to analysis and invokes runtime/overlay/scratch effects (`workbenchFlowService.ts:890-947`). If intentional, document the deferral; otherwise cover it with the same diagnostics policy.
- `createSabakiModeEffects` is now scratch-region-backed and stamps `scratchTarget`, but it still relies on legacy `sabaki.setMode` as the adapter (`workbenchFlowService.ts:201-270`). This remains acceptable only as an adapter seam; it should not become the source of Workbench mode truth.
- Some runtime writes remain in `workbenchFlowService` for problem abandon and recall hint/skip (`workbenchFlowService.ts:693-715`, `:957-1019`). These appear outside the current integration scope, but future child-region cleanup should continue moving transient runtime ownership behind owner APIs.

## Evidence Checked

- `git diff --stat` / `git diff`: no tracked working-tree diff before this review artifact; unrelated untracked `.harness-build/` ignored.
- `git show --stat --name-only 2a66e5ac`: step3 touched checklist, `src/modules/sabaki.js`, `modeStateResolver.ts`, `workbenchFlowService.ts`, and `test/training/workbenchFlowService.test.js`.
- True source:
  - `AGENTS.md`
  - `docs/product/sabaki-training-prd.md:237-269`, `:562-574`, `:591-614`
  - `docs/architecture/training-context-index.md:40-55`
  - `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:112-158`, `:727-775`
  - `docs/architecture/gabaki-sabaki-training-implementation-plan.md:70-90`, `:112-124`
- Requested design/evidence docs:
  - `docs/design/workbench-mode-orchestration-contract.md`
  - `docs/design/workbench-mode-state-machine-implementation-notes.md`
  - `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md`
  - overlay/runtime/scratch/diagnostics contracts, audits, and architecture reviews under the slice archive.
- Production files:
  - `src/modules/training/workbench/workbenchFlowService.ts`
  - `src/modules/training/workbench/modeStateResolver.ts`
  - `src/modules/sabaki.js`
  - `src/modules/training/workbench/workbenchRuntimeRegion.ts`
  - `src/modules/analysis/workbenchAnalysisScratchRegion.ts`
  - `src/modules/overlays/workbenchOverlayRegion.ts`
  - `src/modules/training/store/trainingRuntimeStore.ts`
- Test files:
  - `test/training/workbenchFlowService.test.js`
  - related mode resolver/runtime/scratch/overlay evidence from prior approved gates.
- Commands run:
  - `npx mocha --require tsx test/training/workbenchFlowService.test.js` -> 100 passing.
  - Production-shaped repro for `play -> recall` diagnostics -> `WorkbenchModeInvariantError invalid-after-commit ["missing-frozen-source-attempt"]`.
  - Production-shaped repro for `problem -> recall` diagnostics -> `WorkbenchModeInvariantError reject ["missing-problem-attempt"]`.

## Boundary Review

| Boundary | Status | Evidence | Concern |
|---|---|---|---|
| Parent WorkbenchMode ownership | PASS_WITH_BLOCKING_INTEGRATION_BUG | Mode writes remain in `workbenchFlowService.updateTab` paths (`workbenchFlowService.ts:611-662`, `:738-843`, `:920-947`). | Diagnostics provider can reject valid parent transitions due incomplete projection. |
| Overlay child region | PASS | `workbenchOverlayRegion.ts:36-54` only delegates to `overlayStore.onModeChange`; flow sends transition intent. | No new upward mode writer. |
| Runtime child region | PASS_WITH_NOTES | `workbenchRuntimeRegion.ts:20-35` owns recall activation/completion/checkpoint transient cleanup. | Some runtime transient writes remain in flow for non-step3 paths. |
| Scratch child region | PASS | `workbenchAnalysisScratchRegion.ts:41-117` owns target/generation; `createSabakiModeEffects` composes it as mode effects. | Legacy Sabaki remains adapter seam. |
| Diagnostics consumption | REQUEST_CHANGES | `workbenchFlowService.ts:295-345` consumes resolver as reject/invalid-after-commit only; resolver remains read-only. | Production snapshot shape is incomplete for resolver illegal rules. |
| Persistent domain facts | PASS | No step3 code auto-repairs Attempt/RecallSession/Task/SGF tree. | The problem is false invalid diagnostics, not unauthorized repair. |

## Suggested Actions

1. Fix production diagnostics projection or resolver illegal rules so legal submit/recall states are representable without false invalids.
2. Add production-shaped legal-transition diagnostics tests for `submit`, `enterAnalysis`, and `returnFromAnalysis`.
3. Update the checklist ledger to record `step3.integration` commit `2a66e5ac`.
4. Re-run focused regression set and repeat step4 architecture review.

请先审查标注的风险后再继续。
