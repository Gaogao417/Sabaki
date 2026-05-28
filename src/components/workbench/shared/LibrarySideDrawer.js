import {h, Component} from 'preact'
import Board from '@sabaki/go-board'
import MiniGoban from '../../MiniGoban.js'

const externalSourceLabels = {
  fox: '野狐对局',
  oneOhOne: '101 错题',
}

const externalSourceInputLabels = {
  fox: '野狐 ID',
  oneOhOne: '101 ID',
}

const KIFU_SORT_OPTIONS = [
  ['date-desc', '时间倒序'],
  ['date-asc', '时间正序'],
  ['black-name', '黑方姓名'],
  ['white-name', '白方姓名'],
  ['moves-desc', '手数最多'],
]

const PROBLEM_SORT_OPTIONS = [
  ['wrong-desc', '做错时间倒序'],
  ['wrong-asc', '做错时间正序'],
  ['difficulty-desc', '难度从高到低'],
  ['difficulty-asc', '难度从低到高'],
  ['review-recent', '最近复习优先'],
]

const KIFU_RULE_OPTIONS = ['中国规则', '日韩规则', '应氏规则', '其他']
const KIFU_TIME_OPTIONS = ['快棋', '30m + 读秒', '1h + 读秒', '长棋', '不限时']
const PROBLEM_TYPE_OPTIONS = ['死活', '手筋', '官子', '方向', '征子', '连接']
const DIFFICULTY_STEPS = ['10K', '5K', '1K', '1D', '2D', '3D', '4D', '5D']
const DETAIL_GOBAN_MAX_SIZE = 330
const TILE_GOBAN_MAX_SIZE = 210
const PREVIEW_STONE_VARIANTS = [
  [
    [-1, 4, 2], [-1, 6, 2], [-1, 8, 3],
    [-1, 4, 4], [1, 5, 4], [1, 6, 4], [-1, 7, 4],
    [-1, 4, 5], [1, 5, 5], [1, 7, 5], [-1, 8, 5],
    [-1, 4, 6], [1, 5, 6], [1, 6, 6], [-1, 7, 6],
    [-1, 5, 7], [-1, 6, 7],
  ],
  [
    [-1, 4, 2], [-1, 5, 2], [-1, 6, 2], [-1, 7, 2],
    [-1, 4, 3], [1, 5, 3], [1, 7, 3],
    [-1, 4, 4], [1, 5, 4], [1, 6, 4], [-1, 7, 4],
    [-1, 3, 5], [1, 4, 5], [1, 6, 5], [1, 7, 5], [-1, 8, 5],
    [-1, 4, 6], [1, 5, 6], [-1, 6, 6], [-1, 7, 6],
  ],
  [
    [1, 5, 1], [-1, 6, 1], [1, 7, 1],
    [1, 5, 2], [1, 7, 2], [-1, 8, 2],
    [1, 5, 3], [-1, 6, 3], [-1, 7, 3], [1, 8, 3],
    [1, 5, 4], [-1, 6, 4], [1, 7, 4],
    [1, 5, 5], [1, 6, 5], [-1, 6, 6],
  ],
  [
    [1, 6, 1], [-1, 7, 1], [-1, 8, 1],
    [1, 6, 2], [-1, 7, 2],
    [1, 6, 3], [-1, 7, 3],
    [1, 6, 4], [-1, 7, 4],
    [1, 6, 5], [-1, 7, 5], [1, 8, 5], [1, 9, 5],
    [1, 6, 6], [1, 7, 6], [-1, 8, 6],
  ],
  [
    [1, 1, 3], [-1, 2, 4], [-1, 3, 4], [-1, 4, 4],
    [1, 5, 4], [1, 6, 4], [1, 7, 4], [-1, 8, 4],
    [1, 2, 5], [1, 4, 5], [-1, 5, 5], [-1, 6, 5],
    [1, 2, 6], [1, 4, 6],
  ],
  [
    [-1, 4, 1], [1, 5, 1], [1, 6, 1], [1, 7, 1],
    [-1, 4, 2], [1, 5, 2],
    [-1, 4, 3], [-1, 5, 3], [1, 6, 3],
    [-1, 4, 4], [1, 7, 4], [1, 8, 4],
    [-1, 5, 5], [-1, 6, 5], [-1, 7, 5], [-1, 8, 5],
  ],
  [
    [1, 2, 2], [1, 3, 2], [-1, 6, 2], [-1, 7, 2],
    [1, 2, 3], [-1, 3, 3], [1, 6, 3], [-1, 7, 3],
    [-1, 3, 4], [1, 6, 4], [1, 7, 4],
    [1, 2, 5], [1, 3, 5], [1, 4, 5], [-1, 6, 5], [-1, 7, 5],
    [-1, 2, 6], [-1, 3, 6], [1, 6, 6], [1, 7, 6],
  ],
  [
    [-1, 2, 2], [1, 3, 2], [1, 4, 2], [-1, 7, 2], [-1, 8, 2],
    [-1, 2, 3], [1, 5, 3], [1, 6, 3], [-1, 8, 3],
    [-1, 3, 4], [1, 6, 4], [-1, 7, 4],
    [1, 3, 5], [1, 4, 5], [1, 5, 5], [-1, 6, 5], [-1, 7, 5], [-1, 8, 5],
    [1, 3, 6], [1, 4, 6], [1, 5, 6], [-1, 6, 6],
  ],
]
const DEFAULT_PREVIEW_BOARDS = PREVIEW_STONE_VARIANTS.map(createPreviewBoard)

function createPreviewBoard(stones = PREVIEW_STONE_VARIANTS[0]) {
  return stones.reduce(
    (board, [sign, x, y]) => board.set([x - 1, y - 1], sign),
    Board.fromDimensions(9, 9),
  )
}

function getPreviewBoardIndex(item) {
  let value = String(item?.key ?? item?.id ?? item?.qid ?? item?.date ?? '')
  let hash = 0
  for (let char of value) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return hash % DEFAULT_PREVIEW_BOARDS.length
}

function getPreviewBoard(item) {
  if (item?.board?.signMap) return item.board
  if (item?.previewBoard?.signMap) return item.previewBoard
  if (item?.signMap) {
    let height = item.signMap.length
    let width = height === 0 ? 0 : item.signMap[0].length
    return {...Board.fromDimensions(width, height), signMap: item.signMap}
  }
  return DEFAULT_PREVIEW_BOARDS[getPreviewBoardIndex(item)]
}

