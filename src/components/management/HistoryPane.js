import {h, Component} from 'preact'

const mockHistory = [
  {filename: '2024-05-14_game.sgf', lastOpened: '1小时前'},
  {filename: 'tsumego_collection.sgf', lastOpened: '昨天'},
  {filename: 'championship_final.sgf', lastOpened: '2024-05-10'},
]

export default class HistoryPane extends Component {
  render() {
    return h(
      'div',
      {class: 'hub-pane'},
      h(
        'header',
        {class: 'hub-header'},
        h('h1', null, '历史记录'),
        h('p', {class: 'subtitle'}, '查看与管理最近打开过的棋谱文件'),
      ),

      h(
        'div',
        {class: 'hub-body'},
        h(
          'div',
          {class: 'hub-content-grid'},
          h(
            'div',
            {class: 'hub-card hub-table-card'},
            h(
              'div',
              {class: 'hub-table-header'},
              h('span', null, '最近文件'),
              h(
                'div',
                {
                  class: 'hub-form-group',
                  style: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '8px',
                  },
                },
                h('input', {
                  class: 'hub-input',
                  style: {height: '28px', width: '160px'},
                  type: 'text',
                  placeholder: '搜索历史...',
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
                  'thead',
                  null,
                  h(
                    'tr',
                    null,
                    h('th', null, '文件名'),
                    h('th', {style: {width: '120px'}}, '最后打开时间'),
                  ),
                ),
                h(
                  'tbody',
                  null,
                  mockHistory.map((item, i) =>
                    h(
                      'tr',
                      {
                        class: i === 0 ? 'selected' : '',
                        onClick: () => {},
                      },
                      h('td', null, item.filename),
                      h('td', {style: {color: '#6e6e73'}}, item.lastOpened),
                    ),
                  ),
                ),
              ),
            ),
          ),

          h(
            'div',
            {class: 'hub-card hub-detail-card'},
            h('div', {class: 'hub-detail-section-title'}, '对局概览'),
            h(
              'div',
              {class: 'hub-detail-list'},
              h(
                'div',
                {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '文件名'),
                h('span', {class: 'hub-detail-value'}, '2024_05_12_game.sgf'),
              ),
              h(
                'div',
                {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '类型'),
                h('span', {class: 'hub-detail-value'}, 'SGF 棋谱'),
              ),
              h(
                'div',
                {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, '棋手'),
                h('span', {class: 'hub-detail-value'}, 'Player A vs Player B'),
              ),
            ),
            h(
              'div',
              {style: {marginTop: 'auto'}},
              h(
                'button',
                {
                  class: 'hub-button hub-button--primary',
                  style: {width: '100%'},
                },
                '立即加载此棋谱',
              ),
            ),
          ),
        ),
      ),
    )
  }
}
