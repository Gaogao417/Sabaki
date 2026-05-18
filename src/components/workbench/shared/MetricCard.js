import {h} from 'preact'

export default function MetricCard({label, value, change, changeType = 'neutral'}) {
  return h('div', {class: 'wb-metric-card'}, [
    h('div', {class: 'wb-metric-card__label'}, label),
    h('div', {class: 'wb-metric-card__value'}, value),
    change != null && h('div', {class: `wb-metric-card__change wb-metric-card__change--${changeType}`}, change)
  ])
}
