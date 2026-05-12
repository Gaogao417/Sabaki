import sgf from '@sabaki/sgf'
import * as gametree from '../gametree.js'
import {appendMoveNode, detectKo, detectPrevPass} from './gameTreeWrites.js'
import * as dialog from '../dialog.js'
import * as applogger from '../applogger.js'
import * as sound from '../sound.js'
import * as helper from '../helper.js'
import i18n from '../../i18n.js'

/**
 * Create a document store over a sabaki instance.
 *
 * Phase 12A: document ownership starts here. During the migration the store
 * still writes through sabaki.setState so App.js and legacy callers keep their
 * current subscription model, but game-tree position, navigation, and history
 * writes should flow through this module instead of living in sabaki.js.
 *
 * @param {object} sabaki
 * @param {{
 *   getSetting?: (key: string) => any,
 *   setSetting?: (key: string, value: any) => void,
 *   clearBoardCache?: () => void,
 *   closeDrawer?: () => void,
 *   setMode?: (mode: string) => void,
 *   getTerritoryCompareAvailable?: (state: object) => boolean,
 *   syncEditWorkspaceToCurrentPosition?: () => void,
 *   scheduleEditWorkspaceAnalysis?: () => void,
 *   scheduleLiveAnalysis?: (treePosition: string) => void,
 *   showMessageBox?: (message: string, type: string, buttons: string[], defaultId?: number) => Promise<number>,
 *   boardFromSnapshot?: (snapshot: object) => object,
 * }} [deps]
 */
