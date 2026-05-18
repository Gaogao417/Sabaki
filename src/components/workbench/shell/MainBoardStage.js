import {h} from 'preact'

export default function MainBoardStage({overlayChip}) {
  return h(
    'div',
    {class: 'wb-board-stage'},

    overlayChip &&
      h(
        'div',
        {class: 'wb-board-stage__chip'},
        overlayChip,
      ),

    h(
      'div',
      {class: 'wb-board-stage__board'},
      h(
        'div',
        {class: 'wb-board-stage__board-grid'},
        // Decorative grid lines to suggest a go board
        h('div', {class: 'wb-board-stage__placeholder-text'}, '19 x 19'),
      ),
    ),
  )
}
