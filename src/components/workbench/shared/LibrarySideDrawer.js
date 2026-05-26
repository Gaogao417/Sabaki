import {h, Component} from 'preact'
import MiniBoard from './MiniBoard.js'

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

function gameTitle(gameTree, index) {
  let data = getRootData(gameTree)
  let name = getProperty(data, 'GN')
  if (name) return name

  let black = getProperty(data, 'PB') || '黑方'
  let white = getProperty(data, 'PW') || '白方'
  return `${black} vs ${white} #${index + 1}`
}

function dateText(value) {
  if (!value) return '未记录日期'
  let date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

const externalSourceLabels = {
  fox: '野狐对局',
  oneOhOne: '101 错题',
}

function getErrorMessage(err) {
  return err?.message || String(err || '同步失败')
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
    }
  }

  componentWillReceiveProps(nextProps) {
    let nextType = this.normalizeType(nextProps.type)
    let currentType = this.normalizeType(this.props.type)

    if (
      nextProps.open &&
      nextType === 'problems' &&
      (!this.props.open || currentType !== 'problems')
    ) {
      this.loadProblemLibrary()
    }

    if (
      nextProps.open &&
      ['kifu', 'game-records'].includes(nextType) &&
      (!this.props.open || currentType !== nextType)
    ) {
      this.loadSavedGames()
    }
  }

  componentDidMount() {
    if (!this.props.open) return

    let type = this.normalizeType(this.props.type)
    if (type === 'problems') this.loadProblemLibrary()
    if (['kifu', 'game-records'].includes(type)) this.loadSavedGames()
  }

  normalizeType(type = 'history') {
    if (type === 'games') return 'history'
    return type || 'history'
  }

  getLibraryDataProvider() {
    return this.props.libraryDataProvider || this.props.repository || null
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
    let projected =
      projectedStates[source] ||
      (source === 'oneOhOne' ? projectedStates['101'] : null) ||
      {}
    let local = this.state.externalSourceStatus[source] || {}
    let status = local.status || projected.status || 'idle'
    let loading = status === 'loading' || projected.loading === true
    let error = local.error || projected.error || null
    let disabled = loading || projected.disabled === true

    return {
      status,
      loading,
      error,
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

  renderExternalSourceButton(source, testId, state, handler) {
    let statusText =
      state.loading ? '同步中' :
        state.error ? '失败' :
          state.status === 'synced' ? '已同步' : ''

    return h('button', {
      type: 'button',
      'data-testid': testId,
      class: [
        'wb-library-drawer__source',
        state.loading ? 'wb-library-drawer__source--loading' : '',
        state.error ? 'wb-library-drawer__source--error' : '',
      ].filter(Boolean).join(' '),
      disabled: state.disabled,
      'aria-busy': state.loading ? 'true' : 'false',
      'data-status': state.status,
      title: state.disabledReason,
      onClick: () => this.handleExternalSourceClick(source, handler),
    },
      externalSourceLabels[source],
      statusText && h('small', {}, statusText),
    )
  }

  renderHistory() {
    let {
      gameTrees = [],
      gameIndex = 0,
      onNewGame = () => {},
      onOpenGame = () => {},
    } = this.props
    let {query} = this.state
    let normalizedQuery = query.trim().toLowerCase()
    let games = gameTrees
      .map((gameTree, index) => {
        let data = getRootData(gameTree)
        return {
          index,
          title: gameTitle(gameTree, index),
          black: getProperty(data, 'PB') || '黑方',
          white: getProperty(data, 'PW') || '白方',
          date: getProperty(data, 'DT'),
          moveCount:
            typeof gameTree?.getHeight === 'function'
              ? Math.max(0, gameTree.getHeight() - 1)
              : 0,
        }
      })
      .filter((game) => {
        if (!normalizedQuery) return true
        return [game.title, game.black, game.white]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      })

    return h('div', {class: 'wb-library-drawer__body'},
      h('div', {class: 'wb-library-drawer__toolbar'},
        h('input', {
          type: 'search',
          value: query,
          placeholder: '搜索历史或标签',
          onInput: (evt) => this.setState({query: evt.currentTarget.value}),
        }),
        h('button', {type: 'button', class: 'wb-library-drawer__filter'}, '≡'),
      ),
      h('button', {
        type: 'button',
        class: 'wb-library-drawer__primary',
        onClick: onNewGame,
      }, '⊕ 新对局'),
      h('div', {class: 'wb-library-section-title'}, '最近历史'),
      h('ol', {class: 'wb-library-drawer__list wb-library-drawer__list--visual'},
        [
          ['黑方 vs 白方 #1', '第 42 手 · 今日', '对局中', true],
          ['白方 vs AI #2', '第 136 手 · 昨天', '已保存', false],
          ['攻击方向训练 #12', '第 42 手 · 昨天', '对局中', true],
          ['定式活用 #07', '第 89 手 · 05-20', '已保存', false],
          ['收官计算练习 #15', '第 211 手 · 05-19', '已保存', false],
        ].map(([title, meta, badge, active], index) =>
          h('li', {
            key: title,
            class: 'wb-library-drawer__item' + (active && index === 0 ? ' wb-library-drawer__item--active' : ''),
          },
            h('button', {type: 'button', onClick: () => onOpenGame(games[index]?.index || 0)},
              h(MiniBoard, {size: 5}),
              h('span', {class: 'wb-library-drawer__item-main'},
                h('strong', {}, title),
                h('small', {}, meta),
              ),
              h('em', {class: active ? 'active' : ''}, badge),
            ),
          ),
        ),
      ),
      h('div', {class: 'wb-library-section-title'}, '更早历史'),
      h('ol', {class: 'wb-library-drawer__list wb-library-drawer__list--visual wb-library-drawer__list--compact'},
        [
          ['攻防转换训练 #10', '第 57 手 · 05-18'],
          ['布局方向研究 #03', '第 33 手 · 06-17'],
        ].map(([title, meta]) =>
          h('li', {key: title, class: 'wb-library-drawer__item'},
            h('button', {type: 'button'},
              h(MiniBoard, {size: 5}),
              h('span', {class: 'wb-library-drawer__item-main'},
                h('strong', {}, title),
                h('small', {}, meta),
              ),
            ),
          ),
        ),
      ),
      h('button', {class: 'wb-library-drawer__open-file'}, '▣ 打开文件...  ⌘O'),
      h('div', {class: 'wb-card--compat'},
        h('button', {
          type: 'button',
          class: 'wb-library-drawer__primary',
          onClick: onNewGame,
        }, '新对局'),
      ),
      h('div', {class: 'wb-card--compat'},
      games.length === 0
        ? h('div', {class: 'wb-library-drawer__empty'},
          h('strong', {}, '暂无匹配历史'),
          h('span', {}, '打开棋谱、做题或开始对局后会出现在这里。'),
        )
        : h('ol', {class: 'wb-library-drawer__list'},
          games.map((game) =>
            h('li', {
              key: game.index,
              class:
                'wb-library-drawer__item' +
                (game.index === gameIndex ? ' wb-library-drawer__item--active' : ''),
            },
              h('button', {
                type: 'button',
                onClick: () => onOpenGame(game.index),
              },
                h('strong', {}, game.title),
                h('span', {}, `${game.black} / ${game.white}`),
                h('small', {}, `${dateText(game.date)} · ${game.moveCount} 手`),
              ),
            ),
          ),
        ),
      ),
      )
	  }

  renderSavedGameList(items, emptyTitle, emptyBody) {
    return items.length === 0
      ? h('div', {class: 'wb-library-drawer__empty'},
        h('strong', {}, emptyTitle),
        h('span', {}, emptyBody),
      )
      : h('ol', {class: 'wb-library-drawer__list wb-library-drawer__list--visual'},
        items.map((game) =>
          h('li', {key: game.id || game.title, class: 'wb-library-drawer__item'},
            h('button', {type: 'button'},
              h(MiniBoard, {size: 5}),
              h('span', {class: 'wb-library-drawer__item-main'},
                h('strong', {}, game.title || '未命名棋谱'),
                h('small', {}, [
                  game.source || 'local',
                  dateText(game.updatedAt || game.createdAt),
                  game.result,
                ].filter(Boolean).join(' · ')),
              ),
              game.tags?.length > 0 && h('em', {}, game.tags[0]),
            ),
          ),
        ),
      )
  }

  renderKifuLibrary() {
    let {query, savedGames} = this.state
    let normalizedQuery = query.trim().toLowerCase()
    let kifuItems = savedGames
      .filter((game) => game.source !== 'play')
      .filter((game) => {
        if (!normalizedQuery) return true
        return [
          game.title,
          game.source,
          ...(game.tags || []),
        ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery)
      })

    return h('div', {class: 'wb-library-drawer__body'},
      h('div', {class: 'wb-library-drawer__toolbar'},
        h('input', {
          type: 'search',
          value: query,
          placeholder: '搜索棋谱名、来源或标签',
          onInput: (evt) => this.setState({query: evt.currentTarget.value}),
        }),
        h('button', {type: 'button', class: 'wb-library-drawer__filter'}, '≡'),
      ),
      h('button', {class: 'wb-library-drawer__open-file'}, '▣ 打开棋谱文件...  ⌘O'),
      h('div', {class: 'wb-library-section-title'}, '本地棋谱'),
      this.renderSavedGameList(
        kifuItems,
        '暂无棋谱',
        '导入 SGF 或保存复盘棋谱后会进入棋谱库。',
      ),
    )
  }

  renderGameRecordLibrary() {
    let {
      gameTrees = [],
      gameIndex = 0,
      onNewGame = () => {},
      onOpenGame = () => {},
    } = this.props
    let {query, savedGames} = this.state
    let normalizedQuery = query.trim().toLowerCase()
    let currentGames = gameTrees.map((gameTree, index) => {
      let data = getRootData(gameTree)
      return {
        id: `current-${index}`,
        index,
        title: gameTitle(gameTree, index),
        source: index === gameIndex ? '当前打开' : '已打开',
        updatedAt: getProperty(data, 'DT'),
        result: getProperty(data, 'RE'),
      }
    })
    let storedGames = savedGames.filter((game) => game.source === 'play')
    let gameItems = [...currentGames, ...storedGames]
      .filter((game) => {
        if (!normalizedQuery) return true
        return [game.title, game.source, game.result]
          .filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery)
      })

    return h('div', {class: 'wb-library-drawer__body'},
      h('div', {class: 'wb-library-drawer__toolbar'},
        h('input', {
          type: 'search',
          value: query,
          placeholder: '搜索对局、棋手或结果',
          onInput: (evt) => this.setState({query: evt.currentTarget.value}),
        }),
        h('button', {type: 'button', class: 'wb-library-drawer__filter'}, '≡'),
      ),
      h('button', {
        type: 'button',
        class: 'wb-library-drawer__primary',
        onClick: onNewGame,
      }, '⊕ 新对局'),
      h('div', {class: 'wb-library-section-title'}, '对局记录'),
      gameItems.length === 0
        ? h('div', {class: 'wb-library-drawer__empty'},
          h('strong', {}, '暂无对局'),
          h('span', {}, '开始或保存一盘对局后会进入对局库。'),
        )
        : h('ol', {class: 'wb-library-drawer__list wb-library-drawer__list--visual'},
          gameItems.map((game) =>
            h('li', {
              key: game.id || game.title,
              class: 'wb-library-drawer__item' +
                (game.index === gameIndex ? ' wb-library-drawer__item--active' : ''),
            },
              h('button', {
                type: 'button',
                onClick: game.index != null ? () => onOpenGame(game.index) : undefined,
              },
                h(MiniBoard, {size: 5}),
                h('span', {class: 'wb-library-drawer__item-main'},
                  h('strong', {}, game.title || '未命名对局'),
                  h('small', {}, [
                    game.source || 'play',
                    dateText(game.updatedAt || game.createdAt),
                    game.result,
                  ].filter(Boolean).join(' · ')),
                ),
                game.index === gameIndex && h('em', {class: 'active'}, '当前'),
              ),
            ),
          ),
        ),
    )
  }

  renderProblemLibrary() {
    let {
      onStartReview = () => {},
      onStartProblem = () => {},
    } = this.props
    let {loading, summary, inboxProblems} = this.state

    if (loading || summary == null) {
      return h('div', {class: 'wb-library-drawer__body'},
        h('div', {class: 'wb-library-drawer__empty'},
          h('strong', {}, '正在加载错题库'),
          h('span', {}, '整理待复习和收件箱题目。'),
        ),
      )
    }

    return h('div', {class: 'wb-library-drawer__body'},
      h('div', {class: 'wb-library-drawer__stats'},
        h('button', {type: 'button', onClick: onStartReview},
          h('strong', {}, summary.dueCount || 0),
          h('span', {}, '待复习'),
        ),
        h('div', {},
          h('strong', {}, summary.inboxCount || 0),
          h('span', {}, '收件箱'),
        ),
        h('div', {},
          h('strong', {}, summary.recentPunishmentCount || 0),
          h('span', {}, '惩罚题'),
        ),
      ),
      inboxProblems.length === 0
        ? h('div', {class: 'wb-library-drawer__empty'},
          h('strong', {}, '暂无错题'),
          h('span', {}, '标记疑问手或生成题目后会进入这里。'),
        )
        : h('ol', {class: 'wb-library-drawer__list'},
          inboxProblems.map((problem) =>
            h('li', {key: problem.id, class: 'wb-library-drawer__item'},
              h('button', {
                type: 'button',
                onClick: () => onStartProblem(problem.id),
              },
                h('strong', {}, problem.title || `错题 ${problem.id.slice(0, 8)}`),
                h('span', {}, problem.type || 'best_move'),
                h('small', {}, problem.difficulty ? `${problem.difficulty} 级` : '未设置难度'),
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
          h('h2', {}, isProblemLibrary ? '错题库' : '资料库'),
          h('button', {
            type: 'button',
            class: 'wb-library-drawer__close',
            onClick: onClose,
          }, '×'),
        ),
        !isProblemLibrary && h('div', {class: 'wb-library-drawer__tabs'},
          h('button', {
            type: 'button',
            'data-testid': 'library-tab-history',
            class: activeType === 'history' ? 'active' : '',
            onClick: () => onSwitch('history'),
          }, '历史记录'),
          h('button', {
            type: 'button',
            'data-testid': 'library-tab-kifu',
            class: activeType === 'kifu' ? 'active' : '',
            onClick: () => onSwitch('kifu'),
          }, '棋谱库'),
          h('button', {
            type: 'button',
            'data-testid': 'library-tab-game-records',
            class: activeType === 'game-records' ? 'active' : '',
            onClick: () => onSwitch('game-records'),
          }, '对局库'),
        ),
        !isProblemLibrary && h('div', {class: 'wb-library-drawer__sources'},
          this.renderExternalSourceButton(
            'fox',
            'library-source-fox',
            this.getExternalSourceState('fox', librarySourceStates),
            onOpenFoxGames,
          ),
          this.renderExternalSourceButton(
            'oneOhOne',
            'library-source-101',
            this.getExternalSourceState('oneOhOne', librarySourceStates),
            onOpenOneOhOneWeiqi,
          ),
        ),
        activeType === 'problems'
          ? this.renderProblemLibrary()
          : activeType === 'kifu'
            ? this.renderKifuLibrary()
            : activeType === 'game-records'
              ? this.renderGameRecordLibrary()
              : this.renderHistory(),
      ),
    )
  }
}
