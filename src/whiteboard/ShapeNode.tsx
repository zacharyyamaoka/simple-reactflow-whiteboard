import type { NodeProps } from '@xyflow/react'
import CenterHandles from './CenterHandles'
import type { ShapeNode as ShapeNodeType } from './model'

/**
 * React Flow already sizes the node wrapper from node.width/height (see
 * NodeWrapper's inlineDimensions), so this just fills it — no measurement
 * or resize logic of its own.
 */
export default function ShapeNode({ selected }: NodeProps<ShapeNodeType>) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        borderRadius: 2,
        border: `1.5px solid ${selected ? 'var(--wb-accent)' : 'var(--wb-shape-border)'}`,
        background: 'var(--wb-shape-fill)',
        boxShadow: selected ? '0 0 0 2px var(--wb-accent-ring)' : 'none',
      }}
    >
      <CenterHandles />
    </div>
  )
}
