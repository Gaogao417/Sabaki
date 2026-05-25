import {h} from 'preact'

/**
 * WorkbenchLeftPanel renders only the current mode's task surface.
 *
 * Engine management is intentionally kept out of the default workbench column:
 * the left rail should answer "what do I do next in this mode?" without
 * competing global controls.
 *
 * Props:
 * @param {import('preact').VNode} props.modePanel - Mode-specific panel VNode child
 */
export default function WorkbenchLeftPanel({modePanel}) {
  return h('div', {class: 'workbench-left-panel'},
    h('div', {class: 'workbench-left-panel__mode'},
      modePanel,
    ),
  )
}
