import {existsSync} from 'fs'
import {shell} from 'electron'
import {h, Component} from 'preact'
import classNames from 'classnames'
import {join} from 'path'
import {rimraf} from 'rimraf'
import {v4 as uuid} from 'uuid'

import i18n from '../../i18n.js'
import sabaki from '../../modules/sabaki.js'
import {showOpenDialog, showMessageBox} from '../../modules/dialog.js'
import {
  copyFolderSync,
  noop,
  isWritableDirectory,
} from '../../modules/helper.js'
import * as gtplogger from '../../modules/gtplogger.js'
import Modal from '../Modal.js'

const setting = {
  get: (key) => window.sabaki.setting.get(key),
  set: (key, value) => {
    window.sabaki.setting.set(key, value)
    return setting
  },
  getThemes: () => window.sabaki.setting.getThemes(),
  loadThemes: () => window.sabaki.setting.loadThemes(),
  get themesDirectory() {
    return window.sabaki.setting.themesDirectory
  },
  onDidChange: (callback) => window.sabaki.setting.onDidChange(callback),
}
const t = i18n.context('PreferencesDrawer')

class PreferencesItem extends Component {
  constructor(props) {
    super(props)

    this.state = {
      checked: setting.get(props.id),
    }

    this.handleChange = (evt) => {
      let {onChange = noop} = this.props
      let {checked} = evt.currentTarget

      setting.set(this.props.id, checked)
      onChange(Object.assign({checked}, this.props))
    }

    setting.onDidChange(({key, value}) => {
      if (key === this.props.id) {
        this.setState({checked: value})
      }
    })
  }

  render({text}, {checked}) {
    return h(
      'li',
      {},
      h(
        'label',
        {},
        h('input', {
          type: 'checkbox',
          checked,
          onChange: this.handleChange,
        }),
        ' ',

        text,
      ),
    )
  }
}

class GeneralTab extends Component {
  constructor(props) {
    super(props)

    this.state = {
      appLang: setting.get('app.lang'),
      variationReplayMode: setting.get('board.variation_replay_mode'),
    }

    this.handleSoundEnabledChange = (evt) => {
      sabaki.window.webContents.audioMuted = !evt.checked
    }

    this.handleTreeStyleChange = (evt) => {
      let data = {compact: [16, 4], spacious: [22, 4], big: [26, 6]}
      let [graphGridSize, graphNodeSize] = data[evt.currentTarget.value]

      setting.set('graph.grid_size', graphGridSize)
      setting.set('graph.node_size', graphNodeSize)
    }

    this.handleLanguageChange = (evt) => {
      setting.set('app.lang', evt.currentTarget.value)

      showMessageBox(
        t(
          (p) => `Please restart ${p.appName} to apply your language setting.`,
          {
            appName: sabaki.appName,
          },
        ),
      )
    }

    this.handleVariationReplayModeChange = (evt) => {
      setting.set('board.variation_replay_mode', evt.currentTarget.value)
    }

    setting.onDidChange(({key, value}) => {
      if (key === 'app.lang') {
        this.setState({appLang: value})
      } else if (key === 'board.variation_replay_mode') {
        this.setState({variationReplayMode: value})
      }
    })
  }

