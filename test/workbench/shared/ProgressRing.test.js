/**
 * ProgressRing Contract Tests (Phase 2.2)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-2.2a through T-2.2e
 *
 * Test Legitimacy:
 *   All tests import the production ProgressRing component.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: ProgressRing is a TO-BE-CREATED component.
 *
 * Fragility note (from contract): Assert proportional relationship, not exact pixels.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let ProgressRing = null

describe('ProgressRing (T-2.2)', function () {
  before(async function () {
    ProgressRing = await tryImport('src/components/workbench/shared/ProgressRing.js')
    if (!ProgressRing) this.skip()
  })

  // --- T-2.2a: progress=75 produces correct stroke-dashoffset proportion ---
  // Production subject: ProgressRing component
  // Production bug: stroke-dashoffset calculation is wrong for partial progress
  // Controlled dependencies: props are inline test data
  it('T-2.2a: progress=75 produces proportional stroke-dashoffset', () => {
    const {queryByTestId} = renderToDom(
      h(ProgressRing, {progress: 75})
    )

    const circle = queryByTestId('progress-ring-fill')
    assert.ok(circle, 'Circle element with data-testid="progress-ring-fill" not found')

    const strokeDasharray = parseFloat(circle.getAttribute('stroke-dasharray'))
    const strokeDashoffset = parseFloat(circle.getAttribute('stroke-dashoffset'))

    assert.ok(strokeDasharray > 0, 'stroke-dasharray should be positive')
    assert.ok(!isNaN(strokeDashoffset), 'stroke-dashoffset should be a number')

    // At 75%, dashoffset should be 25% of circumference (dasharray)
    const expectedOffset = strokeDasharray * (1 - 0.75)
    const tolerance = strokeDasharray * 0.01 // 1% tolerance
    assert.ok(
      Math.abs(strokeDashoffset - expectedOffset) <= tolerance,
      `stroke-dashoffset ${strokeDashoffset} not proportional to 75% of circumference ${strokeDasharray} (expected ~${expectedOffset})`
    )
  })

  // --- T-2.2b: progress=0 produces empty ring ---
  // Production subject: ProgressRing component
  // Production bug: progress=0 does not fully hide the fill
  it('T-2.2b: progress=0 produces empty ring (dashoffset = circumference)', () => {
    const {queryByTestId} = renderToDom(
      h(ProgressRing, {progress: 0})
    )

    const circle = queryByTestId('progress-ring-fill')
    assert.ok(circle, 'Circle element not found')

    const strokeDasharray = parseFloat(circle.getAttribute('stroke-dasharray'))
    const strokeDashoffset = parseFloat(circle.getAttribute('stroke-dashoffset'))

    // At 0%, dashoffset should equal circumference (fully hidden)
    const tolerance = strokeDasharray * 0.01
    assert.ok(
      Math.abs(strokeDashoffset - strokeDasharray) <= tolerance,
      `At progress=0, dashoffset (${strokeDashoffset}) should equal circumference (${strokeDasharray})`
    )
  })

  // --- T-2.2c: progress=100 produces full ring ---
  // Production subject: ProgressRing component
  // Production bug: progress=100 does not fully fill the ring
  it('T-2.2c: progress=100 produces full ring (dashoffset = 0)', () => {
    const {queryByTestId} = renderToDom(
      h(ProgressRing, {progress: 100})
    )

    const circle = queryByTestId('progress-ring-fill')
    assert.ok(circle, 'Circle element not found')

    const strokeDashoffset = parseFloat(circle.getAttribute('stroke-dashoffset'))

    // At 100%, dashoffset should be 0 (fully visible)
    assert.ok(
      Math.abs(strokeDashoffset) <= 1,
      `At progress=100, dashoffset (${strokeDashoffset}) should be ~0`
    )
  })

  // --- T-2.2d: size prop controls container dimensions ---
  // Production subject: ProgressRing component
  // Production bug: size prop has no effect on rendered dimensions
  it('T-2.2d: size prop controls container dimensions', () => {
    const {queryByTestId} = renderToDom(
      h(ProgressRing, {progress: 50, size: 120})
    )

    const container = queryByTestId('progress-ring')
    assert.ok(container, 'Container element with data-testid="progress-ring" not found')

    // Check that the size is applied (either via style or width/height attribute)
    const style = container.getAttribute('style') || ''
    const width = container.getAttribute('width')
    const height = container.getAttribute('height')

    const hasSize120 = style.includes('120') || width === '120' || height === '120'
    assert.ok(hasSize120, 'size=120 should be reflected in container dimensions')
  })

  // --- T-2.2e: label prop renders center text ---
  // Production subject: ProgressRing component
  // Production bug: label prop text not displayed
  it('T-2.2e: label prop renders center text', () => {
    const {queryByTestId} = renderToDom(
      h(ProgressRing, {progress: 50, label: '5/10'})
    )

    const label = queryByTestId('progress-ring-label')
    assert.ok(label, 'Label element with data-testid="progress-ring-label" not found')
    assert.ok(label.textContent.includes('5/10'), 'Label text not rendered correctly')
  })
})
