import {h, Component} from 'preact'
import Board from '@sabaki/go-board'
import MiniGoban from '../MiniGoban.js'

const mockGames = [
  {
    date: '2024-05-20 19:43',
    blackName: '星陨如雨',
    blackRank: '7段',
    whiteName: '围棋少年',
    whiteRank: '5段',
    result: '黑胜 3.5子',
    moves: 238,
    chessid: '20240520_194301_a1b2c3',
  },
  {
    date: '2024-05-20 18:21',
    blackName: '星陨如雨',
    blackRank: '7段',
    whiteName: '静水流深',
    whiteRank: '6段',
    result: '白胜 1.5子',
    moves: 186,
    chessid: '20240520_182103_d4e5f6',
  },
  {
    date: '2024-05-20 17:02',
    blackName: '小目一丁',
    blackRank: '4段',
    whiteName: '星陨如雨',
    whiteRank: '7段',
    result: '黑中盘胜',
    moves: 172,
    chessid: '20240520_170245_g7h8i9',
  },
  {
    date: '2024-05-19 22:11',
    blackName: 'AlphaGoZero',
    blackRank: '9段',
    whiteName: '星陨如雨',
    whiteRank: '7段',
    result: '黑胜 2.5子',
    moves: 251,
    chessid: '20240519_221145_j1k2l3',
  },
  {
    date: '2024-05-19 20:33',
    blackName: '围棋小子',
    blackRank: '3段',
    whiteName: '星陨如雨',
    whiteRank: '7段',
    result: '白中盘胜',
    moves: 204,
    chessid: '20240519_203312_m4n5o6',
  },
  {
    date: '2024-05-19 18:07',
    blackName: '星陨如雨',
    blackRank: '7段',
    whiteName: '云淡风轻',
    whiteRank: '6段',
    result: '黑胜 0.5子',
    moves: 159,
    chessid: '20240519_180756_p7q8r9',
  },
]

// Preview board with some stones so it's not empty
let previewBoard = Board.fromDimensions(19, 19)
previewBoard = previewBoard.makeMove(1, [3, 3])
previewBoard = previewBoard.makeMove(-1, [15, 15])
previewBoard = previewBoard.makeMove(1, [15, 3])
previewBoard = previewBoard.makeMove(-1, [3, 15])
previewBoard = previewBoard.makeMove(1, [9, 3])
previewBoard = previewBoard.makeMove(-1, [9, 15])

export default class FoxGamePane extends Component {
  constructor() {
    super()
    this.state = {
      selectedGameIndex: 0,
      userId: '35020143',
      searching: false,
    }
  }