  render({graphGridSize}) {
    return h(
      'div',
      {class: 'prefs-dialog__section'},
      h(
        'ul',
        {class: 'prefs-dialog__check-list'},
        h(PreferencesItem, {
          id: 'app.enable_hardware_acceleration',
          text: t('Enable hardware acceleration if possible'),
        }),
        h(PreferencesItem, {
          id: 'app.startup_check_updates',
          text: t('Check for updates at startup'),
        }),
        h(PreferencesItem, {
          id: 'sound.enable',
          text: t('Enable sounds'),
          onChange: this.handleSoundEnabledChange,
        }),
        h(PreferencesItem, {
          id: 'game.goto_end_after_loading',
          text: t('Jump to end after loading file'),
        }),
        h(PreferencesItem, {
          id: 'view.fuzzy_stone_placement',
          text: t('Fuzzy stone placement'),
        }),
        h(PreferencesItem, {
          id: 'view.animated_stone_placement',
          text: t('Animate fuzzy placement'),
        }),

        h(
          'li',
          {class: 'prefs-dialog__select'},
          h(
            'label',
            {},
            t('Variation Replay Mode:'),
            ' ',

            h(
              'select',
              {onChange: this.handleVariationReplayModeChange},

              h(
                'option',
                {
                  value: 'disabled',
                  selected: this.state.variationReplayMode === 'disabled',
                },
                t('Disabled'),
              ),

              h(
                'option',
                {
                  value: 'move_by_move',
                  selected: this.state.variationReplayMode === 'move_by_move',
                },
                t('Move by Move'),
              ),

              h(
                'option',
                {
                  value: 'instantly',
                  selected: this.state.variationReplayMode === 'instantly',
                },
                t('Instantly'),
              ),
            ),
          ),
        ),

        h(
          'li',
          {class: 'prefs-dialog__select'},
          h(
            'label',
            {},
            t('Language:'),
            ' ',

            h(
              'select',
              {onChange: this.handleLanguageChange},

              Object.entries(i18n.getLanguages())
                .filter(
                  ([, entry]) =>
                    entry.stats != null &&
                    entry.stats.translatedStringsCount > 0,
                )
                .map(([locale, entry]) =>
                  h(
                    'option',
                    {
                      value: locale,
                      selected: this.state.appLang === locale,
                    },
                    `${entry.nativeName} (${entry.name})`,
                  ),
                ),
            ),
            ' ',
            h(
              'span',
              {},
              i18n.formatNumber(
                Math.floor(
                  i18n.getLanguages()[this.state.appLang].stats.progress * 100,
                ),
              ) + '%',
            ),
          ),
        ),

        h(
          'li',
          {class: 'prefs-dialog__select'},
          h(
            'label',
            {},
            t('Game Tree Style:'),
            ' ',

            h(
              'select',
              {onChange: this.handleTreeStyleChange},

              h(
                'option',
                {
                  value: 'compact',
                  selected: graphGridSize < 22,
                },
                t('Compact'),
              ),

              h(
                'option',
                {
                  value: 'spacious',
                  selected: graphGridSize === 22,
                },
                t('Spacious'),
              ),

              h(
                'option',
                {
                  value: 'big',
                  selected: graphGridSize > 22,
                },
                t('Big'),
              ),
            ),
          ),
        ),
      ),

      h(
        'ul',
        {class: 'prefs-dialog__check-list'},
        h(PreferencesItem, {
          id: 'comments.show_move_interpretation',
          text: t('Show automatic move titles'),
        }),
        h(PreferencesItem, {
          id: 'game.show_ko_warning',
          text: t('Show ko warning'),
        }),
        h(PreferencesItem, {
          id: 'game.show_suicide_warning',
          text: t('Show suicide warning'),
        }),
        h(PreferencesItem, {
          id: 'edit.show_removenode_warning',
          text: t('Show remove node warning'),
        }),
        h(PreferencesItem, {
          id: 'edit.show_removeothervariations_warning',
          text: t('Show remove other variations warning'),
        }),
        h(PreferencesItem, {
          id: 'file.show_reload_warning',
          text: t('Offer to reload file if changed externally'),
        }),
        h(PreferencesItem, {
          id: 'edit.click_currentvertex_to_remove',
          text: t('Click last played stone to remove'),
        }),
        h(PreferencesItem, {
          id: 'view.winrategraph_invert',
          text: t('Invert winrate graph'),
        }),
      ),
    )
  }
}

class PathInputItem extends Component {
  constructor(props) {
    super(props)

    this.state = {
      value: setting.get(props.id),
    }

    this.handlePathChange = (evt) => {
      let value =
        evt.currentTarget.value.trim() === '' ? null : evt.currentTarget.value

      setting.set(this.props.id, value)
    }

    this.handleBrowseButtonClick = async (evt) => {
      let result = await showOpenDialog({
        properties:
          this.props.chooseDirectory != null
            ? ['openDirectory', 'createDirectory']
            : ['openFile'],
      })
      if (!result || result.length === 0) return

      this.handlePathChange({currentTarget: {value: result[0]}})
    }

    setting.onDidChange(({key, value}) => {
      if (key === this.props.id) {
        this.setState({value: value})
      }
    })
  }

