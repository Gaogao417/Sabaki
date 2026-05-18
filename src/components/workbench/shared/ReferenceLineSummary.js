import {h} from 'preact'

/**
 * ReferenceLineSummary renders a summary of reference lines with labels,
 * lengths, and a total count.
 *
 * @param {Object} props
 * @param {Array<{label: string, length: number}>} props.lines - Reference lines
 * @param {number} props.totalCount - Total move count across all lines
 */
export default function ReferenceLineSummary({lines = [], totalCount = 0}) {
  return h('div', {class: 'wb-reference-line-summary'},
    lines.map((line, i) =>
      h('div', {
        'data-testid': 'reference-line-item',
        class: 'wb-reference-line-summary__item',
        key: i,
      },
        h('span', {class: 'wb-reference-line-summary__label'}, line.label),
        h('span', {class: 'wb-reference-line-summary__length'}, line.length),
      )
    ),
    h('div', {
      'data-testid': 'reference-total-count',
      class: 'wb-reference-line-summary__total',
    }, totalCount),
  )
}
