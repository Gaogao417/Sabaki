import {h, Component} from 'preact'
import classNames from 'classnames'
import * as gametree from '../../modules/gametree.js'
import {vertexEquals, noop} from '../../modules/helper.js'

const setting = {get: (key) => window.sabaki.setting.get(key)}

let delay = setting.get('graph.delay')
let commentProperties = setting.get('sgf.comment_properties')

class GameGraphNode extends Component {
  shouldComponentUpdate({
    type,
    current,
    compareReference,
    compareTarget,
    fill,
    nodeSize,
    hover,
    treePosition,
  }) {
    return (
      type !== this.props.type ||
      current !== this.props.current ||
      compareReference !== this.props.compareReference ||
      compareTarget !== this.props.compareTarget ||
      fill !== this.props.fill ||
      nodeSize !== this.props.nodeSize ||
      hover !== this.props.hover ||
      treePosition !== this.props.treePosition
    )
  }

  render({
    position: [left, top],
    type,
    current,
    compareReference,
    compareTarget,
    fill,
    nodeSize,
    hover,
    treePosition,
    onMouseDown = noop,
    onMouseUp = noop,
    onDoubleClick = noop,
    onMouseEnter = noop,
    onMouseLeave = noop,
  }) {
    let d = (() => {
      let nodeSize2 = nodeSize * 2

      if (type === 'square') {
        return `M ${left - nodeSize} ${top - nodeSize}
                      h ${nodeSize2} v ${nodeSize2} h ${-nodeSize2} Z`
      } else if (type === 'circle') {
        return `M ${left} ${top} m ${-nodeSize} 0
                      a ${nodeSize} ${nodeSize} 0 1 0 ${nodeSize2} 0
                      a ${nodeSize} ${nodeSize} 0 1 0 ${-nodeSize2} 0`
      } else if (type === 'diamond') {
        let diamondSide = Math.round(Math.sqrt(2) * nodeSize)

        return `M ${left} ${top - diamondSide}
                      L ${left - diamondSide} ${top} L ${left} ${
                        top + diamondSide
                      }
                      L ${left + diamondSide} ${top} Z`
      } else if (type === 'bookmark') {
        return `M ${left - nodeSize} ${top - nodeSize * 1.3}
                      h ${nodeSize2} v ${nodeSize2 * 1.3}
                      l ${-nodeSize} ${-nodeSize} l ${-nodeSize} ${nodeSize} Z`
      }

      return ''
    })()

    return h(
      'g',
      {
        class: classNames('node-group', {
          hover,
          current,
          'compare-reference': compareReference,
          'compare-target': compareTarget,
        }),
        onMouseDown,
        onMouseUp: (evt) => onMouseUp(evt, treePosition),
        onDblClick: (evt) => onDoubleClick(evt, treePosition),
        onMouseEnter: () => onMouseEnter(treePosition),
        onMouseLeave: () => onMouseLeave(treePosition),
      },
      h('circle', {
        class: 'node-hitarea',
        cx: left,
        cy: top,
        r: Math.max(nodeSize * 1.8, 12),
        fill: 'transparent',
      }),
      h('path', {
        d,
        class: classNames('node-ring', {
          hover,
          current,
          'compare-reference': compareReference,
          'compare-target': compareTarget,
        }),
      }),
      h('path', {
        d,
        class: classNames('node', {
          hover,
          current,
          'compare-reference': compareReference,
          'compare-target': compareTarget,
        }),
        fill,
      }),
    )
  }
}

class GameGraphEdge extends Component {
  shouldComponentUpdate({
    positionAbove,
    positionBelow,
    current,
    length,
    gridSize,
  }) {
    return (
      length !== this.props.length ||
      current !== this.props.current ||
      gridSize !== this.props.gridSize ||
      !vertexEquals(positionAbove, this.props.positionAbove) ||
      !vertexEquals(positionBelow, this.props.positionBelow)
    )
  }

  render({
    positionAbove: [left1, top1],
    positionBelow: [left2, top2],
    length,
    gridSize,
    current,
  }) {
    let points

    if (left1 === left2) {
      points = `${left1},${top1} ${left1},${top2 + length}`
    } else {
      points = `${left1},${top1} ${left2 - gridSize},${top2 - gridSize}
                ${left2},${top2} ${left2},${top2 + length}`
    }

    return h('polyline', {
      points,
      fill: 'none',
      stroke: current ? '#ccc' : '#777',
      'stroke-width': current ? 2 : 1,
    })
  }
}

class GameGraph extends Component {
  constructor(props) {
    super(props)

    this.state = {
      cameraPosition: [-props.gridSize, -props.gridSize],
      viewportSize: [0, 0],
      viewportPosition: [0, 0],
      matrixDict: null,
      hoveredTreePosition: null,
    }

    this.matrixDictHash = null
    this.matrixDictCache = {}

    this.handleGraphMouseDown = this.handleGraphMouseDown.bind(this)
    this.handleNodeHoverChange = this.handleNodeHoverChange.bind(this)
    this.handleNodeMouseUp = this.handleNodeMouseUp.bind(this)
    this.handleNodeDoubleClick = this.handleNodeDoubleClick.bind(this)
  }

