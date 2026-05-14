import {h, Component} from 'preact'

export default class GeneralSettingsPane extends Component {
  render() {
    return h(
      'div',
      {class: 'hub-pane'},
      h(
        'header',
        {class: 'hub-header'},
        h('h1', null, '通用设置'),
        h('p', {class: 'subtitle'}, '管理应用程序的基本行为和首选项'),
      ),
      h(
        'div',
        {class: 'hub-body'},
        h(
          'div',
          {class: 'hub-card', style: {padding: '24px'}},
          h('div', {class: 'hub-detail-section-title'}, '应用程序行为'),
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
              ' 启动时检查更新',
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
              ' 启用硬件加速 (需重启)',
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
              ' 启用音效',
            ),
            h(
              'div',
              {class: 'hub-form-group', style: {marginTop: '4px'}},
              h('label', {class: 'hub-label'}, '界面语言'),
              h(
                'select',
                {class: 'hub-input', style: {width: '200px'}},
                h('option', {value: 'zh-CN'}, '简体中文'),
                h('option', {value: 'en'}, 'English'),
                h('option', {value: 'ja'}, '日本語'),
              ),
            ),
          ),
        ),
        h(
          'div',
          {class: 'hub-card', style: {padding: '24px', marginTop: '16px'}},
          h('div', {class: 'hub-detail-section-title'}, '行为与交互'),
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
            h(
              'div',
              {class: 'hub-form-group'},
              h('label', {class: 'hub-label'}, '变化重演模式'),
              h(
                'select',
                {class: 'hub-input', style: {width: '200px'}},
                h('option', {value: 'disabled'}, '禁用'),
                h('option', {value: 'move_by_move'}, '逐步重演'),
                h('option', {value: 'instantly'}, '立即重演'),
              ),
            ),
            h(
              'div',
              {class: 'hub-form-group'},
              h('label', {class: 'hub-label'}, '棋谱树样式'),
              h(
                'select',
                {class: 'hub-input', style: {width: '200px'}},
                h('option', {value: 'compact'}, '紧凑'),
                h('option', {value: 'spacious'}, '宽敞'),
                h('option', {value: 'big'}, '大'),
              ),
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
              ' 点击最后一手移除',
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
              ' 显示自动落子标题',
            ),
          ),
        ),
        h(
          'div',
          {class: 'hub-card', style: {padding: '24px', marginTop: '16px'}},
          h('div', {class: 'hub-detail-section-title'}, '文件处理'),
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
              ' 载入文件后跳转至末尾',
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
              ' 文件被外部修改时提示重新载入',
            ),
          ),
        ),
        h(
          'div',
          {class: 'hub-card', style: {padding: '24px', marginTop: '16px'}},
          h('div', {class: 'hub-detail-section-title'}, '警告提示'),
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
              ' 显示劫争警告',
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
              ' 显示自杀着手警告',
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
              ' 显示删除节点警告',
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
              ' 显示删除其他变化图警告',
            ),
          ),
        ),
      ),
    )
  }
}
