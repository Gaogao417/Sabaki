import {join} from 'path'
import {h} from 'preact'
import {v4 as uuid} from 'uuid'

import gtp from '@sabaki/gtp'
import sgf from '@sabaki/sgf'

import i18n from '../../i18n.js'
import EngineSyncer from '../enginesyncer.js'
import * as dialog from '../dialog.js'
import * as gtplogger from '../gtplogger.js'
import * as applogger from '../applogger.js'
import * as gametree from '../gametree.js'
import * as helper from '../helper.js'
import * as sound from '../sound.js'

const setting = {
  get: (key) => window.sabaki.setting.get(key),
}

/**
 * Create an engine service over a sabaki instance.
 *
 * Phase 12B: engine ownership. During the migration the store still writes
 * through sabaki.setState so App.js and legacy callers keep their current
 * subscription model, but engine lifecycle, HumanSL state, GTP log wiring,
 * engine-game loops, and analysis control writes should flow through this
 * module instead of living in sabaki.js.
 *
 * @param {object} sabaki
 * @param {{
 *   getSetting?: (key: string) => any,
 *   getPlayer?: (treePosition: string) => number,
 *   documentStore?: {setCurrentTreePosition: function},
 *   analysisService?: {scheduleLiveAnalysis: function, analyzeGameTreePosition: function},
 *   cacheOwnership?: (syncerId: string, tree: any, treePosition: string, ownership: any) => void,
 *   saveCurrentGame?: () => Promise,
 *   startRecallSession?: (gameId: string) => Promise,
 *   setBusy?: (busy: boolean) => void,
 *   showInfoOverlay?: (text: string) => void,
 *   hideInfoOverlay?: () => void,
 * }} [deps]
 */
