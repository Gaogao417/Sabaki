# Graph Event Status

## Current State

This branch contains working changes for engine detection, engine error handling,
left sidebar console rendering, and local artifact ignore rules.

Graph click handling is not included in the partial commit for now.

## Observed Behavior

- The graph renders correctly.
- The layout-related graph visibility change is working.
- The renderer test `game graph click works without prior mouse movement`
  is still failing.
- Directly dispatching a `click` event on `#graph .node:not(.current)` does
  not change `window.__sabaki.state.treePosition` in the current app state.

## Scope Decision

The following graph-related files are intentionally kept out of the partial
commit until the event chain is understood end-to-end:

- `src/components/sidebars/GameGraph.js`
- `src/components/Sidebar.js`
- `e2e/renderer.spec.js`

## Reproduction

1. Load `test/sgf/beginner_game.sgf`
2. Open the sidebar graph
3. Click a non-current graph node, or dispatch a synthetic click on it
4. Observe that `treePosition` does not change

## Likely Investigation Areas

- Whether SVG node events are bound and forwarded as expected in Preact
- Whether the graph node click reaches `Sidebar.handleGraphNodeClick()`
- Whether the resulting `sabaki.setCurrentTreePosition()` call is skipped,
  short-circuited, or overwritten by later state updates

## Validation Status

Passing:

- `npm test -- test/studyTests.js test/territoryTests.js`
- `npx playwright test e2e/engine.spec.js -g "collapsed engine excerpt tolerates object-backed log responses"`

Failing:

- `npx playwright test e2e/renderer.spec.js -g "game graph click works without prior mouse movement"`
