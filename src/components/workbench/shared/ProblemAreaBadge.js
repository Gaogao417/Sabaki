import {h} from 'preact'

export default function ProblemAreaBadge({
  enabled = false,
  pointCount = 0,
}) {
  return h('div', {
    class: `wb-problem-area-badge ${enabled ? 'wb-problem-area-badge--enabled' : 'wb-problem-area-badge--disabled'}`,
  },
    h('span', {class: 'wb-problem-area-badge__dot'}),
    h('span', {class: 'wb-problem-area-badge__text'},
      enabled
        ? `Problem Area 已启用 · ${pointCount} 点`
        : 'Problem Area 未设置'
    )
  )
}
