import {h, Component} from 'preact'

import i18n from '../../i18n.js'
import sabaki from '../../modules/sabaki.js'

import Modal from '../Modal.js'

const t = i18n.context('FoxGameImportDrawer')

export default class FoxGameImportDrawer extends Component {
  constructor() {
    super()
    this.state = {
      query: '',
      resolvedUid: null,
      games: [],
      loading: false,
      error: null,
      errorCode: null,
      selectedChessId: null,
      nextLastcode: null,
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.show && !this.props.show) {
      this.setState({
        query: '',
        resolvedUid: null,
        games: [],
        loading: false,
        error: null,
        errorCode: null,
        selectedChessId: null,
        nextLastcode: null,
      })
    }
  }

  handleQueryChange = (evt) => {
    this.setState({query: evt.currentTarget.value.trim()})
  }

  handleQueryKeyDown = (evt) => {
    if (evt.key === 'Enter') this.handleSearch()
  }

  handleSearch = async () => {
    let {query} = this.state
    if (!query) return

    this.setState({loading: true, error: null, errorCode: null, games: [], selectedChessId: null, resolvedUid: null})

    // If query is all digits, treat as numeric UID directly
    if (/^\d+$/.test(query)) {
      return this.fetchGames(query, '')
    }

    // Otherwise, resolve username to UID first
    let userResult = await window.sabaki.fox.queryUserByName(query)

    if (!userResult.success) {
      this.setState({loading: false, error: userResult.error, errorCode: userResult.code})
      return
    }

    this.setState({resolvedUid: userResult.uid})
    return this.fetchGames(userResult.uid, '')
  }

  fetchGames = async (uid, lastcode) => {
    let result = await window.sabaki.fox.fetchGameList(uid, lastcode)

    if (!result.success) {
      this.setState({loading: false, error: result.error, errorCode: result.code, resolvedUid: uid})
      return
    }

    this.setState(({games}) => ({
      games: lastcode ? [...games, ...result.games] : result.games,
      nextLastcode: result.nextLastcode,
      resolvedUid: uid,
      loading: false,
    }))
  }

  handleLoadMore = async () => {
    let {resolvedUid, nextLastcode} = this.state
    if (!resolvedUid || !nextLastcode) return

    this.setState({loading: true, error: null, errorCode: null})
    await this.fetchGames(resolvedUid, nextLastcode)
  }

  handleSelectGame = (chessid) => {
    this.setState({selectedChessId: chessid})
  }

  handleOpenGame = async () => {
    let {selectedChessId} = this.state
    if (!selectedChessId) return

    this.setState({loading: true, error: null, errorCode: null})

    let result = await window.sabaki.fox.fetchSgf(selectedChessId)

    if (!result.success) {
      this.setState({loading: false, error: result.error, errorCode: result.code})
      return
    }

    sabaki.closeDrawer()
    sabaki.loadContent(result.data, 'sgf')
  }

  handleClose = () => sabaki.closeDrawer()

  render({show}) {
    let {query, games, loading, error, selectedChessId, nextLastcode} = this.state

    return h(
      Modal,
      {show, title: t('Import FoxWQ Games'), onClose: this.handleClose},

      h('div', {class: 'fox-import__input-row'},
        h('input', {
          type: 'text',
          class: 'fox-import__uid-input',
          placeholder: t('Enter FoxWQ ID (e.g. YiWoo)'),
          value: query,
          onInput: this.handleQueryChange,
          onKeyDown: this.handleQueryKeyDown,
        }),
        h('button', {
          type: 'button',
          class: 'modal-btn modal-btn--primary',
          disabled: loading || !query,
          onClick: this.handleSearch,
        }, t('Search')),
      ),

      error && h('div', {class: 'fox-import__error'}, error),

      loading && h('div', {class: 'fox-import__loading'}, t('Loading…')),

      !loading && games.length === 0 && query && !error && h('div', {class: 'fox-import__empty'},
        t('Enter a FoxWQ ID and click Search to find games.'),
      ),

      games.length > 0 && h('div', {class: 'fox-import__table-wrap'},
        h('table', {class: 'fox-import__table'},
          h('thead', {},
            h('tr', {},
              h('th', {}, t('Black')),
              h('th', {}, t('White')),
              h('th', {}, t('Result')),
              h('th', {}, t('Date')),
              h('th', {}, t('Moves')),
            ),
          ),
          h('tbody', {},
            games.map((game) =>
              h('tr', {
                key: game.chessid,
                class: selectedChessId === game.chessid ? 'fox-import__selected' : '',
                onClick: () => this.handleSelectGame(game.chessid),
              },
                h('td', {}, `${game.blacknick || '?'} ${game.blackdan ? game.blackdan + '段' : ''}`),
                h('td', {}, `${game.whitenick || '?'} ${game.whitedan ? game.whitedan + '段' : ''}`),
                h('td', {}, game.winner === 1 ? 'B+R' : game.winner === 2 ? 'W+R' : '-'),
                h('td', {}, game.starttime || '-'),
                h('td', {}, game.movenum != null ? String(game.movenum) : '-'),
              ),
            ),
          ),
        ),
      ),

      h('div', {class: 'fox-import__actions'},
        nextLastcode && h('button', {
          type: 'button',
          class: 'modal-btn modal-btn--secondary',
          disabled: loading,
          onClick: this.handleLoadMore,
        }, t('Load More')),
        h('button', {
          type: 'button',
          class: 'modal-btn modal-btn--primary',
          disabled: !selectedChessId || loading,
          onClick: this.handleOpenGame,
        }, t('Open in Board')),
        h('button', {
          type: 'button',
          class: 'modal-btn modal-btn--secondary',
          onClick: this.handleClose,
        }, t('Close')),
      ),
    )
  }
}