  shouldComponentUpdate({text}, {value}) {
    return this.props.text !== text || this.props.value !== value
  }

  render({text}, {value}) {
    return h(
      'li',
      {class: 'prefs-dialog__path-item'},
      h(
        'label',
        {},
        text != null && h('span', {}, text),

        h('input', {
          type: 'search',
          placeholder: t('Path'),
          value,
          onChange: this.handlePathChange,
        }),

        h(
          'a',
          {
            class: 'prefs-dialog__browse',
            onClick: this.handleBrowseButtonClick,
          },
          h('img', {
            src: './node_modules/@primer/octicons/build/svg/file-directory.svg',
            title: t('Browse…'),
            height: 14,
          }),
        ),

        value &&
          !(this.props.chooseDirectory
            ? isWritableDirectory(value)
            : existsSync(value)) &&
          h(
            'a',
            {class: 'prefs-dialog__invalid'},
            h('img', {
              src: './node_modules/@primer/octicons/build/svg/alert.svg',
              title: this.props.chooseDirectory
                ? t('Directory not found')
                : t('File not found'),
              height: 14,
            }),
          ),
      ),
    )
  }
}

class ThemesTab extends Component {
  constructor() {
    super()

    this.state = {
      currentTheme: setting.get('theme.current'),
    }

    this.handleThemeChange = (evt) => {
      let value =
        evt.currentTarget.value === '' ? null : evt.currentTarget.value

      setting.set('theme.current', value)
    }

    this.handleLinkClick = (evt) => {
      evt.preventDefault()

      shell.openExternal(evt.currentTarget.href)
    }

    this.handleUninstallButton = async (evt) => {
      evt.preventDefault()

      let result = await showMessageBox(
        t('Do you really want to uninstall this theme?'),
        'warning',
        [t('Uninstall'), t('Cancel')],
        1,
      )
      if (result === 1) return

      let {path} = setting.getThemes()[this.state.currentTheme]

      try {
        await rimraf(path)
      } catch (err) {
        return showMessageBox(t('Uninstallation failed.'), 'error')
      }

      await setting.loadThemes()
      setting.set('theme.current', null)
    }

    this.handleInstallButton = async (evt) => {
      evt.preventDefault()

      let result = await showOpenDialog({
        properties: ['openFile'],
        filters: [{name: t('Sabaki Themes'), extensions: ['asar']}],
      })
      if (!result || result.length === 0) return

      let id = uuid()

      try {
        copyFolderSync(result[0], join(setting.themesDirectory, id))

        await setting.loadThemes()
        setting.set('theme.current', id)
      } catch (err) {
        return showMessageBox(t('Installation failed.'), 'error')
      }
    }

    setting.onDidChange(({key, value}) => {
      if (key === 'theme.current') {
        this.setState({currentTheme: value})
      }
    })
  }

