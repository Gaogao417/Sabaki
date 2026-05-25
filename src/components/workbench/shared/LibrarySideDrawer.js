import {h, Component} from 'preact'

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

export default class LibrarySideDrawer extends Component {
  constructor() {
    super()

    this.state = {
      loading: false,
      summary: null,
      inboxProblems: [],
      query: '',
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.open &&
      nextProps.type === 'problems' &&
      (!this.props.open || this.props.type !== 'problems')
    ) {
      this.loadProblemLibrary()
    }
  }

  async loadProblemLibrary() {
    if (window.sabaki?.db == null) {
      this.setState({
        loading: false,
        summary: {dueCount: 0, inboxCount: 0, recentPunishmentCount: 0},
        inboxProblems: [],
      })
      return
    }

    this.setState({loading: true})

    try {
      let summary = await window.sabaki.db.getDashboardSummary()
      let inboxProblems = await window.sabaki.db.getProblemsByStatus('inbox', 12)
      this.setState({summary, inboxProblems, loading: false})
    } catch (err) {
      this.setState({
        loading: false,
        summary: {dueCount: 0, inboxCount: 0, recentPunishmentCount: 0},
        inboxProblems: [],
      })
    }
  }

  renderGameLibrary() {
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
          placeholder: '搜索棋谱',
          onInput: (evt) => this.setState({query: evt.currentTarget.value}),
        }),
        h('button', {
          type: 'button',
          class: 'wb-library-drawer__primary',
          onClick: onNewGame,
        }, '新对局'),
      ),
      games.length === 0
        ? h('div', {class: 'wb-library-drawer__empty'},
          h('strong', {}, '暂无匹配棋谱'),
          h('span', {}, '开始一盘新棋后会出现在这里。'),
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
    type = 'games',
    onClose = () => {},
    onSwitch = () => {},
  }) {
    if (!open) return null

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
          h('div', {},
            h('span', {class: 'wb-library-drawer__eyebrow'}, '资料库'),
            h('h2', {}, type === 'games' ? '棋谱库' : '错题库'),
          ),
          h('button', {
            type: 'button',
            class: 'wb-library-drawer__close',
            onClick: onClose,
          }, '×'),
        ),
        h('div', {class: 'wb-library-drawer__tabs'},
          h('button', {
            type: 'button',
            class: type === 'games' ? 'active' : '',
            onClick: () => onSwitch('games'),
          }, '棋谱库'),
          h('button', {
            type: 'button',
            class: type === 'problems' ? 'active' : '',
            onClick: () => onSwitch('problems'),
          }, '错题库'),
        ),
        type === 'games'
          ? this.renderGameLibrary()
          : this.renderProblemLibrary(),
      ),
    )
  }
}
