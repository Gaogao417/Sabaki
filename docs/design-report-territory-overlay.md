# Territory Overlay Boundary Refactor

## Summary

Territory should remain an overlay on top of the main Goban, but
territory-specific rendering and hover behavior should not stay scattered across
`App`, `MainView`, `Goban`, and `sabaki`. This refactor introduces a dedicated
`TerritoryOverlay` component that owns territory presentation and local
interaction state while keeping `Goban` generic and leaving global overlay
selection in `sabaki`.

## Design

- Keep territory as an overlay on the existing board instead of creating a
  second board implementation or a separate territory window.
- Move territory presentation logic behind a single component boundary:
  `TerritoryOverlay`.
- Keep `src/modules/territory.js` as the pure computation layer for ownership
  classification, summaries, paint maps, marker maps, and region grouping.
- Let `App` pass only raw ownership data and availability state for territory
  mode.
- Let `MainView` choose between rendering plain `Goban` or `TerritoryOverlay`.
- Keep compare overlay behavior unchanged in this pass.

## Component Responsibilities

### `TerritoryOverlay`

- Accept `ownership`, `unavailableReason`, and a generic `gobanProps` object.
- Store `hoveredVertex` locally.
- Derive:
  - `paintMap`
  - `markerMap`
  - `territorySummary`
  - `territoryRegions`
  - `hoveredRegion`
- Render:
  - `Goban` with territory overlay props
  - `OverlayStatusBar`

### `Goban`

- Stay a generic board view.
- Keep generic mouse event forwarding so wrappers can react to vertex hover.
- Stop exposing a territory-specific mode prop.
- Accept a generic `className` prop so wrappers can opt into territory styling.

### `sabaki`

- Keep persisted global `overlayMode`.
- Stop storing territory hover state globally.
- Remove territory-hover cleanup logic from navigation and analysis transitions.

## Interface Changes

- `Goban` gains optional `className`.
- `MainView` stops receiving precomputed territory render props and instead
  uses:
  - `overlayMode`
  - `territoryOwnership`
  - `overlayUnavailableReason`
- New `TerritoryOverlay` props:
  - `ownership`
  - `unavailableReason`
  - `gobanProps`

## Validation

- Territory overlay still paints ownership and neutral markers on the board.
- Hovering a territory region highlights its full region and updates the status
  bar.
- Turning overlay off clears only global overlay mode, not component-local hover
  state.
- Compare overlay behavior remains unchanged.
