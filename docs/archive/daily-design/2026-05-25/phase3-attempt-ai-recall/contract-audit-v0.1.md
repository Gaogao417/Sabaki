Date: 2026-05-25
Role: contract-auditor
Status: APPROVE_WITH_NOTES
Subject: test-contract-v0.2.md

# Phase 3 Contract Audit v0.1

## Verdict

`test-contract-v0.2.md` is approved for Phase 3 implementation and testing. It repairs the earlier draft's biggest risks by separating stale AI request cases, requiring typed production-bound doubles, narrowing submit-order claims to the actual orchestration layer, and explicitly deferring board/documentStore write coverage.

## Evidence Checked

- PRD and architecture source alignment is listed in contract section 0.
- Scope includes the required Phase 3 facts: `AiMovePending`, stale guard, frozen Attempt guard, Recall no source Attempt mutation, submit order, and Problem undo rollback.
- The test matrix covers P3-T01 through P3-T08 with concrete production subjects and mock-binding constraints.
- Deferred coverage is explicit for board command/documentStore writes, legacy tree rollback, and UI pending/interruption controls.

## Notes

- The expected AI flow mentions `problemArea` validation, while the stale matrix focuses on request id, active tab, active attempt, mode, and position hash. This is acceptable for the current slice because fresh in-area behavior is covered by P3-T02 and board/write behavior is deferred, but a later controller/wiring contract should cover task/problemArea changes while an AI request is pending.
- The historical implementation plan mentions submit transaction semantics. The v0.2 contract intentionally narrows P3-T08 to ordering and frozen-guard compatibility; transaction behavior remains outside this slice unless a follow-up contract reintroduces it.
