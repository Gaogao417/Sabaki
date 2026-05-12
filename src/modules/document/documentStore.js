import * as gametree from '../gametree.js'
import {appendMoveNode, detectKo, detectPrevPass} from './gameTreeWrites.js'
import * as dialog from '../dialog.js'
import * as applogger from '../applogger.js'
import * as sound from '../sound.js'
import i18n from '../../i18n.js'

/**
 * Create a document store facade over a sabaki instance.
 *
 * Phase 8: minimal adapter. The store delegates tree mutation, position
 * updates, sounds, logging and events to the sabaki instance. Full state
 * ownership migration is Phase 10/12.
 *
 * @param {object} sabaki
 * @param {{getSetting?: (key: string) => any}} [deps]
 * @returns {{playMove: function}}
 */
export function createDocumentStore(sabaki, {getSetting} = {}) {
  let resolveSetting = getSetting ?? ((key) => {
    let w = typeof window !== 'undefined' ? window : {}
    return w.sabaki?.setting?.get(key)
  })

  return {
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
      sabaki.setCurrentTreePosition(newTree, nextTreePosition, {
        scheduleAnalysis: false,
      })

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
  }
}