  render() {
    const game = mockGames[this.state.selectedGameIndex]
    const statusText = `已选择：${game.blackName} vs ${game.whiteName} · ${game.result}`

    return h(
      'div',
      {class: 'hub-pane'},

      h(
        'header',
        {class: 'hub-header'},
        h('h1', null, '野狐历史对局导入'),
        h(
          'p',
          {class: 'subtitle'},
          '根据用户 ID 搜索公开历史对局，并打开到本地棋盘',
        ),
      ),

      h(
        'div',
        {class: 'hub-body'},

        h(
          'div',
          {class: 'hub-card hub-search-card'},
          h(
            'div',
            {class: 'hub-form-group', style: {flex: '1 1 420px'}},
            h('label', {class: 'hub-label'}, '野狐用户 ID'),
            h('input', {
              class: 'hub-input',
              type: 'text',
              value: this.state.userId,
              placeholder: '输入 UID...',
              onInput: (e) => this.setState({userId: e.target.value}),
            }),
          ),
          h(
            'div',
            {class: 'hub-form-group', style: {width: '260px'}},
            h('label', {class: 'hub-label'}, '排序方式'),
            h(
              'select',
              {class: 'hub-input'},
              h('option', null, '最近对局'),
              h('option', null, '最早对局'),
            ),
          ),
          h(
            'button',
            {
              class: 'hub-button hub-button--primary',
              style: {width: '170px', marginTop: 'auto'},
              disabled: this.state.searching,
            },
            h('img', {
              src: './node_modules/@primer/octicons/build/svg/search.svg',
              width: 14,
              height: 14,
              style: {filter: 'brightness(0) invert(1)'},
            }),
            this.state.searching ? '搜索中...' : '搜索历史对局',
          ),
        ),

        h(
          'div',
          {class: 'hub-content-grid'},

          h(
            'div',
            {class: 'hub-card hub-table-card'},
            h(
              'div',
              {class: 'hub-table-header'},
              h('span', null, '搜索结果'),
              h(
                'span',
                {
                  style: {
                    fontSize: '12px',
                    fontWeight: 400,
                    color: 'var(--hub-text-secondary)',
                  },
                },
                '已找到 6 条公开对局 ',
                h('img', {
                  src: './node_modules/@primer/octicons/build/svg/sync.svg',
                  width: 12,
                  height: 12,
                  style: {
                    opacity: 0.5,
                    cursor: 'pointer',
                    verticalAlign: 'middle',
                    marginLeft: '4px',
                  },
                }),
              ),
            ),
            h(
              'div',
              {class: 'hub-table-scroll'},
              h(
                'table',
                {class: 'hub-table'},
                h(
                  'colgroup',
                  null,
                  h('col', {style: {width: '150px'}}),
                  h('col', {style: {width: '120px'}}),
                  h('col', {style: {width: '120px'}}),
                  h('col', {style: {width: '88px'}}),
                  h('col', {style: {width: '64px'}}),
                  h('col', null),
                ),
                h(
                  'thead',
                  null,
                  h(
                    'tr',
                    null,
                    h('th', null, '日期'),
                    h('th', null, '黑方'),
                    h('th', null, '白方'),
                    h('th', null, '结果'),
                    h('th', null, '手数'),
                    h('th', null, 'chessid'),
                  ),
                ),
                h(
                  'tbody',
                  null,
                  ...mockGames.map((g, i) =>
                    h(
                      'tr',
                      {
                        key: g.chessid,
                        class:
                          this.state.selectedGameIndex === i ? 'selected' : '',
                        onClick: () => this.setState({selectedGameIndex: i}),
                      },
                      h('td', null, g.date),
                      h('td', null, g.blackName),
                      h('td', null, g.whiteName),
                      h('td', null, g.result),
                      h('td', null, g.moves),
                      h('td', {class: 'chessid'}, g.chessid),
                    ),
                  ),
                ),
              ),
            ),
          ),

          h(
            'div',
            {class: 'hub-card hub-detail-card'},
            h('div', {class: 'hub-detail-section-title'}, '对局详情'),
            h(
              'div',
              {class: 'hub-detail-list'},
              h(
                'div',
                {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '● 黑方'),
                h(
                  'span',
                  {class: 'hub-detail-value'},
                  `${game.blackName} ${game.blackRank}`,
                ),
              ),
              h(
                'div',
                {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '○ 白方'),
                h(
                  'span',
                  {class: 'hub-detail-value'},
                  `${game.whiteName} ${game.whiteRank}`,
                ),
              ),
              h(
                'div',
                {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '结果'),
                h('span', {class: 'hub-detail-value'}, game.result),
              ),
              h(
                'div',
                {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '日期'),
                h('span', {class: 'hub-detail-value'}, game.date),
              ),
              h(
                'div',
                {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '手数'),
                h('span', {class: 'hub-detail-value'}, String(game.moves)),
              ),
              h(
                'div',
                {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, 'chessid'),
                h(
                  'span',
                  {
                    class: 'hub-detail-value',
                    style: {
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '12px',
                      color: 'var(--hub-text-secondary)',
                    },
                  },
                  game.chessid,
                ),
              ),
            ),
            h(
              'div',
              {class: 'hub-preview-board-container'},
              h(
                'div',
                {class: 'hub-preview-board'},
                h(MiniGoban, {board: previewBoard, maxSize: 220}),
              ),
            ),
          ),
        ),
      ),

      h(
        'div',
        {class: 'hub-bottom-bar'},
        h('div', {class: 'hub-status-info'}, statusText),
        h(
          'div',
          {class: 'hub-action-group'},
          h(
            'button',
            {class: 'hub-button hub-button--secondary'},
            h('img', {
              src: './node_modules/@primer/octicons/build/svg/sync.svg',
              width: 14,
              height: 14,
            }),
            '刷新列表',
          ),
          h(
            'button',
            {class: 'hub-button hub-button--secondary'},
            h('img', {
              src: './node_modules/@primer/octicons/build/svg/copy.svg',
              width: 14,
              height: 14,
            }),
            '复制 chessid',
          ),
          h(
            'button',
            {class: 'hub-button hub-button--primary'},
            h('img', {
              src: './node_modules/@primer/octicons/build/svg/play.svg',
              width: 14,
              height: 14,
              style: {filter: 'brightness(0) invert(1)'},
            }),
            '打开到本地棋盘',
          ),
        ),
      ),
    )
  }
}