  render() {
    let currentTheme = setting.getThemes()[this.state.currentTheme]

    return h(
      'div',
      {class: 'prefs-dialog__section'},
      h('h3', {}, t('Custom Images')),

      h(
        'ul',
        {class: 'prefs-dialog__userpaths'},
        h(PathInputItem, {
          id: 'theme.custom_blackstones',
          text: t('Black stone image:'),
        }),
        h(PathInputItem, {
          id: 'theme.custom_whitestones',
          text: t('White stone image:'),
        }),
        h(PathInputItem, {
          id: 'theme.custom_board',
          text: t('Board image:'),
        }),
        h(PathInputItem, {
          id: 'theme.custom_background',
          text: t('Background image:'),
        }),
      ),

      h('h3', {}, t('Current Theme')),

      h(
        'p',
        {},
        h(
          'select',
          {onChange: this.handleThemeChange},

          h(
            'option',
            {value: '', selected: currentTheme == null},
            t('Default'),
          ),

          Object.keys(setting.getThemes()).map((id) =>
            h(
              'option',
              {
                value: id,
                selected: currentTheme && currentTheme.id === id,
              },

              setting.getThemes()[id].name,
            ),
          ),
        ),
        ' ',

        currentTheme &&
          h(
            'button',
            {
              type: 'button',
              onClick: this.handleUninstallButton,
            },
            t('Uninstall'),
          ),

        h(
          'div',
          {},
          h(
            'button',
            {
              type: 'button',
              onClick: this.handleInstallButton,
            },
            t('Install Theme…'),
          ),
          ' ',
          h(
            'a',
            {
              href: `https://github.com/SabakiHQ/Sabaki/blob/v${sabaki.version}/docs/guides/theme-directory.md`,
              onClick: this.handleLinkClick,
              style: {cursor: 'pointer', color: 'var(--ui-blue)'},
            },
            t('Get more themes…'),
          ),
        ),
      ),

      currentTheme && [
        h(
          'p',
          {},
          currentTheme.author &&
            t((p) => `by ${p.author}`, {
              author: currentTheme.author,
            }),
          currentTheme.author && currentTheme.homepage && ' — ',
          currentTheme.homepage &&
            h(
              'a',
              {
                href: currentTheme.homepage,
                title: currentTheme.homepage,
                onClick: this.handleLinkClick,
                style: {cursor: 'pointer', color: 'var(--ui-blue)'},
              },
              t('Homepage'),
            ),
        ),

        h(
          'p',
          {},
          currentTheme.version &&
            h(
              'span',
              {class: 'prefs-dialog__version'},
              'v' + currentTheme.version,
            ),
          ' ',

          currentTheme.description,
        ),
      ],
    )
  }
}

class EngineItem extends Component {
  constructor() {
    super()

    this.handleChange = (evt) => {
      let {engine, onChange = noop} = this.props
      let element = evt.currentTarget

      onChange({
        ...engine,
        [element.name]:
          element.type === 'checkbox' ? element.checked : element.value,
      })
    }

    this.handleAnalysisChange = (evt) => {
      let {engine, onChange = noop} = this.props
      let element = evt.currentTarget

      onChange({
        ...engine,
        analysis: {
          ...(engine.analysis || {}),
          [element.name]: element.value,
        },
      })
    }

    this.browsePath = async (key) => {
      let result = await showOpenDialog({
        properties: ['openFile'],
        filters: [{name: t('All Files'), extensions: ['*']}],
      })
      if (!result || result.length === 0) return

      let {engine, onChange = noop} = this.props
      onChange({...engine, [key]: result[0]})
    }

    this.handleRemoveButtonClick = () => {
      let {onRemove = noop} = this.props
      onRemove(this.props)
    }
  }

  renderPathInput(key, placeholder, value) {
    return h(
      'p',
      {},
      h(
        'a',
        {
          class: 'prefs-dialog__browse',
          title: t('Browse...'),
          onClick: () => this.browsePath(key),
        },

        h('img', {
          src: './node_modules/@primer/octicons/build/svg/file-directory.svg',
        }),
      ),
      h('input', {
        type: 'text',
        placeholder,
        value: value || '',
        name: key,
        onChange: this.handleChange,
      }),
    )
  }

  renderAnalysisInput(name, placeholder, value, step = 1) {
    return h(
      'label',
      {class: 'engine-analysis-field'},
      h('span', {}, placeholder),
      h('input', {
        type: 'number',
        min: 0,
        step,
        name,
        value: value || '',
        onChange: this.handleAnalysisChange,
      }),
    )
  }

