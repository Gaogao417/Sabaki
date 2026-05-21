# B2: Adapter Test Mock Fix — Test Contract v0.1

Date: 2026-05-21
Status: pending-audit

## 0. Source Alignment

| Source | Section | Constraint |
|---|---|---|
| gobanDataAdapter.ts L42-48 | getDocumentStore dep type | `getDocumentStore()` returns `{ getCurrent(): { tree, treePosition, ... } }`. No `getCurrentTree()`, `getCurrentTreePosition()`, or `getCurrentBoard()`. |
| gobanDataAdapter.ts L85 | getBoard dep type | `deps.getBoard(gameTree, treePosition)` is the only path to get a board. |
| gobanDataAdapter.ts L197-201 | getSnapshot board logic | `documentStore.getCurrent()` yields `{ tree, treePosition }`. `deps.getBoard(tree, pos)` yields board. |
| Architecture v0.5 Section 3.2 | documentStore definition | Owns game tree, tree position, board navigation. Training reads through adapter. |

## 1. User Story

As a developer, I want the W3.5 gobanDataAdapter test mocks to match the production adapter API so that all tests pass.

## 2. Scope

**No production code changes.** Only `test/workbench/wiring/w35-goban-datasource-adapter.test.js`.

## 3. Changes Required

### FIX-M1: createMockDocumentStore (line 59-68)

Replace:
```js
function createMockDocumentStore(overrides = {}) {
  const board = createMockBoardState()
  return {
    getCurrentTree: () => ({id: 'mock_tree_1'}),
    getCurrentTreePosition: () => 'node_root',
    getCurrentBoard: () => board,
    playMove: () => Promise.resolve({valid: true, changed: true}),
    ...overrides,
  }
}
```

With:
```js
function createMockDocumentStore(overrides = {}) {
  return {
    getCurrent: () => ({
      tree: {id: 'mock_tree_1'},
      treePosition: 'node_root',
    }),
    playMove: () => Promise.resolve({valid: true, changed: true}),
    ...overrides,
  }
}
```

### FIX-D1: createAdapterDeps — add getBoard (line 185-234)

Add `getBoard` to options destructuring and returned deps:
```js
getBoard: getBoard || ((gameTree, treePosition) => createMockBoardState()),
```

### FIX-T01a: Test mock override for gameTree

From `getCurrentTree: () => mockTree` to:
```js
documentStore: createMockDocumentStore({
  getCurrent: () => ({ tree: mockTree, treePosition: 'node_root' }),
}),
```

### FIX-T01b: Test mock override for board

From `getCurrentBoard: () => ...` to deps-level override:
```js
getBoard: () => mockBoard,
```
Assertion changes to `snapshot.boardState.board === mockBoard`.

### FIX-T01c: Test mock override for treePosition

From `getCurrentTreePosition: () => 'node_move_7'` to:
```js
documentStore: createMockDocumentStore({
  getCurrent: () => ({ tree: {id: 'mock_tree_1'}, treePosition: 'node_move_7' }),
}),
```

### FIX-T15: Sentinel deps — add getBoard

Add `getBoard: () => null` to sentinel deps object.

## 4. Test Contract Table

| Test ID | Layer | Production Subject | Real Deps | Mocked Deps | Forbidden Mocks | Primary Assertion |
|---|---|---|---|---|---|---|
| FIX-T01a | CONTAINER_DELEGATION | gobanDataAdapter.getSnapshot() | real createGobanDataAdapter | deps.getDocumentStore returns getCurrent: () => ({ tree: mockTree, treePosition }) | getSnapshot must not be mocked | snapshot.boardState.gameTree === mockTree |
| FIX-T01b | CONTAINER_DELEGATION | gobanDataAdapter.getSnapshot() | real createGobanDataAdapter | deps.getBoard: () => mockBoard | getSnapshot must not be mocked | snapshot.boardState.board === mockBoard |
| FIX-T01c | CONTAINER_DELEGATION | gobanDataAdapter.getSnapshot() | real createGobanDataAdapter | deps.getDocumentStore returns getCurrent: () => ({ tree, treePosition: 'node_move_7' }) | getSnapshot must not be mocked | snapshot.boardState.treePosition === 'node_move_7' |
| FIX-T15 | ARCHITECTURE_BOUNDARY | createGobanDataAdapter constructor | real createGobanDataAdapter | all sentinel deps including getBoard: () => null | sabaki.js must not be imported | constructor does not throw |

## 5. Tests Passing After Fix (no changes needed)

FIX-T02, FIX-T03a/b/c, FIX-T04, FIX-T05a/b, FIX-T06, FIX-T16a/b, FIX-T25, FIX-T26a/b, FIX-CLEANUP

## 6. Out of Scope

- Production code changes
- New test coverage
- Changing playMode write guard
- Modifying adapter subscription or destroy behavior
