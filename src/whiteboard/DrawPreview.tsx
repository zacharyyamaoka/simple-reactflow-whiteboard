import { ViewportPortal } from '@xyflow/react'
import { normaliseRect } from './model'
import type { DrawingGesture } from './drawing'

/**
 * WHY: ViewportPortal renders its children inside React Flow's own
 * transformed viewport div, so a plain absolutely-positioned element drawn
 * at flow coordinates pans and zooms for free — no manual matrix math to
 * keep the live preview glued to the gesture.
 */
export default function DrawPreview({ gesture }: { gesture: DrawingGesture | null }) {
  if (!gesture) return null

  if (gesture.tool === 'rect') {
    const rect = normaliseRect(gesture.start, gesture.current)
    return (
      <ViewportPortal>
        <div
          style={{
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            border: '1.5px dashed var(--wb-accent)',
            background: 'var(--wb-shape-fill)',
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />
      </ViewportPortal>
    )
  }

  const { start, current } = gesture
  const left = Math.min(start.x, current.x)
  const top = Math.min(start.y, current.y)
  const width = Math.abs(current.x - start.x) || 1
  const height = Math.abs(current.y - start.y) || 1
  const markerId = 'wb-preview-arrowhead'

  return (
    <ViewportPortal>
      <svg
        style={{ position: 'absolute', left, top, overflow: 'visible', pointerEvents: 'none' }}
        width={width}
        height={height}
      >
        {gesture.tool === 'arrow' && (
          <defs>
            <marker id={markerId} markerWidth={9} markerHeight={9} refX={7.5} refY={4.5} orient="auto">
              <path d="M0,0 L9,4.5 L0,9 Z" fill="var(--wb-accent)" />
            </marker>
          </defs>
        )}
        <line
          x1={start.x - left}
          y1={start.y - top}
          x2={current.x - left}
          y2={current.y - top}
          stroke="var(--wb-accent)"
          strokeWidth={2}
          markerEnd={gesture.tool === 'arrow' ? `url(#${markerId})` : undefined}
        />
      </svg>
    </ViewportPortal>
  )
}
