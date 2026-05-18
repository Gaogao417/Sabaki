import {h} from 'preact'

/**
 * Status chip definitions for known status values.
 * Each entry maps a status value to a display label.
 */
const STATUS_MAP = {
  saving: '保存中',
  saved: '已保存',
  thinking: '思考中',
  idle: '空闲',
  unsynced: '未同步',
  synced: '已同步',
  correct: '正确',
  wrong: '错误',
  unsubmitted: '未提交',
}

/**
 * QuietStatusChips renders small status indicator chips for various
 * status props. Only renders chips for truthy/defined status values.
 *
 * @param {Object} props
 * @param {string} [props.saveStatus] - Save state: 'saving', 'saved'
 * @param {string} [props.engineStatus] - Engine state: 'thinking', 'idle'
 * @param {string} [props.attemptStatus] - Attempt state: 'correct', 'wrong', 'unsubmitted'
 * @param {string} [props.syncStatus] - Sync state: 'synced', 'unsynced'
 */
export default function QuietStatusChips({
  saveStatus,
  engineStatus,
  attemptStatus,
  syncStatus,
}) {
  const statuses = [saveStatus, engineStatus, attemptStatus, syncStatus].filter(Boolean)

  return h('div', {class: 'wb-quiet-status-chips'},
    statuses.map(status =>
      h('span', {
        'data-testid': 'quiet-status-chip',
        class: 'wb-chip wb-status-chip',
        key: status,
      }, STATUS_MAP[status] || status)
    )
  )
}
