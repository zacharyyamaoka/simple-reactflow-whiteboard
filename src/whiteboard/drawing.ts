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

/**
 * Topmost shape wins on overlap: later entries paint on top in React Flow's
 * default z-order, so scan back-to-front and take the first hit.
 */
function shapeAt(point: XYPosition, nodes: WbNode[]): ShapeNode | null {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i]
    if (node.type !== 'shape') continue
    const { x, y } = node.position
    const width = node.width ?? 0
    const height = node.height ?? 0
    if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
      return node
    }
  }
  return null
}

interface ResolvedEndpoint {
  nodeId: string
  anchor: WbNode | null
}

/** A point over a shape binds directly to it; otherwise it gets a free-floating anchor. */
function resolveEndpoint(point: XYPosition, nodes: WbNode[]): ResolvedEndpoint {
  const shape = shapeAt(point, nodes)
  if (shape) return { nodeId: shape.id, anchor: null }
  const anchor = createAnchorNode(point)
  return { nodeId: anchor.id, anchor: anchor }
}

export interface CommitResult {
  nodes: WbNode[]
  edges?: ConnectorEdge[]
}

/**
 * Pure: given the finished gesture and the nodes it may bind to, returns
 * what to append to the model. Returns null when the gesture reads as a
 * click rather than a drag and should commit nothing (connector tools only
 * — a tiny rect drag still commits a default-sized rectangle, see below).
 */
export function commitDrawingGesture(gesture: DrawingGesture, nodes: WbNode[]): CommitResult | null {
  if (gesture.tool === 'rect') {
    const rect = normaliseRect(gesture.start, gesture.current)
    if (rect.width < DRAG_COMMIT_THRESHOLD && rect.height < DRAG_COMMIT_THRESHOLD) {
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
  if (dragDistance(gesture) < DRAG_COMMIT_THRESHOLD) return null

  const from = resolveEndpoint(gesture.start, nodes)
  const to = resolveEndpoint(gesture.current, nodes)
  const newNodes = [from.anchor, to.anchor].filter((node): node is WbNode => node !== null)
  const edge = createConnectorEdge(from.nodeId, to.nodeId, gesture.tool === 'arrow')
  return { nodes: newNodes, edges: [edge] }
}
