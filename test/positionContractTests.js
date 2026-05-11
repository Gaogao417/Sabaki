import assert from 'assert'

import {
  MUTATION_CONTRACTS,
  SCRATCH_ROLES,
  WORKSPACE_KINDS,
  createGameTreePositionSource,
  createScratchPositionFromSnapshot,
  createScratchPositionSource,
  getMutationContractFromState,
  getPositionSourceFromState,
} from '../src/modules/position-contracts.ts'

describe('position contracts', () => {
  it('creates explicit position sources', () => {
    assert.deepEqual(createGameTreePositionSource('node-a'), {
      kind: 'game-tree',
      treePosition: 'node-a',
    })

    assert.deepEqual(
      createScratchPositionSource('snapshot-a', SCRATCH_ROLES.CURRENT),
      {
        kind: 'scratch',
        snapshotId: 'snapshot-a',
        role: 'current',
      },
    )
  })

  it('normalizes scratch positions from snapshots', () => {
    let position = createScratchPositionFromSnapshot(
      {
        width: 2,
        height: 2,
        nextPlayer: -1,
        signMap: [
          [1, '0'],
          [-2, 7],
        ],
      },
      {
        id: 'scratch-a',
        role: SCRATCH_ROLES.REFERENCE,
        komi: 6.5,
        rules: 'Japanese',
        source: {type: 'game-tree-node', id: 'node-a'},
      },
    )

    assert.deepEqual(position, {
      id: 'scratch-a',
      width: 2,
      height: 2,
      nextPlayer: -1,
      signMap: [
        [1, 0],
        [-1, 1],
      ],
      role: 'reference',
      komi: 6.5,
      rules: 'Japanese',
      source: {type: 'game-tree-node', id: 'node-a'},
    })
  })

  it('derives active contracts from state', () => {
    let scratchState = {
      mode: 'analysis',
      treePosition: 'node-a',
      editWorkspace: {
        activeTab: 'reference',
        currentSnapshot: {id: 'current-a', role: 'current'},
        referenceSnapshot: {id: 'reference-a', role: 'reference'},
      },
    }

    assert.equal(
      getMutationContractFromState(scratchState),
      MUTATION_CONTRACTS.SCRATCH_EDIT,
    )
    assert.deepEqual(getPositionSourceFromState(scratchState), {
      kind: 'scratch',
      snapshotId: 'reference-a',
      role: 'reference',
    })

    assert.equal(
      getMutationContractFromState({
        mode: WORKSPACE_KINDS.PLAY,
        treePosition: 'node-a',
      }),
      MUTATION_CONTRACTS.PLAY_MOVE,
    )
  })
})
