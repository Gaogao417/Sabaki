# Territory, Compare, and Analysis Area UX

## Summary

Edit workspace has two board states: Current and Reference. The UI presents them
in two slots: a large editable board and a small sidebar preview board. Tab
swaps which board state is in the large slot. The large board is always the
active editing surface, regardless of whether it currently shows Current or
Reference.

## Interaction Contract

- The large board receives edit tools, player changes, territory status hover,
  analysis-area selection, and territory diff rendering.
- The small board is a read-only preview of the other board state. It can show
  pure territory, but it never shows territory diff and never handles editing,
  dragging, area selection, or hover status.
- Territory Compare is edit-only. It is available only after both board states
  exist.
- Territory diff is always computed as small board to large board. The large
  board shows how the active editable board differs from the preview board.
- Territory hover may update the status bar, but it must not write territory
  regions into board selection highlights.
- Analysis Area is a transient modifier-key function, not a visible mode.
  Its selected area owns board selection and drag-preview visuals. Territory
  paint should blend beneath it instead of hiding it.

## Shortcuts

- `T`: Toggle Territory.
- `Shift+T`: Toggle Territory Compare in edit workspace.
- `Ctrl`/`Command` + hover/click/drag: Preview and add an Analysis Area box.
- Overlapping Analysis Area boxes cancel their shared points.
- `Alt` + click: Remove the most recent Analysis Area box containing that point.
- `Alt` + right click: Clear all Analysis Area boxes.
- `R`: Copy the large board state into the small board state.
- `Tab`: Swap Current and Reference between the large and small board slots.
- `Esc`: Exit the active tool or overlay using the existing priority order.

## Implementation Notes

- `editWorkspace.activeTab` means "which board state is in the large slot".
- Editing APIs should continue to operate on `activeTab`.
- Diff inputs should be derived from slot position, not board names:
  `delta = ownership(large) - ownership(small)`.
- Capture Reference should keep its existing command name for compatibility, but
  its UX meaning is "copy large board to small board".
- The sidebar preview belongs in the right graph column, not as a floating layer
  over the large board.

## Acceptance Criteria

- Swapping with `Tab` changes which board edits affect.
- Capturing with `R` overwrites the small board with the current large board.
- Territory Compare renders diff only on the large board.
- The small board remains pure territory and pointer-passive.
- Area selection remains visible while Territory is enabled and the pointer
  moves across territory regions.
