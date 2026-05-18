import {h} from 'preact'

export default function StatusChip({label, type = 'default'}) {
  return h('span', {class: `wb-status-chip wb-status-chip--${type}`}, label)
}
