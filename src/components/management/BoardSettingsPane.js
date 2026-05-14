import {h, Component} from 'preact'

export default class BoardSettingsPane extends Component {
  render() {
    return h(
      'div',
      {class: 'hub-pane'},
      h(
        'header',
        {class: 'hub-header'},
        h('h1', null, '棋盘设置'),
        h('p', {class: 'subtitle'}, '自定义棋盘外观、棋子样式和显示首选项'),
      ),
      h(
        'div',
        {class: 'hub-body'},
        h(
          'div',
          {class: 'hub-card', style: {padding: '24px'}},
          h('div', {class: 'hub-detail-section-title'}, '主题'),
          h(
            'div',
            {
              style: {
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                marginTop: '12px',
              },
            },
            h(
              'select',
              {class: 'hub-input', style: {flex: 1}},
              h('option', {value: ''}, '默认主题'),
              h('option', {value: 'dark'}, '深色简约'),
              h('option', {value: 'wood'}, '经典木纹'),
            ),
            h(
              'button',
              {class: 'hub-button hub-button--secondary'},
              '获取更多主题...',
            ),
          ),
        ),
        h(
          'div',
          {class: 'hub-card', style: {padding: '24px', marginTop: '16px'}},
          h('div', {class: 'hub-detail-section-title'}, '自定义图片'),
          h(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '12px',
              },
            },
            ['黑子图片', '白子图片', '棋盘图片', '背景图片'].map((label) =>
              h(
                'div',
                {class: 'hub-detail-row'},
                h('span', {class: 'hub-detail-label'}, label),
                h(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      gap: '8px',
                      flex: 1,
                      justifyContent: 'flex-end',
                    },
                  },
                  h('input', {
                    class: 'hub-input',
                    type: 'text',
                    style: {flex: 1, maxWidth: '280px'},
                    placeholder: '留空使用默认',
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
            ),
          ),
        ),
        h(
          'div',
          {class: 'hub-card', style: {padding: '24px', marginTop: '16px'}},
          h('div', {class: 'hub-detail-section-title'}, '棋子与显示'),
          h(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px 24px',
                marginTop: '12px',
              },
            },
            h(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                },
              },
              h('input', {type: 'checkbox', checked: true}),
              ' 显示落子序号',
            ),
            h(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                },
              },
              h('input', {type: 'checkbox', checked: true}),
              ' 突出显示当前落子',
            ),
            h(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                },
              },
              h('input', {type: 'checkbox', checked: true}),
              ' 显示下一手',
            ),
            h(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                },
              },
              h('input', {type: 'checkbox', checked: true}),
              ' 显示兄弟变化图',
            ),
            h(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                },
              },
              h('input', {type: 'checkbox', checked: true}),
              ' 显示热力图',
            ),
          ),
        ),
        h(
          'div',
          {class: 'hub-card', style: {padding: '24px', marginTop: '16px'}},
          h('div', {class: 'hub-detail-section-title'}, '坐标系'),
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '12px',
              },
            },
            h(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                },
              },
              h('input', {type: 'checkbox', checked: true}),
              ' 显示坐标',
            ),
            h(
              'select',
              {class: 'hub-input', style: {width: '120px'}},
              h('option', {value: 'A1'}, 'A1 (默认)'),
              h('option', {value: '1-1'}, '1-1'),
              h('option', {value: 'relative'}, '相对坐标'),
            ),
          ),
        ),
      ),
    )
  }
}
