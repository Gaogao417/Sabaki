import {h, Component} from 'preact'
import Board from '@sabaki/go-board'
import MiniGoban from './MiniGoban.js'
import sabaki from '../modules/sabaki.js'
import * as fileformats from '../modules/fileformats/index.js'
import {getBoard} from '../modules/gametree.js'

const setting = {
  get: (key) => window.sabaki.setting.get(key),
  onDidChange: (cb) => window.sabaki.setting.onDidChange(cb),
}

function getDefaultAccountQuery() {
  let defaultId = setting.get('fox.default_account')
  if (defaultId) {
    let accounts = setting.get('fox.accounts') || []
    let entry = accounts.find((a) => a.id === defaultId)
    if (entry) return entry.account
  }
  return setting.get('fox.account') || ''
}

export default class FoxGamePane extends Component {
  constructor() {
    super()
    this.state = {
      query: getDefaultAccountQuery(),
      resolvedUid: null,
      games: [],
      loading: false,
      error: null,
      selectedChessId: null,
      nextLastcode: null,
      previewBoard: Board.fromDimensions(19, 19),
      sortBy: 'starttime',
      sortDir: 'desc',
    }

    this.settingUnsub = setting.onDidChange(({key}) => {
      if (key === 'fox.default_account' || key === 'fox.accounts') {
        this.setState({query: getDefaultAccountQuery()}, () => this.handleSearch())
      }
    })

    this.handleQueryChange = (e) => {
      this.setState({query: e.currentTarget.value.trim()})
    }

    this.handleQueryKeyDown = (e) => {
      if (e.key === 'Enter') this.handleSearch()
    }

    this.handleSearch = async () => {
      let {query} = this.state
      if (!query) return

      this.setState({
        loading: true,
        error: null,
        games: [],
        selectedChessId: null,
        resolvedUid: null,
        nextLastcode: null,
        previewBoard: Board.fromDimensions(19, 19),
      })

      if (/^\d+$/.test(query)) {
        this.setState({resolvedUid: query})
        return this.fetchGames(query, '')
      }

      let userResult = await window.sabaki.fox.queryUserByName(query)
      if (!userResult.success) {
        this.setState({loading: false, error: userResult.error})
        return
      }

      this.setState({resolvedUid: userResult.uid})
      this.fetchGames(userResult.uid, '')
    }

    this.handleLoadMore = async () => {
      let {resolvedUid, nextLastcode} = this.state
      if (!resolvedUid || !nextLastcode) return

      this.setState({loading: true, error: null})
      await this.fetchGames(resolvedUid, nextLastcode)
    }

    this.handleSelectGame = async (game) => {
      this.setState({selectedChessId: game.chessid})

      let result = await window.sabaki.fox.fetchSgf(game.chessid)
      if (!result.success) return

      try {
        let trees = fileformats.sgf.parse(result.data)
        if (trees && trees.length > 0) {
          let node = trees[0].root
          while (node.children && node.children.length > 0) node = node.children[0]
          this.setState({previewBoard: getBoard(trees[0], node.id)})
        }
      } catch (_) {}
    }

    this.handleOpenGame = async () => {
      let {selectedChessId} = this.state
      if (!selectedChessId) return

      this.setState({loading: true, error: null})

      let result = await window.sabaki.fox.fetchSgf(selectedChessId)
      if (!result.success) {
        this.setState({loading: false, error: result.error})
        return
      }

      sabaki.toggleThirdPartyPanel()
      sabaki.loadContent(result.data, 'sgf')
    }
  }

  componentDidMount() {
    if (this.state.query) this.handleSearch()
  }

  componentWillUnmount() {
    this.settingUnsub()
  }

  async fetchGames(uid, lastcode) {
    let result = await window.sabaki.fox.fetchGameList(uid, lastcode)
    if (!result.success) {
      this.setState({loading: false, error: result.error})
      return
    }

    this.setState(({games}) => ({
      games: lastcode ? [...games, ...result.games] : result.games,
      nextLastcode: result.nextLastcode,
      loading: false,
    }))

    if (result.games.length > 0 && !lastcode) {
      this.handleSelectGame(result.games[0])
    }
  }

  toggleSort(field) {
    this.setState(({sortBy, sortDir}) =>
      sortBy === field
        ? {sortDir: sortDir === 'asc' ? 'desc' : 'asc'}
        : {sortBy: field, sortDir: 'desc'}
    )
  }