export function createEngineService(sabaki, deps = {}) {
  let {
    getSetting,
    getPlayer,
    documentStore,
    analysisService,
    cacheOwnership,
    saveCurrentGame,
    startRecallSession,
    setBusy,
    showInfoOverlay,
    hideInfoOverlay,
  } = deps

  let resolveSetting = getSetting ?? ((key) => setting.get(key))
  let resolveGetPlayer = getPlayer ?? ((tp) => sabaki.getPlayer(tp))
  let resolveDocumentStore = documentStore
  let resolveAnalysisService = analysisService

  // Internal instance state
  let lastAnalyzingEngineSyncerId = null

  // ── Pure config helpers ─────────────────────────────────────────

  function getAnalyzeCommand(syncer) {
    if (syncer == null) return null
    if (!Array.isArray(syncer.commands) || syncer.commands.length === 0) return null

    let analyzeCommands = resolveSetting('engines.analyze_commands')
    return analyzeCommands.find((cmd) => syncer.commands.includes(cmd)) || null
  }

  function engineSupportsOwnership(syncer) {
    let commandName = getAnalyzeCommand(syncer)
    return commandName != null && commandName.includes('kata')
  }

  function getAnalysisMaxTime(syncer = null) {
    let maxTime = +(
      syncer?.engine.analysis?.maxTime || resolveSetting('board.analysis_max_time')
    )
    return Number.isFinite(maxTime) && maxTime > 0 ? maxTime : null
  }

  function getAnalysisVisitLimit(syncer = null) {
    let maxVisits = +(
      syncer?.engine.analysis?.visits || resolveSetting('board.analysis_max_visits')
    )
    return Number.isFinite(maxVisits) && maxVisits > 0 ? Math.round(maxVisits) : null
  }

  function getGenmoveAnalyzeCommand(syncer) {
    if (syncer == null) return null
    let commands = resolveSetting('engines.gemove_analyze_commands')
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
      resolveSetting('board.analysis_interval').toString(),
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

    let args = [color, resolveSetting('board.analysis_interval').toString()]

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
        analysis.visits || resolveSetting('board.analysis_max_visits')
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

      let maxTime = +(
        analysis.maxTime || resolveSetting('board.analysis_max_time')
      )
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
        let rules = gametree.getRootProperty(sabaki.inferredState.gameTree, 'RU')
        if (rules) {
          await syncer.queueCommand({
            name: 'kata-set-rules',
            args: [rules],
          })
        }
      }
      applogger.log(
        'info',
        'engine',
        'kata.configured',
        'KataGo analysis configured',
        {
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
            Number.isFinite(temperature) && temperature > 0
              ? temperature
              : null,
        },
      )
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
      let parts = ['gtp']
      if (engine.modelPath) parts.push('-model', `"${engine.modelPath}"`)
      if (engine.configPath) parts.push('-config', `"${engine.configPath}"`)
      if (engine.enableHumanSL === true) {
        let humanSLModelPath =
          engine.humanModelPath ||
          join(
            window.sabaki.setting.userDataDirectory,
            'models',
            humanSLModelFilename,
          )
        parts.push('-human-model', `"${humanSLModelPath}"`)
      }

      args = `${parts.join(' ')} ${args}`.trim()
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
    let engines = resolveSetting('engines.list') || []
    let engine = engines[engineIndex]
    return normalizeEngineConfig(engine, engineIndex)
  }

  // ── HumanSL ─────────────────────────────────────────────────────

  function updateHumanSLStateFromSyncer(syncer) {
    if (syncer == null) {
      sabaki.setState({
        humanSLAvailable: false,
        humanSLModelLoaded: false,
        humanSLPendingProfile: null,
        humanSLError: null,
      })
      return
    }

    sabaki.setState({
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
    let syncer = sabaki.inferredState.analyzingEngineSyncer
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
    if (sabaki.state.analyzingEngineSyncerId == null) return false
    await resolveAnalysisService.analyzeGameTreePosition(sabaki.state.treePosition)
    return true
  }

  // ── GTP log wiring ──────────────────────────────────────────────

  function addEngineLogEntry(engineName, response) {
    let maxLength = resolveSetting('console.max_history_count')

    sabaki.setState(({consoleLog}) => {
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
    let maxLength = resolveSetting('console.max_history_count')

    sabaki.setState(({consoleLog}) => {
      let newLog = consoleLog.slice(
        Math.max(consoleLog.length - maxLength + 1, 0),
      )
      newLog.push(entry)

      return {consoleLog: newLog}
    })

    let updateEntry = (update) => {
      Object.assign(entry, update)
      sabaki.setState(({consoleLog}) => ({consoleLog}))
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
        sabaki.state.attachedEngineSyncers.some(hasName)
      ) {
        counter++
      }

      return getName()
    }

    for (let engine of engines) {
      engine = {...engine, name: getEngineName(engine.name)}

      let syncer = new EngineSyncer(engine)

      // Handle engine path errors
      if (syncer.pathError) {
        dialog.showMessageBox(syncer.pathError, 'error')
        applogger.log(
          'error',
          'engine',
          'engine.start_failed',
          'Engine path error',
          {name: engine.name, path: engine.path, error: syncer.pathError},
        )

        addEngineLogEntry(engine.name, {
          internal: false,
          error: true,
          content: syncer.pathError,
        })

        continue
      }

      console.log('[engine.creating]', {
        name: engine.name,
        path: engine.path,
        args: engine.args,
        syncerId: syncer.id,
      })

      syncer.on('error', (err) => {
        applogger.log(
          'error',
          'engine',
          'engine.start_failed',
          'Engine start failed',
          {name: engine.name, error: err},
        )
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
          content: message,
        })
      })

      syncer.on('analysis-update', () => {
        if (sabaki.state.analyzingEngineSyncerId === syncer.id) {
          // Scratch analysis uses temporary trees whose nodes are not in the
          // real game tree. Skip the global state / SBKV / SBKS write-back so
          // scratch results never pollute the SGF.
          if (
            sabaki.state.mode === 'analysis' &&
            sabaki.state.editWorkspace != null
          ) {
            return
          }
          // Update analysis info

          let tree = sabaki.state.gameTrees[sabaki.state.gameIndex]
          if (
            syncer.treePosition != null &&
            tree.get(syncer.treePosition) == null
          ) {
            return
          }

          let currentAnalysisUpdate =
            syncer.treePosition === sabaki.state.treePosition

          if (currentAnalysisUpdate) {
            sabaki.setState({
              analysis: syncer.analysis,
              analysisTreePosition: syncer.treePosition,
            })
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

            resolveDocumentStore.setCurrentTreePosition(
              newTree,
              sabaki.state.treePosition,
            )
          }

          if (
            syncer.treePosition != null &&
            syncer.treePosition !== sabaki.state.treePosition
          ) {
            resolveAnalysisService.scheduleLiveAnalysis(sabaki.state.treePosition)
          }
        }
      })

      syncer.on('human-sl-update', () => {
        if (sabaki.state.analyzingEngineSyncerId === syncer.id) {
          sabaki.setState({
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

        sabaki.setState(({consoleLog}) => {
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

      syncer.controller.on('started', () => {
        gtplogger.write({
          type: 'meta',
          message: 'Engine Started',
          engine: engine.name,
        })

        addEngineLogEntry(engine.name, {
          internal: true,
          content: 'Engine Started',
        })
      })

      syncer.controller.on('stopped', () => {
        gtplogger.write({
          type: 'meta',
          message: 'Engine Stopped',
          engine: engine.name,
        })

        addEngineLogEntry(engine.name, {
          internal: true,
          content: 'Engine Stopped',
        })
      })

      console.log('[engine.starting]', {
        name: engine.name,
        syncerId: syncer.id,
      })

      syncer.start()

      attaching.push(syncer)
      applogger.log('info', 'engine', 'engine.attached', 'Engine attached', {
        name: engine.name,
        syncerId: syncer.id,
      })
    }

    sabaki.setState(({attachedEngineSyncers}) => ({
      attachedEngineSyncers: [...attachedEngineSyncers, ...attaching],
    }))

    return attaching
  }

  async function detachEngines(syncerIds) {
    let detachEngineSyncers = sabaki.state.attachedEngineSyncers.filter(
      (syncer) => syncerIds.includes(syncer.id),
    )

    await Promise.all(
      detachEngineSyncers.map(async (syncer) => {
        await stopEngineGame()
        await syncer.stop()

        applogger.log('info', 'engine', 'engine.detached', 'Engine detached', {
          name: syncer.engine.name,
          syncerId: syncer.id,
        })

        let unset = (syncerId) => (syncerId === syncer.id ? null : syncerId)

        if (lastAnalyzingEngineSyncerId === syncer.id) {
          lastAnalyzingEngineSyncerId = null
        }

        sabaki.setState((state) => ({
          attachedEngineSyncers: state.attachedEngineSyncers.filter(
            (s) => s.id !== syncer.id,
          ),
          engineGameOngoing:
            state.engineGameOngoing &&
            [state.blackEngineSyncerId, state.whiteEngineSyncerId].includes(
              syncer.id,
            )
              ? false
              : state.engineGameOngoing,
          blackEngineSyncerId: unset(state.blackEngineSyncerId),
          whiteEngineSyncerId: unset(state.whiteEngineSyncerId),
          analyzingEngineSyncerId: unset(state.analyzingEngineSyncerId),
        }))
      }),
    )
  }

  async function syncEngine(
    syncerId,
    treePosition,
    {tree = sabaki.inferredState.gameTree} = {},
  ) {
    let syncer = sabaki.state.attachedEngineSyncers.find(
      (syncer) => syncer.id === syncerId,
    )

    if (syncer != null) {
      try {
        await syncer.sync(tree, treePosition)
        applogger.log(
          'info',
          'engine',
          'sync.success',
          'Engine synced successfully',
          {
            syncerId,
            treePosition,
          },
        )
        return true
      } catch (err) {
        applogger.log(
          'warn',
          'engine',
          'engine.sync_failed',
          'Engine sync failed',
          {name: syncer.engine.name, error: err.message},
        )
        await dialog.showMessageBox(err.message, 'error')
      }
    }

    return false
  }

  function getOrAttachEngine(engineIndex) {
    let engine = getConfiguredEngine(engineIndex)
    if (engine == null || engine.enabled === false) return null

    let syncer = sabaki.state.attachedEngineSyncers.find((syncer) => {
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
    let {engineGameOngoing, attachedEngineSyncers} = sabaki.state
    let engineCount = attachedEngineSyncers.length
    if (engineGameOngoing != null) return

    if (engineCount === 0) {
      await dialog.showMessageBox(
        t('Please attach one or more engines first.'),
        'info',
      )

      return
    } else {
      sabaki.setState((state) => ({
        blackEngineSyncerId:
          state.blackEngineSyncerId == null
            ? state.attachedEngineSyncers[0].id
            : state.blackEngineSyncerId,
        whiteEngineSyncerId:
          state.whiteEngineSyncerId == null
            ? state.attachedEngineSyncers[1 % engineCount].id
            : state.whiteEngineSyncerId,
      }))
    }

    let gameId = uuid()
    sabaki.setState({engineGameOngoing: gameId})

    let consecutivePasses = 0

    while (sabaki.state.engineGameOngoing === gameId) {
      let syncerId =
        resolveGetPlayer(treePosition) > 0
          ? sabaki.state.blackEngineSyncerId
          : sabaki.state.whiteEngineSyncerId

      let move = await generateMove(syncerId, treePosition, {
        commit: () => sabaki.state.engineGameOngoing,
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
    if (sabaki.state.engineGameOngoing == null) return

    sabaki.setState((state) => ({
      engineGameOngoing:
        gameId == null || state.engineGameOngoing === gameId
          ? null
          : state.engineGameOngoing,
    }))

    let syncer = sabaki.inferredState.analyzingEngineSyncer
    if (syncer == null) return
  }

  async function startStopEngineGame(treePosition) {
    if (sabaki.state.engineGameOngoing != null) {
      stopEngineGame()
    } else {
      startEngineGame(treePosition)
    }
  }

  // ── generateMove ────────────────────────────────────────────────

  async function generateMove(syncerId, treePosition, {commit = () => true} = {}) {
    let t = i18n.context('sabaki.engine')
    let sign = resolveGetPlayer(treePosition)
    let color = sign > 0 ? 'B' : 'W'
    let syncer = sabaki.state.attachedEngineSyncers.find(
      (syncer) => syncer.id === syncerId,
    )
    if (syncer == null) {
      applogger.log(
        'warn',
        'engine',
        'generateMove.no_syncer',
        'No syncer found for move generation',
        {syncerId, color},
      )
      return
    }

    applogger.log(
      'info',
      'engine',
      'generateMove.start',
      'Generating engine move',
      {name: syncer.engine.name, color, commands: syncer.commands.length},
    )

    let synced = await syncEngine(syncerId, treePosition)
    if (!synced) return

    let {gameTree: tree, board} = sabaki.inferredState
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
      applogger.log('info', 'engine', 'engine.resign', 'Engine resigned', {
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
      applogger.log('info', 'engine', 'engine.move', 'Engine generated move', {
        name: syncer.engine.name,
        coord,
      })
    }

    let currentTree = sabaki.inferredState.gameTree
    let currentTreePosition = sabaki.state.treePosition
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

    resolveDocumentStore.setCurrentTreePosition(
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
    console.log('[analysis.start]', {
      syncerId,
      currentAnalyzingId: sabaki.state.analyzingEngineSyncerId,
      match: sabaki.state.analyzingEngineSyncerId === syncerId,
    })

    if (sabaki.state.analyzingEngineSyncerId === syncerId) return

    let t = i18n.context('sabaki.engine')
    let syncer = sabaki.state.attachedEngineSyncers.find(
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
    sabaki.setState({
      analyzingEngineSyncerId: syncerId,
    })
    updateHumanSLStateFromSyncer(syncer)
    detectHumanSL(syncer).catch(helper.noop)

    if (
      !sabaki.state.engineGameOngoing ||
      (sabaki.state.blackEngineSyncerId !== syncerId &&
        sabaki.state.whiteEngineSyncerId !== syncerId)
    ) {
      if (sabaki.state.mode === 'analysis' && sabaki.state.editWorkspace != null) {
        sabaki.syncEditWorkspaceToCurrentPosition()
        sabaki.scheduleEditWorkspaceAnalysis()
      } else {
        sabaki.analyzeMove(sabaki.state.treePosition)
      }
    }
  }

  function stopAnalysis() {
    let syncer = sabaki.inferredState.analyzingEngineSyncer

    if (syncer != null) {
      syncer.sendAbort()
    }

    sabaki.setState({
      analysis: null,
      analysisTreePosition: null,
      analyzingEngineSyncerId: null,
      humanSLAvailable: false,
      humanSLModelLoaded: false,
      humanSLPendingProfile: null,
      humanSLError: null,
      editWorkspace:
        sabaki.state.editWorkspace == null
          ? null
          : {
              ...sabaki.state.editWorkspace,
              currentAnalysis: null,
              currentOwnership: null,
              referenceAnalysis: null,
              referenceOwnership: null,
              analysisPending: false,
            },
    })
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
        // Cancellation check
        if (sabaki.state.quickAnalysisId !== analysisId) {
          finish(null)
          return
        }

        if (syncer.treePosition !== treePosition || syncer.analysis == null) {
          return
        }

        // Track the latest valid analysis for this position
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
    if (sabaki.state.quickAnalysisId != null) return

    let syncer = await sabaki.ensureAnalysisReady()
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
    sabaki.setState({
      quickAnalysisId: analysisId,
      quickAnalysisSyncerId: syncer.id,
    })
    setBusy(true)

    let tree = sabaki.inferredState.gameTree
    let nodes = [...tree.listMainNodes()]
    let results = []

    // Override KataGo maxVisits for quick mode
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
        // Cancellation check
        if (sabaki.state.quickAnalysisId !== analysisId) break

        let node = nodes[i]
        showInfoOverlay(`Analyzing ${i + 1}/${nodes.length}...`)

        let synced = await syncEngine(syncer.id, node.id, {tree})
        if (!synced || sabaki.state.quickAnalysisId !== analysisId) break

        await prepareHumanSL(syncer)

        let sign = resolveGetPlayer(node.id)
        let args = buildAnalyzeArgs(syncer, sign)

        // Must await: ensures command is queued before listener checks
        await syncer.queueCommand({name: commandName, args})

        let analysis = await waitForQuickAnalysis(
          syncer,
          node.id,
          analysisId,
          50,
          3000,
        )

        if (analysis == null) continue
        if (sabaki.state.quickAnalysisId !== analysisId) break

        // Convert to Black's perspective
        let winrate = analysis.winrate
        let scoreLead = analysis.scoreLead
        if (analysis.sign < 0) winrate = 100 - winrate
        if (analysis.sign < 0 && scoreLead != null) scoreLead = -scoreLead

        results.push({nodeId: node.id, winrate, scoreLead})
      }

      // Batch write all results in one mutation
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
        resolveDocumentStore.setCurrentTreePosition(newTree, sabaki.state.treePosition)
      }
    } finally {
      // Restore KataGo params to user settings
      if (isKata) {
        await configureKataAnalysis(syncer).catch(() => {})
      }

      hideInfoOverlay()
      sabaki.setState({quickAnalysisId: null, quickAnalysisSyncerId: null})
      setBusy(false)

      // Resume normal analysis if active
      if (sabaki.state.analyzingEngineSyncerId != null) {
        resolveAnalysisService.analyzeGameTreePosition(sabaki.state.treePosition)
      }
    }
  }

  function stopQuickAnalysis() {
    let syncer = sabaki.state.attachedEngineSyncers.find(
      (s) => s.id === sabaki.state.quickAnalysisSyncerId,
    )
    if (syncer != null) {
      syncer.sendAbort()
    }

    hideInfoOverlay()
    sabaki.setState({quickAnalysisId: null, quickAnalysisSyncerId: null})
  }

  // ── generateReply (facade for play interaction) ─────────────────

  function generateReply(treePosition, currentPlayer) {
    let syncerId =
      currentPlayer > 0
        ? sabaki.state.whiteEngineSyncerId
        : sabaki.state.blackEngineSyncerId

    if (syncerId == null) return

    generateMove(syncerId, treePosition)
  }

  // ── Public API ──────────────────────────────────────────────────

  return {
    // Config helpers (called by analysisService via sabaki wrapper)
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

    // GTP log
    addEngineLogEntry,
    handleCommandSent,

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

    // Internal state accessors
    getLastAnalyzingEngineSyncerId: () => lastAnalyzingEngineSyncerId,
  }
}
