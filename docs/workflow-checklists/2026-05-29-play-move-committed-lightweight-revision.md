# PlayMoveCommitted Lightweight Revision Checklist

## Task

Revise the PlayMoveCommitted documentation so it describes a lightweight post-`documentStore.playMove` commit point, not a mandatory formal domain event type or event bus.

## Steps

- [x] Step 1: Revise the standalone PlayMoveCommitted design document. commit: pending
- [ ] Step 2: Sync the lightweight wording into architecture and PRD.
- [ ] Step 3: Verify documentation consistency.

## Notes

- `PlayMoveCommitted` is a conceptual lifecycle point / hook name.
- It should not imply a persisted event, event bus, or large required TypeScript type.
- The practical implementation can be `documentStore.playMove(...)` followed by `afterPlayMoveCommitted(...)`.
