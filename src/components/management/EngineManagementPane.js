import {h, Component} from 'preact'

const mockEngines = [
  {name: 'KataGo 1.14', kind: 'katago', status: 'ready'},
  {name: 'Leela Zero', kind: 'generic', status: 'disconnected'},
  {name: 'GNU Go', kind: 'generic', status: 'disconnected'},
]

export default class EngineManagementPane extends Component {
  constructor() {
    super()
    this.state = {selectedIndex: 0}
  }

  render() {
    const engine = mockEngines[this.state.selectedIndex]

    return h(
      'div',
      {class: 'hub-pane'},
      h(
        'header',
        {class: 'hub-header'},
        h('h1', null, '引擎管理'),
        h(
          'p',
          {class: 'subtitle'},
          '配置与管理 GTP 引擎，包括 KataGo 及其分析模型',
        ),
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
              h('span', null, '已安装引擎'),
              h(
                'button',
                {
                  class: 'hub-button hub-button--secondary',
                  style: {height: '28px', fontSize: '12px', padding: '0 12px'},
                },
                '+ 添加引擎',
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
                    h('th', {style: {width: '40px'}}, ''),
                    h('th', null, '引擎名称'),
                    h('th', {style: {width: '100px'}}, '类型'),
                  ),
                ),
                h(
                  'tbody',
                  null,
                  ...mockEngines.map((e, i) =>
                    h(
                      'tr',
                      {
                        key: e.name,
                        class: this.state.selectedIndex === i ? 'selected' : '',
                        onClick: () => this.setState({selectedIndex: i}),
                      },
                      h(
                        'td',
                        null,
                        h('input', {
                          type: 'checkbox',
                          checked: e.status === 'ready',
                        }),
                      ),
                      h('td', null, e.name),
                      h('td', null, e.kind),
                    ),
                  ),
                ),
              ),
            ),
          ),
          h(
            'div',
            {class: 'hub-card hub-detail-card'},
            h('div', {class: 'hub-detail-section-title'}, '引擎配置'),
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  marginTop: '12px',
                },
              },
              h(
                'div',
                {class: 'hub-form-group'},
                h('label', {class: 'hub-label'}, '引擎名称'),
                h('input', {
                  class: 'hub-input',
                  type: 'text',
                  value: engine.name,
                }),
              ),
              h(
                'div',
                {class: 'hub-form-group'},
                h('label', {class: 'hub-label'}, '引擎类型'),
                h(
                  'select',
                  {class: 'hub-input'},
                  h('option', {value: 'generic'}, '通用 GTP'),
                  h('option', {value: 'katago'}, 'KataGo'),
                ),
              ),
              h(
                'div',
                {class: 'hub-form-group'},
                h('label', {class: 'hub-label'}, '执行文件路径'),
                h(
                  'div',
                  {style: {display: 'flex', gap: '8px'}},
                  h('input', {
                    class: 'hub-input',
                    type: 'text',
                    style: {flex: 1},
                    value: 'C:\\Games\\KataGo\\katago.exe',
                  }),
                  h(
                    'button',
                    {
                      class: 'hub-button hub-button--secondary',
                      style: {
                        height: '36px',
                        padding: '0 12px',
                        fontSize: '13px',
                      },
                    },
                    '浏览...',
                  ),
                ),
              ),
              h(
                'div',
                {class: 'hub-form-group'},
                h('label', {class: 'hub-label'}, '启动参数'),
                h('input', {
                  class: 'hub-input',
                  type: 'text',
                  value: 'gtp -config default_gtp.cfg -model b18c384.bin.gz',
                }),
              ),
              h(
                'div',
                {class: 'hub-form-group'},
                h('label', {class: 'hub-label'}, '初始命令'),
                h('input', {
                  class: 'hub-input',
                  type: 'text',
                  placeholder: '用 ; 分隔',
                }),
              ),
            ),
            h(
              'div',
              {style: {display: 'flex', gap: '8px', marginTop: '16px'}},
              h(
                'button',
                {class: 'hub-button hub-button--secondary', style: {flex: 1}},
                '测试引擎',
              ),
              h(
                'button',
                {
                  class: 'hub-button hub-button--secondary',
                  style: {flex: 1, color: '#dc2626'},
                },
                '删除',
              ),
            ),
          ),
        ),
      ),
      h(
        'div',
        {class: 'hub-bottom-bar'},
        h('div', null),
        h(
          'div',
          {class: 'hub-action-group'},
          h(
            'button',
            {class: 'hub-button hub-button--primary'},
            '保存所有更改',
          ),
        ),
      ),
    )
  }
}