function getRootData(gameTree) {
  if (gameTree == null) return {}
  let root = typeof gameTree.get === 'function'
    ? gameTree.get(gameTree.root.id)
    : gameTree.root

  return root?.data || {}
}

function getProperty(data, key) {
  return data?.[key]?.[0] || ''
}

function firstText(...values) {
  for (let value of values) {
    if (value == null) continue
    if (Array.isArray(value)) value = value[0]
    if (typeof value === 'object') continue
    let text = String(value).trim()
    if (text) return text
  }

  return ''
}

function asNumber(value, fallback = 0) {
  let number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function joinSearchText(values) {
  return values
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function parseDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value

  let text = String(value)
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text)
  if (match) {
    let date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    )
    return Number.isNaN(date.getTime()) ? null : date
  }

  let date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(value) {
  let date = parseDate(value)
  if (!date) return ''
  let year = date.getFullYear()
  let month = String(date.getMonth() + 1).padStart(2, '0')
  let day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateText(value) {
  return dateKey(value) || firstText(value) || '未记录日期'
}

function dateTime(value) {
  let date = parseDate(value)
  return date ? date.getTime() : 0
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date, count) {
  let next = new Date(date)
  next.setDate(next.getDate() + count)
  return next
}

function getDateRange(range, exactDate) {
  if (!range && !exactDate) return null

  let today = startOfDay(new Date())
  let end = addDays(today, 1).getTime() - 1

  if (exactDate) {
    let exact = startOfDay(parseDate(exactDate) || today)
    return {start: exact.getTime(), end: addDays(exact, 1).getTime() - 1}
  }

  if (range === 'week') {
    let day = today.getDay() || 7
    let start = addDays(today, 1 - day)
    return {start: start.getTime(), end}
  }

  if (range === 'month') {
    let start = new Date(today.getFullYear(), today.getMonth(), 1)
    return {start: start.getTime(), end}
  }

  if (range === 'last90') {
    return {start: addDays(today, -89).getTime(), end}
  }

  return null
}

function matchesDate(value, range, exactDate) {
  let filterRange = getDateRange(range, exactDate)
  if (!filterRange) return true

  let time = dateTime(value)
  if (!time) return false

  return time >= filterRange.start && time <= filterRange.end
}

function listItemTitle(item, fallback = '未命名') {
  return firstText(item?.title, item?.name, item?.label, fallback)
}

function listItemBadge(item) {
  return firstText(item?.statusLabel, item?.status, item?.badge)
}

function sourceLabel(source) {
  if (source === 'fox') return '野狐'
  if (source === 'oneOhOne' || source === '101') return '101'
  if (source === 'history') return '历史'
  if (source === 'current') return '当前打开'
  if (source === 'record') return '对局记录'
  if (source === 'saved') return '本地'
  return firstText(source, '全部')
}

function getErrorMessage(err) {
  return err?.message || String(err || '同步失败')
}

function getProjectionItems(projection, key) {
  return Array.isArray(projection?.[key]) ? projection[key] : []
}

function getProjectionSource(projection, source) {
  if (!projection) return {}
  return projection[source] ||
    (source === 'oneOhOne' ? projection['101'] : null) ||
    {}
}

function splitPlayers(title) {
  let text = firstText(title)
  if (!text) return {}

  let parts = text.split(/\s+(?:vs|VS|v\.?)\s+|[／/]/).map((part) => part.trim())
  if (parts.length >= 2) return {black: parts[0], white: parts[1]}

  return {}
}

function gameTitle(gameTree, index) {
  let data = getRootData(gameTree)
  let name = getProperty(data, 'GN')
  if (name) return name

  let black = getProperty(data, 'PB') || '黑方'
  let white = getProperty(data, 'PW') || '白方'
  return `${black} / ${white} #${index + 1}`
}

function normalizeKifuItem(item, source, index, fallback = {}) {
  let title = listItemTitle(item, fallback.title || '未命名棋谱')
  let players = splitPlayers(title)
  let black = firstText(
    item?.black,
    item?.blackName,
    item?.blackPlayer,
    item?.PB,
    item?.data?.PB,
    fallback.black,
    players.black,
  )
  let white = firstText(
    item?.white,
    item?.whiteName,
    item?.whitePlayer,
    item?.PW,
    item?.data?.PW,
    fallback.white,
    players.white,
  )
  let result = firstText(item?.result, item?.RE, item?.outcome, fallback.result)
  let date = firstText(
    item?.date,
    item?.playedAt,
    item?.updatedAt,
    item?.createdAt,
    item?.DT,
    fallback.date,
  )
  let rule = firstText(item?.rule, item?.ruleset, item?.RU, fallback.rule)
  let timeControl = firstText(
    item?.timeControl,
    item?.time,
    item?.mainTime,
    item?.TM,
    fallback.timeControl,
  )
  let moveCount = asNumber(
    firstText(item?.moveCount, item?.moves, item?.handCount, fallback.moveCount),
    0,
  )
  let explicitScope = firstText(item?.scope, item?.view, fallback.scope)
  let scope = explicitScope ||
    (item?.history === true ? 'history' : '') ||
    (source === 'history' || source === 'current' ? 'history' : 'all')

  return {
    ...item,
    rawItem: item,
    key: firstText(item?.id, item?.taskId, item?.index, fallback.id, `${source}-${index}`),
    title,
    black,
    white,
    playerLine: black && white ? `${black} / ${white}` : title,
    date,
    result,
    rule,
    timeControl,
    moveCount,
    source,
    sourceLabel: sourceLabel(firstText(item?.source, source)),
    scope,
    scopeExplicit: Boolean(explicitScope || item?.history != null),
    badge: listItemBadge(item) || (scope === 'history' ? '历史' : '全部'),
    tags: Array.isArray(item?.tags) ? item.tags : [],
  }
}

function qidText(value) {
  let text = firstText(value)
  if (!text) return 'Q-未记录'
  if (/^Q[-_]?/i.test(text)) return text.replace(/^Q_/, 'Q-')
  if (/^\d+$/.test(text)) return `Q-${text}`
  return text.length > 14 ? `Q-${text.slice(0, 8)}` : `Q-${text}`
}

function difficultyText(value) {
  let text = firstText(value)
  if (!text) return '未设置难度'
  if (/^\d+$/.test(text)) return `${text}D`
  return text.toUpperCase()
}

function difficultyIndex(value) {
  let text = difficultyText(value)
  let index = DIFFICULTY_STEPS.indexOf(text)
  if (index >= 0) return index

  let dan = /^(\d+)D$/i.exec(text)
  if (dan) return DIFFICULTY_STEPS.indexOf(`${Math.min(Number(dan[1]), 5)}D`)

  let kyu = /^(\d+)K$/i.exec(text)
  if (kyu) {
    let rank = Number(kyu[1])
    if (rank >= 10) return 0
    if (rank >= 5) return 1
    return 2
  }

  return -1
}

function normalizeProblemItem(item, source, index) {
  let title = listItemTitle(item, '')
  let type = firstText(item?.type, item?.problemType, item?.category, item?.kind)
  let qid = qidText(firstText(
    item?.qid,
    item?.QID,
    item?.externalId,
    item?.problemId,
    item?.id,
    index + 1,
  ))
  let description = firstText(
    item?.description,
    item?.desc,
    item?.summary,
    item?.comment,
    title,
    '未记录描述',
  )
  let wrongAt = firstText(item?.wrongAt, item?.missedAt, item?.date, item?.updatedAt, item?.createdAt)
  let difficulty = difficultyText(firstText(item?.difficulty, item?.rank, item?.level))
  let explicitScope = firstText(item?.scope, item?.view)
  let scope = explicitScope || (item?.history ? 'history' : 'all')

  return {
    ...item,
    rawItem: item,
    key: firstText(item?.id, item?.taskId, item?.qid, `${source}-${index}`),
    title,
    type: type || '错题',
    qid,
    description,
    wrongAt,
    side: firstText(item?.side, item?.toPlay, item?.color, '黑先'),
    difficulty,
    difficultyIndex: difficultyIndex(difficulty),
    source,
    sourceLabel: sourceLabel(firstText(item?.source, source)),
    scope,
    scopeExplicit: Boolean(explicitScope || item?.history != null),
    reviewAt: firstText(item?.reviewAt, item?.lastReviewedAt, item?.updatedAt),
  }
}

function uniqueRecent(values, limit = 4) {
  let seen = new Set()
  let result = []

  for (let value of values) {
    let text = firstText(value)
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
    if (result.length >= limit) break
  }

  return result
}

export default class LibrarySideDrawer extends Component {
  constructor() {
    super()

    this.state = {
      loading: false,
      summary: null,
      inboxProblems: [],
      savedGames: [],
      query: '',
      externalSourceStatus: {},
      sourceEditor: null,
      activePopover: null,
      kifuView: 'history',
      problemView: 'all',
      selectedKifuKey: null,
      selectedProblemKey: null,
      kifuFilters: {
        sort: 'date-desc',
        playerColor: 'black',
        playerQuery: '',
        dateRange: '',
        dateExact: '',
        rules: [],
        timeControls: [],
      },
      problemFilters: {
        sort: 'wrong-desc',
        query: '',
        dateRange: '',
        dateExact: '',
        difficultyRange: null,
        types: [],
      },
    }
  }

  componentWillReceiveProps(nextProps) {
    let nextType = this.normalizeType(nextProps.type)
    let currentType = this.normalizeType(this.props.type)

    if (nextType !== currentType) {
      this.setState({activePopover: null, sourceEditor: null})
    }

    if (
      nextProps.open &&
      nextType === 'problems' &&
      (!this.props.open || currentType !== 'problems')
    ) {
      this.loadProblemLibrary()
    }

    if (
      nextProps.open &&
      nextType === 'kifu' &&
      (!this.props.open || currentType !== nextType)
    ) {
      this.loadSavedGames()
    }
  }

  componentDidMount() {
    if (!this.props.open) return

    let type = this.normalizeType(this.props.type)
    if (type === 'problems') this.loadProblemLibrary()
    if (type === 'kifu') this.loadSavedGames()
  }

  normalizeType(type = 'history') {
    if (type === 'problems') return 'problems'
    return 'kifu'
  }

  getLibraryDataProvider() {
    return this.props.libraryDataProvider || this.props.repository || null
  }

  getLibraryProjection() {
    return this.props.libraryProjection || {}
  }

  async loadProblemLibrary() {
    let provider = this.getLibraryDataProvider()
    if (
      provider == null ||
      typeof provider.getDashboardSummary !== 'function' ||
      typeof provider.getProblemsByStatus !== 'function'
    ) {
      this.setState({
        loading: false,
        summary: {dueCount: 0, inboxCount: 0, recentPunishmentCount: 0},
        inboxProblems: [],
      })
      return
    }

    this.setState({loading: true})

    try {
      let summary = await provider.getDashboardSummary()
      let inboxProblems = await provider.getProblemsByStatus('inbox', 12)
      this.setState({summary, inboxProblems, loading: false})
    } catch (err) {
      this.setState({
        loading: false,
        summary: {dueCount: 0, inboxCount: 0, recentPunishmentCount: 0},
        inboxProblems: [],
      })
    }
  }

  async loadSavedGames() {
    let provider = this.getLibraryDataProvider()
    if (provider == null || typeof provider.getRecentGames !== 'function') {
      this.setState({savedGames: []})
      return
    }

    try {
      let savedGames = await provider.getRecentGames(30)
      this.setState({savedGames})
    } catch (_) {
      this.setState({savedGames: []})
    }
  }

  setExternalSourceStatus(source, patch) {
    this.setState(({externalSourceStatus}) => ({
      externalSourceStatus: {
        ...externalSourceStatus,
        [source]: {
          ...(externalSourceStatus[source] || {}),
          ...patch,
        },
      },
    }))
  }

  getExternalSourceState(source, projectedStates = {}) {
    projectedStates = projectedStates || {}
    let projected =
      projectedStates[source] ||
      getProjectionSource(this.getLibraryProjection(), source)
    let local = this.state.externalSourceStatus[source] || {}
    let status = local.status || projected.status || 'idle'
    let loading = status === 'loading' || projected.loading === true
    let error = local.error || projected.error || null
    let disabled = loading || projected.disabled === true

    return {
      status,
      loading,
      error,
      message: local.message || projected.message || '',
      rows: Array.isArray(projected.rows) ? projected.rows : [],
      disabled,
      disabledReason:
        projected.disabledReason ||
        (error ? getErrorMessage(error) : ''),
    }
  }

  async handleExternalSourceClick(source, handler) {
    let state = this.getExternalSourceState(
      source,
      this.props.librarySourceStates,
    )
    if (state.disabled || typeof handler !== 'function') return

    this.setExternalSourceStatus(source, {status: 'loading', error: null})

    try {
      await handler()
      this.setExternalSourceStatus(source, {status: 'synced', error: null})
    } catch (err) {
      this.setExternalSourceStatus(source, {
        status: 'error',
        error: getErrorMessage(err),
      })
    }
  }

  toggleExternalSourceEditor(source) {
    this.setState(({sourceEditor}) => ({
      sourceEditor: sourceEditor === source ? null : source,
      activePopover: null,
    }))
  }

  async handleExternalSourceSubmit(source, handler, evt) {
    evt.preventDefault()
    if (typeof handler !== 'function') return

    let value = (evt.currentTarget.elements.sourceId?.value || '').trim()
    if (!value) return

    this.setExternalSourceStatus(source, {status: 'loading', error: null})

    try {
      await handler(value)
      this.setExternalSourceStatus(source, {status: 'synced', error: null})
      this.setState({sourceEditor: null})
    } catch (err) {
      this.setExternalSourceStatus(source, {
        status: 'error',
        error: getErrorMessage(err),
      })
    }
  }

  togglePopover(name) {
    this.setState(({activePopover}) => ({
      activePopover: activePopover === name ? null : name,
      sourceEditor: null,
    }))
  }

  setKifuFilters(patch) {
    this.setState(({kifuFilters}) => ({
      kifuFilters: {...kifuFilters, ...patch},
    }))
  }

  setProblemFilters(patch) {
    this.setState(({problemFilters}) => ({
      problemFilters: {...problemFilters, ...patch},
    }))
  }

  toggleKifuChip(field, value) {
    this.setState(({kifuFilters}) => {
      let values = kifuFilters[field] || []
      let next = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value]

      return {kifuFilters: {...kifuFilters, [field]: next}}
    })
  }

  toggleProblemType(value) {
    this.setState(({problemFilters}) => {
      let types = problemFilters.types || []
      let next = types.includes(value)
        ? types.filter((item) => item !== value)
        : [...types, value]

      return {problemFilters: {...problemFilters, types: next}}
    })
  }

  chooseDifficulty(index) {
    this.setState(({problemFilters}) => {
      let current = problemFilters.difficultyRange
      let next = current == null
        ? [index, index]
        : [Math.min(current[0], index), Math.max(current[1], index)]

      if (current && current[0] === index && current[1] === index) next = null

      return {problemFilters: {...problemFilters, difficultyRange: next}}
    })
  }

  getKifuItems() {
    let projection = this.getLibraryProjection()
    let {
      gameTrees = [],
      gameIndex = 0,
    } = this.props
    let {savedGames} = this.state
    let projectedHistory = getProjectionItems(projection, 'history')
    let projectedKifu = getProjectionItems(projection, 'kifu')
    let projectedRecords = getProjectionItems(projection, 'gameRecords')
    let foxRows = getProjectionSource(projection, 'fox').rows || []
    let currentGames = gameTrees.map((gameTree, index) => {
      let data = getRootData(gameTree)
      return {
        id: `current-${index}`,
        index,
        title: gameTitle(gameTree, index),
        black: getProperty(data, 'PB'),
        white: getProperty(data, 'PW'),
        date: getProperty(data, 'DT'),
        result: getProperty(data, 'RE'),
        rule: getProperty(data, 'RU'),
        timeControl: getProperty(data, 'TM'),
        moveCount:
          typeof gameTree?.getHeight === 'function'
            ? Math.max(0, gameTree.getHeight() - 1)
            : 0,
        badge: index === gameIndex ? '当前' : '',
      }
    })

    return [
      ...projectedHistory.map((item, index) => normalizeKifuItem(item, 'history', index)),
      ...projectedKifu.map((item, index) => normalizeKifuItem(item, 'saved', index)),
      ...projectedRecords.map((item, index) => normalizeKifuItem(item, 'record', index)),
      ...(Array.isArray(foxRows) ? foxRows : [])
        .map((item, index) => normalizeKifuItem(item, 'fox', index)),
      ...currentGames.map((item, index) => normalizeKifuItem(item, 'current', index)),
      ...savedGames.map((item, index) => normalizeKifuItem(item, 'saved', index)),
    ]
  }

  getVisibleKifuItems(items) {
    let {kifuFilters, kifuView} = this.state
    let shouldApplyScope = items.some((item) => item.scopeExplicit)
    let scoped = shouldApplyScope && kifuView === 'history'
      ? items.filter((item) => item.scope === 'history')
      : items

    if (shouldApplyScope && kifuView === 'history' && scoped.length === 0) scoped = items

    return scoped
      .filter((item) => {
        let playerField = kifuFilters.playerColor === 'white' ? item.white : item.black
        let playerMatch = !kifuFilters.playerQuery ||
          normalizeText(playerField).includes(normalizeText(kifuFilters.playerQuery))
        let dateMatch = matchesDate(item.date, kifuFilters.dateRange, kifuFilters.dateExact)
        let ruleMatch = kifuFilters.rules.length === 0 ||
          kifuFilters.rules.includes(item.rule)
        let timeMatch = kifuFilters.timeControls.length === 0 ||
          kifuFilters.timeControls.includes(item.timeControl)

        return playerMatch && dateMatch && ruleMatch && timeMatch
      })
      .sort((a, b) => {
        if (kifuFilters.sort === 'date-asc') return dateTime(a.date) - dateTime(b.date)
        if (kifuFilters.sort === 'black-name') return a.black.localeCompare(b.black)
        if (kifuFilters.sort === 'white-name') return a.white.localeCompare(b.white)
        if (kifuFilters.sort === 'moves-desc') return b.moveCount - a.moveCount
        return dateTime(b.date) - dateTime(a.date)
      })
  }

  getProblemItems() {
    let projection = this.getLibraryProjection()
    let {inboxProblems} = this.state
    let oneOhOneRows = getProjectionSource(projection, 'oneOhOne').rows || []
    let projectedProblems = [
      ...getProjectionItems(projection, 'problems'),
      ...(Array.isArray(oneOhOneRows) ? oneOhOneRows : []),
    ]
    let problemItems = projectedProblems.length > 0 ? projectedProblems : inboxProblems

    return problemItems.map((item, index) =>
      normalizeProblemItem(
        item,
        item?.source === '101' ? 'oneOhOne' : firstText(item?.source, 'oneOhOne'),
        index,
      ),
    )
  }

  getVisibleProblemItems(items) {
    let {problemFilters, problemView} = this.state
    let shouldApplyScope = items.some((item) => item.scopeExplicit)
    let scoped = shouldApplyScope && problemView === 'history'
      ? items.filter((item) => item.scope === 'history')
      : items

    if (shouldApplyScope && problemView === 'history' && scoped.length === 0) scoped = items

    return scoped
      .filter((item) => {
        let queryMatch = !problemFilters.query ||
          joinSearchText([item.qid, item.type, item.description, item.title])
            .includes(normalizeText(problemFilters.query))
        let dateMatch = matchesDate(item.wrongAt, problemFilters.dateRange, problemFilters.dateExact)
        let range = problemFilters.difficultyRange
        let difficultyMatch = range == null ||
          (
            item.difficultyIndex >= 0 &&
            item.difficultyIndex >= range[0] &&
            item.difficultyIndex <= range[1]
          )
        let typeMatch = problemFilters.types.length === 0 ||
          problemFilters.types.includes(item.type)

        return queryMatch && dateMatch && difficultyMatch && typeMatch
      })
      .sort((a, b) => {
        if (problemFilters.sort === 'wrong-asc') return dateTime(a.wrongAt) - dateTime(b.wrongAt)
        if (problemFilters.sort === 'difficulty-desc') return b.difficultyIndex - a.difficultyIndex
        if (problemFilters.sort === 'difficulty-asc') return a.difficultyIndex - b.difficultyIndex
        if (problemFilters.sort === 'review-recent') return dateTime(b.reviewAt) - dateTime(a.reviewAt)
        return dateTime(b.wrongAt) - dateTime(a.wrongAt)
      })
  }

  renderExternalSourceButton(source, testId, state, handler) {
    let editorOpen = this.state.sourceEditor === source
    let inputLabel = externalSourceInputLabels[source]
    let sourceGlyph = source === 'fox' ? '狐' : '101'

    return h('div', {class: 'wb-library-drawer__source-group'},
      h('button', {
        type: 'button',
        'data-testid': testId,
        class: [
          'wb-library-drawer__source',
          state.loading ? 'wb-library-drawer__source--loading' : '',
          state.error ? 'wb-library-drawer__source--error' : '',
          state.status === 'synced' && !state.loading ? 'wb-library-drawer__source--synced' : '',
        ].filter(Boolean).join(' '),
        disabled: state.disabled,
        'aria-busy': state.loading ? 'true' : 'false',
        'aria-invalid': state.error ? 'true' : undefined,
        'data-status': state.status,
        title: state.disabledReason || externalSourceLabels[source],
        onClick: () => this.handleExternalSourceClick(source, handler),
      },
        h('span', {class: 'wb-library-drawer__source-logo'}, sourceGlyph),
      ),
      h('button', {
        type: 'button',
        'data-testid': `${testId}-id-toggle`,
        class: [
          'wb-library-drawer__source-id-toggle',
          editorOpen ? 'wb-library-drawer__source-id-toggle--active' : '',
        ].filter(Boolean).join(' '),
        disabled: state.loading,
        title: `输入${inputLabel}`,
        'aria-label': `${editorOpen ? '收起' : '展开'}${inputLabel}输入框`,
        'aria-expanded': editorOpen ? 'true' : 'false',
        onClick: () => this.toggleExternalSourceEditor(source),
      }, editorOpen ? '⌃' : '⌄'),
      editorOpen && h('form', {
        class: 'wb-library-drawer__source-id-form',
        onSubmit: (evt) => this.handleExternalSourceSubmit(source, handler, evt),
      },
        h('input', {
          name: 'sourceId',
          type: 'text',
          'data-testid': `${testId}-id-input`,
          class: 'wb-library-drawer__source-id-input',
          placeholder: inputLabel,
          disabled: state.loading,
        }),
        h('button', {
          type: 'submit',
          'data-testid': `${testId}-id-submit`,
          class: 'wb-library-drawer__source-id-submit',
          disabled: state.loading,
        }, '打开'),
      ),
    )
  }

  renderScopeToggle(kind) {
    let isKifu = kind === 'kifu'
    let view = isKifu ? this.state.kifuView : this.state.problemView

    return h('div', {class: 'wb-library-drawer__scope-toggle', 'data-testid': 'library-scope-toggle'},
      h('button', {
        type: 'button',
        'data-testid': 'library-scope-history',
        class: view === 'history' ? 'active' : '',
        title: '历史',
        'aria-label': '历史',
        onClick: () => this.setState({
          [isKifu ? 'kifuView' : 'problemView']: 'history',
          activePopover: null,
        }),
      }, '◷'),
      h('button', {
        type: 'button',
        'data-testid': 'library-scope-all',
        class: view === 'all' ? 'active' : '',
        title: '全部',
        'aria-label': '全部',
        onClick: () => this.setState({
          [isKifu ? 'kifuView' : 'problemView']: 'all',
          activePopover: null,
        }),
      }, '▦'),
    )
  }

  renderFilterButton(popover, label) {
    let active = this.state.activePopover === popover
    return h('button', {
      type: 'button',
      'data-testid': `library-filter-${popover}`,
      class: active ? 'active' : '',
      'aria-expanded': active ? 'true' : 'false',
      onClick: () => this.togglePopover(popover),
    }, label)
  }

  renderSortPopover(kind) {
    let isKifu = kind === 'kifu'
    let options = isKifu ? KIFU_SORT_OPTIONS : PROBLEM_SORT_OPTIONS
    let filters = isKifu ? this.state.kifuFilters : this.state.problemFilters
    let setFilters = isKifu
      ? (patch) => this.setKifuFilters(patch)
      : (patch) => this.setProblemFilters(patch)

    return h('div', {
      class: 'wb-library-filter-popover wb-library-filter-popover--menu',
      'data-testid': `library-popover-${kind}-sort`,
    },
      options.map(([value, label]) =>
        h('button', {
          key: value,
          type: 'button',
          class: filters.sort === value ? 'active' : '',
          onClick: () => setFilters({sort: value}),
        }, label),
      ),
    )
  }

  renderKifuPlayerPopover(items) {
    let {kifuFilters} = this.state
    let recent = uniqueRecent(items.flatMap((item) => [item.black, item.white]))

    return h('div', {
      class: 'wb-library-filter-popover',
      'data-testid': 'library-popover-kifu-players',
    },
      h('div', {class: 'wb-library-filter-segments'},
        h('button', {
          type: 'button',
          class: kifuFilters.playerColor === 'black' ? 'active' : '',
          onClick: () => this.setKifuFilters({playerColor: 'black'}),
        }, '黑方'),
        h('button', {
          type: 'button',
          class: kifuFilters.playerColor === 'white' ? 'active' : '',
          onClick: () => this.setKifuFilters({playerColor: 'white'}),
        }, '白方'),
      ),
      h('input', {
        type: 'search',
        value: kifuFilters.playerQuery,
        placeholder: '输入棋手名 / 账号',
        onInput: (evt) => this.setKifuFilters({playerQuery: evt.currentTarget.value}),
      }),
      h('div', {class: 'wb-library-filter-chips'},
        recent.map((name) =>
          h('button', {
            key: name,
            type: 'button',
            class: kifuFilters.playerQuery === name ? 'active' : '',
            onClick: () => this.setKifuFilters({playerQuery: name}),
          }, name),
        ),
      ),
    )
  }

  renderDatePopover(kind) {
    let isKifu = kind === 'kifu'
    let filters = isKifu ? this.state.kifuFilters : this.state.problemFilters
    let setFilters = isKifu
      ? (patch) => this.setKifuFilters(patch)
      : (patch) => this.setProblemFilters(patch)
    let today = new Date()
    let year = today.getFullYear()
    let month = today.getMonth()
    let days = new Date(year, month + 1, 0).getDate()

    return h('div', {
      class: 'wb-library-filter-popover wb-library-filter-popover--calendar',
      'data-testid': `library-popover-${kind}-date`,
    },
      h('div', {class: 'wb-library-filter-chips'},
        [
          ['week', '本周'],
          ['month', '本月'],
          ['last90', '近90天'],
          ['custom', '自定义'],
        ].map(([value, label]) =>
          h('button', {
            key: value,
            type: 'button',
            class: filters.dateRange === value ? 'active' : '',
            onClick: () => setFilters({
              dateRange: value === 'custom' ? '' : value,
              dateExact: '',
            }),
          }, label),
        ),
      ),
      h('strong', {class: 'wb-library-calendar-title'}, `${year}年${month + 1}月`),
      h('div', {class: 'wb-library-calendar-grid'},
        Array.from({length: days}).map((_, index) => {
          let day = index + 1
          let date = new Date(year, month, day)
          let key = dateKey(date)

          return h('button', {
            key,
            type: 'button',
            class: filters.dateExact === key ? 'active' : '',
            onClick: () => setFilters({dateRange: '', dateExact: key}),
          }, day)
        }),
      ),
    )
  }

  renderChipPopover(kind, field, options, title) {
    let isKifu = kind === 'kifu'
    let values = isKifu
      ? this.state.kifuFilters[field] || []
      : this.state.problemFilters[field] || []

    return h('div', {
      class: 'wb-library-filter-popover',
      'data-testid': `library-popover-${kind}-${field}`,
    },
      h('span', {class: 'wb-library-filter-title'}, title),
      h('div', {class: 'wb-library-filter-chips'},
        options.map((option) =>
          h('button', {
            key: option,
            type: 'button',
            class: values.includes(option) ? 'active' : '',
            onClick: () => isKifu
              ? this.toggleKifuChip(field, option)
              : this.toggleProblemType(option),
          }, option),
        ),
      ),
    )
  }

  renderProblemQueryPopover(items) {
    let {problemFilters} = this.state
    let recent = uniqueRecent(items.flatMap((item) => [item.qid, item.type, item.description]), 4)

    return h('div', {
      class: 'wb-library-filter-popover',
      'data-testid': 'library-popover-problem-query',
    },
      h('input', {
        type: 'search',
        value: problemFilters.query,
        placeholder: '输入 QID 或题目描述',
        onInput: (evt) => this.setProblemFilters({query: evt.currentTarget.value}),
      }),
      h('div', {class: 'wb-library-filter-chips'},
        recent.map((query) =>
          h('button', {
            key: query,
            type: 'button',
            class: problemFilters.query === query ? 'active' : '',
            onClick: () => this.setProblemFilters({query}),
          }, query),
        ),
      ),
    )
  }

  renderDifficultyPopover() {
    let range = this.state.problemFilters.difficultyRange

    return h('div', {
      class: 'wb-library-filter-popover wb-library-filter-popover--difficulty',
      'data-testid': 'library-popover-problem-difficulty',
    },
      h('span', {class: 'wb-library-filter-title'}, '难度'),
      h('div', {class: 'wb-library-filter-chips'},
        DIFFICULTY_STEPS.map((step, index) =>
          h('button', {
            key: step,
            type: 'button',
            class: range && index >= range[0] && index <= range[1] ? 'active' : '',
            onClick: () => this.chooseDifficulty(index),
          }, step),
        ),
      ),
    )
  }

  renderKifuFilters(items) {
    let popover = this.state.activePopover

    return h('div', {class: 'wb-library-filters', 'data-testid': 'library-kifu-filters'},
      h('div', {class: 'wb-library-filter'},
        this.renderFilterButton('kifu-sort', '时间↓'),
        popover === 'kifu-sort' && this.renderSortPopover('kifu'),
      ),
      h('div', {class: 'wb-library-filter'},
        this.renderFilterButton('kifu-players', '黑/白方'),
        popover === 'kifu-players' && this.renderKifuPlayerPopover(items),
      ),
      h('div', {class: 'wb-library-filter'},
        this.renderFilterButton('kifu-date', '日期'),
        popover === 'kifu-date' && this.renderDatePopover('kifu'),
      ),
      h('div', {class: 'wb-library-filter'},
        this.renderFilterButton('kifu-rules', '规则'),
        popover === 'kifu-rules' &&
          this.renderChipPopover('kifu', 'rules', KIFU_RULE_OPTIONS, '规则'),
      ),
      h('div', {class: 'wb-library-filter'},
        this.renderFilterButton('kifu-timeControls', '用时'),
        popover === 'kifu-timeControls' &&
          this.renderChipPopover('kifu', 'timeControls', KIFU_TIME_OPTIONS, '用时'),
      ),
    )
  }

  renderProblemFilters(items) {
    let popover = this.state.activePopover

    return h('div', {class: 'wb-library-filters', 'data-testid': 'library-problem-filters'},
      h('div', {class: 'wb-library-filter'},
        this.renderFilterButton('problem-sort', '做错时间↓'),
        popover === 'problem-sort' && this.renderSortPopover('problem'),
      ),
      h('div', {class: 'wb-library-filter'},
        this.renderFilterButton('problem-query', 'QID/描述'),
        popover === 'problem-query' && this.renderProblemQueryPopover(items),
      ),
      h('div', {class: 'wb-library-filter'},
        this.renderFilterButton('problem-date', '做错日期'),
        popover === 'problem-date' && this.renderDatePopover('problem'),
      ),
      h('div', {class: 'wb-library-filter'},
        this.renderFilterButton('problem-difficulty', '难度'),
        popover === 'problem-difficulty' && this.renderDifficultyPopover(),
      ),
      h('div', {class: 'wb-library-filter'},
        this.renderFilterButton('problem-types', '题型'),
        popover === 'problem-types' &&
          this.renderChipPopover('problem', 'types', PROBLEM_TYPE_OPTIONS, '题型'),
      ),
    )
  }

  renderProjectionMessages(kind) {
    let projection = this.getLibraryProjection()
    let sourceIds = kind === 'problems' ? ['oneOhOne'] : ['fox']
    let sourceMessages = sourceIds
      .map((source) => getProjectionSource(projection, source))
      .flatMap((state) => [
        state?.message,
        state?.error && getErrorMessage(state.error),
      ])
    let messages = [
      projection.loading,
      projection.empty,
      ...(Array.isArray(projection.emptyStates) ? projection.emptyStates : []),
      ...(Array.isArray(projection.errors) ? projection.errors : []),
      ...sourceMessages,
    ].filter(Boolean)

    return messages.length > 0 && h('div', {class: 'wb-library-drawer__projection-messages'},
      messages.map((message) =>
        h('div', {key: message, class: 'wb-library-drawer__projection-message'}, message),
      ),
    )
  }

  renderKifuDetail(item) {
    if (!item) {
      return h('aside', {class: 'wb-library-drawer__detail', 'data-testid': 'library-kifu-detail'},
        h('span', {class: 'wb-library-drawer__detail-label'}, '选中棋局'),
        h('div', {class: 'wb-library-drawer__empty'},
          h('strong', {}, '暂无棋谱'),
          h('span', {}, '导入或打开棋谱后会在这里显示详情。'),
        ),
      )
    }

    return h('aside', {class: 'wb-library-drawer__detail', 'data-testid': 'library-kifu-detail'},
      h('span', {class: 'wb-library-drawer__detail-label'}, '选中棋局'),
      h('div', {class: 'wb-library-goban-frame wb-library-goban-frame--detail'},
        h(MiniGoban, {board: getPreviewBoard(item), maxSize: DETAIL_GOBAN_MAX_SIZE}),
      ),
      h('div', {class: 'wb-library-detail-heading'},
        h('strong', {}, `黑 ${item.black || '未记录'}`),
        h('strong', {}, `白 ${item.white || '未记录'}`),
      ),
      h('dl', {class: 'wb-library-detail-list'},
        h('dt', {}, '日期'),
        h('dd', {}, dateText(item.date)),
        h('dt', {}, '结果'),
        h('dd', {}, item.result || '未记录'),
        h('dt', {}, '规则'),
        h('dd', {}, item.rule || '未记录'),
        h('dt', {}, '用时'),
        h('dd', {}, item.timeControl || '未记录'),
        h('dt', {}, '来源'),
        h('dd', {}, item.sourceLabel),
      ),
      h('div', {class: 'wb-library-detail-chips'},
        h('span', {}, item.rule || '规则未知'),
        h('span', {}, item.timeControl || '用时未知'),
        h('span', {}, item.sourceLabel),
        h('span', {}, item.scope === 'history' ? '历史' : '全部'),
      ),
    )
  }

  renderProblemDetail(item) {
    if (!item) {
      return h('aside', {class: 'wb-library-drawer__detail', 'data-testid': 'library-problem-detail'},
        h('span', {class: 'wb-library-drawer__detail-label'}, '选中问题'),
        h('div', {class: 'wb-library-drawer__empty'},
          h('strong', {}, '暂无错题'),
          h('span', {}, '同步或生成错题后会在这里显示详情。'),
        ),
      )
    }

    return h('aside', {class: 'wb-library-drawer__detail', 'data-testid': 'library-problem-detail'},
      h('span', {class: 'wb-library-drawer__detail-label'}, '选中问题'),
      h('div', {class: 'wb-library-goban-frame wb-library-goban-frame--detail'},
        h(MiniGoban, {board: getPreviewBoard(item), maxSize: DETAIL_GOBAN_MAX_SIZE}),
      ),
      h('div', {class: 'wb-library-detail-heading'},
        h('strong', {}, item.type),
        h('strong', {}, item.qid),
      ),
      h('dl', {class: 'wb-library-detail-list'},
        h('dt', {}, '描述'),
        h('dd', {}, item.description),
        h('dt', {}, '做错日期'),
        h('dd', {}, dateText(item.wrongAt)),
        h('dt', {}, '先后手'),
        h('dd', {}, item.side),
        h('dt', {}, '难度'),
        h('dd', {}, item.difficulty),
        h('dt', {}, '来源'),
        h('dd', {}, item.sourceLabel),
      ),
      h('div', {class: 'wb-library-detail-chips'},
        h('span', {}, item.side),
        h('span', {}, item.difficulty),
        h('span', {}, item.sourceLabel),
        h('span', {}, item.scope === 'history' ? '历史' : '全部'),
      ),
    )
  }

  renderKifuTile(item, active, onClick) {
    return h('li', {
      key: item.key,
      class: 'wb-library-drawer__item' + (active ? ' wb-library-drawer__item--active' : ''),
    },
      h('button', {
        type: 'button',
        'data-testid': 'library-kifu-tile',
        onClick,
      },
        h('span', {class: 'wb-library-goban-frame wb-library-goban-frame--tile'},
          h(MiniGoban, {board: getPreviewBoard(item), maxSize: TILE_GOBAN_MAX_SIZE}),
        ),
        h('span', {class: 'wb-library-drawer__item-main'},
          h('strong', {}, item.playerLine),
          h('small', {}, `${dateText(item.date)} · ${item.result || '结果未定'}`),
        ),
      ),
    )
  }

  renderProblemTile(problem, active, onClick) {
    return h('li', {
      key: problem.key,
      class: 'wb-library-drawer__item' + (active ? ' wb-library-drawer__item--active' : ''),
    },
      h('button', {
        type: 'button',
        'data-testid': 'library-problem-tile',
        onClick,
      },
        h('span', {class: 'wb-library-goban-frame wb-library-goban-frame--tile'},
          h(MiniGoban, {board: getPreviewBoard(problem), maxSize: TILE_GOBAN_MAX_SIZE}),
        ),
        h('span', {class: 'wb-library-drawer__item-main'},
          h('strong', {}, `${problem.type} ${problem.qid}`),
          h('small', {}, `${problem.difficulty} · ${problem.description}`),
        ),
      ),
    )
  }

  renderKifuLibrary() {
    let {
      gameIndex = 0,
      onOpenGame = () => {},
      onOpenLibraryTask = () => {},
    } = this.props
    let allItems = this.getKifuItems()
    let items = this.getVisibleKifuItems(allItems)
    let selected = items.find((item) => item.key === this.state.selectedKifuKey) ||
      items.find((item) => item.index === gameIndex) ||
      items[0]
    let selectedKey = selected?.key

    return h('div', {class: 'wb-library-drawer__body'},
      h('div', {class: 'wb-library-drawer__workspace'},
        this.renderKifuDetail(selected),
        h('section', {class: 'wb-library-drawer__grid-panel'},
          h('div', {class: 'wb-library-drawer__grid-heading'},
            h('h3', {}, this.state.kifuView === 'history' ? '历史' : '全部'),
            h('span', {class: 'wb-library-drawer__count'}, items.length),
          ),
          this.renderKifuFilters(allItems),
          this.renderProjectionMessages('kifu'),
          items.length === 0
            ? h('div', {class: 'wb-library-drawer__empty'},
              h('strong', {}, '暂无棋谱'),
              h('span', {}, '导入 SGF 或保存复盘棋谱后会进入棋谱库。'),
            )
            : h('ol', {class: 'wb-library-drawer__list wb-library-drawer__list--visual'},
              items.map((item) =>
                this.renderKifuTile(
                  item,
                  item.key === selectedKey,
                  () => {
                    this.setState({selectedKifuKey: item.key})
                    item.index != null ? onOpenGame(item.index) : onOpenLibraryTask(item.rawItem || item)
                  },
                ),
              ),
            ),
        ),
      ),
    )
  }

  renderProblemLibrary() {
    let {
      onStartProblem = () => {},
    } = this.props
    let {loading, summary} = this.state
    let allItems = this.getProblemItems()
    let items = this.getVisibleProblemItems(allItems)
    let selected = items.find((item) => item.key === this.state.selectedProblemKey) || items[0]
    let librarySummary = summary || {dueCount: 0, inboxCount: items.length, recentPunishmentCount: 0}

    if ((loading || summary == null) && allItems.length === 0) {
      return h('div', {class: 'wb-library-drawer__body'},
        h('div', {class: 'wb-library-drawer__empty'},
          h('strong', {}, '正在加载错题库'),
          h('span', {}, '整理待复习和收件箱题目。'),
        ),
      )
    }

    return h('div', {class: 'wb-library-drawer__body'},
      h('div', {class: 'wb-library-drawer__workspace'},
        this.renderProblemDetail(selected),
        h('section', {class: 'wb-library-drawer__grid-panel'},
          h('div', {class: 'wb-library-drawer__grid-heading'},
            h('h3', {}, this.state.problemView === 'history' ? '历史' : '全部'),
            h('span', {class: 'wb-library-drawer__count'}, librarySummary.inboxCount || items.length),
          ),
          this.renderProblemFilters(allItems),
          this.renderProjectionMessages('problems'),
          items.length === 0
            ? h('div', {class: 'wb-library-drawer__empty'},
              h('strong', {}, '暂无错题'),
              h('span', {}, '标记疑问手或生成题目后会进入这里。'),
            )
            : h('ol', {class: 'wb-library-drawer__list wb-library-drawer__list--visual'},
              items.map((problem) =>
                this.renderProblemTile(
                  problem,
                  problem.key === selected?.key,
                  () => {
                    this.setState({selectedProblemKey: problem.key})
                    if (problem.rawItem == null) onStartProblem(problem.id, problem)
                    else onStartProblem(problem.id, problem.rawItem)
                  },
                ),
              ),
            ),
        ),
      ),
    )
  }

  render({
    open = false,
    type = 'history',
    onClose = () => {},
    onSwitch = () => {},
    onOpenFoxGames = () => {},
    onOpenOneOhOneWeiqi = () => {},
    librarySourceStates = {},
  }) {
    if (!open) return null
    let activeType = this.normalizeType(type)
    let isProblemLibrary = activeType === 'problems'
    let source = isProblemLibrary ? 'oneOhOne' : 'fox'

    return h('div', {
      'data-testid': 'library-side-drawer',
      class: 'wb-library-drawer-shell',
    },
      h('button', {
        type: 'button',
        class: 'wb-library-drawer__backdrop',
        'aria-label': '关闭资料库抽屉',
        onClick: onClose,
      }),
      h('aside', {class: 'wb-library-drawer'},
        h('header', {class: 'wb-library-drawer__header'},
          h('div', {class: 'wb-library-drawer__title-block'},
            h('h2', {}, isProblemLibrary ? '错题库' : '棋谱库'),
          ),
          h('div', {class: 'wb-library-drawer__top-actions'},
            this.renderScopeToggle(activeType),
            h('div', {class: 'wb-library-drawer__sources'},
              this.renderExternalSourceButton(
                source,
                isProblemLibrary ? 'library-source-101' : 'library-source-fox',
                this.getExternalSourceState(source, librarySourceStates),
                isProblemLibrary ? onOpenOneOhOneWeiqi : onOpenFoxGames,
              ),
            ),
            h('button', {
              type: 'button',
              class: 'wb-library-drawer__close',
              onClick: onClose,
            }, '×'),
          ),
        ),
        h('div', {class: 'wb-library-drawer__tabs'},
          h('button', {
            type: 'button',
            'data-testid': 'library-tab-kifu',
            class: activeType === 'kifu' ? 'active' : '',
            onClick: () => onSwitch('kifu'),
          }, '棋谱库'),
          h('button', {
            type: 'button',
            'data-testid': 'library-tab-problems',
            class: activeType === 'problems' ? 'active' : '',
            onClick: () => onSwitch('problems'),
          }, '错题库'),
        ),
        activeType === 'problems'
          ? this.renderProblemLibrary()
          : this.renderKifuLibrary(),
      ),
    )
  }
}
