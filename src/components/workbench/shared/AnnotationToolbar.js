import {h} from 'preact'

function Icon({children, size = 16}) {
  return h('svg', {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.4,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }, children)
}

const TOOLS = [
  {id: 'arrow', title: '箭头', icon: () => h(Icon, null,
    h('path', {d: 'M3 13L13 3m0 0v4m0-4H9'}),
  )},
  {id: 'line', title: '线', icon: () => h(Icon, null,
    h('path', {d: 'M3 13L13 3'}),
  )},
  {id: 'freehand', title: '画笔', icon: () => h(Icon, null,
    h('path', {d: 'M2 14c1-2 3-8 5-8s2 4 4 4 3-5 3-5'}),
  )},
  {id: 'text', title: '文字', icon: () => h(Icon, null,
    h('path', {d: 'M4 3v10M8 3v10M4 8h4'}),
  )},
  {id: 'number', title: '数字', icon: () => h(Icon, null,
    h('path', {d: 'M6 3L4 6h2l1-3v4M4 10h2a2 2 0 010 4H4'}),
  )},
  {id: 'circle', title: '圆', icon: () => h(Icon, null,
    h('circle', {cx: 8, cy: 8, r: 5}),
  )},
  {id: 'square', title: '方', icon: () => h(Icon, null,
    h('rect', {x: 3, y: 3, width: 10, height: 10, rx: 1}),
  )},
  {id: 'triangle', title: '三角', icon: () => h(Icon, null,
    h('path', {d: 'M8 3L3 13h10z'}),
  )},
  {id: 'cross', title: '叉', icon: () => h(Icon, null,
    h('path', {d: 'M4 4l8 8M12 4l-8 8'}),
  )},
  {id: 'highlight', title: '高亮', icon: () => h(Icon, null,
    h('circle', {cx: 8, cy: 8, r: 3}),
    h('circle', {cx: 8, cy: 8, r: 5, 'stroke-dasharray': '2 2'}),
  )},
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
        'data-tool': tool.id,
        class: 'wb-annotation-toolbar__item' + (isActive ? ' active' : ''),
      },
        h('button', {
          'data-testid': `annotation-tool-btn-${tool.id}`,
          class: classNames,
          'aria-pressed': String(isActive),
          'aria-label': tool.title,
          title: tool.title,
          disabled,
          onClick: () => {
            if (!disabled && !isActive) onToolChange(tool.id)
          },
        }, tool.icon()),
      )
    }),
  )
}

/** Export tool icon definitions for reuse by BottomActionBar */
export {TOOLS as ANNOTATION_TOOL_DEFS}
