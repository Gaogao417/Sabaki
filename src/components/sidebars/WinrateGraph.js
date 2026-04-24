import {h, Component} from 'preact'
import i18n from '../../i18n.js'
import sabaki from '../../modules/sabaki.js'
import {noop} from '../../modules/helper.js'

const t = i18n.context('WinrateGraph')
const setting = {
  get: (key) => window.sabaki.setting.get(key),
  onDidChange: (callback) => window.sabaki.setting.onDidChange(callback),
}

function toNumber(value) {
  if (value == null || value === '') return null

  let number = +value
  return Number.isFinite(number) ? number : null
}

function buildLinePath(values, mapPoint) {
  let path = ''
  let open = false

  values.forEach((value, index) => {
    if (value == null) {
      open = false
      return
    }

    let [x, y] = mapPoint(value, index)
    path += `${open ? 'L' : 'M'} ${x},${y} `
    open = true
  })

  return path.trim()
}

function buildAreaPath(values, mapPoint, baselineY) {
  let segments = []
  let current = []

  values.forEach((value, index) => {
    if (value == null) {
      if (current.length > 0) segments.push(current)
      current = []
      return
    }

    current.push([value, index])
  })

  if (current.length > 0) segments.push(current)

  return segments
    .map((segment) => {
      let points = segment.map(([value, index]) => mapPoint(value, index))
      let first = points[0]
      let last = points[points.length - 1]

      return [
        `M ${first[0]},${baselineY}`,
        ...points.map(([x, y]) => `L ${x},${y}`),
        `L ${last[0]},${baselineY}`,
        'Z',
      ].join(' ')
    })
    .join(' ')
}

export default class WinrateGraph extends Component {
  constructor() {
    super()

    this.state = {
      invert: setting.get('view.winrategraph_invert'),
      metricMode: 'both', // 'winrate' | 'lead' | 'both'
    }

    setting.onDidChange(({key, value}) => {
      if (key === 'view.winrategraph_invert') {
        this.setState({invert: value})
      }
    })

    this.handleMouseDown = (evt) => {
      if (!this.hasData) return

      this.mouseDown = true
      document.dispatchEvent(new MouseEvent('mousemove', evt))
    }

    this.handleWinrateToggle = (evt) => {
      evt.preventDefault()
      this.setState(({metricMode}) => {
        if (metricMode === 'lead') return {metricMode: 'lead'} // Can't turn off last metric
        if (metricMode === 'both') return {metricMode: 'lead'}
        return {metricMode: 'both'}
      })
    }

    this.handleScoreLeadToggle = (evt) => {
      evt.preventDefault()
      this.setState(({metricMode}) => {
        if (metricMode === 'winrate') return {metricMode: 'winrate'} // Can't turn off last metric
        if (metricMode === 'both') return {metricMode: 'winrate'}
        return {metricMode: 'both'}
      })
    }
  }

  componentDidMount() {
    this.handleDocumentMouseMove = (evt) => {
      if (!this.mouseDown || this.element == null) return

      let rect = this.element.getBoundingClientRect()
      let percent = (evt.clientX - rect.left) / rect.width
      let {data, onCurrentIndexChange = noop} = this.props
      let index = Math.max(
        Math.min(Math.round((data.length - 1) * percent), data.length - 1),
        0,
      )

      if (index !== this.props.currentIndex) onCurrentIndexChange({index})
    }

    this.handleDocumentMouseUp = () => {
      this.mouseDown = false
    }

    document.addEventListener('mousemove', this.handleDocumentMouseMove)
    document.addEventListener('mouseup', this.handleDocumentMouseUp)
  }

  componentWillUnmount() {
    document.removeEventListener('mousemove', this.handleDocumentMouseMove)
    document.removeEventListener('mouseup', this.handleDocumentMouseUp)
  }

