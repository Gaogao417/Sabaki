import {h} from 'preact'

/**
 * WorkbenchRightPanel renders the lightweight mode inspector.
 *
 * The full game graph is no longer mounted as a fixed default block here. It
 * remains available through mode-specific variation/analysis surfaces, keeping
 * the first screen quieter and the board visually dominant.
 *
 * Props:
 * @param {import('preact').VNode} props.modePanel - RightModePanel VNode child
 */
export default function WorkbenchRightPanel({modePanel}) {
  return h('div', {class: 'workbench-right-panel'},
    h('div', {class: 'workbench-right-panel__mode'},
      modePanel,
    ),
  )
}