  getSortedGames() {
    let {games, sortBy, sortDir} = this.state
    return [...games].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'starttime') {
        cmp = (a.starttime || '').localeCompare(b.starttime || '')
      } else if (sortBy === 'winner') {
        cmp = (a.winner || 0) - (b.winner || 0)
      } else if (sortBy === 'movenum') {
        cmp = (a.movenum || 0) - (b.movenum || 0)
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

  render() {
    let {query, games, loading, error, selectedChessId, nextLastcode, previewBoard} = this.state
    let sorted = this.getSortedGames()
    let game = games.find((g) => g.chessid === selectedChessId)
    let statusText = game
      ? `已选择：${game.blacknick || '?'} vs ${game.whitenick || '?'}`
      : games.length > 0 ? `共 ${games.length} 条对局`
        : '输入野狐 UID 或用户名搜索'

    return h(
      'div',
      {class: 'hub-pane'},

      h('div', {class: 'hub-body'},

        // Search bar
        h('div', {class: 'hub-card hub-search-card'},
          h('div', {class: 'hub-form-group', style: {flex: '1 1 420px'}},
            h('label', {class: 'hub-label'}, '野狐用户 ID / 用户名'),
            h('input', {
              class: 'hub-input',
              type: 'text',
              value: query,
              placeholder: '输入 UID 或用户名...',
              onInput: this.handleQueryChange,
              onKeyDown: this.handleQueryKeyDown,
            }),
          ),
          h('button', {
            class: 'hub-button hub-button--primary',
            style: {width: '140px', marginTop: 'auto'},
            disabled: loading || !query,
            onClick: this.handleSearch,
          }, loading ? '搜索中...' : '搜索对局'),
        ),

        error && h('div', {style: {padding: '8px 16px', color: '#dc2626', fontSize: '13px'}}, error),

        // Content grid
        games.length > 0 && h('div', {class: 'hub-content-grid'},

          // Table
          h('div', {class: 'hub-card hub-table-card'},
            h('div', {class: 'hub-table-header'},
              h('span', null, '搜索结果'),
              h('span', {style: {fontSize: '12px', fontWeight: 400, color: 'var(--hub-text-secondary)'}},
                `共 ${games.length} 条`,
                nextLastcode && h(
                  'span',
                  {style: {marginLeft: '8px', cursor: 'pointer', opacity: 0.7},
                    onClick: this.handleLoadMore},
                  loading ? '加载中...' : '+ 加载更多',
                ),
              ),
            ),
            h('div', {class: 'hub-table-scroll'},
              h('table', {class: 'hub-table'},
                h('colgroup', null,
                  h('col', {style: {width: '130px'}}),
                  h('col', {style: {width: '100px'}}),
                  h('col', {style: {width: '100px'}}),
                  h('col', {style: {width: '60px'}}),
                  h('col', {style: {width: '50px'}}),
                  h('col', null),
                ),
                h('thead', null,
                  h('tr', null,
                    this.sortHeader('日期', 'starttime'),
                    h('th', null, '黑方'),
                    h('th', null, '白方'),
                    this.sortHeader('结果', 'winner'),
                    this.sortHeader('手数', 'movenum'),
                    h('th', null, 'chessid'),
                  ),
                ),
                h('tbody', null,
                  ...sorted.map((g) =>
                    h('tr', {
                      key: g.chessid,
                      class: selectedChessId === g.chessid ? 'selected' : '',
                      onClick: () => this.handleSelectGame(g),
                    },
                      h('td', null, g.starttime || '-'),
                      h('td', null, `${g.blacknick || '?'}${g.blackdanLabel ? ' ' + g.blackdanLabel : ''}`),
                      h('td', null, `${g.whitenick || '?'}${g.whitedanLabel ? ' ' + g.whitedanLabel : ''}`),
                      h('td', null, g.winner === 1 ? 'B' : g.winner === 2 ? 'W' : '-'),
                      h('td', null, g.movenum != null ? String(g.movenum) : '-'),
                      h('td', {class: 'chessid'}, g.chessid),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Detail card with MiniGoban
          h('div', {class: 'hub-card hub-detail-card'},
            h('div', {class: 'hub-detail-section-title'}, '对局详情'),
            game ? h(
              'div',
              {class: 'hub-detail-list'},
              h('div', {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '● 黑方'),
                h('span', {class: 'hub-detail-value'}, `${game.blacknick || '?'}${game.blackdanLabel ? ' ' + game.blackdanLabel : ''}`),
              ),
              h('div', {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '○ 白方'),
                h('span', {class: 'hub-detail-value'}, `${game.whitenick || '?'}${game.whitedanLabel ? ' ' + game.whitedanLabel : ''}`),
              ),
              h('div', {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '结果'),
                h('span', {class: 'hub-detail-value'}, game.winner === 1 ? '黑胜' : game.winner === 2 ? '白胜' : '-'),
              ),
              h('div', {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '日期'),
                h('span', {class: 'hub-detail-value'}, game.starttime || '-'),
              ),
              h('div', {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '手数'),
                h('span', {class: 'hub-detail-value'}, game.movenum != null ? String(game.movenum) : '-'),
              ),
            ) : h('div', {style: {color: 'var(--hub-text-secondary)', fontSize: '13px', padding: '20px', textAlign: 'center'}}, '选择对局查看详情'),
            h('div', {class: 'hub-preview-board-container'},
              h('div', {class: 'hub-preview-board'},
                h(MiniGoban, {board: previewBoard, maxSize: 220}),
              ),
            ),
          ),
        ),

        // Empty state
        !loading && !error && games.length === 0 && h(
          'div',
          {style: {padding: '60px', textAlign: 'center', color: 'var(--hub-text-secondary)', fontSize: '13px'}},
          '输入野狐 UID 或用户名后点击搜索',
        ),
      ),

      // Bottom bar
      h('div', {class: 'hub-bottom-bar'},
        h('div', {class: 'hub-status-info'}, statusText),
        h('div', {class: 'hub-action-group'},
          h('button', {
            class: 'hub-button hub-button--secondary',
            disabled: loading || games.length === 0,
            onClick: this.handleSearch,
          }, '刷新列表'),
          h('button', {
            class: 'hub-button hub-button--primary',
            disabled: !selectedChessId || loading,
            onClick: this.handleOpenGame,
          }, '打开到本地棋盘'),
        ),
      ),
    )
  }
}
