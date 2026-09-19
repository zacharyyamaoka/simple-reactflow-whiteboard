import type { XYPosition } from '@xyflow/react'
import {
  DEFAULT_RECT_SIZE,
  DRAG_COMMIT_THRESHOLD,
  createAnchorNode,
  createConnectorEdge,
  createShapeNode,
  normaliseRect,
  type ConnectorEdge,
  type ShapeNode,
  type Tool,
  type WbNode,
} from './model'

export type DrawTool = Extract<Tool, 'rect' | 'line' | 'arrow'>

export function isDrawTool(tool: Tool): tool is DrawTool {
  return tool === 'rect' || tool === 'line' || tool === 'arrow'
}

/** Live state of an in-progress drag; both points are in flow space. */
export interface DrawingGesture {
  tool: DrawTool
  start: XYPosition
  current: XYPosition
}

function dragDistance(gesture: DrawingGesture): number {
  return Math.hypot(gesture.current.x - gesture.start.x, gesture.current.y - gesture.start.y)
}

function pointInShape(point: XYPosition, shape: ShapeNode): boolean {
  const { x, y } = shape.position
  const width = shape.width ?? 0
  const height = shape.height ?? 0
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height
}

/**
 * Topmost shape wins on overlap: later entries paint on top in React Flow's
 * default z-order, so scan back-to-front and take the first hit.
 */
function shapeAt(point: XYPosition, nodes: WbNode[]): ShapeNode | null {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i]
    if (node.type !== 'shape') continue
    if (pointInShape(point, node)) return node
  }
  return null
}

interface ResolvedEndpoint {
  nodeId: string
  anchor: WbNode | null
}

/**
 * A point over a shape binds to it, but only when the OTHER drawn point
 * lies outside that shape's box.
 *
 * WHY: binding is only meaningful when there is a border between the two
 * ends for `clipRayToRectBorder` to land the visible line on. If the other
 * end is also inside the same box — both ends in one shape, two shapes that
 * happen to share a centre, or an arrow whose far end never leaves the near
 * shape's bounds — the ray from centre toward that far point never crosses
 * an edge, so there is nothing to clip to. Binding anyway collapses this
 * endpoint onto the shape's centre (or, if both ends bind, the whole
 * connector onto a single point): invisible and, because the hit path is
 * zero-length too, unclickable. Leaving the endpoint free at the exact
 * point the user drew preserves the gesture instead of erasing it.
 */
function resolveEndpoint(point: XYPosition, otherPoint: XYPosition, nodes: WbNode[]): ResolvedEndpoint {
  const shape = shapeAt(point, nodes)
  if (shape && !pointInShape(otherPoint, shape)) return { nodeId: shape.id, anchor: null }
  const anchor = createAnchorNode(point)
  return { nodeId: anchor.id, anchor: anchor }
}

export interface CommitResult {
  nodes: WbNode[]
  edges?: ConnectorEdge[]
}

/**
 * Pure: given the finished gesture, the nodes it may bind to, and the
 * viewport zoom it was drawn at, returns what to append to the model.
 * Returns null when the gesture reads as a click rather than a drag and
 * should commit nothing (connector tools only — a tiny rect drag still
 * commits a default-sized rectangle, see below).
 *
 * WHY zoom: `gesture.start`/`gesture.current` are flow-space points, but
 * DRAG_COMMIT_THRESHOLD (model.ts) is defined in screen pixels — the
 * distance the user's hand actually moved. Multiplying the flow-space
 * distance by the current zoom converts it back to screen pixels before the
 * comparison, so the same physical twitch reads as a click at any zoom
 * level instead of only at zoom 1.
 */
export function commitDrawingGesture(gesture: DrawingGesture, nodes: WbNode[], zoom: number): CommitResult | null {
  if (gesture.tool === 'rect') {
    const rect = normaliseRect(gesture.start, gesture.current)
    if (rect.width * zoom < DRAG_COMMIT_THRESHOLD && rect.height * zoom < DRAG_COMMIT_THRESHOLD) {
      const { width, height } = DEFAULT_RECT_SIZE
      return {
        nodes: [
          createShapeNode({
            x: gesture.start.x - width / 2,
            y: gesture.start.y - height / 2,
            width,
            height,
          }),
        ],
      }
    }
    return { nodes: [createShapeNode(rect)] }
  }

  // line / arrow: a sub-threshold drag is dropped, not defaulted to anything.
  if (dragDistance(gesture) * zoom < DRAG_COMMIT_THRESHOLD) return null

  const from = resolveEndpoint(gesture.start, gesture.current, nodes)
  const to = resolveEndpoint(gesture.current, gesture.start, nodes)
  const newNodes = [from.anchor, to.anchor].filter((node): node is WbNode => node !== null)
  // Belt-and-braces: resolveEndpoint's rule above should make source ===
  // target impossible (binding both ends to the same shape would require
  // each end to be simultaneously inside and outside it), but a zero-length
  // connector is invisible and unclickable, so refuse to ship one rather
  // than trust the derivation silently.
  if (from.nodeId === to.nodeId) {
    throw new Error('commitDrawingGesture: resolved a connector with source === target')
  }
  const edge = createConnectorEdge(from.nodeId, to.nodeId, gesture.tool === 'arrow')
  return { nodes: newNodes, edges: [edge] }
}
