import assert from 'assert'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const Module = require('module')

function withPlatform(value, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', {...descriptor, value})

  try {
    return callback()
  } finally {
    Object.defineProperty(process, 'platform', descriptor)
  }
}

function loadMenuWithMocks() {
  const menuPath = require.resolve('../src/menu.js')
  const originalLoad = Module._load
  const originalWindow = globalThis.window

  globalThis.window = {}
  delete require.cache[menuPath]

  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: {
          name: 'Sabaki',
          getVersion: () => '0.60.0',
          quit: () => {},
        },
        clipboard: {
          readText: () => '',
          writeText: () => {},
        },
        shell: {
          openExternal: () => {},
          showItemInFolder: () => {},
        },
      }
    }

    if (parent?.filename === menuPath && request === './i18n') {
      return {
        t: (_scope, value, params = {}) =>
          typeof value === 'function' ? value(params) : value,
        context: () => (value) => value,
      }
    }

    if (parent?.filename === menuPath && request === './setting') {
      return {
        get: () => false,
        set: () => {},
        settingsPath: '',
      }
    }

    return originalLoad.apply(this, arguments)
  }

  try {
    return require('../src/menu.js')
  } finally {
    Module._load = originalLoad
    delete require.cache[menuPath]
    globalThis.window = originalWindow
  }
}

describe('application menu', () => {
  it('keeps Preferences in the File menu when adding the macOS app menu', () => {
    withPlatform('darwin', () => {
      const menu = loadMenuWithMocks().get()
      const fileMenu = menu.find((item) => item.id === 'file')
      const appMenu = menu[0]

      assert.ok(fileMenu, 'File menu should exist')
      assert.ok(appMenu, 'macOS app menu should be inserted')

      const fileLabels = fileMenu.submenu.map((item) => item.label)
      const appLabels = appMenu.submenu.map((item) => item.label)

      assert.ok(
        fileLabels.includes('&Preferences…'),
        'File menu should keep Preferences',
      )
      assert.ok(
        appLabels.includes('&Preferences…'),
        'macOS app menu should also expose Preferences',
      )
      assert.ok(
        !fileLabels.includes('&Quit'),
        'File menu should still hand Quit over to the macOS app menu',
      )
    })
  })
})
