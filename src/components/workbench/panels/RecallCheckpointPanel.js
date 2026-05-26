import {h} from 'preact'

/**
 * RecallCheckpointPanel renders a single checkpoint item in the recall checkpoint list.
 *
 * @param {Object} props
 * @param {{id: string, moveNumber: number, source: string, sourceLabel?: string, severityLabel?: string, statusLabel?: string, summary: string}} props.checkpoint
 * @param {boolean} props.isActive - Whether this checkpoint is currently active
 * @param {Function} props.onSelect - Called when this checkpoint is selected
 */
export default function RecallCheckpointPanel({
  checkpoint = {id: '', moveNumber: 0, source: '', summary: ''},
  isActive = false,
  onSelect = () => {},
}) {
  const classNames = 'wb-recall-checkpoint-panel' + (isActive ? ' wb-recall-checkpoint-panel--active' : '')

  return h('div', {
    'data-testid': 'recall-checkpoint-panel',
    class: classNames,
    onClick: onSelect,
  },
    h('span', {class: 'wb-recall-checkpoint-panel__move-number'}, checkpoint.moveNumber),
    h('span', {class: 'wb-recall-checkpoint-panel__source'}, checkpoint.sourceLabel || checkpoint.source),
    h('span', {class: 'wb-recall-checkpoint-panel__summary'}, checkpoint.summary),
    checkpoint.severityLabel && h('span', {class: 'wb-recall-checkpoint-panel__severity'}, checkpoint.severityLabel),
    checkpoint.statusLabel && h('span', {class: 'wb-recall-checkpoint-panel__status'}, checkpoint.statusLabel),
  )
}