export function createDocumentStore(sabaki, deps = {}) {
  let {getSetting, showMessageBox} = deps
  let resolveSetting = getSetting ?? ((key) => {
    let w = typeof window !== 'undefined' ? window : {}
    return w.sabaki?.setting?.get(key)
  })
  let setSetting = deps.setSetting ?? ((key, value) => {
    let w = typeof window !== 'undefined' ? window : {}
    w.sabaki?.setting?.set(key, value)
  })

  function getCurrent() {
    let {gameTrees, gameIndex, treePosition, gameCurrents} = sabaki.state
    let tree = gameTrees[gameIndex]
    return {
      gameTrees,
      gameIndex,
      gameCurrents,
      treePosition,
      tree,
      current: gameCurrents[gameIndex],
    }
  }

  function recordHistory({prevGameIndex, prevTreePosition} = {}) {
    let currentEntry = sabaki.history[sabaki.historyPointer]
    let newEntry = {
      gameIndex: sabaki.state.gameIndex,
      gameTrees: sabaki.state.gameTrees,
      treePosition: sabaki.state.treePosition,
      timestamp: Date.now(),
    }

    if (
      currentEntry != null &&
      helper.shallowEquals(currentEntry.gameTrees, newEntry.gameTrees)
    )
      return

    sabaki.history = sabaki.history.slice(
      -resolveSetting('edit.max_history_count'),
      sabaki.historyPointer + 1,
    )

    if (
      currentEntry != null &&
      newEntry.timestamp - currentEntry.timestamp <
        resolveSetting('edit.history_batch_interval')
    ) {
      sabaki.history[sabaki.historyPointer] = newEntry
    } else {
      if (
        currentEntry != null &&
        prevGameIndex != null &&
        prevTreePosition != null
      ) {
        currentEntry.gameIndex = prevGameIndex
        currentEntry.treePosition = prevTreePosition
      }

      sabaki.history.push(newEntry)
      sabaki.historyPointer = sabaki.history.length - 1
    }
  }

  function setCurrentTreePosition(
    tree,
    treePosition,
    {clearCache = false, scheduleAnalysis = true} = {},
  ) {
    if (clearCache) (deps.clearBoardCache ?? gametree.clearBoardCache)()

    let navigated = treePosition !== sabaki.state.treePosition

    if (navigated && sabaki.state.mode === 'analysis') {
      clearTimeout(sabaki.editAnalysisId)
    }

    if (['scoring', 'estimator'].includes(sabaki.state.mode) && navigated) {
      sabaki.setState({mode: 'play'})
    }

    let {gameTrees, gameCurrents, blockedGuesses} = sabaki.state
    let gameIndex = gameTrees.findIndex((t) => t.root.id === tree.root.id)
    let currents = gameCurrents[gameIndex]

    let n = tree.get(treePosition)
    while (n.parentId != null) {
      currents[n.parentId] = n.id
      n = tree.get(n.parentId)
    }

    let prevGameIndex = sabaki.state.gameIndex
    let prevTreePosition = sabaki.state.treePosition
    let nextPreviewState = {
      ...sabaki.state,
      treePosition,
    }
    let getTerritoryCompareAvailable =
      deps.getTerritoryCompareAvailable ??
      ((state) => sabaki.getTerritoryCompareAvailable(state))

    sabaki.setState({
      playVariation: null,
      blockedGuesses: navigated ? [] : blockedGuesses,
      gameTrees: gameTrees.map((t, i) => (i !== gameIndex ? t : tree)),
      gameIndex,
      treePosition,
      mode: sabaki.state.mode,
      territoryCompareEnabled:
        sabaki.state.territoryCompareEnabled &&
        (!navigated || getTerritoryCompareAvailable(nextPreviewState)),
    })

    recordHistory({prevGameIndex, prevTreePosition})

    if (navigated) sabaki.events.emit('navigate')

    if (scheduleAnalysis) {
      if (
        navigated &&
        sabaki.state.mode === 'analysis' &&
        sabaki.state.editWorkspace != null
      ) {
        ;(
          deps.syncEditWorkspaceToCurrentPosition ??
          (() => sabaki.syncEditWorkspaceToCurrentPosition())
        )()
        ;(
          deps.scheduleEditWorkspaceAnalysis ??
          (() => sabaki.scheduleEditWorkspaceAnalysis())
        )()
      } else if (navigated) {
        ;(deps.scheduleLiveAnalysis ?? ((tp) => sabaki.scheduleLiveAnalysis(tp)))(
          treePosition,
        )
      }
    }
  }

  let autoscrollId = null
  let copyVariationData = null

  return {
    getCurrent,
    setCurrentTreePosition,
    recordHistory,

    clearHistory() {
      sabaki.history = []
      recordHistory()
    },

    checkoutHistory(historyPointer) {
      let entry = sabaki.history[historyPointer]
      if (entry == null) return

      let gameTree = entry.gameTrees[entry.gameIndex]

      sabaki.historyPointer = historyPointer
      sabaki.setState({
        gameIndex: entry.gameIndex,
        gameTrees: entry.gameTrees,
        gameCurrents: entry.gameTrees.map((_) => ({})),
      })

      setCurrentTreePosition(gameTree, entry.treePosition, {clearCache: true})
    },

    undo() {
      if (sabaki.state.mode === 'analysis' && sabaki.state.editWorkspace != null) {
        return
      }
      this.checkoutHistory(sabaki.historyPointer - 1)
      applogger.log('debug', 'user', 'user.undo', 'Undo')
    },

    redo() {
      if (sabaki.state.mode === 'analysis' && sabaki.state.editWorkspace != null) {
        return
      }
      this.checkoutHistory(sabaki.historyPointer + 1)
      applogger.log('debug', 'user', 'user.redo', 'Redo')
    },

    goStep(step) {
      let {tree, current, treePosition} = getCurrent()
      let node = tree.navigate(treePosition, step, current)
      if (node != null) setCurrentTreePosition(tree, node.id)
    },

    goToMoveNumber(number) {
      number = +number

      if (isNaN(number)) return
      if (number < 0) number = 0

      let {tree, current} = getCurrent()
      let node = tree.navigate(tree.root.id, Math.round(number), current)

      if (node != null) setCurrentTreePosition(tree, node.id)
      else this.goToEnd()
    },

    goToNextFork() {
      let {tree, current, treePosition} = getCurrent()
      let next = tree.navigate(treePosition, 1, current)
      if (next == null) return
      let sequence = [...tree.getSequence(next.id)]

      setCurrentTreePosition(tree, sequence.slice(-1)[0].id)
    },

    goToPreviousFork() {
      let {tree, current, treePosition} = getCurrent()
      let node = tree.get(treePosition)
      let prev = tree.get(node.parentId)
      if (prev == null) return
      let newTreePosition = tree.root.id

      for (let node of tree.listNodesVertically(prev.id, -1, current)) {
        if (node.children.length > 1) {
          newTreePosition = node.id
          break
        }
      }

      setCurrentTreePosition(tree, newTreePosition)
    },

    goToComment(step) {
      let {tree, current, treePosition} = getCurrent()
      let commentProps = resolveSetting('sgf.comment_properties')
      let newTreePosition = null

      for (let node of tree.listNodesVertically(treePosition, step, current)) {
        if (
          node.id !== treePosition &&
          commentProps.some((prop) => node.data[prop] != null)
        ) {
          newTreePosition = node.id
          break
        }
      }

      if (newTreePosition != null) setCurrentTreePosition(tree, newTreePosition)
    },

    goToBeginning() {
      let {tree} = getCurrent()
      setCurrentTreePosition(tree, tree.root.id)
    },

    goToEnd() {
      let {tree, current} = getCurrent()
      let [node] = [...tree.listCurrentNodes(current)].slice(-1)
      setCurrentTreePosition(tree, node.id)
    },

    goToSiblingVariation(step) {
      let {tree, treePosition} = getCurrent()
      let section = [...tree.getSection(tree.getLevel(treePosition))]
      let index = section.findIndex((node) => node.id === treePosition)
      let newIndex =
        (((step + index) % section.length) + section.length) % section.length

      setCurrentTreePosition(tree, section[newIndex].id)
    },

    changeDownstreamVariation(step) {
      let {tree, current, treePosition} = getCurrent()

      let chIdx = [-1, 0]
      if (step < 0) chIdx = [0, -1]

      let sequence = [...tree.getSequence(treePosition)]
      let node = sequence.slice(-1)[0]
      let next = tree.navigate(node.id, 1, current)
      if (next == null) return
      let lowestFork = node
      while (next != null) {
        if (next.id != node.children.slice(chIdx[0])[0].id) {
          lowestFork = node
        }
        sequence = [...tree.getSequence(next.id)]
        node = sequence.slice(-1)[0]
        next = tree.navigate(node.id, 1, current)
      }

      next = tree.navigate(lowestFork.id, 1, current)
      let idx = lowestFork.children.findIndex((ch) => ch.id == next.id)
      let ch_len = lowestFork.children.length
      idx = (((idx + step) % ch_len) + ch_len) % ch_len
      current[lowestFork.id] = lowestFork.children[idx].id

      next = tree.navigate(lowestFork.id, 1, current)

      while (next.id != null) {
        sequence = [...tree.getSequence(next.id)]
        node = sequence.slice(-1)[0]
        if (node.children.length > 0) {
          current[node.id] = node.children.slice(chIdx[1])[0].id
          next = tree.navigate(node.id, 1, current)
        } else {
          break
        }
      }
    },

    goToMainVariation() {
      let {gameCurrents, gameIndex, tree, treePosition} = getCurrent()

      gameCurrents[gameIndex] = {}
      sabaki.setState({gameCurrents})

      if (tree.onMainLine(treePosition)) {
        setCurrentTreePosition(tree, treePosition)
      } else {
        let id = treePosition
        while (!tree.onMainLine(id)) {
          id = tree.get(id).parentId
        }

        setCurrentTreePosition(tree, id)
      }
    },

    goToSiblingGame(step) {
      let {gameTrees, gameIndex} = getCurrent()
      let newIndex = Math.max(0, Math.min(gameTrees.length - 1, gameIndex + step))

      ;(deps.closeDrawer ?? (() => sabaki.closeDrawer()))()
      setCurrentTreePosition(gameTrees[newIndex], gameTrees[newIndex].root.id)
    },

    /**
     * Validate and execute a play-stone move against the real game tree.
     *
     * Steps:
     *  1. Analyze the move (pass / overwrite / capturing / suicide).
     *  2. Ko / suicide confirmation dialogs (async, can cancel).
     *  3. Append move node via gameTreeWrites.appendMoveNode().
     *  4. Call sabaki.setCurrentTreePosition() with scheduleAnalysis=false.
     *  5. Play sound, log move.
     *  6. Check double pass.
     *  7. Emit moveMake event.
     *  8. Return structured result.
     *
     * @param {number[]} vertex
     * @param {{player?: number}} [options]
     * @returns {Promise<{valid: boolean, changed: boolean, reason?: string, treePosition?: string, pass?: boolean, capturing?: boolean, suicide?: boolean, ko?: boolean, doublePass?: boolean}>}
     */
    async playMove(vertex, {player = null} = {}) {
      let t = i18n.context('sabaki.play')
      let {gameTrees, gameIndex, treePosition} = sabaki.state
      let tree = gameTrees[gameIndex]
      let board = gametree.getBoard(tree, treePosition)

      if (!player) player = sabaki.getPlayer(treePosition)

      let {pass, overwrite, capturing, suicide} = board.analyzeMove(player, vertex)

      if (!pass && overwrite) {
        return {valid: false, changed: false, reason: 'overwrite'}
      }

      let node = tree.get(treePosition)
      let prev = node.parentId != null ? tree.get(node.parentId) : null
      let color = player > 0 ? 'B' : 'W'
      let ko = false

      // Ko confirmation
      if (!pass) {
        if (prev != null && resolveSetting('game.show_ko_warning')) {
          ko = detectKo(tree, treePosition, board, player, vertex)

          if (ko) {
            let answer = await dialog.showMessageBox(
              t(
                [
                  'You are about to play a move which repeats a previous board position.',
                  'This is invalid in some rulesets.',
                ].join('\n'),
              ),
              'info',
              [t('Play Anyway'), t("Don't Play")],
              1,
            )
            if (answer !== 0) {
              return {valid: true, changed: false, reason: 'ko-cancelled'}
            }
          }
        }

        if (suicide && resolveSetting('game.show_suicide_warning')) {
          let answer = await dialog.showMessageBox(
            t(
              [
                'You are about to play a suicide move.',
                'This is invalid in some rulesets.',
              ].join('\n'),
            ),
            'info',
            [t('Play Anyway'), t("Don't Play")],
            1,
          )
          if (answer !== 0) {
            return {valid: true, changed: false, reason: 'suicide-cancelled'}
          }
        }
      }

      // Append move node
      let {newTree, nextTreePosition, createNode} = appendMoveNode(
        tree,
        treePosition,
        vertex,
        player,
      )

      // Update position (skip automatic analysis scheduling)
      setCurrentTreePosition(newTree, nextTreePosition, {scheduleAnalysis: false})

      // Play sounds
      if (!pass) {
        sound.playPachi()
        if (capturing || suicide) sound.playCapture()
        applogger.log('debug', 'game', 'game.move', 'Stone placed', {
          color,
          vertex: vertex,
        })
      } else {
        sound.playPass()
        applogger.log('debug', 'game', 'game.pass', 'Pass', {color})
      }

      // Double pass detection
      let doublePass = false
      if (pass && createNode && prev != null) {
        doublePass = detectPrevPass(tree, treePosition, color)
      }

      // Emit event
      let enterScoring = false
      sabaki.events.emit('moveMake', {
        pass,
        capturing,
        suicide,
        ko,
        enterScoring,
      })

      return {
        valid: true,
        changed: true,
        treePosition: nextTreePosition,
        pass,
        capturing,
        suicide,
        ko,
        doublePass,
      }
    },

    startAutoscrolling(step) {
      if (autoscrollId != null) return

      let first = true
      let maxDelay = resolveSetting('autoscroll.max_interval')
      let minDelay = resolveSetting('autoscroll.min_interval')
      let diff = resolveSetting('autoscroll.diff')

      let scroll = (delay = null) => {
        this.goStep(step)

        clearTimeout(autoscrollId)
        autoscrollId = setTimeout(() => {
          scroll(first ? maxDelay : Math.max(minDelay, delay - diff))
          first = false
        }, delay)
      }

      scroll(400)
    },

    stopAutoscrolling() {
      clearTimeout(autoscrollId)
      autoscrollId = null
    },

    // Phase 12A continuation: game tree mutation methods migrated from sabaki.js

    getGameInfo() {
      return gametree.getGameInfo(getCurrent().tree)
    },

    getPlayer(treePosition) {
      let {data} = getCurrent().tree.get(treePosition)

      return data.PL != null
        ? data.PL[0] === 'W'
          ? -1
          : 1
        : data.B != null || (data.HA != null && +data.HA[0] >= 1)
          ? -1
          : 1
    },

    getComment(treePosition) {
      let {data} = getCurrent().tree.get(treePosition)

      return {
        title: data.N != null ? data.N[0].trim() : null,
        comment: data.C != null ? data.C[0] : null,
        hotspot: data.HO != null,
        moveAnnotation:
          data.BM != null
            ? 'BM'
            : data.TE != null
              ? 'TE'
              : data.DO != null
                ? 'DO'
                : data.IT != null
                  ? 'IT'
                  : null,
        positionAnnotation:
          data.UC != null
            ? 'UC'
            : data.GW != null
              ? 'GW'
              : data.DM != null
                ? 'DM'
                : data.GB != null
                  ? 'GB'
                  : null,
      }
    },

    setGameInfo(data) {
      let {tree} = getCurrent()
      let newTree = gametree.setGameInfo(tree, data)

      if (data.size) {
        setSetting('game.default_board_size', data.size.join(':'))
      }

      if (data.komi && data.komi.toString() !== '') {
        setSetting('game.default_komi', isNaN(data.komi) ? 0 : +data.komi)
      }

      if (data.handicap && data.handicap.toString() !== '') {
        setSetting('game.default_handicap', isNaN(data.handicap) ? 0 : +data.handicap)
      }

      setCurrentTreePosition(newTree, sabaki.state.treePosition)
    },

    setPlayer(treePosition, sign) {
      let {tree} = getCurrent()
      let newTree = tree.mutate((draft) => {
        let node = draft.get(treePosition)
        let intendedSign =
          node.data.B != null || (node.data.HA != null && +node.data.HA[0] >= 1)
            ? -1
            : +(node.data.W != null)

        if (intendedSign === sign || sign === 0) {
          draft.removeProperty(treePosition, 'PL')
        } else {
          draft.updateProperty(treePosition, 'PL', [sign > 0 ? 'B' : 'W'])
        }
      })

      setCurrentTreePosition(newTree, treePosition)
    },

    setComment(treePosition, data) {
      let {tree} = getCurrent()
      let newTree = tree.mutate((draft) => {
        for (let [key, prop] of [
          ['title', 'N'],
          ['comment', 'C'],
        ]) {
          if (key in data) {
            if (data[key] && data[key] !== '') {
              draft.updateProperty(treePosition, prop, [data[key]])
            } else {
              draft.removeProperty(treePosition, prop)
            }
          }
        }

        if ('hotspot' in data) {
          if (data.hotspot) {
            draft.updateProperty(treePosition, 'HO', ['1'])
          } else {
            draft.removeProperty(treePosition, 'HO')
          }
        }

        let clearProperties = (properties) =>
          properties.forEach((p) => draft.removeProperty(treePosition, p))

        if ('moveAnnotation' in data) {
          let moveProps = {BM: '1', DO: '', IT: '', TE: '1'}
          clearProperties(Object.keys(moveProps))

          if (data.moveAnnotation != null) {
            draft.updateProperty(treePosition, data.moveAnnotation, [
              moveProps[data.moveAnnotation],
            ])
          }
        }

        if ('positionAnnotation' in data) {
          let positionProps = {UC: '1', GW: '1', GB: '1', DM: '1'}
          clearProperties(Object.keys(positionProps))

          if (data.positionAnnotation != null) {
            draft.updateProperty(treePosition, data.positionAnnotation, [
              positionProps[data.positionAnnotation],
            ])
          }
        }
      })

      setCurrentTreePosition(newTree, treePosition)
    },

    playAnalysisVariation(sign, moves) {
      if (!moves || moves.length === 0) return

      let {treePosition} = sabaki.state
      let {tree} = getCurrent()
      let [color, opponent] = sign > 0 ? ['B', 'W'] : ['W', 'B']

      let newTree = tree.mutate((draft) => {
        let parentId = treePosition
        let variationData = moves.map((vertex, i) => ({
          [i % 2 === 0 ? color : opponent]: [sgf.stringifyVertex(vertex)],
        }))

        for (let data of variationData) {
          parentId = draft.appendNode(parentId, data)
        }
      })

      let newNode = newTree.get(treePosition).children[0]
      if (newNode != null) {
        setCurrentTreePosition(newTree, newNode.id)
      }
    },

    copyVariation(treePosition) {
      let {tree} = getCurrent()
      let node = tree.get(treePosition)
      let copy = {
        id: node.id,
        data: Object.assign({}, node.data),
        parentId: null,
        children: node.children,
      }

      let stripProperties = resolveSetting('edit.copy_variation_strip_props')

      for (let prop of stripProperties) {
        delete copy.data[prop]
      }

      copyVariationData = copy
    },

    cutVariation(treePosition) {
      this.copyVariation(treePosition)
      this.removeNode(treePosition, {suppressConfirmation: true})
    },

    pasteVariation(treePosition) {
      if (copyVariationData == null) return

      ;(deps.closeDrawer ?? (() => sabaki.closeDrawer()))()
      ;(deps.setMode ?? ((m) => sabaki.setMode(m)))('play')

      let newPosition
      let copied = copyVariationData
      let {tree} = getCurrent()
      let newTree = tree.mutate((draft) => {
        let inner = (id, children) => {
          let childIds = []

          for (let child of children) {
            let childId = draft.appendNode(id, child.data)
            childIds.push(childId)

            inner(childId, child.children)
          }

          return childIds
        }

        newPosition = inner(treePosition, [copied])[0]
      })

      setCurrentTreePosition(newTree, newPosition)
    },

    flattenVariation(treePosition) {
      ;(deps.closeDrawer ?? (() => sabaki.closeDrawer()))()
      ;(deps.setMode ?? ((m) => sabaki.setMode(m)))('play')

      let {gameTrees} = sabaki.state
      let {tree} = getCurrent()
      let gameIndex = gameTrees.findIndex((t) => t.root.id === tree.root.id)
      if (gameIndex < 0) return

      let board = gametree.getBoard(tree, treePosition)
      let playerSign = this.getPlayer(treePosition)
      let inherit = resolveSetting('edit.flatten_inherit_root_props')

      let newTree = tree.mutate((draft) => {
        draft.makeRoot(treePosition)

        for (let prop of ['AB', 'AW', 'AE', 'B', 'W']) {
          draft.removeProperty(treePosition, prop)
        }

        for (let prop of inherit) {
          draft.updateProperty(treePosition, prop, tree.root.data[prop])
        }

        for (let x = 0; x < board.width; x++) {
          for (let y = 0; y < board.height; y++) {
            let sign = board.get([x, y])
            if (sign == 0) continue

            draft.addToProperty(
              treePosition,
              sign > 0 ? 'AB' : 'AW',
              sgf.stringifyVertex([x, y]),
            )
          }
        }
      })

      sabaki.setState({
        gameTrees: gameTrees.map((t, i) => (i === gameIndex ? newTree : t)),
      })
      setCurrentTreePosition(newTree, newTree.root.id)
      this.setPlayer(treePosition, playerSign)
    },

    snapshotAsNewGame() {
      ;(deps.closeDrawer ?? (() => sabaki.closeDrawer()))()

      let board
      let playerSign
      if (sabaki.state.mode === 'analysis' && sabaki.state.editWorkspace != null) {
        let snapshot = sabaki.state.editWorkspace.currentSnapshot
        board = (deps.boardFromSnapshot ?? ((s) => null))(snapshot)
        playerSign = snapshot.nextPlayer
      } else {
        let {tree} = getCurrent()
        let treePosition = sabaki.state.treePosition
        board = gametree.getBoard(tree, treePosition)
        playerSign = this.getPlayer(treePosition)
      }

      ;(deps.setMode ?? ((m) => sabaki.setMode(m)))('play')

      let {gameTrees, gameCurrents} = sabaki.state
      let {tree} = getCurrent()
      let gameIndex = gameTrees.findIndex((t) => t.root.id === tree.root.id)
      if (gameIndex < 0) return

      let inherit = resolveSetting('edit.flatten_inherit_root_props')

      let newTree = gametree.new().mutate((draft) => {
        let size =
          board.width === board.height
            ? board.width.toString()
            : [board.width, board.height].join(':')
        draft.updateProperty(draft.root.id, 'SZ', [size])
        draft.updateProperty(draft.root.id, 'PL', [playerSign > 0 ? 'B' : 'W'])

        for (let x = 0; x < board.width; x++) {
          for (let y = 0; y < board.height; y++) {
            let sign = board.get([x, y])
            if (sign === 0) continue

            draft.addToProperty(
              draft.root.id,
              sign > 0 ? 'AB' : 'AW',
              sgf.stringifyVertex([x, y]),
            )
          }
        }

        for (let prop of inherit) {
          if (tree.root.data[prop] != null) {
            draft.updateProperty(draft.root.id, prop, tree.root.data[prop])
          }
        }
      })

      let newGameIndex = gameIndex + 1
      let newGameTrees = [...gameTrees]
      newGameTrees.splice(newGameIndex, 0, newTree)
      let newGameCurrents = [...gameCurrents]
      newGameCurrents.splice(newGameIndex, 0, {})

      sabaki.setState({
        gameTrees: newGameTrees,
        gameCurrents: newGameCurrents,
      })

      setCurrentTreePosition(newTree, newTree.root.id)
    },

    makeMainVariation(treePosition) {
      ;(deps.closeDrawer ?? (() => sabaki.closeDrawer()))()
      ;(deps.setMode ?? ((m) => sabaki.setMode(m)))('play')

      let {gameCurrents, gameTrees} = sabaki.state
      let {tree} = getCurrent()
      let gameIndex = gameTrees.findIndex((t) => t.root.id === tree.root.id)
      if (gameIndex < 0) return

      let newTree = tree.mutate((draft) => {
        let id = treePosition

        while (id != null) {
          draft.shiftNode(id, 'main')
          id = draft.get(id).parentId
        }
      })

      gameCurrents[gameIndex] = {}
      sabaki.setState({gameCurrents})
      setCurrentTreePosition(newTree, treePosition)
    },

    shiftVariation(treePosition, step) {
      ;(deps.closeDrawer ?? (() => sabaki.closeDrawer()))()
      ;(deps.setMode ?? ((m) => sabaki.setMode(m)))('play')

      let shiftNode = null
      let {tree} = getCurrent()

      for (let node of tree.listNodesVertically(treePosition, -1, {})) {
        let parent = tree.get(node.parentId)

        if (parent.children.length >= 2) {
          shiftNode = node
          break
        }
      }

      if (shiftNode == null) return

      let newTree = tree.mutate((draft) => {
        draft.shiftNode(shiftNode.id, step >= 0 ? 'right' : 'left')
      })

      setCurrentTreePosition(newTree, treePosition)
    },

    async removeNode(treePosition, {suppressConfirmation = false} = {}) {
      let t = i18n.context('sabaki.node')
      let {tree} = getCurrent()
      let node = tree.get(treePosition)
      let noParent = node.parentId == null

      if (
        suppressConfirmation !== true &&
        resolveSetting('edit.show_removenode_warning')
      ) {
        let answer = await (showMessageBox ?? dialog.showMessageBox)(
          t('Do you really want to remove this node?'),
          'warning',
          [t('Remove Node'), t('Cancel')],
          1,
        )
        if (answer === 1) return
      }

      ;(deps.closeDrawer ?? (() => sabaki.closeDrawer()))()
      ;(deps.setMode ?? ((m) => sabaki.setMode(m)))('play')

      let newTree = tree.mutate((draft) => {
        if (!noParent) {
          draft.removeNode(treePosition)
        } else {
          for (let child of node.children) {
            draft.removeNode(child.id)
          }

          for (let prop of ['AB', 'AW', 'AE', 'B', 'W']) {
            draft.removeProperty(node.id, prop)
          }
        }
      })

      sabaki.setState(({gameCurrents, gameIndex}) => {
        if (!noParent) {
          if (gameCurrents[gameIndex][node.parentId] === node.id) {
            delete gameCurrents[gameIndex][node.parentId]
          }
        } else {
          delete gameCurrents[gameIndex][node.id]
        }

        return {gameCurrents}
      })

      setCurrentTreePosition(newTree, noParent ? node.id : node.parentId)
    },

    async removeOtherVariations(
      treePosition,
      {suppressConfirmation = false} = {},
    ) {
      let t = i18n.context('sabaki.node')

      if (
        suppressConfirmation !== true &&
        resolveSetting('edit.show_removeothervariations_warning')
      ) {
        let answer = await (showMessageBox ?? dialog.showMessageBox)(
          t('Do you really want to remove all other variations?'),
          'warning',
          [t('Remove Variations'), t('Cancel')],
          1,
        )
        if (answer === 1) return
      }

      ;(deps.closeDrawer ?? (() => sabaki.closeDrawer()))()
      ;(deps.setMode ?? ((m) => sabaki.setMode(m)))('play')

      let {gameCurrents, gameTrees} = sabaki.state
      let {tree} = getCurrent()
      let gameIndex = gameTrees.findIndex((t) => t.root.id === tree.root.id)
      if (gameIndex < 0) return

      let newTree = tree.mutate((draft) => {
        for (let node of tree.listNodesVertically(
          treePosition,
          1,
          gameCurrents[gameIndex],
        )) {
          if (node.children.length <= 1) continue

          let next = tree.navigate(node.id, 1, gameCurrents[gameIndex])

          for (let child of node.children) {
            if (child.id === next.id) continue
            draft.removeNode(child.id)
          }
        }

        let prevId = treePosition

        for (let node of tree.listNodesVertically(treePosition, -1, {})) {
          if (node.id !== prevId && node.children.length > 1) {
            gameCurrents[gameIndex][node.id] = prevId

            for (let child of node.children) {
              if (child.id === prevId) continue
              draft.removeNode(child.id)
            }
          }

          prevId = node.id
        }
      })

      sabaki.setState({gameCurrents})
      setCurrentTreePosition(newTree, treePosition)
    },
  }
}
