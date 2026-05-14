import {h, Component} from 'preact'

export default class AdvancedSettingsPane extends Component {
  render() {
    return h(
      'div',
      {class: 'hub-pane'},
      h(
        'header',
        {class: 'hub-header'},
        h('h1', null, '设置与调试'),
        h('p', {class: 'subtitle'}, '管理应用程序日志、导出配置及重置设置'),
      ),

      h(
        'div',
        {class: 'hub-body'},
        h(
          'div',
          {class: 'hub-section'},
          h('div', {class: 'hub-detail-section-title'}, '日志配置'),
          h(
            'div',
            {class: 'hub-card', style: {padding: '20px'}},
            h(
              'div',
              {style: {display: 'flex', flexDirection: 'column', gap: '16px'}},
              h(
                'div',
                {style: {display: 'flex', flexDirection: 'column', gap: '8px'}},
                h(
                  'label',
                  {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                    },
                  },
                  h('input', {type: 'checkbox', checked: true}),
                  ' 启用应用日志 (App Logging)',
                ),
                h(
                  'div',
                  {class: 'hub-form-group', style: {marginLeft: '24px'}},
                  h('label', {class: 'hub-label'}, '日志保存目录'),
                  h(
                    'div',
                    {style: {display: 'flex', gap: '8px'}},
                    h('input', {
                      class: 'hub-input',
                      style: {flex: 1},
                      type: 'text',
                      value:
                        'C:\\Users\\Sabaki\\AppData\\Roaming\\Sabaki\\logs',
                      readOnly: true,
                    }),
                    h(
                      'button',
                      {
                        class: 'hub-button hub-button--secondary',
                        style: {height: '44px'},
                      },
                      '浏览...',
                    ),
                  ),
                ),
              ),
              h(
                'div',
                {style: {display: 'flex', flexDirection: 'column', gap: '8px'}},
                h(
                  'label',
                  {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                    },
                  },
                  h('input', {type: 'checkbox'}),
                  ' 启用 GTP 控制台日志',
                ),
                h(
                  'div',
                  {class: 'hub-form-group', style: {marginLeft: '24px'}},
                  h('label', {class: 'hub-label'}, 'GTP 日志保存目录'),
                  h(
                    'div',
                    {style: {display: 'flex', gap: '8px'}},
                    h('input', {
                      class: 'hub-input',
                      style: {flex: 1},
                      type: 'text',
                      placeholder: '未设置...',
                      readOnly: true,
                    }),
                    h(
                      'button',
                      {
                        class: 'hub-button hub-button--secondary',
                        style: {height: '44px'},
                      },
                      '浏览...',
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),

        h(
          'div',
          {class: 'hub-section', style: {marginTop: '24px'}},
          h('div', {class: 'hub-detail-section-title'}, '维护与导出'),
          h(
            'div',
            {class: 'hub-card', style: {padding: '20px'}},
            h(
              'div',
              {style: {display: 'flex', gap: '12px'}},
              h(
                'button',
                {class: 'hub-button hub-button--secondary', style: {flex: 1}},
                '导出所有设置...',
              ),
              h(
                'button',
                {class: 'hub-button hub-button--secondary', style: {flex: 1}},
                '导入设置文件...',
              ),
            ),
            h(
              'button',
              {
                class: 'hub-button hub-button--secondary',
                style: {width: '100%', marginTop: '12px', color: '#dc2626'},
              },
              '重置所有设置为默认值',
            ),
          ),
        ),
      ),
    )
  }
}
