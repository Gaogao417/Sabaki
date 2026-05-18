import {h} from 'preact'

const DEFAULT_BOARD_ACTIONS = [
  {label: '悔棋', icon: '↩'},
  {label: '重做', icon: '↪'},
  {label: 'Pass', icon: '⏭'},
]

const DEFAULT_LEARNING_ACTIONS = [
  {label: '标记疑问手', icon: '?'},
  {label: '请求提示', icon: '💡'},
]

const DEFAULT_PRIMARY = {label: '提交答案', icon: '✓', onClick: () => {}}

export default function BottomActionBar({
  mode = 'problem',
  actions = {},
}) {
  const {
    boardActions = DEFAULT_BOARD_ACTIONS,
    learningActions = DEFAULT_LEARNING_ACTIONS,
    primaryAction = DEFAULT_PRIMARY,
  } = actions

  return h(
    'div',
    {class: 'wb-action-bar'},

    h(
      'div',
      {class: 'wb-action-bar__group'},
      boardActions.map((action, i) =>
        h(
          'button',
          {
            key: 'board-' + i,
            class: 'wb-action-bar__btn wb-action-bar__btn--board',
            onClick: action.onClick,
          },
          h('span', {class: 'wb-action-bar__btn-icon'}, action.icon),
          h('span', {class: 'wb-action-bar__btn-label'}, action.label),
        ),
      ),
    ),

    h('div', {class: 'wb-action-bar__divider'}),

    h(
      'div',
      {class: 'wb-action-bar__group'},
      learningActions.map((action, i) =>
        h(
          'button',
          {
            key: 'learn-' + i,
            class: 'wb-action-bar__btn wb-action-bar__btn--learning',
            onClick: action.onClick,
          },
          h('span', {class: 'wb-action-bar__btn-icon'}, action.icon),
          h('span', {class: 'wb-action-bar__btn-label'}, action.label),
        ),
      ),
    ),

    h('div', {class: 'wb-action-bar__divider'}),

    h(
      'div',
      {class: 'wb-action-bar__group wb-action-bar__group--primary'},
      h(
        'button',
        {
          class: 'wb-action-bar__btn wb-action-bar__btn--primary',
          onClick: primaryAction.onClick,
        },
        h('span', {class: 'wb-action-bar__btn-icon'}, primaryAction.icon),
        h('span', {class: 'wb-action-bar__btn-label'}, primaryAction.label),
      ),
    ),
  )
}
