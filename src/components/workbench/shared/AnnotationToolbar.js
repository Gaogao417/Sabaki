import {h} from 'preact'

/**
 * List of annotation tool identifiers and their display labels.
 */
const TOOLS = [
  {id: 'arrow', label: 'Arrow'},
  {id: 'line', label: 'Line'},
  {id: 'freehand', label: 'Freehand'},
  {id: 'text', label: 'Text'},
  {id: 'number', label: 'Number'},
  {id: 'circle', label: 'Circle'},
  {id: 'square', label: 'Square'},
  {id: 'triangle', label: 'Triangle'},
  {id: 'cross', label: 'Cross'},
  {id: 'highlight', label: 'Highlight'},
]

/**
 * AnnotationToolbar renders a row of annotation tool buttons.
 *
 * @param {Object} props
 * @param {string} props.activeTool - Currently selected tool id
 * @param {Function} props.onToolChange - Called with new tool id on selection
 * @param {boolean} [props.disabled=false] - Disables all tool buttons
 */
export default function AnnotationToolbar({activeTool = 'arrow', onToolChange = () => {}, disabled = false}) {
  return h('div', {class: 'wb-annotation-toolbar'},
    TOOLS.map(tool => {
      const isActive = tool.id === activeTool
      const classNames = 'wb-annotation-toolbar__btn' +
        (isActive ? ' wb-annotation-toolbar__btn--active' : '')

      return h('div', {
        key: tool.id,
        'data-testid': 'annotation-tool-btn',
        class: 'wb-annotation-toolbar__item',
      },
        h('button', {
          'data-testid': `annotation-tool-btn-${tool.id}`,
          class: classNames,
          'aria-pressed': String(isActive),
          disabled,
          onClick: () => {
            if (!disabled && !isActive) onToolChange(tool.id)
          },
        }, tool.label),
      )
    }),
  )
}
