import {h, Component} from 'preact'
import Board from '@sabaki/go-board'
import MiniGoban from './MiniGoban.js'
import sabaki from '../modules/sabaki.js'
import {getBoard} from '../modules/gametree.js'
import {createOneOhOneWeiqiService} from '../modules/oneOhOneWeiqi/oneOhOneWeiqiService.js'

let service = null

function getService() {
  if (!service) {
    service = createOneOhOneWeiqiService({
      db: window.sabaki.db,
      logger: window.sabaki.logger,
      setting: window.sabaki.setting,
    })
  }
  return service
}

function parseRank(rank) {
  if (!rank) return 0
  let s = String(rank).toLowerCase()
  let m = s.match(/(\d+)\s*(k|d|级|段)/)
  if (!m) return 0
  let n = parseInt(m[1])
  if (m[2] === 'k' || m[2] === '级') return -n
  return n
}

function formatSyncTime(isoStr) {
  if (!isoStr) return '--'
  let d = new Date(isoStr)
  if (isNaN(d.getTime())) return '--'
  let mm = String(d.getMonth() + 1).padStart(2, '0')
  let dd = String(d.getDate()).padStart(2, '0')
  let hh = String(d.getHours()).padStart(2, '0')
  let mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

export default class OneOhOneWeiqiPane extends Component {
  constructor() {
    super()
    this.state = {
      username: '',
      password: '',
      isLoggedIn: false,
      loggedInUser: '',
      loginError: null,
      loginLoading: false,
      problems: [],
      loading: false,
      error: null,
      selectedId: null,
      previewBoard: Board.fromDimensions(19, 19),
      sortBy: 'syncedAt',
      sortDir: 'desc',
      syncProgress: null,
      cachedCount: 0,
    }

    this.handleServiceStateChange = (state) => {
      this.setState({
        isLoggedIn: state.isLoggedIn,
        loggedInUser: state.username,
        syncProgress: state.syncProgress,
      })
    }
  }

  componentDidMount() {
    const svc = getService()
    this.unsubscribe = svc.onStateChange(this.handleServiceStateChange)
    this.setState(svc.getState())
    this.loadCachedProblems()
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe()
  }

  async loadCachedProblems() {
    try {
      const problems = await window.sabaki.db.getWeiqi101Problems()
      const count = await window.sabaki.db.getWeiqi101ProblemCount()
      this.setState({problems, cachedCount: count})
      if (problems.length > 0 && !this.state.selectedId) {
        this.selectProblem(problems[0])
      }
    } catch { /* ignore */ }
  }

  async handleLogin() {
    this.setState({loginLoading: true, loginError: null})
    try {
      await getService().login(this.state.username, this.state.password)
      sabaki.setState({weiqi101Connected: true})
      this.setState({loginLoading: false, password: ''})
    } catch (err) {
      this.setState({loginLoading: false, loginError: err.message})
    }
  }

  handleLogout() {
    getService().logout()
    sabaki.setState({weiqi101Connected: false})
    this.setState({password: ''})
  }

  async syncProblems(forceAll = false) {
    this.setState({loading: true, error: null})
    try {
      await getService().syncErrorBook({forceAll})
      await this.loadCachedProblems()
      this.setState({loading: false})
    } catch (err) {
      this.setState({loading: false, error: err.message})
    }
  }

  selectProblem(problem) {
    this.setState({selectedId: problem.problemId})
    if (problem.sgf) {
      try {
        let {sgf} = require('../modules/fileformats/index.js')
        let trees = sgf.parse(problem.sgf)
        if (trees && trees.length > 0) {
          let node = trees[0].root
          while (node.children && node.children.length > 0) node = node.children[0]
          this.setState({previewBoard: getBoard(trees[0], node.id)})
        }
      } catch { /* keep existing preview */ }
    }
  }

  openOnBoard() {
    let {selectedId, problems} = this.state
    let problem = problems.find(p => p.problemId === selectedId)
    if (!problem || !problem.sgf) return
    sabaki.toggleThirdPartyPanel()
    sabaki.loadContent(problem.sgf, 'sgf')
  }

  toggleSort(field) {
    this.setState(({sortBy, sortDir}) =>
      sortBy === field
        ? {sortDir: sortDir === 'asc' ? 'desc' : 'asc'}
        : {sortBy: field, sortDir: 'desc'}
    )
  }

  getSortedProblems() {
    let {problems, sortBy, sortDir} = this.state
    return [...problems].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'syncedAt') {
        cmp = (new Date(a.syncedAt) || 0) - (new Date(b.syncedAt) || 0)
      } else if (sortBy === 'rank') {
        cmp = parseRank(a.rank) - parseRank(b.rank)
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
  }

  sortHeader(label, field) {
    let {sortBy, sortDir} = this.state
    let active = sortBy === field
    let arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
    return h('th', {
      onClick: () => this.toggleSort(field),
      style: {cursor: 'pointer', userSelect: 'none'},
    }, label + arrow)
  }

  renderProgressBar() {
    let p = this.state.syncProgress
    if (!p || p.phase === 'done' || p.phase === 'error') return null
    let pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0
    let phaseText = {
      discovering: '发现题目中...',
      fetching: '抓取题目中...',
      decoding: '解码中...',
    }[p.phase] || p.phase

    return h('div', {style: {padding: '4px 16px', fontSize: '12px'}},
      h('div', {style: {display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}},
        h('span', null, phaseText),
        h('span', {style: {color: '#666'}}, `${p.completed}/${p.total}`),
      ),
      h('div', {style: {background: '#e5e7eb', borderRadius: '3px', height: '4px', overflow: 'hidden'}},
        h('div', {style: {background: '#3b82f6', height: '100%', width: `${pct}%`, transition: 'width 0.3s'}}),
      ),
    )
  }

  render() {
    let {loading, error, selectedId, previewBoard, problems, isLoggedIn, loginLoading, loginError, username, password} = this.state
    let sorted = this.getSortedProblems()
    let problem = problems.find((p) => p.problemId === selectedId)

    let statusText = problem
      ? `已选择：题目 #${problem.problemCode || problem.problemId} · ${problem.rank || '未知'}`
      : problems.length > 0 ? `共 ${problems.length} 个错题`
        : '点击同步获取错题列表'

    return h(
      'div',
      {class: 'hub-pane'},

      h('div', {class: 'hub-body'},

        // Login bar
        h('div', {class: 'hub-card hub-search-card'},
          h('div', {class: 'hub-form-group', style: {width: '140px'}},
            h('label', {class: 'hub-label'}, '用户名'),
            h('input', {
              class: 'hub-input',
              type: 'text',
              value: username,
              disabled: isLoggedIn,
              placeholder: '101围棋用户名',
              onInput: (e) => this.setState({username: e.target.value}),
            }),
          ),
          h('div', {class: 'hub-form-group', style: {width: '140px'}},
            h('label', {class: 'hub-label'}, '密码'),
            h('input', {
              class: 'hub-input',
              type: 'password',
              value: password,
              disabled: isLoggedIn,
              placeholder: isLoggedIn ? '********' : '密码',
              onInput: (e) => this.setState({password: e.target.value}),
              onKeyDown: (e) => {
                if (e.key === 'Enter' && !isLoggedIn && username && password) this.handleLogin()
              },
            }),
          ),
          isLoggedIn
            ? h('button', {
                class: 'hub-button hub-button--secondary',
                onClick: () => this.handleLogout(),
              }, '退出登录')
            : h('button', {
                class: 'hub-button hub-button--primary',
                disabled: loginLoading || !username || !password,
                onClick: () => this.handleLogin(),
              }, loginLoading ? '登录中...' : '登录'),
          h('div', {style: {flex: 1}}),
          h('button', {
            class: 'hub-button hub-button--primary',
            style: {width: '140px', marginTop: 'auto'},
            disabled: !isLoggedIn || loading,
            onClick: () => this.syncProblems(false),
          }, loading ? '同步中...' : '同步错题'),
        ),

        loginError && h('div', {style: {padding: '4px 16px', color: '#dc2626', fontSize: '12px'}}, loginError),
        this.renderProgressBar(),
        error && h('div', {style: {padding: '4px 16px', color: '#dc2626', fontSize: '13px'}}, error),

        // Content grid
        problems.length > 0 && h('div', {class: 'hub-content-grid'},

          // Table
          h('div', {class: 'hub-card hub-table-card'},
            h('div', {class: 'hub-table-header'},
              h('span', null, '错题列表'),
            ),
            h('div', {class: 'hub-table-scroll'},
              h('table', {class: 'hub-table'},
                h('colgroup', null,
                  h('col', {style: {width: '40px'}}),
                  h('col', {style: {width: '70px'}}),
                  h('col', {style: {width: '80px'}}),
                  h('col', {style: {width: '110px'}}),
                  h('col', null),
                ),
                h('thead', null,
                  h('tr', null,
                    h('th', null, '序号'),
                    this.sortHeader('难度', 'rank'),
                    h('th', null, '题目编号'),
                    this.sortHeader('同步时间', 'syncedAt'),
                    h('th', null, 'ID'),
                  ),
                ),
                h('tbody', null,
                  ...sorted.map((p, i) =>
                    h('tr', {
                      key: p.problemId,
                      class: selectedId === p.problemId ? 'selected' : '',
                      onClick: () => this.selectProblem(p),
                    },
                      h('td', null, i + 1),
                      h('td', null, p.rank || '--'),
                      h('td', null, p.problemCode || '--'),
                      h('td', null, formatSyncTime(p.syncedAt)),
                      h('td', {class: 'chessid'}, p.problemId),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Detail card
          h('div', {class: 'hub-card hub-detail-card'},
            h('div', {class: 'hub-detail-section-title'}, '题目详情'),
            problem && h(
              'div',
              {class: 'hub-detail-list'},
              h('div', {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '题目编号'),
                h('span', {class: 'hub-detail-value'}, problem.problemCode || problem.problemId),
              ),
              h('div', {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '难度等级'),
                h('span', {class: 'hub-detail-value'}, problem.rank || '未知'),
              ),
              h('div', {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '做错次数'),
                h('span', {class: 'hub-detail-value'}, problem.wrongCount || 0),
              ),
              h('div', {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '题目 ID'),
                h('span', {class: 'hub-detail-value',
                  style: {fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', color: 'var(--hub-text-secondary)'}},
                  problem.problemId),
              ),
            ),
            h('div', {class: 'hub-preview-board-container'},
              h('div', {class: 'hub-preview-board'},
                h(MiniGoban, {board: previewBoard, maxSize: 220}),
              ),
            ),
          ),
        ),

        // Empty state
        !loading && !error && problems.length === 0 && h(
          'div',
          {style: {padding: '60px', textAlign: 'center', color: 'var(--hub-text-secondary)', fontSize: '13px'}},
          !isLoggedIn
            ? '请先登录 101 围棋账户'
            : '点击「同步错题」从 101 围棋获取错题列表',
        ),
      ),

      // Bottom bar
      h('div', {class: 'hub-bottom-bar'},
        h('div', {class: 'hub-status-info'}, statusText),
        h('div', {class: 'hub-action-group'},
          h('button', {
            class: 'hub-button hub-button--secondary',
            disabled: !isLoggedIn || loading,
            onClick: () => this.syncProblems(true),
          }, '强制全量同步'),
          h('button', {
            class: 'hub-button hub-button--primary',
            disabled: !selectedId,
            onClick: () => this.openOnBoard(),
          }, '在棋盘打开'),
        ),
      ),
    )
  }
}
