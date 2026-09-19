import { Handle, Position } from '@xyflow/react'
import type { CSSProperties } from 'react'

/**
 * WHY: React Flow only computes an edge endpoint's position from a
 * registered <Handle>'s measured DOM bounds — a node with none gets no
 * position at all and its edges silently render nothing (confirmed by
 * reading getEdgePosition/getHandle$1 in the installed
 * @xyflow/system@0.0.82 bundle: an empty handle-bounds array resolves to
 * `null`, and the edge wrapper bails out before ever mounting a custom edge
 * component). ShapeNode and AnchorNode both need a connector to be able to
 * land on them, so both render one inert source+target handle pair, pinned
 * to the node's exact center via CSS rather than React Flow's edge-relative
 * Top/Right/Bottom/Left offsets — this board has no notion of "which side"
 * a freeform line enters from.
 */
const CENTER_HANDLE_STYLE: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 'none',
  background: 'transparent',
  opacity: 0,
  pointerEvents: 'none',
  transform: 'translate(-50%, -50%)',
}

export default function CenterHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} style={CENTER_HANDLE_STYLE} />
      <Handle type="source" position={Position.Top} isConnectable={false} style={CENTER_HANDLE_STYLE} />
    </>
  )
}
