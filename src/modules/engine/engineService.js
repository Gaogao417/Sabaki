import {join} from 'path'
import {h} from 'preact'
import {v4 as uuid} from 'uuid'

import gtp from '@sabaki/gtp'
import sgf from '@sabaki/sgf'

import i18n from '../../i18n.js'
import EngineSyncer from '../enginesyncer.js'
import * as dialog from '../dialog.js'
import * as gtplogger from '../gtplogger.js'
import {logger} from '../logger/index.js'
import * as gametree from '../gametree.js'
import * as helper from '../helper.js'
import * as sound from '../sound.js'

export function quoteCommandLinePart(value) {
  let text = `${value}`
  if (text === '') return '""'
  if (!/[\s"]/.test(text)) return text

  return `"${text.replace(/"/g, '\\"')}"`
}

export function formatEngineCommandLine(path, args = []) {
  return [path, ...args].map(quoteCommandLinePart).join(' ')
}

// ---------------------------------------------------------------------------
// Deps interface — zero sabaki references. Follows analysisLifecycle.ts pattern.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} EngineServiceDeps
 * @property {(key: string) => any} getSetting
 * @property {(treePosition: string) => number} getPlayer
 * @property {() => any} getGameTree
 * @property {() => string} getTreePosition
 * @property {() => string} getMode
 * @property {() => any} getEditWorkspace
 * @property {() => number} getGameIndex
 * @property {() => any[]} getGameTrees
 * @property {(tree: any, pos: string, opts?: any) => void} setCurrentTreePosition
 * @property {(tp: string) => void} analyzeMove
 * @property {() => void} scheduleEditWorkspaceAnalysis
 * @property {(tp: string) => void} scheduleLiveAnalysis
 * @property {() => void} syncEditWorkspaceToCurrentPosition
 * @property {(syncerId: string, tree: any, tp: string, ownership: any) => void} cacheOwnership
 * @property {() => Promise} saveCurrentGame
 * @property {(gameId: string) => Promise} startRecallSession
 * @property {() => Promise<void>} stopEngineGameTraining
 * @property {(positionKey: string) => void} notifyAnalysisUpdate
 * @property {(busy: boolean) => void} setBusy
 * @property {(text: string) => void} showInfoOverlay
 * @property {() => void} hideInfoOverlay
 * @property {(msg: string, type: string) => Promise<void>} showMessageBox
 * @property {() => void} notifyChange — triggers sabaki setState({}) to re-render
 * @property {() => string} getUserDataDirectory — path to user data dir (for HumanSL models)
 */

// ---------------------------------------------------------------------------
// Internal state type
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} EngineState
 * @property {EngineSyncer[]} attachedEngineSyncers
 * @property {string|null} analyzingEngineSyncerId
 * @property {string|null} blackEngineSyncerId
 * @property {string|null} whiteEngineSyncerId
 * @property {string|null} engineGameOngoing
 * @property {string|null} analysisTreePosition
 * @property {object|null} analysis
 * @property {number|null} quickAnalysisId
 * @property {string|null} quickAnalysisSyncerId
 * @property {boolean} humanSLAvailable
 * @property {boolean} humanSLModelLoaded
 * @property {string} humanSLProfile
 * @property {string|null} humanSLPendingProfile
 * @property {string|null} humanSLError
 * @property {object[]} consoleLog
 */

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an engine service that OWNS its state.
 *
 * This module owns all engine-related state (syncers, analysis, HumanSL, GTP
 * log). All dependencies are injected through deps — zero sabaki references.
 * Follows the analysisLifecycle.ts / overlayStore.ts pattern.
 *
 * @param {EngineServiceDeps} deps
 */
export function createEngineService(deps) {
  let {
    getSetting,
    getPlayer,
    getGameTree,
    getTreePosition,
    getMode,
    getEditWorkspace,
    getGameIndex,
    getGameTrees,
    setCurrentTreePosition,
    analyzeMove,
    scheduleEditWorkspaceAnalysis,
    scheduleLiveAnalysis,
    syncEditWorkspaceToCurrentPosition,
    cacheOwnership,
    saveCurrentGame,
    startRecallSession,
    stopEngineGameTraining,
    setBusy,
    showInfoOverlay,
    hideInfoOverlay,
    showMessageBox,
    notifyChange,
    getUserDataDirectory,
    notifyAnalysisUpdate,
  } = deps

  // ── Owned state ──────────────────────────────────────────────────

  /** @type {EngineState} */
  let state = {
    attachedEngineSyncers: [],
    analyzingEngineSyncerId: null,
    blackEngineSyncerId: null,
    whiteEngineSyncerId: null,
    engineGameOngoing: null,
    analysisTreePosition: null,
    analysis: null,
    quickAnalysisId: null,
    quickAnalysisSyncerId: null,
    humanSLAvailable: false,
    humanSLModelLoaded: false,
    humanSLProfile: 'rank_1d',
    humanSLPendingProfile: null,
    humanSLError: null,
    consoleLog: [],
  }

  // Internal instance state (not exposed)
  let lastAnalyzingEngineSyncerId = null
  let epoch = 0

  function getState() {
    return state
  }

  function getEpoch() {
    return epoch
  }

  function setState(patch) {
    epoch++
    if (typeof patch === 'function') {
      patch = patch(state)
    }
    Object.assign(state, patch)
    notifyChange()
  }

  function transaction(checkFn, patchFn) {
    if (!checkFn(state)) return {committed: false, epoch}
    epoch++
    let patch = typeof patchFn === 'function' ? patchFn(state) : patchFn
    if (patch != null) Object.assign(state, patch)
    notifyChange()
    return {committed: true, epoch}
  }

  function getAnalyzingEngineSyncer() {
    return (
      state.attachedEngineSyncers.find(
        (syncer) => syncer.id === state.analyzingEngineSyncerId,
      ) || null
    )
  }

  // ── Pure config helpers ─────────────────────────────────────────

  function getAnalyzeCommand(syncer) {
    if (syncer == null) return null
    if (!Array.isArray(syncer.commands) || syncer.commands.length === 0)
      return null

    let analyzeCommands = getSetting('engines.analyze_commands')
    return analyzeCommands.find((cmd) => syncer.commands.includes(cmd)) || null
  }

  function engineSupportsOwnership(syncer) {
    let commandName = getAnalyzeCommand(syncer)
    return commandName != null && commandName.includes('kata')
  }

  function getAnalysisMaxTime(syncer = null) {
    let maxTime = +(
      syncer?.engine.analysis?.maxTime || getSetting('board.analysis_max_time')
    )
    return Number.isFinite(maxTime) && maxTime > 0 ? maxTime : null
  }

  function getAnalysisVisitLimit(syncer = null) {
    let maxVisits = +(
      syncer?.engine.analysis?.visits || getSetting('board.analysis_max_visits')
    )
    return Number.isFinite(maxVisits) && maxVisits > 0
      ? Math.round(maxVisits)
      : null
  }

  function getGenmoveAnalyzeCommand(syncer) {
    if (syncer == null) return null
    let commands = getSetting('engines.gemove_analyze_commands')
    return commands.find((cmd) => syncer.commands.includes(cmd)) || null
  }

  function buildAnalyzeArgs(
    syncer,
    analyzePlayer,
    {analysisAreaVertices = null, gameBoard = null} = {},
  ) {
    let commandName = getAnalyzeCommand(syncer)
    if (commandName == null) return null

    let args = [
      analyzePlayer > 0 ? 'B' : 'W',
      getSetting('board.analysis_interval').toString(),
    ]

    if (commandName.includes('kata')) {
      args.push('ownership', 'true')

      let candidates = +syncer.engine.analysis?.candidates
      if (Number.isFinite(candidates) && candidates > 0) {
        args.push('maxmoves', Math.round(candidates).toString())
      }
    }

    if (
      commandName.includes('kata') &&
      analysisAreaVertices?.length > 0 &&
      gameBoard != null
    ) {
      let vertexStr = analysisAreaVertices
        .map((v) => gameBoard.stringifyVertex(v))
        .join(',')
      args.push('allow', 'b', vertexStr, '999', 'allow', 'w', vertexStr, '999')
    }

    return args
  }

  function buildGenmoveAnalyzeArgs(syncer, color) {
    let commandName = getGenmoveAnalyzeCommand(syncer)
    if (commandName == null) return {commandName: 'genmove', args: null}

    let args = [color, getSetting('board.analysis_interval').toString()]

    if (commandName.includes('kata')) {
      let candidates = +syncer.engine.analysis?.candidates
      if (Number.isFinite(candidates) && candidates > 0) {
        args.push('maxmoves', Math.round(candidates).toString())
      }
    }

    return {commandName, args}
  }

  async function prepareHumanSL(syncer) {
    if (syncer.humanSL?.modelLoaded) {
      await syncer.updateRawHumanPolicy().catch(() => {})
    }
  }

  async function prepareAnalysis(syncer, commandName) {
    if (commandName.includes('kata')) {
      await configureKataAnalysis(syncer)
    }

    await prepareHumanSL(syncer)
  }

  async function configureKataAnalysis(syncer) {
    if (
      syncer == null ||
      syncer.suspended ||
      !syncer.commands.includes('kata-set-param')
    ) {
      return
    }

    try {
      let analysis = syncer.engine.analysis || {}
      let maxVisits = +(
        analysis.visits || getSetting('board.analysis_max_visits')
      )
      if (Number.isFinite(maxVisits) && maxVisits > 0) {
        await syncer.queueCommand({
          name: 'kata-set-param',
          args: ['maxVisits', Math.round(maxVisits).toString()],
        })
      }

      let maxPlayouts = +analysis.playouts
      if (Number.isFinite(maxPlayouts) && maxPlayouts > 0) {
        await syncer.queueCommand({
          name: 'kata-set-param',
          args: ['maxPlayouts', Math.round(maxPlayouts).toString()],
        })
      }

      let maxTime = +(analysis.maxTime || getSetting('board.analysis_max_time'))
      if (Number.isFinite(maxTime) && maxTime > 0) {
        await syncer.queueCommand({
          name: 'kata-set-param',
          args: ['maxTime', maxTime.toString()],
        })
      }

      let temperature = +analysis.temperature
      if (Number.isFinite(temperature) && temperature > 0) {
        await syncer.queueCommand({
          name: 'kata-set-param',
          args: ['rootPolicyTemperature', temperature.toString()],
        })
      }

      if (syncer.commands.includes('kata-set-rules')) {
        let rules = gametree.getRootProperty(getGameTree(), 'RU')
        if (rules) {
          await syncer.queueCommand({
            name: 'kata-set-rules',
            args: [rules],
          })
        }
      }
      logger.info('kata.configured', 'KataGo analysis configured', {
        maxVisits:
          Number.isFinite(maxVisits) && maxVisits > 0
            ? Math.round(maxVisits)
            : null,
        maxPlayouts:
          Number.isFinite(maxPlayouts) && maxPlayouts > 0
            ? Math.round(maxPlayouts)
            : null,
        maxTime: Number.isFinite(maxTime) && maxTime > 0 ? maxTime : null,
        temperature:
          Number.isFinite(temperature) && temperature > 0 ? temperature : null,
      })
    } catch (err) {}
  }

  function normalizeEngineConfig(engine, index = 0) {
    if (engine == null) return null

    let humanSLModelFilename = 'b18c384nbt-humanv0.bin.gz'

    let kind =
      engine.kind ||
      (/katago/i.test(engine.name || '') || /katago/i.test(engine.path || '')
        ? 'katago'
        : 'generic')
    let args = engine.args || ''

    if (kind === 'katago') {
      let strippedArgs = args.replace(/^\s*gtp\b\s*/, '')
      let parts = ['gtp']
      if (engine.modelPath) parts.push('-model', `"${engine.modelPath}"`)
      if (engine.configPath) parts.push('-config', `"${engine.configPath}"`)
      if (engine.enableHumanSL === true) {
        let humanSLModelPath =
          engine.humanModelPath ||
          join(getUserDataDirectory(), 'models', humanSLModelFilename)
        parts.push('-human-model', `"${humanSLModelPath}"`)
      }

      args = `${parts.join(' ')} ${strippedArgs}`.trim()
    }

    return {
      id: engine.id || `engine-${index}`,
      enabled: engine.enabled !== false,
      kind,
      ...engine,
      args,
    }
  }

  function getConfiguredEngine(engineIndex) {
    let engines = getSetting('engines.list') || []
    let engine = engines[engineIndex]
    return normalizeEngineConfig(engine, engineIndex)
  }

  // ── HumanSL ─────────────────────────────────────────────────────

  function updateHumanSLStateFromSyncer(syncer) {
    if (syncer == null) {
      setState({
        humanSLAvailable: false,
        humanSLModelLoaded: false,
        humanSLPendingProfile: null,
        humanSLError: null,
      })
      return
    }

    setState({
      humanSLAvailable: syncer.humanSL.available,
      humanSLModelLoaded: syncer.humanSL.modelLoaded,
      humanSLProfile: syncer.humanSL.currentProfile,
      humanSLPendingProfile: syncer.humanSL.pendingProfile,
      humanSLError: syncer.humanSL.lastError,
    })
  }

  async function detectHumanSL(syncer) {
    if (syncer == null || syncer.suspended) {
      updateHumanSLStateFromSyncer(null)
      return false
    }

    let available = await syncer.detectHumanSL()
    updateHumanSLStateFromSyncer(syncer)
    return available
  }

  async function setHumanSLProfile(profile) {
    let syncer = getAnalyzingEngineSyncer()
    if (syncer == null || syncer.suspended) return false

    try {
      await syncer.setHumanSLProfile(profile)
      updateHumanSLStateFromSyncer(syncer)
      await refreshHumanSLAnalysis()
      return true
    } catch (err) {
      updateHumanSLStateFromSyncer(syncer)
      return false
    }
  }

  async function refreshHumanSLAnalysis() {
    if (state.analyzingEngineSyncerId == null) return false
    await analyzeMove(getTreePosition())
    return true
  }

  // ── GTP log wiring ──────────────────────────────────────────────

  function addEngineLogEntry(engineName, response) {
    let maxLength = getSetting('console.max_history_count')

    setState(({consoleLog}) => {
      let newLog = consoleLog.slice(
        Math.max(consoleLog.length - maxLength + 1, 0),
      )

      newLog.push({
        name: engineName,
        command: null,
        response: {...response, internal: response.internal !== false},
        waiting: false,
      })

      return {consoleLog: newLog}
    })
  }

  function handleCommandSent({syncer, command, subscribe, getResponse}) {
    let t = i18n.context('sabaki.engine')
    let entry = {name: syncer.engine.name, command, waiting: true}
    let maxLength = getSetting('console.max_history_count')

    setState(({consoleLog}) => {
      let newLog = consoleLog.slice(
        Math.max(consoleLog.length - maxLength + 1, 0),
      )
      newLog.push(entry)

      return {consoleLog: newLog}
    })

    let updateEntry = (update) => {
      Object.assign(entry, update)
      setState(({consoleLog}) => ({consoleLog}))
    }

    subscribe(({line, response, end}) => {
      updateEntry({
        response,
        waiting: !end,
      })

      gtplogger.write({
        type: 'stdout',
        message: line,
        engine: syncer.engine.name,
      })
    })

    getResponse().catch((_) => {
      gtplogger.write({
        type: 'meta',
        message: 'Connection Failed',
        engine: syncer.engine.name,
      })

      updateEntry({
        response: {
          internal: true,
          content: h('img', {
            class: 'icon',
            src: './node_modules/@primer/octicons/build/svg/alert.svg',
            alt: t('Connection Failed'),
            title: t('Connection Failed'),
          }),
        },
        waiting: false,
      })
    })
  }

  // ── Engine lifecycle ────────────────────────────────────────────

  function attachEngines(engines) {
    let t = i18n.context('sabaki.engine')
    let attaching = []
    let getEngineName = (name) => {
      let counter = 1
      let getName = () => (counter === 1 ? name : `${name} ${counter}`)
      let hasName = (syncer) => syncer.engine.name === getName()

      while (
        attaching.some(hasName) ||
        state.attachedEngineSyncers.some(hasName)
      ) {
        counter++
      }

      return getName()
    }

    for (let engine of engines) {
      engine = {...engine, name: getEngineName(engine.name)}

      let syncer = new EngineSyncer(engine)

      if (syncer.pathError) {
        dialog.showMessageBox(syncer.pathError, 'error')
        logger.error('engine.start_failed', 'Engine path error', {
          name: engine.name,
          path: engine.path,
          error: syncer.pathError,
        })

        addEngineLogEntry(engine.name, {
          internal: false,
          error: true,
          content: `${syncer.pathError}\nPath: ${engine.path}`,
        })

        continue
      }

      logger.debug('engine.creating', 'Creating engine', {
        name: engine.name,
        path: engine.path,
        args: engine.args,
        syncerId: syncer.id,
      })

      syncer.on('error', (err) => {
        logger.error('engine.start_failed', 'Engine start failed', {
          name: engine.name,
          error: err,
        })
        let commandLine =
          syncer.controller != null
            ? formatEngineCommandLine(
                syncer.controller.path,
                syncer.controller.args,
              )
            : engine.path

        let message
        if (err.code === 'ENOENT') {
          message = t(
            'Engine binary not found. Please check the engine path in Preferences > Engines.',
          )
        } else if (err.code === 'EACCES') {
          message = t(
            'Engine binary is not executable. Please check file permissions.',
          )
        } else {
          message = t('Failed to start engine: ') + err.message
        }
        dialog.showMessageBox(message, 'error')

        addEngineLogEntry(engine.name, {
          internal: false,
          error: true,
          content: `${message}\n$ ${commandLine}`,
        })
      })

      syncer.on('analysis-update', () => {
        let handlerEpoch = epoch

        if (state.analyzingEngineSyncerId === syncer.id) {
          if (epoch !== handlerEpoch) return
          if (getMode() === 'analysis' && getEditWorkspace() != null) {
            return
          }

          let tree = getGameTrees()[getGameIndex()]
          if (
            syncer.treePosition != null &&
            tree.get(syncer.treePosition) == null
          ) {
            return
          }

          let currentAnalysisUpdate = syncer.treePosition === getTreePosition()

          if (currentAnalysisUpdate) {
            setState({
              analysis: syncer.analysis,
              analysisTreePosition: syncer.treePosition,
            })

            // Notify training monitor so pending MoveEvaluations can be resolved
            if (syncer.treePosition != null && notifyAnalysisUpdate) {
              notifyAnalysisUpdate(syncer.treePosition)
            }
          }

          if (syncer.analysis != null && syncer.treePosition != null) {
            if (syncer.analysis.ownership != null) {
              cacheOwnership(
                syncer.id,
                tree,
                syncer.treePosition,
                syncer.analysis.ownership,
              )
            }

            let {sign, winrate, scoreLead} = syncer.analysis
            if (sign < 0) winrate = 100 - winrate
            if (scoreLead != null && sign < 0) scoreLead = -scoreLead

            let newTree = tree.mutate((draft) => {
              if (winrate != null) {
                draft.updateProperty(syncer.treePosition, 'SBKV', [
                  (Math.round(winrate * 100) / 100).toString(),
                ])
              }

              if (scoreLead != null) {
                draft.updateProperty(syncer.treePosition, 'SBKS', [
                  (Math.round(scoreLead * 100) / 100).toString(),
                ])
              }
            })

            setCurrentTreePosition(newTree, getTreePosition())
          }

          if (
            syncer.treePosition != null &&
            syncer.treePosition !== getTreePosition()
          ) {
            scheduleLiveAnalysis(getTreePosition())
          }
        }
      })

      syncer.on('human-sl-update', () => {
        if (state.analyzingEngineSyncerId === syncer.id) {
          setState({
            humanSLAvailable: syncer.humanSL.available,
            humanSLModelLoaded: syncer.humanSL.modelLoaded,
            humanSLProfile: syncer.humanSL.currentProfile,
            humanSLPendingProfile: syncer.humanSL.pendingProfile,
            humanSLError: syncer.humanSL.lastError,
          })
        }
      })

      syncer.controller.on('command-sent', (evt) => {
        gtplogger.write({
          type: 'stdin',
          message: gtp.Command.toString(evt.command),
          engine: engine.name,
        })

        handleCommandSent({syncer, ...evt})
      })

      syncer.controller.on('stderr', ({content}) => {
        gtplogger.write({
          type: 'stderr',
          message: content,
          engine: engine.name,
        })

        setState(({consoleLog}) => {
          let lastIndex = consoleLog.length - 1
          let lastEntry = consoleLog[lastIndex]

          if (
            lastEntry != null &&
            lastEntry.name === engine.name &&
            lastEntry.command == null &&
            lastEntry.response != null &&
            lastEntry.response.internal &&
            typeof lastEntry.response.content === 'string'
          ) {
            lastEntry.response = {
              ...lastEntry.response,
              content: `${lastEntry.response.content}\n${content}`,
            }

            return {consoleLog}
          } else {
            return {
              consoleLog: [
                ...consoleLog,
                {
                  name: engine.name,
                  command: null,
                  response: {content, internal: true},
                },
              ],
            }
          }
        })
      })

      let startedAt = null

      syncer.controller.on('started', () => {
        startedAt = Date.now()

        let commandLine = formatEngineCommandLine(
          syncer.controller.path,
          syncer.controller.args,
        )

        gtplogger.write({
          type: 'meta',
          message: 'Engine Started',
          engine: engine.name,
        })

        addEngineLogEntry(engine.name, {
          internal: true,
          content: `Engine Started\n$ ${commandLine}`,
        })
      })

      syncer.controller.on('stopped', () => {
        let uptime =
          startedAt != null ? ((Date.now() - startedAt) / 1000).toFixed(1) : '?'

        gtplogger.write({
          type: 'meta',
          message: 'Engine Stopped',
          engine: engine.name,
        })

        addEngineLogEntry(engine.name, {
          internal: true,
          content:
            parseFloat(uptime) < 3
              ? `Engine Stopped (ran ${uptime}s — likely startup failure; check command above)`
              : `Engine Stopped (ran ${uptime}s)`,
        })

        startedAt = null
      })

      logger.debug('engine.starting', 'Starting engine', {
        name: engine.name,
        syncerId: syncer.id,
      })

      syncer.start()

      attaching.push(syncer)
      logger.info('engine.attached', 'Engine attached', {
        name: engine.name,
        syncerId: syncer.id,
      })
    }

    setState(({attachedEngineSyncers}) => ({
      attachedEngineSyncers: [...attachedEngineSyncers, ...attaching],
    }))

    return attaching
  }

  async function detachEngines(syncerIds) {
    let detachEngineSyncers = state.attachedEngineSyncers.filter((syncer) =>
      syncerIds.includes(syncer.id),
    )

    await Promise.all(
      detachEngineSyncers.map(async (syncer) => {
        await stopEngineGame()
        await syncer.stop()

        logger.info('engine.detached', 'Engine detached', {
          name: syncer.engine.name,
          syncerId: syncer.id,
        })

        let unset = (syncerId) => (syncerId === syncer.id ? null : syncerId)

        if (lastAnalyzingEngineSyncerId === syncer.id) {
          lastAnalyzingEngineSyncerId = null
        }

        setState((s) => ({
          attachedEngineSyncers: s.attachedEngineSyncers.filter(
            (e) => e.id !== syncer.id,
          ),
          engineGameOngoing:
            s.engineGameOngoing &&
            [s.blackEngineSyncerId, s.whiteEngineSyncerId].includes(syncer.id)
              ? false
              : s.engineGameOngoing,
          blackEngineSyncerId: unset(s.blackEngineSyncerId),
          whiteEngineSyncerId: unset(s.whiteEngineSyncerId),
          analyzingEngineSyncerId: unset(s.analyzingEngineSyncerId),
        }))
      }),
    )
  }

  async function syncEngine(
    syncerId,
    treePosition,
    {tree = getGameTree()} = {},
  ) {
    let syncer = state.attachedEngineSyncers.find(
      (syncer) => syncer.id === syncerId,
    )

    if (syncer != null) {
      try {
        await syncer.sync(tree, treePosition)
        logger.info('sync.success', 'Engine synced successfully', {
          syncerId,
          treePosition,
        })
        return true
      } catch (err) {
        logger.warn('engine.sync_failed', 'Engine sync failed', {
          name: syncer.engine.name,
          error: err.message,
        })
        await dialog.showMessageBox(err.message, 'error')
      }
    }

    return false
  }

  function getOrAttachEngine(engineIndex) {
    let engine = getConfiguredEngine(engineIndex)
    if (engine == null || engine.enabled === false) return null

    let syncer = state.attachedEngineSyncers.find((syncer) => {
      let attached = syncer.engine
      if (attached.id != null && engine.id != null)
        return attached.id === engine.id

      return (
        attached.path === engine.path &&
        attached.args === engine.args &&
        attached.name === engine.name
      )
    })

    return syncer || attachEngines([engine])[0]
  }

  // ── Engine games ────────────────────────────────────────────────

  async function startEngineGame(treePosition) {
    let t = i18n.context('sabaki.engine')
    let {engineGameOngoing, attachedEngineSyncers} = state
    let engineCount = attachedEngineSyncers.length
    if (engineGameOngoing != null) return

    if (engineCount === 0) {
      await dialog.showMessageBox(
        t('Please attach one or more engines first.'),
        'info',
      )

      return
    } else {
      setState((s) => ({
        blackEngineSyncerId:
          s.blackEngineSyncerId == null
            ? s.attachedEngineSyncers[0].id
            : s.blackEngineSyncerId,
        whiteEngineSyncerId:
          s.whiteEngineSyncerId == null
            ? s.attachedEngineSyncers[1 % engineCount].id
            : s.whiteEngineSyncerId,
      }))
    }

    let gameId = uuid()
    setState({engineGameOngoing: gameId})

    let consecutivePasses = 0

    while (state.engineGameOngoing === gameId) {
      let syncerId =
        getPlayer(treePosition) > 0
          ? state.blackEngineSyncerId
          : state.whiteEngineSyncerId

      let move = await generateMove(syncerId, treePosition, {
        commit: () => state.engineGameOngoing,
      })

      if (move == null || move.resign) {
        break
      }

      if (move.pass) {
        consecutivePasses++
      } else {
        consecutivePasses = 0
      }

      if (consecutivePasses >= 2) {
        stopEngineGame(gameId)
        let saved = await saveCurrentGame()
        if (saved?.id) {
          startRecallSession(saved.id)
        }
        return
      }

      treePosition = move.treePosition
    }

    stopEngineGame(gameId)
  }

  async function stopEngineGame(gameId = null) {
    if (state.engineGameOngoing == null) return

    setState((s) => ({
      engineGameOngoing:
        gameId == null || s.engineGameOngoing === gameId
          ? null
          : s.engineGameOngoing,
    }))

    let syncer = getAnalyzingEngineSyncer()
    if (syncer == null) return
  }

  async function startStopEngineGame(treePosition) {
    if (state.engineGameOngoing != null) {
      stopEngineGame()
    } else {
      startEngineGame(treePosition)
    }
  }

  // ── generateMove ────────────────────────────────────────────────

  async function generateMove(
    syncerId,
    treePosition,
    {commit = () => true} = {},
  ) {
    let t = i18n.context('sabaki.engine')
    let sign = getPlayer(treePosition)
    let color = sign > 0 ? 'B' : 'W'
    let syncer = state.attachedEngineSyncers.find(
      (syncer) => syncer.id === syncerId,
    )
    if (syncer == null) {
      logger.warn(
        'generateMove.no_syncer',
        'No syncer found for move generation',
        {syncerId, color},
      )
      return
    }

    logger.info('generateMove.start', 'Generating engine move', {
      name: syncer.engine.name,
      color,
      commands: syncer.commands.length,
    })

    let synced = await syncEngine(syncerId, treePosition)
    if (!synced) return

    let tree = getGameTree()
    let board = gametree.getBoard(tree, treePosition)
    let coord
    try {
      let genmoveResult = buildGenmoveAnalyzeArgs(syncer, color)
      let commandName = genmoveResult.commandName

      await prepareAnalysis(syncer, commandName)

      if (commandName === 'genmove') {
        let response = await syncer.queueCommand({
          name: commandName,
          args: [color],
        })

        if (response == null || response.error) throw new Error()

        coord = response.content
      } else {
        let args = genmoveResult.args

        coord = await new Promise(async (resolve) => {
          await syncer.queueCommand({name: commandName, args}, ({line}) => {
            if (!line.startsWith('play ')) return
            resolve(line.slice('play '.length))
          })

          resolve()
        })
      }
    } catch (err) {
      await dialog.showMessageBox(
        t((p) => `${p.engine} has failed to generate a move.`, {
          engine: syncer.engine.name,
        }),
        'error',
      )
    }

    if (coord == null) return
    coord = coord.toLowerCase().trim()

    if (coord === 'resign') {
      logger.info('engine.resign', 'Engine resigned', {
        name: syncer.engine.name,
      })
      await dialog.showMessageBox(
        t((p) => `${p.engine} has resigned.`, {
          engine: syncer.engine.name,
        }),
        'info',
      )
    }

    let vertex = ['resign', 'pass'].includes(coord)
      ? [-1, -1]
      : board.parseVertex(coord)

    if (coord !== 'resign') {
      logger.info('engine.move', 'Engine generated move', {
        name: syncer.engine.name,
        coord,
      })
    }

    let currentTree = getGameTree()
    let currentTreePosition = getTreePosition()
    let positionMoved =
      currentTree.root.id !== tree.root.id ||
      currentTreePosition !== treePosition
    let resign = coord === 'resign'
    let {pass, capturing, suicide} = board.analyzeMove(sign, vertex)

    let newTreePosition
    let newTree = currentTree.mutate((draft) => {
      newTreePosition = draft.appendNode(treePosition, {
        [color]: [sgf.stringifyVertex(vertex)],
      })

      if (coord === 'resign') {
        draft.updateProperty(draft.root.id, 'RE', [
          `${sign > 0 ? 'W' : 'B'}+Resign`,
        ])

        let id2 = treePosition
        while (id2 != null) {
          draft.shiftNode(id2, 'main')
          id2 = draft.get(id2).parentId
        }
      }
    })

    if (newTreePosition == null || !commit()) return

    if (pass) {
      sound.playPass()
    } else {
      sound.playPachi()
      if (capturing || suicide) sound.playCapture()
    }

    setCurrentTreePosition(
      newTree,
      !positionMoved ? newTreePosition : currentTreePosition,
    )

    if (pass && !positionMoved) {
      let parentNode = currentTree.get(treePosition)
      let otherColor = color === 'B' ? 'W' : 'B'
      let prevPass =
        parentNode.data[otherColor] != null &&
        parentNode.data[otherColor][0] === ''
      if (prevPass) {
        syncer.treePosition = newTreePosition
        stopEngineGame()
        await stopEngineGameTraining()
        let saved = await saveCurrentGame()
        if (saved?.id) {
          startRecallSession(saved.id)
        }
        return {tree: newTree, treePosition: newTreePosition, resign, pass}
      }
    }

    syncer.treePosition = newTreePosition

    return {
      tree: newTree,
      treePosition: newTreePosition,
      resign,
      pass,
    }
  }

  // ── Analysis control ────────────────────────────────────────────

  async function startAnalysis(syncerId) {
    logger.debug('analysis.start', 'Starting analysis', {
      syncerId,
      currentAnalyzingId: state.analyzingEngineSyncerId,
      match: state.analyzingEngineSyncerId === syncerId,
    })

    let {committed} = transaction(
      (s) => s.analyzingEngineSyncerId !== syncerId,
      {analyzingEngineSyncerId: syncerId},
    )
    if (!committed) return

    let t = i18n.context('sabaki.engine')
    let syncer = state.attachedEngineSyncers.find(
      (syncer) => syncer.id === syncerId,
    )

    if (syncer == null) return

    if (getAnalyzeCommand(syncer) == null) {
      await dialog.showMessageBox(
        t('The selected engine does not support analysis.'),
        'warning',
      )
      return
    }

    lastAnalyzingEngineSyncerId = syncerId
    setState({
      analyzingEngineSyncerId: syncerId,
    })
    updateHumanSLStateFromSyncer(syncer)
    detectHumanSL(syncer).catch(helper.noop)

    if (
      !state.engineGameOngoing ||
      (state.blackEngineSyncerId !== syncerId &&
        state.whiteEngineSyncerId !== syncerId)
    ) {
      if (getMode() === 'analysis' && getEditWorkspace() != null) {
        syncEditWorkspaceToCurrentPosition()
        scheduleEditWorkspaceAnalysis()
      } else {
        analyzeMove(getTreePosition())
      }
    }
  }

  function stopAnalysis() {
    let syncer = getAnalyzingEngineSyncer()

    if (syncer != null) {
      syncer.sendAbort()
    }

    // Clear analysis state and editWorkspace analysis state (owned by sabaki)
    setState({
      analysis: null,
      analysisTreePosition: null,
      analyzingEngineSyncerId: null,
      humanSLAvailable: false,
      humanSLModelLoaded: false,
      humanSLPendingProfile: null,
      humanSLError: null,
    })

    // editWorkspace analysis fields are owned by sabaki.state —
    // return them so sabaki can clear them via a separate setState.
    let editWorkspace = getEditWorkspace()
    if (editWorkspace != null) {
      return {
        currentAnalysis: null,
        currentOwnership: null,
        referenceAnalysis: null,
        referenceOwnership: null,
        analysisPending: false,
      }
    }
    return null
  }

  // ── Quick analysis ──────────────────────────────────────────────

  function waitForQuickAnalysis(
    syncer,
    treePosition,
    analysisId,
    visitLimit,
    timeoutMs,
  ) {
    return new Promise((resolve) => {
      let settled = false
      let timeoutId = null
      let latestAnalysis = null

      let finish = (value) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        syncer.removeListener('analysis-update', handleUpdate)
        syncer.sendAbort()
        resolve(value)
      }

      let handleUpdate = () => {
        if (state.quickAnalysisId !== analysisId) {
          finish(null)
          return
        }

        if (syncer.treePosition !== treePosition || syncer.analysis == null) {
          return
        }

        latestAnalysis = syncer.analysis

        let bestVisits = Math.max(
          0,
          ...syncer.analysis.variations.map((v) => v.visits || 0),
        )

        if (bestVisits >= visitLimit) {
          finish(latestAnalysis)
        }
      }

      syncer.on('analysis-update', handleUpdate)
      timeoutId = setTimeout(() => finish(latestAnalysis), timeoutMs)
    })
  }

  async function quickAnalyzeAllNodes() {
    if (state.quickAnalysisId != null) return

    let syncer = getAnalyzingEngineSyncer()
    if (syncer == null) return

    let commandName = getAnalyzeCommand(syncer)
    if (commandName == null) {
      await dialog.showMessageBox(
        i18n.t(
          'sabaki.engine',
          'The selected engine does not support analysis.',
        ),
        'warning',
      )
      return
    }

    let analysisId = Date.now()
    setState({
      quickAnalysisId: analysisId,
      quickAnalysisSyncerId: syncer.id,
    })
    setBusy(true)

    let tree = getGameTree()
    let nodes = [...tree.listMainNodes()]
    let results = []

    let isKata =
      commandName.includes('kata') && syncer.commands.includes('kata-set-param')

    try {
      if (isKata) {
        await syncer.queueCommand({
          name: 'kata-set-param',
          args: ['maxVisits', '50'],
        })
      }

      for (let i = 0; i < nodes.length; i++) {
        if (state.quickAnalysisId !== analysisId) break

        let node = nodes[i]
        showInfoOverlay(`Analyzing ${i + 1}/${nodes.length}...`)

        let synced = await syncEngine(syncer.id, node.id, {tree})
        if (!synced || state.quickAnalysisId !== analysisId) break

        await prepareHumanSL(syncer)

        let sign = getPlayer(node.id)
        let args = buildAnalyzeArgs(syncer, sign)

        await syncer.queueCommand({name: commandName, args})

        let analysis = await waitForQuickAnalysis(
          syncer,
          node.id,
          analysisId,
          50,
          3000,
        )

        if (analysis == null) continue
        if (state.quickAnalysisId !== analysisId) break

        let winrate = analysis.winrate
        let scoreLead = analysis.scoreLead
        if (analysis.sign < 0) winrate = 100 - winrate
        if (analysis.sign < 0 && scoreLead != null) scoreLead = -scoreLead

        results.push({nodeId: node.id, winrate, scoreLead})
      }

      if (results.length > 0) {
        let newTree = tree.mutate((draft) => {
          for (let {nodeId, winrate, scoreLead} of results) {
            if (winrate != null) {
              draft.updateProperty(nodeId, 'SBKV', [
                (Math.round(winrate * 100) / 100).toString(),
              ])
            }
            if (scoreLead != null) {
              draft.updateProperty(nodeId, 'SBKS', [
                (Math.round(scoreLead * 100) / 100).toString(),
              ])
            }
          }
        })
        setCurrentTreePosition(newTree, getTreePosition())
      }
    } finally {
      if (isKata) {
        await configureKataAnalysis(syncer).catch(() => {})
      }

      hideInfoOverlay()
      setState({quickAnalysisId: null, quickAnalysisSyncerId: null})
      setBusy(false)

      if (state.analyzingEngineSyncerId != null) {
        analyzeMove(getTreePosition())
      }
    }
  }

  function stopQuickAnalysis() {
    let syncer = state.attachedEngineSyncers.find(
      (s) => s.id === state.quickAnalysisSyncerId,
    )
    if (syncer != null) {
      syncer.sendAbort()
    }

    hideInfoOverlay()
    setState({quickAnalysisId: null, quickAnalysisSyncerId: null})
  }

  // ── generateReply (facade for play interaction) ─────────────────

  function generateReply(treePosition, currentPlayer) {
    let syncerId =
      currentPlayer > 0 ? state.whiteEngineSyncerId : state.blackEngineSyncerId

    if (syncerId == null) return

    generateMove(syncerId, treePosition)
  }

  // ── Cross-domain: set engine syncer IDs for game start ──────────

  function setBlackWhiteSyncerIds(blackId, whiteId) {
    setState({
      blackEngineSyncerId: blackId,
      whiteEngineSyncerId: whiteId,
    })
  }

  // ── Purpose-driven query methods ────────────────────────────────
  //
  // Each method encapsulates a specific question the rest of the
  // application needs answered, so callers never read raw state fields.

  /** Whether an engine-vs-engine game is currently in progress. */
  function isEngineGameRunning() {
    return state.engineGameOngoing != null
  }

  /**
   * The syncerId for the engine assigned to play the given side.
   * Used by Generate Move and reply logic to pick the correct engine.
   */
  function getEnginePlayerSyncerId(playerSign) {
    return playerSign > 0
      ? state.blackEngineSyncerId
      : state.whiteEngineSyncerId
  }

  /** Whether a syncer is assigned as the analyzer. */
  function hasAnalyzer() {
    return state.analyzingEngineSyncerId != null
  }

  /**
   * The current analysis result, but only if it matches the given treePosition.
   * Returns null if analysis is stale (different position) or absent.
   */
  function getAnalysisForPosition(treePosition) {
    if (state.analysisTreePosition === treePosition) return state.analysis
    return null
  }

  /** Whether the analysis treePosition matches the given position. */
  function isAnalysisAtPosition(treePosition) {
    return state.analysisTreePosition === treePosition
  }

  /**
   * The unique ID for the currently running quick analysis, or null.
   * Used to toggle the "Stop Quick Analyze" menu label.
   */
  function getQuickAnalysisId() {
    return state.quickAnalysisId
  }

  /**
   * All currently attached engine syncers.
   * Used by PeerList, InfoDrawer, PreferencesDrawer to render engine lists.
   */
  function getAttachedSyncers() {
    return state.attachedEngineSyncers
  }

  /**
   * Whether at least one engine is attached.
   * Simpler than checking getAttachedSyncers().length everywhere.
   */
  function hasAttachedEngines() {
    return state.attachedEngineSyncers.length > 0
  }

  /**
   * Whether the given syncer is the current analyzer.
   * Used by PeerList to show the analyzing indicator.
   */
  function isAnalyzing(syncerId) {
    return state.analyzingEngineSyncerId === syncerId
  }

  /** The analyzing engine syncerId (may be null). */
  function getAnalyzingSyncerId() {
    return state.analyzingEngineSyncerId
  }

  /** The black engine syncerId (may be null). */
  function getBlackSyncerId() {
    return state.blackEngineSyncerId
  }

  /** The white engine syncerId (may be null). */
  function getWhiteSyncerId() {
    return state.whiteEngineSyncerId
  }

  /**
   * Current HumanSL state for the analyzer engine.
   * Returns an object {modelLoaded, error} for UI rendering.
   */
  function getHumanSLState() {
    return {
      modelLoaded: state.humanSLModelLoaded,
      error: state.humanSLError,
    }
  }

  /**
   * The GTP console log entries.
   * Used by the ConsoleDrawer to render command/response history.
   */
  function getConsoleLog() {
    return state.consoleLog
  }

  /**
   * Append a log entry to the engine console log.
   * Merged with application logs in the UI (GtpConsole).
   */
  function appendConsoleLog(entry) {
    let maxLength = getSetting('console.max_history_count') || 1000
    let entryWithTime = {time: Date.now(), ...entry}
    setState(({consoleLog}) => {
      let newLog = consoleLog.slice(
        Math.max(consoleLog.length - maxLength + 1, 0),
      )
      newLog.push(entryWithTime)
      return {consoleLog: newLog}
    })
  }

  /**
   * Find the first attached syncer that supports analysis commands.
   * Used by menu.js Toggle Analysis to pick a default analyzer.
   */
  function findFirstAnalysisCapableSyncerId() {
    let analyzeCommands = getSetting('engines.analyze_commands')
    let syncer = state.attachedEngineSyncers.find((s) =>
      s.commands.some((x) => analyzeCommands.includes(x)),
    )
    return syncer?.id ?? null
  }

  /**
   * Ensure an analyzer is attached for problem mode.
   * Picks the first attached engine if no analyzer is set.
   */
  function ensureAnalyzerForProblemMode() {
    if (
      state.analyzingEngineSyncerId == null &&
      state.attachedEngineSyncers.length > 0
    ) {
      setState({analyzingEngineSyncerId: state.attachedEngineSyncers[0].id})
    }
  }

  /**
   * Return the IDs of all attached syncers.
   * Used when detaching all engines on newFile/close.
   */
  function getAttachedSyncerIds() {
    return state.attachedEngineSyncers.map((s) => s.id)
  }

  /**
   * Clear the GTP console log.
   */
  function clearConsoleLog() {
    setState({consoleLog: []})
  }

  /**
   * The analyzing engine syncerId from the previous session (before stop).
   * Used by menu.js Toggle Analysis to resume the same engine.
   */
  function getLastAnalyzingSyncerId() {
    return lastAnalyzingEngineSyncerId
  }

  /**
   * Return engine-owned state fields needed by analysisService.
   * This is a controlled escape hatch — only analysisService should use it.
   * Fields returned: analysis, analysisTreePosition, analyzingEngineSyncerId,
   * engineGameOngoing, blackEngineSyncerId, whiteEngineSyncerId.
   */
  function getAnalysisRelevantState() {
    return {
      analysis: state.analysis,
      analysisTreePosition: state.analysisTreePosition,
      analyzingEngineSyncerId: state.analyzingEngineSyncerId,
      engineGameOngoing: state.engineGameOngoing,
      blackEngineSyncerId: state.blackEngineSyncerId,
      whiteEngineSyncerId: state.whiteEngineSyncerId,
    }
  }

  // ── Public API ──────────────────────────────────────────────────

  return {
    // State reads (raw — used by App.js render)
    getState,
    setState,
    getEpoch,

    // Purpose-driven queries (replaces raw getState())
    isEngineGameRunning,
    getEnginePlayerSyncerId,
    hasAnalyzer,
    getAnalysisForPosition,
    isAnalysisAtPosition,
    getQuickAnalysisId,
    getAttachedSyncers,
    hasAttachedEngines,
    isAnalyzing,
    getAnalyzingSyncerId,
    getBlackSyncerId,
    getWhiteSyncerId,
    getHumanSLState,
    getConsoleLog,
    appendConsoleLog,
    findFirstAnalysisCapableSyncerId,
    ensureAnalyzerForProblemMode,
    getAttachedSyncerIds,
    clearConsoleLog,
    getLastAnalyzingSyncerId,
    getAnalyzingEngineSyncer,
    getAnalysisRelevantState,

    // Config helpers
    getAnalyzeCommand,
    engineSupportsOwnership,
    getAnalysisMaxTime,
    getAnalysisVisitLimit,
    getGenmoveAnalyzeCommand,
    buildAnalyzeArgs,
    buildGenmoveAnalyzeArgs,
    configureKataAnalysis,
    prepareHumanSL,
    prepareAnalysis,
    normalizeEngineConfig,
    getConfiguredEngine,

    // HumanSL
    updateHumanSLStateFromSyncer,
    detectHumanSL,
    setHumanSLProfile,
    refreshHumanSLAnalysis,

    // Lifecycle
    attachEngines,
    detachEngines,
    syncEngine,
    getOrAttachEngine,

    // Engine games
    startEngineGame,
    stopEngineGame,
    startStopEngineGame,

    // Move generation
    generateMove,
    generateReply,

    // Analysis control
    startAnalysis,
    stopAnalysis,

    // Quick analysis
    waitForQuickAnalysis,
    quickAnalyzeAllNodes,
    stopQuickAnalysis,

    // Cross-domain setters
    setBlackWhiteSyncerIds,

    // Late binding
    setEngineService: noop,
  }

  function noop() {}
}