  componentDidMount() {
    this.setState({matrixDict: this.getMatrixDict(this.props.gameTree)})

    document.addEventListener('mousemove', (evt) => {
      if (!this.svgElement) return

      let {clientX: x, clientY: y, movementX, movementY} = evt
      let {
        cameraPosition: [cx, cy],
        viewportPosition: [vx, vy],
      } = this.state

      if (this.mouseDown === 0) {
        this.drag = true
      } else {
        movementX = movementY = 0
        this.drag = false
      }

      if (this.drag) {
        evt.preventDefault()
        this.setState({cameraPosition: [cx - movementX, cy - movementY]})
      }
    })

    document.addEventListener('mouseup', () => {
      this.mouseDown = null
      if (this.drag) {
        this.setState({hoveredTreePosition: null})
        this.props.onNodeHoverChange?.(null)
      }
    })

    window.addEventListener('resize', () => {
      clearTimeout(this.remeasureId)
      this.remeasureId = setTimeout(() => this.remeasure(), 500)
    })

    this.remeasure()
  }

  shouldComponentUpdate(
    {
      showGameGraph,
      height,
      treePosition,
      compareReferenceTreePosition,
      compareTargetTreePosition,
    },
    nextState,
  ) {
    return (
      height !== this.props.height ||
      treePosition !== this.props.treePosition ||
      compareReferenceTreePosition !== this.props.compareReferenceTreePosition ||
      compareTargetTreePosition !== this.props.compareTargetTreePosition ||
      nextState.hoveredTreePosition !== this.state.hoveredTreePosition ||
      showGameGraph
    )
  }

  componentWillReceiveProps({treePosition, gameTree} = {}) {
    if (treePosition == null) return

    if (gameTree !== this.props.gameTree) {
      let [matrix, dict] = this.getMatrixDict(gameTree)
      this.setState({matrixDict: [matrix, dict]})
    }

    if (treePosition !== this.props.treePosition) {
      clearTimeout(this.updateCameraPositionId)
      this.updateCameraPositionId = setTimeout(
        () => this.updateCameraPosition(),
        delay,
      )
    }
  }

  componentDidUpdate({height, showGameGraph}) {
    if (height !== this.props.height) {
      setTimeout(() => this.remeasure(), 200)
    }

    if (showGameGraph !== this.props.showGameGraph) {
      setTimeout(() => this.updateCameraPosition(), 200)
    }
  }

  getMatrixDict(tree) {
    if (tree !== this.matrixDictTree) {
      this.matrixDictTree = tree
      this.matrixDictCache = gametree.getMatrixDict(tree)
    }

    return this.matrixDictCache
  }

  updateCameraPosition() {
    let {gridSize, treePosition} = this.props
    let {
      matrixDict: [matrix, dict],
    } = this.state

    let [x, y] = dict[treePosition]
    let [width, padding] = gametree.getMatrixWidth(y, matrix)

    let relX = width === 1 ? 0 : 1 - (2 * (x - padding)) / (width - 1)
    let diff = ((width - 1) * gridSize) / 2
    diff = Math.min(diff, this.state.viewportSize[0] / 2 - gridSize)

    this.setState({
      cameraPosition: [
        x * gridSize + relX * diff - this.state.viewportSize[0] / 2,
        y * gridSize - this.state.viewportSize[1] / 2,
      ].map((z) => Math.round(z)),
    })
  }

  remeasure() {
    if (!this.props.showGameGraph) return

    let {left, top, width, height} = this.element.getBoundingClientRect()
    this.setState({
      viewportSize: [width, height],
      viewportPosition: [left, top],
    })
  }

  handleGraphMouseDown(evt) {
    this.mouseDown = evt.button
  }

  handleNodeHoverChange(treePosition) {
    if (this.state.hoveredTreePosition === treePosition) return

    this.setState({hoveredTreePosition: treePosition})
    this.props.onNodeHoverChange?.(treePosition)
  }

  handleNodeMouseUp(evt, treePosition) {
    evt.preventDefault()
    evt.stopPropagation()

    if (this.drag) {
      this.drag = false
      return
    }

    let {onNodeClick = noop, gameTree} = this.props

    clearTimeout(this.nodeClickId)
    this.nodeClickId = setTimeout(() => {
      onNodeClick(
        Object.assign(evt, {
          gameTree,
          treePosition,
        }),
      )
    }, 180)
  }

  handleNodeDoubleClick(evt, treePosition) {
    evt.preventDefault()
    evt.stopPropagation()

    if (this.drag) return

    clearTimeout(this.nodeClickId)

    let {onNodeDoubleClick = noop, gameTree} = this.props

    onNodeDoubleClick(
      Object.assign(evt, {
        gameTree,
        treePosition,
      }),
    )
  }

