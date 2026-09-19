import type { NodeProps } from '@xyflow/react'
import CenterHandles from './CenterHandles'
import type { AnchorNode as AnchorNodeType } from './model'

/**
 * 1x1 and invisible: this node has no picture of its own, it exists only to
 * give a free connector endpoint a real position and node id (see the WHY:
 * comment on `createAnchorNode` in model.ts). `pointerEvents: 'none'` even
 * though React Flow already disables interaction on it (selectable: false
 * on the node data) — belt and suspenders against ever becoming a stray
 * click target at 1px square.
 *
 * WHY: the node itself stays 1x1 — its position *is* the connector's
 * endpoint (geometry.ts, drawing.ts both read it as a point), so inflating
 * the node would move the geometry, not just its hit area. The grab target
 * is a separate ~14x14 pad instead: absolutely positioned, centred over the
 * 1x1 node, and left to overflow the wrapper (which does not clip). It only
 * accepts pointer events when the node is draggable, matching the one case
 * React Flow itself would start a drag for.
 */
export default function AnchorNode({ draggable }: NodeProps<AnchorNodeType>) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', opacity: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 14,
          height: 14,
          transform: 'translate(-50%, -50%)',
          pointerEvents: draggable ? 'auto' : 'none',
        }}
      />
      <CenterHandles />
    </div>
  )
}
