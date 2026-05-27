/**
 * Harness/mock manifest:
 * - Layer: Workbench wiring/static contract guard for visible command coverage.
 * - Production subject: WORKBENCH_COMMANDS plus TrainingWorkbenchContainer handler
 *   implementations and presentational shell affordance files.
 * - Real files scanned: src/modules/training/workbench/workbenchCommandMap.ts,
 *   src/components/TrainingWorkbenchContainer.js, ModeBar, BottomActionBar,
 *   AnnotationToolbar, and LibrarySideDrawer.
 * - Mocks/scans: no runtime mocks; this suite uses exact source scans for command
 *   registration and high-risk owner-dispatch boundaries.
 * - Limits: this is not a click/render harness; source scans must stay specific
 *   enough to fail if a command's metadata owner disagrees with its production
 *   handler path.
 */
import assert from 'assert'
import fs from 'fs'

import {
  WORKBENCH_COMMANDS,
  findWorkbenchCommand,
  listWorkbenchCommands,
} from '../../../src/modules/training/workbench/workbenchCommandMap.ts'

const SOURCE_FILES = {
  container: 'src/components/TrainingWorkbenchContainer.js',
  modeBar: 'src/components/workbench/shell/ModeBar.js',
  bottomActionBar: 'src/components/workbench/shell/BottomActionBar.js',
  annotationToolbar: 'src/components/workbench/shared/AnnotationToolbar.js',
  librarySideDrawer: 'src/components/workbench/shared/LibrarySideDrawer.js',
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function extractFunctionBody(source, functionName) {
  const declaration = new RegExp(`function\\s+${functionName}\\s*\\([^)]*\\)\\s*{`, 'm')
  const match = declaration.exec(source)

  assert.ok(match, `TrainingWorkbenchContainer must define ${functionName}`)

  let depth = 1
  let index = match.index + match[0].length
  const start = index

  for (; index < source.length; index++) {
    const char = source[index]
    if (char === '{') depth++
    if (char === '}') depth--
    if (depth === 0) return source.slice(start, index)
  }

  assert.fail(`Could not parse ${functionName} body`)
}

function sourceForSurface(surface) {
  if (surface === 'modebar' || surface === 'topbar') return read(SOURCE_FILES.modeBar)
  if (surface === 'bottombar' || surface === 'editbar') {
    return read(SOURCE_FILES.bottomActionBar) + '\n' + read(SOURCE_FILES.annotationToolbar)
  }
  if (surface === 'library') return read(SOURCE_FILES.librarySideDrawer)
  return ''
}

describe('Workbench command map coverage', () => {
  it('exports a stable command list with unique ids', () => {
    assert.ok(Array.isArray(WORKBENCH_COMMANDS))
    assert.ok(WORKBENCH_COMMANDS.length > 0)

    const ids = WORKBENCH_COMMANDS.map(command => command.id)
    assert.deepStrictEqual(
      ids,
      [...new Set(ids)],
      'command ids must be unique',
    )
    assert.deepStrictEqual(listWorkbenchCommands().map(command => command.id), ids)
    assert.strictEqual(findWorkbenchCommand('analysis.snapshot')?.handlerProp, 'onSnapshot')
  })

  it('each command has an owner, handler, disabled reason, and visible affordance label', () => {
    for (const command of WORKBENCH_COMMANDS) {
      assert.ok(command.id, 'command requires id')
      assert.ok(command.surface, `${command.id} requires surface`)
      assert.ok(command.owner, `${command.id} requires owner`)
      assert.ok(command.handlerProp, `${command.id} requires handlerProp`)
      assert.ok(command.disabledReason, `${command.id} requires disabledReason`)
      assert.ok(command.label, `${command.id} requires visible label or key`)
      assert.ok(command.modes === 'any' || command.modes.length > 0,
        `${command.id} requires one or more modes`)
    }
  })

  it('training commands do not retain legacy controller ownership', () => {
    const legacyOwned = WORKBENCH_COMMANDS
      .filter(command => command.owner === 'legacyTrainingFlowController')
      .map(command => command.id)

    assert.deepStrictEqual(
      legacyOwned,
      [],
      `Workbench commands must route through service/adapter owners, not legacyTrainingFlowController: ${legacyOwned.join(', ')}`,
    )

    assert.strictEqual(
      findWorkbenchCommand('bottom.hint')?.owner,
      'workbenchFlowService',
      'Recall hint command must route through workbenchFlowService',
    )
  })

  it('container wires every handler prop declared by visible commands', () => {
    const container = read(SOURCE_FILES.container)
    const missing = WORKBENCH_COMMANDS
      .filter(command => command.surface !== 'keyboard')
      .filter(command => !container.includes(command.handlerProp))
      .map(command => `${command.id}:${command.handlerProp}`)

    assert.deepStrictEqual(
      missing,
      [],
      `TrainingWorkbenchContainer must wire every command handler: ${missing.join(', ')}`,
    )
  })

  it('visible commands appear in their owning shell component by test id or label', () => {
    const missing = []

    for (const command of WORKBENCH_COMMANDS) {
      if (command.surface === 'keyboard') continue

      const source = sourceForSurface(command.surface)
      const hasTestId = command.testId ? source.includes(command.testId) : false
      const hasLabel = source.includes(command.label)

      if (!hasTestId && !hasLabel) {
        missing.push(`${command.id}:${command.testId || command.label}`)
      }
    }

    assert.deepStrictEqual(
      missing,
      [],
      `visible commands must have component affordance coverage: ${missing.join(', ')}`,
    )
  })

  it('external material commands dispatch through task import and explicit play/problem task entrypoints instead of legacy third-party panels', () => {
    const container = read(SOURCE_FILES.container)
    const externalCommands = [
      {
        id: 'library.fox',
        handlerName: 'handleOpenFoxGames',
        expectedImportPattern: /taskImportService\.(?:importFoxGame|syncFoxGame|openFoxGame|createTaskFromFoxGame)/,
      },
      {
        id: 'library.101',
        handlerName: 'handleOpenOneOhOneWeiqi',
        expectedImportPattern: /taskImportService\.(?:import101Problem|importOneOhOneProblem|syncOneOhOneProblem|openOneOhOneProblem|createTaskFromOneOhOneProblem)/,
      },
    ]

    assert.deepStrictEqual(
      WORKBENCH_COMMANDS
        .filter(command => externalCommands.some(({id}) => id === command.id))
        .map(command => command.id)
        .sort(),
      ['library.101', 'library.fox'],
    )

    for (const {id, handlerName, expectedImportPattern} of externalCommands) {
      const command = findWorkbenchCommand(id)
      const body = extractFunctionBody(container, handlerName)

      assert.strictEqual(command.owner, 'taskImportService')
      assert.match(command.handlerProp, /^onOpen/)
      assert.ok(
        command.disabledReason.includes('失败') ||
          command.disabledReason.includes('无效') ||
          command.disabledReason.includes('未配置'),
        `${id} must expose a failure/invalid/not-configured disabled reason`,
      )

      assert.doesNotMatch(
        body,
        /toggleThirdPartyPanel/,
        `${id} must not dispatch through legacy sabaki.toggleThirdPartyPanel`,
      )
      assert.match(
        body,
        expectedImportPattern,
        `${id} must call its taskImportService import/sync boundary before opening a task`,
      )
      assert.match(
        body,
        id === 'library.fox'
          ? /openPlayTab\s*\(\s*{[^}]*taskId/
          : /openProblemTab\s*\(\s*{[^}]*taskId/,
        `${id} must open the imported/synced TrainingTask through the semantic Workbench tab entrypoint`,
      )
    }
  })

  it('visible library problem rows route through Workbench task opening, not legacy startProblem', () => {
    const container = read(SOURCE_FILES.container)
    const drawer = read(SOURCE_FILES.librarySideDrawer)
    const body = extractFunctionBody(container, 'handleOpenLibraryProblem')

    assert.ok(
      drawer.includes('onStartProblem(problem.id, problem)'),
      'LibrarySideDrawer must pass the visible problem row payload to the container',
    )
    assert.doesNotMatch(
      container,
      /sabaki\.startProblem\s*\(/,
      'TrainingWorkbenchContainer must not route visible problem rows through sabaki.startProblem',
    )
    assert.doesNotMatch(
      body,
      /legacyCompatibility\s*:\s*true|setMode\s*\(\s*['"]play['"]\s*\)/,
      'Visible problem row handler must not enable legacy compatibility or set legacy play mode',
    )
    assert.match(
      body,
      /createTaskFromLegacyProblem\s*\(/,
      'Legacy problem rows must first be converted to a TrainingTask',
    )
    assert.match(
      body,
      /openProblemTab\s*\(\s*{[^}]*taskId/,
      'Visible problem rows must open a semantic Workbench problem tab',
    )
  })

  it('container does not call the internal generic openTask primitive', () => {
    const container = read(SOURCE_FILES.container)
    assert.doesNotMatch(
      container,
      /tabService\.openTask\s*\(/,
      'TrainingWorkbenchContainer must route through openPlayTab/openProblemTab, not openTask',
    )
  })

  it('recall hint and skip handlers use flow service instead of legacy controller', () => {
    const container = read(SOURCE_FILES.container)
    const hintBody = extractFunctionBody(container, 'handleRequestHint')

    assert.match(
      hintBody,
      /flowService\.showRecallHint\s*\(/,
      'handleRequestHint must delegate recall hints to workbenchFlowService',
    )
    assert.doesNotMatch(
      container,
      /legacyTrainingFlowController\.(showRecallHint|skipRecallMove)/,
      'TrainingWorkbenchContainer must not call recall hint/skip through legacyTrainingFlowController',
    )
    assert.doesNotMatch(
      container,
      /window\?*\.sabaki|window\.sabaki/,
      'TrainingWorkbenchContainer must not read window.sabaki directly',
    )
  })
})
