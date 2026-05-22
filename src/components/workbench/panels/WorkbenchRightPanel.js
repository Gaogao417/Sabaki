import {h} from 'preact'

// Lazy import: GameGraph.js imports gametree.js and other modules that may
// have Electron-specific dependencies. Use try-catch to tolerate test harnesses.
let GameGraph = null
try {
  const graphMod = require('../../sidebars/GameGraph.js')
  if (graphMod && graphMod.default) {
    GameGraph = graphMod.default
  }
} catch (_) { /* GameGraph unavailable in test harness */ }

/**
 * WorkbenchRightPanel is a presentational wrapper that renders
 * GameGraph (top) + RightModePanel children (bottom) in the
 * right column of the WorkbenchShell.
 *
 * Props:
 * @param {Object} props.gameTree - Game tree object
 * @param {string} props.treePosition - Current tree position ID
 * @param {number} props.graphGridSize - Grid size for graph rendering
 * @param {number} props.graphNodeSize - Node size for graph rendering
 * @param {boolean} props.showGameGraph - Whether to show the game graph
 * @param {Object} props.gameCurrents - Current game currents (indexed object)
 * @param {Function} props.onGraphClick - Callback for graph node click
 * @param {import('preact').VNode} props.modePanel - RightModePanel VNode child
 */
export default function WorkbenchRightPanel({
  gameTree,
  treePosition,
  graphGridSize,
  graphNodeSize,
  showGameGraph,
  gameCurrents,
  onGraphClick,
  modePanel,
}) {
  return h('div', {class: 'workbench-right-panel'},
    GameGraph
      ? h(GameGraph, {
          gameTree,
          treePosition,
          graphGridSize,
          graphNodeSize,
          showGameGraph,
          gameCurrents,
          onNodeClick: onGraphClick,
        })
      : h('div', {class: 'workbench-right-panel__graph-placeholder'}),
    modePanel,
  )
}