  render() {
    let {lastPlayer, currentIndex, data, scoreLeadData = []} = this.props
    let {invert, metricMode} = this.state
    let showWinrate = metricMode !== 'lead'
    let showScoreLead = metricMode !== 'winrate'

    let winrateValues = data.map(toNumber)
    let scoreLeadValues = scoreLeadData.map(toNumber)
    let hasWinrateData = winrateValues.some((value) => value != null)
    let hasScoreLeadData = scoreLeadValues.some((value) => value != null)
    let hasData = hasWinrateData || hasScoreLeadData
    this.hasData = hasData

    let currentWinrate = winrateValues[currentIndex]
    let displayedWinrate =
      currentWinrate == null
        ? null
        : Math.round(
            (lastPlayer > 0 ? currentWinrate : 100 - currentWinrate) * 100,
          ) / 100
    let currentScoreLead = scoreLeadValues[currentIndex]

    let width = 320
    let height = 180
    let left = 34
    let right = 286
    let top = 18
    let bottom = 154
    let chartWidth = right - left
    let chartHeight = bottom - top
    let count = Math.max(winrateValues.length, scoreLeadValues.length, 1)
    let scoreAbsMax = Math.max(
      20,
      ...scoreLeadValues
        .filter((value) => value != null)
        .map((value) => Math.abs(value)),
    )

    let xForIndex = (index) =>
      count <= 1 ? left : left + (index / (count - 1)) * chartWidth
    let yForWinrate = (value) => {
      let y = bottom - (Math.max(0, Math.min(100, value)) / 100) * chartHeight
      return !invert ? y : top + bottom - y
    }
    let yForScoreLead = (value) => {
      let clamped = Math.max(-scoreAbsMax, Math.min(scoreAbsMax, value))
      return top + ((scoreAbsMax - clamped) / (scoreAbsMax * 2)) * chartHeight
    }

    let winratePath = buildLinePath(winrateValues, (value, index) => [
      xForIndex(index),
      yForWinrate(value),
    ])
    let winrateArea = buildAreaPath(
      winrateValues,
      (value, index) => [xForIndex(index), yForWinrate(value)],
      bottom,
    )
    let scoreLeadPath = buildLinePath(scoreLeadValues, (value, index) => [
      xForIndex(index),
      yForScoreLead(value),
    ])
    let markerX = xForIndex(currentIndex)
    let markerY = currentWinrate == null ? null : yForWinrate(currentWinrate)
    let tooltip =
      currentWinrate == null
        ? ''
        : [
            `${lastPlayer > 0 ? t('Black Winrate:') : t('White Winrate:')} ${
              displayedWinrate == null
                ? '-'
                : i18n.formatNumber(displayedWinrate)
            }%`,
            currentScoreLead == null
              ? null
              : `${t('Score lead:')} ${
                  currentScoreLead >= 0 ? '+' : ''
                }${i18n.formatNumber(Math.round(currentScoreLead * 10) / 10)}`,
          ]
            .filter(Boolean)
            .join('\n')

    return h(
      'section',
      {
        ref: (el) => (this.element = el),
        id: 'winrategraph',
        class: 'sidebar-card analysis-card',
      },

      h(
        'header',
        {class: 'card-header analysis-header'},
        h('strong', {class: 'card-title'}, 'ANALYSIS'),
        h(
          'span',
          {class: 'analysis-value'},
          displayedWinrate == null
            ? '-'
            : `${i18n.formatNumber(displayedWinrate)}%`,
        ),
      ),

      !hasData &&
        h(
          'div',
          {class: 'analysis-empty-state'},
          h('strong', {}, t('No analysis data')),
          h('span', {}, t('Start engine analysis to see win rate and score lead.')),
        ),

      hasData &&
      h(
        'div',
        {class: 'metric-tabs'},
        hasWinrateData &&
          h(
          'button',
          {
            class: `metric-tab${showWinrate ? ' active' : ''}`,
            onClick: this.handleWinrateToggle,
          },
          h('span', {class: 'checkmark'}),
          'Win rate',
        ),
        hasScoreLeadData &&
          h(
          'button',
          {
            class: `metric-tab${showScoreLead ? ' active' : ''}`,
            onClick: this.handleScoreLeadToggle,
          },
          h('span', {class: 'checkmark'}),
          'Score lead',
        ),
      ),

      hasData &&
      h(
        'section',
        {
          class: 'graph trend-chart',
          title: tooltip,
          onMouseDown: this.handleMouseDown,
        },
        h(
          'svg',
          {
            class: 'trend-svg',
            viewBox: `0 0 ${width} ${height}`,
            preserveAspectRatio: 'none',
          },
          [top, top + chartHeight / 2, bottom].map((y, index) =>
            h('line', {
              class: `grid-line${index === 1 ? ' major' : ''}`,
              x1: left,
              y1: y,
              x2: right,
              y2: y,
              'vector-effect': 'non-scaling-stroke',
            }),
          ),
          [0, 50, 100, 150].map((x) =>
            h('line', {
              class: 'grid-line vertical',
              x1: left + (x / 150) * chartWidth,
              y1: top,
              x2: left + (x / 150) * chartWidth,
              y2: bottom,
              'vector-effect': 'non-scaling-stroke',
            }),
          ),
          h('text', {class: 'axis-label', x: 2, y: top + 5}, '100%'),
          h(
            'text',
            {class: 'axis-label', x: 8, y: top + chartHeight / 2 + 4},
            '50%',
          ),
          h('text', {class: 'axis-label', x: 14, y: bottom + 4}, '0%'),
          h(
            'text',
            {class: 'axis-label axis-label--right', x: right + 10, y: top + 5},
            '+20',
          ),
          h(
            'text',
            {
              class: 'axis-label axis-label--right',
              x: right + 18,
              y: top + chartHeight / 2 + 4,
            },
            '0',
          ),
          h(
            'text',
            {
              class: 'axis-label axis-label--right',
              x: right + 10,
              y: bottom + 4,
            },
            '-20',
          ),
          showWinrate &&
            winrateArea !== '' &&
            h('path', {class: 'winrate-area', d: winrateArea}),
          showWinrate &&
            winratePath !== '' &&
            h('path', {
              class: 'winrate-line',
              d: winratePath,
              'vector-effect': 'non-scaling-stroke',
            }),
          showScoreLead &&
            scoreLeadPath !== '' &&
            h('path', {
              class: 'score-line',
              d: scoreLeadPath,
              'vector-effect': 'non-scaling-stroke',
            }),
          h('line', {
            class: 'current-move-line',
            x1: markerX,
            y1: top,
            x2: markerX,
            y2: bottom,
            'vector-effect': 'non-scaling-stroke',
          }),
          showWinrate &&
            markerY != null &&
            h('circle', {
              class: 'current-move-dot',
              cx: markerX,
              cy: markerY,
              r: 4,
              'vector-effect': 'non-scaling-stroke',
            }),
        ),
      ),
    )
  }
}