  render({engine}) {
    let {
      name,
      path,
      args,
      commands,
      enabled = true,
      kind = 'generic',
      modelPath,
      configPath,
      analysis = {},
    } = engine

    return h(
      'li',
      {},
      h(
        'h3',
        {},
        h(
          'a',
          {
            class: 'prefs-dialog__remove',
            title: t('Remove'),
            onClick: this.handleRemoveButtonClick,
          },

          h('img', {src: './node_modules/@primer/octicons/build/svg/x.svg'}),
        ),
        h(
          'label',
          {},
          h('input', {
            type: 'checkbox',
            name: 'enabled',
            checked: enabled !== false,
            onChange: this.handleChange,
          }),
          ' 启用 ',
        ),
        h('input', {
          type: 'text',
          placeholder: t('(Unnamed Engine)'),
          value: name,
          name: 'name',
          onChange: this.handleChange,
        }),
      ),
      h(
        'p',
        {},
        h('label', {}, '类型 '),
        h(
          'select',
          {
            name: 'kind',
            value: kind,
            onChange: this.handleChange,
          },
          h('option', {value: 'generic'}, '通用 GTP'),
          h('option', {value: 'katago'}, 'KataGo'),
        ),
      ),
      kind === 'katago' &&
        this.renderPathInput('modelPath', 'KataGo model file', modelPath),
      kind === 'katago' &&
        this.renderPathInput('configPath', 'KataGo config file', configPath),
      h(
        'p',
        {},
        h(
          'a',
          {
            class: 'prefs-dialog__browse',
            title: t('Browse…'),
            onClick: () => this.browsePath('path'),
          },

          h('img', {
            src: './node_modules/@primer/octicons/build/svg/file-directory.svg',
          }),
        ),
        h('input', {
          type: 'text',
          placeholder: t('Path'),
          value: path || '',
          name: 'path',
          onChange: this.handleChange,
        }),
      ),
      h(
        'p',
        {},
        h('input', {
          type: 'text',
          placeholder: t('No arguments'),
          value: args || '',
          name: 'args',
          onChange: this.handleChange,
        }),
      ),
      h(
        'p',
        {},
        h('input', {
          type: 'text',
          placeholder: t('Initial commands (;-separated)'),
          value: commands || '',
          name: 'commands',
          onChange: this.handleChange,
        }),
      ),
      kind === 'katago' &&
        h(
          'div',
          {class: 'engine-analysis-grid'},
          this.renderAnalysisInput('visits', 'visits', analysis.visits),
          this.renderAnalysisInput('playouts', 'playouts', analysis.playouts),
          this.renderAnalysisInput(
            'maxTime',
            '思考时间(s)',
            analysis.maxTime,
            0.1,
          ),
          this.renderAnalysisInput(
            'candidates',
            '候选点数量',
            analysis.candidates,
          ),
          this.renderAnalysisInput(
            'temperature',
            '温度',
            analysis.temperature,
            0.1,
          ),
        ),
    )
  }
}

class EnginesTab extends Component {
  constructor() {
    super()

    this.handleItemChange = (engine) => {
      let engines = this.props.engines.slice()

      engines[engine.index] = this.normalizeEngine(engine)
      setting.set('engines.list', engines)
    }

    this.handleItemRemove = ({engine}) => {
      let engines = this.props.engines.slice()

      engines.splice(engine.index, 1)
      setting.set('engines.list', engines)
    }

    this.handleAddButtonClick = (evt) => {
      evt.preventDefault()

      let engines = [
        {
          id: uuid(),
          name: '',
          path: '',
          args: '',
          enabled: true,
          kind: 'generic',
        },
        ...this.props.engines,
      ]
      setting.set('engines.list', engines)

      setImmediate(() => {
        this.element
          .querySelector('.prefs-dialog__engine-list li:first-child input')
          .focus()
      })
    }
  }

  normalizeEngine(engine) {
    let {index, ...data} = engine

    return {
      id: data.id || uuid(),
      enabled: data.enabled !== false,
      kind: data.kind || 'generic',
      name: data.name || '',
      path: data.path || '',
      args: data.args || '',
      commands: data.commands || '',
      modelPath: data.modelPath || '',
      configPath: data.configPath || '',
      analysis: data.analysis || {},
    }
  }

