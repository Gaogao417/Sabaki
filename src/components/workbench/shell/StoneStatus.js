import {h} from 'preact'

/**
 * StoneStatus displays black/white capture counts with stone indicators.
 *
 * @param {Object} props
 * @param {number} [props.blackCaptures=0] - Number of captures by black
 * @param {number} [props.whiteCaptures=0] - Number of captures by white
 * @param {'black'|'white'} [props.currentPlayer='black'] - Which player's turn it is
 */
export default function StoneStatus({
  blackCaptures = 0,
  whiteCaptures = 0,
  currentPlayer = 'black',
}) {
  const isBlackTurn = currentPlayer === 'black'

  return h(
    'div',
    {'data-testid': 'stone-status', class: 'wb-stone-status'},

    h(
      'div',
      {
        class: [
          'wb-stone-status__side',
          'wb-stone-status__side--black',
          isBlackTurn ? 'wb-stone-status__side--active' : '',
        ]
          .filter(Boolean)
          .join(' '),
      },
      h('span', {
        class: [
          'wb-stone-indicator',
          'wb-stone-indicator--black',
          'wb-stone-indicator--inline',
          isBlackTurn ? 'wb-stone-indicator--active' : '',
        ]
          .filter(Boolean)
          .join(' '),
      }),
      h('span', {class: 'wb-stone-status__label'}, '黑棋'),
      h('span', {class: 'wb-stone-status__captures'}, '提子 ', blackCaptures),
    ),

    h('span', {class: 'wb-stone-status__divider'}),

    h(
      'div',
      {
        class: [
          'wb-stone-status__side',
          'wb-stone-status__side--white',
          !isBlackTurn ? 'wb-stone-status__side--active' : '',
        ]
          .filter(Boolean)
          .join(' '),
      },
      h('span', {
        class: [
          'wb-stone-indicator',
          'wb-stone-indicator--white',
          'wb-stone-indicator--inline',
          !isBlackTurn ? 'wb-stone-indicator--active' : '',
        ]
          .filter(Boolean)
          .join(' '),
      }),
      h('span', {class: 'wb-stone-status__label'}, '白棋'),
      h('span', {class: 'wb-stone-status__captures'}, '提子 ', whiteCaptures),
    ),
  )
}
