import {h} from 'preact'

/**
 * ProgressRing renders a circular SVG progress indicator.
 *
 * @param {Object} props
 * @param {number} props.progress - Progress value 0-100
 * @param {number} [props.size=64] - Width/height of the ring in pixels
 * @param {string} [props.label] - Optional center label text
 */
export default function ProgressRing({progress = 0, size = 64, label}) {
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashoffset = circumference * (1 - progress / 100)

  return h('div', {
    'data-testid': 'progress-ring',
    class: 'wb-progress-ring',
    style: {width: size + 'px', height: size + 'px'},
  },
    h('svg', {width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: {transform: 'rotate(-90deg)'}},
      h('circle', {
        cx: size / 2,
        cy: size / 2,
        r: radius,
        fill: 'none',
        stroke: 'rgba(0,0,0,0.06)',
        'stroke-width': strokeWidth,
      }),
      h('circle', {
        'data-testid': 'progress-ring-fill',
        cx: size / 2,
        cy: size / 2,
        r: radius,
        fill: 'none',
        stroke: 'var(--ui-blue)',
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round',
        'stroke-dasharray': circumference,
        'stroke-dashoffset': dashoffset,
        class: 'wb-progress-ring__fill',
      }),
    ),
    label != null && h('span', {
      'data-testid': 'progress-ring-label',
      class: 'wb-progress-ring__label',
    }, label),
  )
}
