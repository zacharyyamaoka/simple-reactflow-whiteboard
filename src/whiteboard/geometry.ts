import type { XYPosition } from '@xyflow/react'

/**
 * Walks from a rectangle's centre toward `toward` and returns the point where
 * the ray leaves the rectangle.
 *
 * WHY: a connector bound to a shape anchors at that shape's centre, because
 * the centre is the only point that stays meaningful as the shape resizes or
 * the other end swings around it. Drawing from the centre, though, puts half
 * the line *inside* the box and buries the arrowhead — so the geometry keeps
 * the centre as the anchor and clips the visible path at the border. This is
 * what makes a bound arrow read like Excalidraw's rather than like a
 * node-graph edge that happens to start in the middle of a node.
 *
 * PROVENANCE: ours, derived from scratch — the standard parametric ray/AABB
 * clip (scale the direction vector until the first slab is crossed). React
 * Flow's own "floating edges" example solves the same problem with a
 * different formulation; it was not read or copied. Nothing in
 * /home/bam/pyblocks/src/whiteboard/ is an analogue: that board snaps to the
 * nearest point on a border instead (App.tsx `findSnap` → `nearestBorderSnap`),
 * which answers "where did the user aim", not "where does this line exit".
 */
export function clipRayToRectBorder(
  centre: XYPosition,
  toward: XYPosition,
  halfWidth: number,
  halfHeight: number,
): XYPosition {
  const dx = toward.x - centre.x
  const dy = toward.y - centre.y
  // Degenerate box or a zero-length ray: there is no border to land on. A
  // positive-number test, not `<= 0` — `NaN <= 0` is false, so a NaN extent
  // would otherwise fall through into `d="M NaN,NaN…"` instead of here.
  if (!(halfWidth > 0) || !(halfHeight > 0)) return centre
  if (dx === 0 && dy === 0) return centre

  // How far the direction vector scales before crossing each slab. The
  // smaller scale is the edge the ray actually leaves through.
  const scaleToVerticalEdge = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx)
  const scaleToHorizontalEdge = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy)
  const scale = Math.min(scaleToVerticalEdge, scaleToHorizontalEdge)

  // The ray never leaves the box (its target is inside, or on, the same
  // rectangle): there is no border to clip to. `drawing.ts`'s resolveEndpoint
  // only binds an endpoint to a shape when the *other* end lies outside it,
  // which guarantees scale < 1 here — so this should be unreachable. Kept as
  // an honest guard: returning `toward` would collapse this endpoint onto
  // the far one, so fall back to the centre instead.
  if (scale >= 1) return centre

  return { x: centre.x + dx * scale, y: centre.y + dy * scale }
}
