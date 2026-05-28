# Library Filter UI Design Archive

Archived final v3 preview states for the front-end-only library drawer redesign.

## Kifu Library

- `kifu-default.png` - default kifu library view.
- `kifu-sort.png` - sort menu.
- `kifu-players.png` - black/white player filter.
- `kifu-date.png` - date range calendar filter.
- `kifu-rule.png` - rule chip filter.
- `kifu-time.png` - time-control chip filter.

## Problem Library

- `problem-default.png` - default problem library view.
- `problem-sort.png` - sort menu.
- `problem-query.png` - QID/description text search.
- `problem-date.png` - wrong-date calendar filter.
- `problem-difficulty.png` - difficulty range filter.
- `problem-type.png` - problem-type chip filter.

## Design Notes

- Keep the left rail as selected-item detail with a slightly larger goban.
- Keep the right side as a high-density scrollable goban grid.
- Right-side tiles should stay lightweight: kifu tiles show players plus date/result; problem tiles show type/QID plus difficulty/description.
- Each filter control opens exactly one focused popover; do not merge unrelated filters into one popover.
- This archive is visual reference only. Implementation should stay front-end-only unless a later task explicitly asks for container/service wiring.
