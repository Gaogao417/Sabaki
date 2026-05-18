import {h} from 'preact'

const OPTIONS = ['self', 'ai']

/**
 * OpponentControl renders a segmented control for choosing opponent type.
 *
 * @param {Object} props
 * @param {string} props.value - Current value: 'self' or 'ai'
 * @param {Function} props.onChange - Called with new value on selection
 * @param {boolean} [props.disabled=false] - Disables interaction
 * @param {string} [props.disabledReason] - Tooltip text when disabled
 */
export default function OpponentControl({value = 'self', onChange = () => {}, disabled = false, disabledReason = ''}) {
  function handleContainerClick() {
    if (disabled) return
    const currentIndex = OPTIONS.indexOf(value)
    const nextIndex = (currentIndex + 1) % OPTIONS.length
    onChange(OPTIONS[nextIndex])
  }

  return h('div', {
    'data-testid': 'opponent-control',
    class: 'wb-opponent-control' + (disabled ? ' wb-opponent-control--disabled' : ''),
    onClick: handleContainerClick,
  },
    OPTIONS.map(option => {
      const isSelected = value === option
      const classNames = 'wb-opponent-control__option' +
        (isSelected ? ' wb-opponent-control__option--selected' : '')

      return h('button', {
        key: option,
        'data-testid': `opponent-option-${option}`,
        class: classNames,
        'aria-selected': String(isSelected),
        title: disabled ? disabledReason : '',
        disabled,
        onClick: (e) => {
          e.stopPropagation()
          if (!disabled) onChange(option)
        },
      }, option === 'self' ? 'Self Play' : 'vs AI')
    }),
  )
}
