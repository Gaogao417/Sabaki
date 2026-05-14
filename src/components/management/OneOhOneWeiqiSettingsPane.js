import {h, Component} from 'preact'

export default class OneOhOneWeiqiSettingsPane extends Component {
  render() {
    return h('div', {class: 'hub-pane'},
      h('header', {class: 'hub-header'},
        h('h1', null, '101围棋错题同步'),
        h('p', {class: 'subtitle'}, '登录 101围棋后同步错题本题目到本地，供训练和复盘使用')
      ),

      h('div', {class: 'hub-body'},
        h('div', {class: 'hub-section'},
          h('div', {class: 'hub-section-title'}, '账户连接'),
          h('div', {class: 'hub-panel'},
            h('div', {style: {display: 'flex', gap: '24px'}},
              h('div', {style: {flex: 1, display: 'flex', flexDirection: 'column', gap: '12px'}},
                h('div', {class: 'hub-form-group'},
                  h('label', {class: 'hub-label'}, '用户名 / 手机号'),
                  h('input', {class: 'hub-input', type: 'text', value: 'SabakiUser'})
                ),
                h('div', {class: 'hub-form-group'},
                  h('label', {class: 'hub-label'}, '密码'),
                  h('input', {class: 'hub-input', type: 'password', value: '********'})
                ),
                h('div', {style: {display: 'flex', gap: '12px'}},
                  h('button', {class: 'hub-button hub-button--primary'}, '登录'),
                  h('button', {class: 'hub-button hub-button--secondary'}, '退出登录')
                )
              ),
              h('div', {style: {width: '200px', padding: '12px', background: '#f9f9f9', borderRadius: '8px', fontSize: '13px'}},
                h('div', {style: {fontWeight: 600, marginBottom: '8px'}}, '状态'),
                h('div', {style: {color: '#059669'}}, '● 已连接'),
                h('div', {style: {marginTop: '8px', color: '#666'}}, '上次同步: 2小时前')
              )
            )
          )
        ),

        h('div', {class: 'hub-section', style: {marginTop: '24px'}},
          h('div', {class: 'hub-section-title'}, '同步选项'),
          h('div', {class: 'hub-panel'},
            h('div', {style: {display: 'flex', flexDirection: 'column', gap: '16px'}},
              h('div', {style: {display: 'flex', justifyContent: 'space-between', alignItems: 'center'}},
                h('div', null,
                  h('div', {style: {fontSize: '14px', fontWeight: 500}}, '同步错题本题目'),
                  h('div', {style: {fontSize: '12px', color: '#666'}}, '将云端错题本同步到本地缓存')
                ),
                h('button', {class: 'hub-button hub-button--primary'}, '开始同步')
              ),
              h('div', {style: {borderTop: '1px solid #f0f0f0', paddingTop: '16px'}},
                h('div', {class: 'hub-form-group'},
                  h('label', {class: 'hub-label'}, '本地缓存路径'),
                  h('div', {style: {display: 'flex', gap: '8px'}},
                    h('input', {class: 'hub-input', style: {flex: 1}, type: 'text', value: 'C:\\Users\\Sabaki\\101cache', readOnly: true}),
                    h('button', {class: 'hub-button hub-button--secondary'}, '更改...')
                  )
                )
              )
            )
          )
        ),

        h('div', {class: 'hub-section', style: {marginTop: '24px'}},
          h('div', {class: 'hub-section-title'}, '高级设置'),
          h('div', {class: 'hub-panel'},
            h('div', {style: {display: 'flex', flexDirection: 'column', gap: '12px'}},
              h('label', {style: {display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px'}},
                h('input', {type: 'checkbox', checked: true}),
                ' 下载题目缩略图'
              ),
              h('label', {style: {display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px'}},
                h('input', {type: 'checkbox'}),
                ' 同步时覆盖本地已解码数据'
              ),
              h('div', {style: {marginTop: '8px'}},
                h('button', {class: 'hub-button hub-button--secondary', style: {color: '#dc2626', borderColor: '#fee2e2'}}, '清除本地缓存')
              )
            )
          )
        )
      )
    )
  }
}
