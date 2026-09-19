import {
  BaseEdge,
  getStraightPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
  type Node,
  type XYPosition,
} from '@xyflow/react'
import { clipRayToRectBorder } from './geometry'
import type { ConnectorEdge as ConnectorEdgeType } from './model'

/**
 * An endpoint sitting on a shape is pulled back to that shape's border; an
 * endpoint on a 1x1 anchor is left exactly where the user drew it. Anchors
 * have no border worth clipping to, and shortening there would make a free
 * line fall short of the cursor.
 */
function endpointFor(
  node: InternalNode<Node> | undefined,
  centre: XYPosition,
  toward: XYPosition,
): XYPosition {
  if (node?.type !== 'shape') return centre
  const width = node.measured?.width ?? 0
  const height = node.measured?.height ?? 0
  return clipRayToRectBorder(centre, toward, width / 2, height / 2)
}

export default function ConnectorEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps<ConnectorEdgeType>) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  const sourceCentre = { x: sourceX, y: sourceY }
  const targetCentre = { x: targetX, y: targetY }
  const from = endpointFor(sourceNode, sourceCentre, targetCentre)
  const to = endpointFor(targetNode, targetCentre, sourceCentre)

  const [path] = getStraightPath({
    sourceX: from.x,
    sourceY: from.y,
    targetX: to.x,
    targetY: to.y,
  })
  const arrowHead = data?.arrowHead ?? false
  const markerId = `wb-arrowhead-${id}`
  const stroke = selected ? 'var(--wb-accent)' : 'var(--wb-edge-stroke)'

  return (
    <>
      {arrowHead && (
        <defs>
          <marker
            id={markerId}
            markerWidth={9}
            markerHeight={9}
            refX={7.5}
            refY={4.5}
            orient="auto"
          >
            <path d="M0,0 L9,4.5 L0,9 Z" fill={stroke} />
          </marker>
        </defs>
      )}
      {/*
       * WHY: stock <BaseEdge> rather than a hand-rolled pair of paths. It
       * already emits the visible `react-flow__edge-path` (the class every
       * React Flow stylesheet, devtool and selector expects) plus a wider
       * transparent `react-flow__edge-interaction` path underneath, which is
       * the only reason a 2px line is clickable at all. Rolling our own
       * reproduced both by hand and silently dropped the stock class.
       */}
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={12}
        markerEnd={arrowHead ? `url(#${markerId})` : undefined}
        style={{ stroke, strokeWidth: 2 }}
      />
    </>
  )
}
