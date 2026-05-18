/**
 * Preact component test helper using jsdom.
 *
 * Provides renderToDom() which renders a Preact VNode into a jsdom document,
 * returning { container, queryByTestId, queryAllByTestId, getByTestId, getByText,
 * queryAllByText, fireEvent }.
 *
 * Usage:
 *   import { renderToDom } from '../preactTestHelper.js'
 *   const { getByTestId, fireEvent } = renderToDom(h(MyComponent, { ... }))
 */

import {JSDOM} from 'jsdom'
import {h, render} from 'preact'

const jsdomInstance = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
})

const domWindow = jsdomInstance.window
const domDocument = domWindow.document

// Preact's render() accesses global.document directly, so we must expose it.
if (typeof globalThis.document === 'undefined') {
  globalThis.document = domDocument
  globalThis.window = domWindow
  globalThis.Node = domWindow.Node
  globalThis.Event = domWindow.Event
  globalThis.MouseEvent = domWindow.MouseEvent
  globalThis.KeyboardEvent = domWindow.KeyboardEvent
  globalThis.Element = domWindow.Element
  globalThis.HTMLElement = domWindow.HTMLElement
  globalThis.Text = domWindow.Text
}

/**
 * Set up global DOM environment for a single test.
 * Returns a fresh container div and query utilities.
 */
export function createContainer() {
  // Clean up body
  domDocument.body.innerHTML = ''
  const container = domDocument.createElement('div')
  domDocument.body.appendChild(container)
  return container
}

/**
 * Render a Preact VNode into a jsdom container.
 * Returns query and event utilities.
 *
 * @param {import('preact').VNode} vnode
 * @returns {{ container: HTMLElement, queryByTestId: Function, queryAllByTestId: Function, getByTestId: Function, getByText: Function, queryAllByText: Function, fireEvent: Object }}
 */
export function renderToDom(vnode) {
  const container = createContainer()
  render(vnode, container)

  return {
    container,

    queryByTestId(testId) {
      return container.querySelector(`[data-testid="${testId}"]`)
    },

    queryAllByTestId(testId) {
      return Array.from(container.querySelectorAll(`[data-testid="${testId}"]`))
    },

    getByTestId(testId) {
      const el = container.querySelector(`[data-testid="${testId}"]`)
      if (!el) throw new Error(`Element with data-testid="${testId}" not found`)
      return el
    },

    getByText(text) {
      const all = Array.from(container.querySelectorAll('*'))
      const match = all.find(el => el.textContent.trim() === text && el.children.length === 0)
      if (!match) throw new Error(`Element with text "${text}" not found`)
      return match
    },

    queryAllByText(text) {
      const all = Array.from(container.querySelectorAll('*'))
      return all.filter(el => el.textContent.trim() === text && el.children.length === 0)
    },

    fireEvent: {
      click(el) {
        const evt = new domWindow.MouseEvent('click', {bubbles: true, cancelable: true})
        el.dispatchEvent(evt)
      },

      keyDown(el, key, options = {}) {
        const evt = new domWindow.KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...options})
        el.dispatchEvent(evt)
      },

      input(el, value) {
        el.value = value
        const evt = new domWindow.Event('input', {bubbles: true})
        el.dispatchEvent(evt)
      },

      change(el, value) {
        el.value = value
        const evt = new domWindow.Event('change', {bubbles: true})
        el.dispatchEvent(evt)
      },
    },
  }
}

/**
 * Export the jsdom window and document for direct access.
 */
export {domWindow as window, domDocument as document}
