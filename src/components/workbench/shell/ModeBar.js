import {h} from 'preact'
import StoneStatus from './StoneStatus.js'
import ModeActions from './ModeActions.js'

const MODES = [
  {key: 'play', label: '对局模式', color: 'var(--ui-play)'},
  {key: 'problem', label: '做题模式', color: 'var(--ui-problem)'},
  {key: 'recall', label: '回忆模式', color: 'var(--ui-recall-mode)'},
  {key: 'analysis', label: '复盘模式', color: 'var(--ui-analysis)'},
]

export {MODES}

export default function ModeBar({
  activeMode = 'problem',
  onModeChange = () => {},
  modeBarPolicy = null,
  blackCaptures = 0,
  whiteCaptures = 0,
  currentPlayer = 'black',
  ...rest
}) {
  return h(
    'nav',
    {'data-testid': 'mode-bar', class: 'wb-mode-bar'},

    // Left: StoneStatus
    h(StoneStatus, {blackCaptures, whiteCaptures, currentPlayer}),

    // Center: Segmented control
    h(
      'div',
      {class: 'wb-mode-bar__tabs wb-segmented-control'},
      MODES.map(({key, label}) => {
        const availability = modeBarPolicy?.[key]
        const disabled = availability && !availability.enabled
        const reason = availability?.reason || ''
        const isActive = activeMode === key

        return h(
          'button',
          {
            key,
            class: `wb-segmented-control__item${isActive ? ' wb-segmented-control__item--active' : ''}${disabled ? ' wb-segmented-control__item--disabled' : ''}`,
            'aria-disabled': disabled || undefined,
            title: reason || undefined,
            onClick: disabled ? undefined : () => onModeChange(key),
            'data-testid': `mode-bar-${key}`,
          },
          label,
        )
      }),
    ),

    // Right: Mode actions
    h(
      'div',
      {class: 'wb-mode-bar__actions'},
      h(ModeActions, {
        mode: activeMode,
        ...rest,
      }),
    ),
  )
}
