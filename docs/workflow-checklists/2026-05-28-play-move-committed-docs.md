# PlayMoveCommitted Docs Checklist

## Task

Document the Play Mode move-commit architecture from the recent discussion, then sync the accepted boundary into the current architecture and PRD documents.

## Steps

- [x] Step 1: Create the standalone PlayMoveCommitted architecture design document with diagrams.
- [x] Step 2: Sync the design into the current architecture and PRD documents.
- [ ] Step 3: Verify the changed documentation and record completion.

## Notes

- Keep `overlayRegion` out of Play/Problem move commit fan-out. Territory/compare/analysis overlays are Analysis-mode display concerns and mode-transition cleanup concerns.
- Keep `aiMoveService` as the AI turn policy/request orchestration owner; do not introduce a separate thin `AiTurnScheduler` unless it gains non-trivial ownership later.
- Treat Attempt, monitor, analysis scheduling, and AI reply as subscribers/side effects of a successful Play move commit, not as the core legality/write path.