  renderNodes(
    {
      gameTree,
      gameCurrents,
      gridSize,
      nodeSize,
      compareReferenceTreePosition,
      compareTargetTreePosition,
    },
    {
      matrixDict: [matrix, dict],
      cameraPosition: [cx, cy],
      viewportSize: [width, height],
      hoveredTreePosition,
    },
  ) {
    let nodeColumns = []
    let edges = []

    let [minX, minY] = [cx, cy].map((z) =>
      Math.max(Math.ceil(z / gridSize) - 2, 0),
    )
    let [maxX, maxY] = [cx, cy].map(
      (z, i) => (z + [width, height][i]) / gridSize + 2,
    )
    minY -= 3
    maxY += 3

    let doneTreeBones = []
    let currentTrack = [...gameTree.listCurrentNodes(gameCurrents)]

    // Render only nodes that are visible

    for (let x = minX; x <= maxX; x++) {
      let column = []

      for (let y = minY; y <= maxY; y++) {
        if (matrix[y] == null || matrix[y][x] == null) continue

        let id = matrix[y][x]
        let node = gameTree.get(id)
        let parent = gameTree.get(node.parentId)
        let onCurrentTrack = currentTrack.includes(node)

        // Render node

        let isCurrentNode = this.props.treePosition === id
        let opacity = onCurrentTrack ? 1 : 0.5
        let fillRGB =
          node.data.BM != null
            ? [240, 35, 17]
            : node.data.DO != null
              ? [146, 39, 143]
              : node.data.IT != null
                ? [72, 134, 213]
                : node.data.TE != null
                  ? [89, 168, 15]
                  : commentProperties.some((x) => node.data[x] != null)
                    ? [255, 174, 61]
                    : [238, 238, 238]

        let left = x * gridSize
        let top = y * gridSize

        column.push(
          h(GameGraphNode, {
            key: y,
            position: [left, top],
            type:
              node.data.HO != null
                ? 'bookmark' // Bookmark node
                : (node.data.B != null && node.data.B[0] === '') ||
                    (node.data.W != null && node.data.W[0] === '')
                  ? 'square' // Pass node
                  : node.data.B == null && node.data.W == null
                    ? 'diamond' // Non-move node
                    : 'circle', // Normal node
            current: isCurrentNode,
            compareReference: compareReferenceTreePosition === id,
            compareTarget: compareTargetTreePosition === id,
            fill: `rgb(${fillRGB.map((x) => x * opacity).join(',')})`,
            nodeSize: nodeSize + 1,
            hover: hoveredTreePosition === id,
            treePosition: id,
            onMouseDown: this.handleGraphMouseDown,
            onMouseUp: this.handleNodeMouseUp,
            onDoubleClick: this.handleNodeDoubleClick,
            onMouseEnter: (treePosition) => this.handleNodeHoverChange(treePosition),
            onMouseLeave: () => this.handleNodeHoverChange(null),
          }),
        )

        if (!doneTreeBones.includes(id)) {
          // A *tree bone* denotes a straight edge through the tree

          let positionAbove, positionBelow

          if (parent != null) {
            // Render parent edge with tree bone

            let [px, py] = dict[parent.id]

            positionAbove = [px * gridSize, py * gridSize]
            positionBelow = [left, top]
          } else {
            // Render tree bone only

            positionAbove = [left, top]
            positionBelow = positionAbove
          }

          let sequence = [...gameTree.getSequence(id)]

          if (positionAbove != null && positionBelow != null) {
            edges[!onCurrentTrack ? 'unshift' : 'push'](
              h(GameGraphEdge, {
                key: id,
                positionAbove,
                positionBelow,
                length: (sequence.length - 1) * gridSize,
                current: onCurrentTrack,
                gridSize,
              }),
            )

            doneTreeBones.push(...sequence.map((node) => node.id))
          }
        }

        if (node.children.length > 1) {
          // Render successor edges with subtree bones

          for (let child of node.children) {
            let current = onCurrentTrack && currentTrack.includes(child)
            let [nx, ny] = dict[child.id]
            let subsequence = [...gameTree.getSequence(child.id)]

            edges[!current ? 'unshift' : 'push'](
              h(GameGraphEdge, {
                key: child.id,
                positionAbove: [left, top],
                positionBelow: [nx * gridSize, ny * gridSize],
                length: (subsequence.length - 1) * gridSize,
                current,
                gridSize,
              }),
            )

            doneTreeBones.push(...subsequence.map((node) => node.id))
          }
        }
      }

      if (column.length > 0) nodeColumns.push(h('g', {key: x}, column))
    }

    return [h('g', {}, edges), h('g', {}, nodeColumns)]
  }

  render(
    {showGameGraph},
    {matrixDict, viewportSize, cameraPosition: [cx, cy]},
  ) {
    return h(
      'section',
      {
        ref: (el) => (this.element = el),
        id: 'graph',
      },

      h(
        'style',
        {},
        `#graph svg > * {
                transform: translate(${-cx}px, ${-cy}px);
            }`,
      ),

      showGameGraph &&
        matrixDict &&
        viewportSize &&
        h(
          'svg',
          {
            ref: (el) => (this.svgElement = el),
            width: viewportSize[0],
            height: viewportSize[1],

            onMouseDown: this.handleGraphMouseDown,
          },

          this.renderNodes(this.props, this.state),
        ),
    )
  }
}

export default GameGraph
