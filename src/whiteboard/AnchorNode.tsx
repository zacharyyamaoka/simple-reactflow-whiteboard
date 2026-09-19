import CenterHandles from './CenterHandles'

/**
 * 1x1 and invisible: this node has no picture of its own, it exists only to
 * give a free connector endpoint a real position and node id (see the WHY:
 * comment on `createAnchorNode` in model.ts). `pointerEvents: 'none'` even
 * though React Flow already disables interaction on it (selectable: false
 * on the node data) — belt and suspenders against ever becoming a stray
 * click target at 1px square.
 */
export default function AnchorNode() {
  return (
    <div style={{ width: '100%', height: '100%', opacity: 0, pointerEvents: 'none' }}>
      <CenterHandles />
    </div>
  )
}
