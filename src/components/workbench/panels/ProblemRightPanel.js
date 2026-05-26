import {h} from 'preact'
/**
 * ProblemRightPanel renders the right panel content for Problem mode.
 *
 * @param {Object} props
 * @param {number} props.currentVariation - Current variation index
 * @param {string} props.opponentMode - Opponent mode identifier
 * @param {string|null} props.hint - Hint text, or null if no hint
 * @param {boolean} props.aiAnalysisHidden - Whether AI analysis is hidden
 * @param {Array<{label: string, length: number}>} props.referenceLines - Reference lines
 * @param {number} props.pendingEval - Pending evaluation count
 * @param {number} props.badMoveCount - Number of bad moves detected
 */
export default function ProblemRightPanel({
  hint = null,
  pendingEval = 0,
  badMoveCount = 0,
}) {
  return h('div', {
    'data-testid': 'problem-right-panel',
    class: 'wb-problem-right-panel',
  },
    h('div', {class: 'wb-card wb-eval-card'},
      h('div', {class: 'wb-panel-title'}, '评估监控'),
      h('button', {class: 'wb-card-expand', 'aria-label': '展开评估监控'}, '↗'),
      h('div', {class: 'wb-eval-card__lead'},
        h('span', {}, '领先（黑）'),
        h('strong', {}, '3.6', h('small', {}, ' 目')),
      ),
      h('div', {class: 'wb-eval-card__row'},
        h('span', {}, pendingEval > 0 ? '评估中' : '最近下降'),
        h('b', {}, '0.0 目'),
      ),
      h('div', {class: 'wb-sparkline', 'aria-hidden': 'true'},
        [8, 8, 13, 9, 8, 7, 6].map((height, index) =>
          h('span', {key: index, style: `--y:${height}`}),
        ),
      ),
      h('div', {class: 'wb-sparkline__ticks'}, h('span', {}, '2'), h('span', {}, '4'), h('span', {}, '6'), h('span', {}, '8'), h('span', {}, '10')),
    ),

    h('div', {
      'data-testid': 'hint-card',
      class: 'wb-card wb-hint-card',
    },
      h('div', {class: 'wb-panel-title'}, '提示'),
      h('div', {class: 'wb-hint-card__used'},
        h('span', {}, '已使用'),
        h('strong', {}, '1', h('small', {}, '/5')),
      ),
      h('p', {}, hint || '需要提示时可获取帮助'),
      h('button', {class: 'wb-btn wb-btn-secondary'}, '请求提示'),
    ),

    h('div', {class: 'wb-card wb-path-card'},
      h('div', {class: 'wb-panel-title'}, '当前尝试路径'),
      h('ol', {class: 'wb-path-card__steps'},
        [
          ['开始', '00:00', false],
          ['思考中', '00:27', true],
          ['...', '', false],
          ['...', '', false],
          ['...', '', false],
        ].map(([label, time, active], index) =>
          h('li', {key: index, class: active ? 'active' : ''},
            h('span', {class: 'wb-path-card__index'}, index + 1),
            h('span', {class: 'wb-path-card__label'}, label),
            h('span', {class: 'wb-path-card__time'}, time),
          ),
        ),
      ),
      badMoveCount > 0 && h('span', {class: 'wb-path-card__badge'}, badMoveCount),
    ),
  )
}
