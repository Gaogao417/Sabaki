/**
 * Type declarations for @sabaki npm packages.
 * Adapted from Gabaki's sabaki.d.ts for Sabaki's runtime:
 * - TreeId is string | number (Sabaki uses string TreePosition alongside numeric node ids)
 * - GoBoard includes methods used by enginesyncer.js and study.js
 */

declare module '@sabaki/immutable-gametree' {
  export type TreeId = string | number

  export interface TreeNode {
    id: TreeId
    data: Record<string, string[]>
    parentId: TreeId | null
    children: TreeNode[]
  }

  export interface GameTreeDraft {
    root: TreeNode
    get(id: TreeId): TreeNode | null
    updateProperty(id: TreeId, key: string, value: string[]): void
    removeProperty(id: TreeId, key: string): void
    addToProperty(id: TreeId, key: string, value: string): void
    appendNode(id: TreeId, data: Record<string, string[]>): TreeId
  }

  export default class GameTree {
    constructor(options?: {
      getId?: () => TreeId
      merger?: (nodes: TreeNode[]) => TreeNode | null
      root?: Partial<TreeNode>
    })
    root: TreeNode
    get(id: TreeId): TreeNode | null
    getSequence(id: TreeId): IterableIterator<TreeNode>
    listNodes(): IterableIterator<TreeNode>
    listMainNodes(): IterableIterator<TreeNode>
    listNodesVertically(startId: TreeId, step: number, currents?: Record<number, number>): IterableIterator<TreeNode>
    listCurrentNodes(currents?: Record<number, number>): IterableIterator<TreeNode>
    mutate(mutator: (draft: GameTreeDraft) => void): GameTree
    navigate(id: TreeId, step: number, currents?: Record<number, number>): TreeNode | null
    onMainLine(id: TreeId): boolean
    getHeight(): number
    getHash(): string
    toJSON(): TreeNode
  }
}

declare module '@sabaki/go-board' {
  export type Vertex = [number, number]
  export type Sign = -1 | 0 | 1
  export type SignMap = Sign[][]

  export function fromDimensions(width: number, height?: number): GoBoard

  export default class GoBoard {
    constructor(signMap?: number[][])
    signMap: number[][]
    width: number
    height: number
    get(vertex: Vertex): number
    set(vertex: Vertex, sign: number): GoBoard
    has(vertex: Vertex): boolean
    clear(): GoBoard
    makeMove(sign: number, vertex: Vertex, options?: {
      preventSuicide?: boolean
      preventOverwrite?: boolean
      preventKo?: boolean
    }): GoBoard
    clone(): GoBoard
    diff(board: GoBoard): Vertex[] | null
    analyzeMove(sign: number, vertex: Vertex): {captureCount: number; occupied: boolean}
    stringifyVertex(vertex: Vertex): string
    parseVertex(coord: string): Vertex
    getNeighbors(vertex: Vertex): Vertex[]
    getChain(vertex: Vertex): Vertex[]
    getLiberties(vertex: Vertex): Vertex[]
    hasLiberties(vertex: Vertex, visited?: Record<string, boolean>): boolean
    getCaptures(sign: number): number
    isEmpty(): boolean
    isValid(): boolean
    isSquare(): boolean

    static fromDimensions(width: number, height?: number): GoBoard
  }
}