  render({engines}) {
    return h(
      'div',
      {ref: (el) => (this.element = el), class: 'prefs-dialog__section'},
      h(
        'ul',
        {class: 'prefs-dialog__check-list'},
        h(PreferencesItem, {
          id: 'gtp.console_log_enabled',
          text: t('Enable GTP logging to directory:'),
        }),

        h(PathInputItem, {
          id: 'gtp.console_log_path',
          chooseDirectory: true,
        }),
      ),
      h(
        'ul',
        {class: 'prefs-dialog__check-list'},
        h(PreferencesItem, {
          id: 'app.logging_enabled',
          text: t('Enable application logging:'),
        }),

        h(PreferencesItem, {
          id: 'app.logging_file_enabled',
          text: t('Write logs to file:'),
        }),

        h(PathInputItem, {
          id: 'app.logging_file_path',
          chooseDirectory: true,
        }),
      ),
      h(
        'div',
        {class: 'prefs-dialog__engine-list'},
        h(
          'ul',
          {},
          engines.map((engine, id) =>
            h(EngineItem, {
              engine: this.normalizeEngine({...engine, index: id}),

              onChange: this.handleItemChange,
              onRemove: this.handleItemRemove,
            }),
          ),
        ),
      ),

      h(
        'p',
        {},
        h(
          'button',
          {
            type: 'button',
            class: 'modal-btn modal-btn--secondary',
            onClick: this.handleAddButtonClick,
          },
          t('Add'),
        ),
      ),
    )
  }
}

export default class PreferencesDrawer extends Component {
  constructor() {
    super()

    this.handleClose = () => {
      sabaki.closeDrawer()
    }

    this.handleTabClick = (evt) => {
      let tabs = ['general', 'themes', 'engines']
      let tab = tabs.find((x) => evt.currentTarget.classList.contains(x))

      sabaki.setState({preferencesTab: tab})
    }
  }

  shouldComponentUpdate({show}) {
    return show || show !== this.props.show
  }

  componentDidUpdate(prevProps) {
    // On closing

    if (prevProps.show && !this.props.show) {
      // Validate GTP logging path

      if (sabaki.state.attachedEngineSyncers.length > 0) {
        if (!gtplogger.updatePath()) {
          // Force the user to fix the issue

          setTimeout(() => {
            sabaki.setState({preferencesTab: 'engines'})
            sabaki.openDrawer('preferences')
          }, 500)

          return
        }
      }

      // Reset tab selection

      sabaki.setState({preferencesTab: 'general'})
    }
  }

  render({show, tab, engines, graphGridSize}) {
    return h(
      Modal,
      {
        show,
        title: t('Preferences'),
        onClose: this.handleClose,
        width: 'min(640px, calc(100vw - 48px))',
      },

      h(
        'div',
        {class: 'prefs-dialog__tabs'},
        h(
          'button',
          {
            type: 'button',
            class: classNames('prefs-dialog__tab', 'general', {
              active: tab === 'general',
            }),
            onClick: this.handleTabClick,
          },
          t('General'),
        ),
        h(
          'button',
          {
            type: 'button',
            class: classNames('prefs-dialog__tab', 'themes', {
              active: tab === 'themes',
            }),
            onClick: this.handleTabClick,
          },
          t('Themes'),
        ),
        h(
          'button',
          {
            type: 'button',
            class: classNames('prefs-dialog__tab', 'engines', {
              active: tab === 'engines',
            }),
            onClick: this.handleTabClick,
          },
          t('Engines'),
        ),
      ),

      h(
        'div',
        {class: classNames('prefs-dialog__content', tab)},
        tab === 'general' && h(GeneralTab, {graphGridSize}),
        tab === 'themes' && h(ThemesTab),
        tab === 'engines' && h(EnginesTab, {engines}),
      ),

      h(
        'footer',
        {class: 'prefs-dialog__footer'},
        h(
          'button',
          {
            type: 'button',
            class: 'modal-btn modal-btn--primary',
            onClick: this.handleClose,
          },
          t('Close'),
        ),
      ),
    )
  }
}
