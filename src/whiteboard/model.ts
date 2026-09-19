import type { Edge, Node, XYPosition } from '@xyflow/react'

/**
 * PROVENANCE: the tool set, the anchor-node mechanism and the constructor
 * shapes below port the approach in Zach's prior React Flow whiteboard,
 * /home/bam/pyblocks/src/whiteboard/model.ts — see `createAnchor` at
 * lines 377-396 and `cleanupUnusedAnchors` at lines 944-947. This file trims
 * that whiteboard's much larger tool/shape vocabulary (ellipse, text, group,
 * styling, resize handles, ...) down to the five tools this minimal board
 * needs. Full classification: docs/ALGORITHM-PROVENANCE.md.
 */
export type Tool = 'select' | 'hand' | 'rect' | 'line' | 'arrow'

/** A drawn rectangle. Size lives in React Flow's native node.width/height. */
export type ShapeNode = Node<{ kind: 'rect' }, 'shape'>

/**
 * An invisible free endpoint of a connector. 1x1, not selectable, but
 * draggable so the user can move a loose arrow end.
 */
export type AnchorNode = Node<Record<string, never>, 'anchor'>

export type WbNode = ShapeNode | AnchorNode

/** A line or arrow. arrowHead false => line, true => arrow. */
export type ConnectorEdge = Edge<{ arrowHead: boolean }, 'connector'>

export function makeId(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${random}`
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Normalise two free-form drag points into a positive-size, top-left-anchored rect. */
export function normaliseRect(a: XYPosition, b: XYPosition): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

export const DEFAULT_RECT_SIZE = { width: 160, height: 100 }

/** Below this drag distance (flow units) a gesture reads as a click, not a drag. */
export const DRAG_COMMIT_THRESHOLD = 4

export function createShapeNode(rect: Rect, id = makeId('shape')): ShapeNode {
  return {
    id,
    type: 'shape',
    position: { x: rect.x, y: rect.y },
    width: rect.width,
    height: rect.height,
    data: { kind: 'rect' },
  }
}

/**
 * WHY: React Flow edges require a source/target NODE id — there is no way to
 * anchor an edge endpoint to a bare (x, y). Excalidraw-style arrows that
 * float free of any shape are expressed here as an invisible 1x1 node, so
 * the connector always has real node ids to point at and rides along for
 * free when something drags it. The rejected alternative is an SVG overlay
 * drawn outside React Flow entirely: it would forfeit stock selection,
 * dragging and hit-testing on that free end, and reimplement them by hand.
 * Ports /home/bam/pyblocks/src/whiteboard/model.ts:377-396 (`createAnchor`).
 */
export function createAnchorNode(position: XYPosition, id = makeId('anchor')): AnchorNode {
  return {
    id,
    type: 'anchor',
    position,
    width: 1,
    height: 1,
    selectable: false,
    data: {},
  }
}

export function createConnectorEdge(
  source: string,
  target: string,
  arrowHead: boolean,
  id = makeId('connector'),
): ConnectorEdge {
  return { id, type: 'connector', source, target, data: { arrowHead } }
}

/**
 * An anchor exists only to give a connector's free end a node id; once no
 * edge references it, it is dead weight. Ports
 * /home/bam/pyblocks/src/whiteboard/model.ts:944-947 (`cleanupUnusedAnchors`).
 */
export function cleanupUnusedAnchors(nodes: WbNode[], edges: ConnectorEdge[]): WbNode[] {
  const used = new Set(edges.flatMap((edge) => [edge.source, edge.target]))
  return nodes.filter((node) => node.type !== 'anchor' || used.has(node.id))
}
