import assert from 'assert'

import {
  MUTATION_CONTRACTS,
  SCRATCH_ROLES,
  WORKSPACE_KINDS,
  createGameTreePositionSource,
  createScratchPositionFromSnapshot,
  createScratchPositionSource,
  getMutationContractForWorkspace,
  getMutationContractFromState,
  getPositionSourceFromState,
  getWorkspaceKindFromState,
} from '../src/modules/workbench/contracts/index.ts'

// Verify the old compatibility path still works
import {
  MUTATION_CONTRACTS as MUTATION_CONTRACTS_COMPAT,
  SCRATCH_ROLES as SCRATCH_ROLES_COMPAT,
  WORKSPACE_KINDS as WORKSPACE_KINDS_COMPAT,
  createGameTreePositionSource as createGameTreePositionSource_COMPAT,
  getMutationContractFromState as getMutationContractFromState_COMPAT,
  getPositionSourceFromState as getPositionSourceFromState_COMPAT,
} from '../src/modules/position-contracts'

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

  it('maps workspaces to mutation contracts', () => {
    assert.equal(
      getMutationContractForWorkspace(WORKSPACE_KINDS.PLAY),
      MUTATION_CONTRACTS.PLAY_MOVE,
    )
    assert.equal(
      getMutationContractForWorkspace(WORKSPACE_KINDS.SCRATCH_ANALYSIS),
      MUTATION_CONTRACTS.SCRATCH_EDIT,
    )
    assert.equal(
      getMutationContractForWorkspace(WORKSPACE_KINDS.RECALL),
      MUTATION_CONTRACTS.RECALL_ANSWER,
    )
    assert.equal(
      getMutationContractForWorkspace(WORKSPACE_KINDS.VARIATION_ANALYSIS),
      MUTATION_CONTRACTS.VARIATION_MOVE,
    )
  })
})

describe('canonical import path', () => {
  it('exports the same values as the compatibility path', () => {
    assert.equal(MUTATION_CONTRACTS.PLAY_MOVE, MUTATION_CONTRACTS_COMPAT.PLAY_MOVE)
    assert.equal(SCRATCH_ROLES.CURRENT, SCRATCH_ROLES_COMPAT.CURRENT)
    assert.equal(WORKSPACE_KINDS.PLAY, WORKSPACE_KINDS_COMPAT.PLAY)

    assert.deepEqual(
      createGameTreePositionSource('x'),
      createGameTreePositionSource_COMPAT('x'),
    )
  })

  it('compatibility re-export derives contracts identically', () => {
    let state = {mode: 'play', treePosition: 'n1'}
    assert.equal(
      getMutationContractFromState(state),
      getMutationContractFromState_COMPAT(state),
    )
    assert.deepEqual(
      getPositionSourceFromState(state),
      getPositionSourceFromState_COMPAT(state),
    )
  })
})

describe('workspace kind mapping', () => {
  it('maps play mode to PLAY workspace', () => {
    assert.equal(
      getWorkspaceKindFromState({mode: 'play', treePosition: 'n1'}),
      WORKSPACE_KINDS.PLAY,
    )
  })

  it('maps analysis + editWorkspace to SCRATCH_ANALYSIS', () => {
    assert.equal(
      getWorkspaceKindFromState({
        mode: 'analysis',
        editWorkspace: {currentSnapshot: {id: 's1'}},
      }),
      WORKSPACE_KINDS.SCRATCH_ANALYSIS,
    )
  })

  it('analysis without editWorkspace is null', () => {
    assert.equal(
      getWorkspaceKindFromState({mode: 'analysis'}),
      null,
    )
  })

  it('maps recall mode to RECALL', () => {
    assert.equal(
      getWorkspaceKindFromState({mode: 'recall', treePosition: 'n1'}),
      WORKSPACE_KINDS.RECALL,
    )
  })

  it('maps autoplay to null (legacy/unmigrated)', () => {
    assert.equal(
      getWorkspaceKindFromState({mode: 'autoplay', treePosition: 'n1'}),
      null,
    )
    assert.equal(
      getMutationContractFromState({mode: 'autoplay', treePosition: 'n1'}),
      null,
    )
  })

  it('maps scoring, estimator, find, guess, problem to null (legacy)', () => {
    for (let mode of ['scoring', 'estimator', 'find', 'guess', 'problem']) {
      assert.equal(
        getWorkspaceKindFromState({mode, treePosition: 'n1'}),
        null,
        `${mode} should map to null`,
      )
    }
  })

  it('null state returns null', () => {
    assert.equal(getWorkspaceKindFromState(null), null)
    assert.equal(getMutationContractFromState(null), null)
    assert.equal(getPositionSourceFromState(null), null)
  })
})

describe('position source derivation', () => {
  it('returns scratch source for analysis current tab', () => {
    let state = {
      mode: 'analysis',
      editWorkspace: {
        activeTab: 'current',
        currentSnapshot: {id: 'cur-1', role: 'current'},
        referenceSnapshot: {id: 'ref-1', role: 'reference'},
      },
    }
    assert.deepEqual(getPositionSourceFromState(state), {
      kind: 'scratch',
      snapshotId: 'cur-1',
      role: 'current',
    })
  })

  it('returns scratch source for analysis reference tab', () => {
    let state = {
      mode: 'analysis',
      editWorkspace: {
        activeTab: 'current',
        currentSnapshot: {id: 'cur-1', role: 'current'},
        referenceSnapshot: {id: 'ref-1', role: 'reference'},
      },
    }
    assert.deepEqual(getPositionSourceFromState(state, 'reference'), {
      kind: 'scratch',
      snapshotId: 'ref-1',
      role: 'reference',
    })
  })

  it('returns null when editWorkspace has no snapshots', () => {
    let state = {
      mode: 'analysis',
      editWorkspace: {
        activeTab: 'current',
        currentSnapshot: null,
      },
    }
    assert.equal(getPositionSourceFromState(state), null)
  })

  it('returns game-tree source for play mode', () => {
    let state = {mode: 'play', treePosition: 'node-42'}
    assert.deepEqual(getPositionSourceFromState(state), {
      kind: 'game-tree',
      treePosition: 'node-42',
    })
  })

  it('returns game-tree source for recall mode', () => {
    let state = {mode: 'recall', treePosition: 'node-r1'}
    assert.deepEqual(getPositionSourceFromState(state), {
      kind: 'game-tree',
      treePosition: 'node-r1',
    })
  })

  it('returns null for autoplay (legacy)', () => {
    assert.equal(
      getPositionSourceFromState({mode: 'autoplay', treePosition: 'n1'}),
      null,
    )
  })

  it('returns null without treePosition', () => {
    assert.equal(getPositionSourceFromState({mode: 'play'}), null)
  })
})
