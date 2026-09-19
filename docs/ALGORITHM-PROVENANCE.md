# Algorithm provenance

Every file below that does real logic (not just JSX wiring) and where its
approach came from. "Ported" means the actual algorithm/shape; this app's own
tool vocabulary, styling and prop wiring are original even where a port sits
next to them.

## `src/whiteboard/model.ts`

- **Tool set, `makeId`, `createShapeNode`** — ours, ad hoc. Trivial shape.
- **`createAnchorNode`** — ports the free-endpoint-as-invisible-node decision
  and its constructor shape from
  `/home/bam/pyblocks/src/whiteboard/model.ts:377-396` (`createAnchor`).
  Trimmed: the donor anchor carries a full `ShapeStyle` (stroke/fill/opacity
  for a style system this board doesn't have); this one only needs
  `width`/`height`/`selectable`.
- **`cleanupUnusedAnchors`** — ports
  `/home/bam/pyblocks/src/whiteboard/model.ts:944-947` verbatim in approach
  (build the set of node ids any edge still references, drop the anchors not
  in it). The donor also drops other non-anchor "kind"s conditionally; this
  board only ever has one anchor kind so the filter simplifies to a straight
  type check.
- **`normaliseRect`** — ours, ad hoc (min/max of two points; not really an
  "algorithm").

## `src/whiteboard/tools.ts`

- **`HOTKEYS` table** — ports
  `/home/bam/pyblocks/src/whiteboard/bindings.ts:24-58` (`DEFAULT_HOTKEYS`),
  keeping only the five key → tool entries this board has (`v/h/r/l/a`). The
  donor table also binds `o/t/f/b`, every edit/arrange/view command, and
  supports per-user overrides via a `BindingsState`; none of that exists
  here — this is a flat `Record<string, Tool>`.
- **`useToolHotkeys`** — ours, ad hoc (a standard `keydown` listener + a
  typing-target guard). The donor's binding resolution goes through a
  `mod+shift+alt+key` serialization format this board has no use for (no
  modifier combos, no per-command config).

## `src/whiteboard/drawing.ts`

- **Gesture shape (`start`/`current` in flow space) and the
  screen→flow→commit flow** — ports the shape of
  `/home/bam/pyblocks/src/App.tsx` `onToolPointerDown`/`onToolPointerMove`
  (~3051-3073) and `createConnector` (~2985-3017): track a gesture with
  `screenToFlowPosition`, resolve each endpoint independently, create an
  anchor only for the end that isn't a snap/bind hit.
- **`shapeAt` (point-in-shape binding test)** — ours, ad hoc, and
  deliberately NOT a port. The donor's binding
  (`/home/bam/pyblocks/src/App.tsx` `findSnap`, ~2404-2410, calling
  `nearestBorderSnap`) is a border-proximity snap system (finds the nearest
  point on a shape's *border*, within a pixel radius that scales with zoom).
  This board's brief only asks for "did the point land inside the shape's
  bounding box" — a plain axis-aligned containment test — so porting the
  border-snap machinery would be importing complexity this app doesn't need.
- **`commitDrawingGesture`'s click-vs-drag threshold and the default
  160x100 rectangle on a sub-threshold `rect` drag** — ours, ad hoc; this
  exact behavior (Excalidraw's click-to-place-a-default-rectangle) isn't in
  the donor, which always requires a real drag distance for every shape.

## `src/whiteboard/Whiteboard.tsx`

- **Per-tool `<ReactFlow>` props** (`panOnDrag`, `selectionOnDrag`,
  `nodesDraggable`, `elementsSelectable`, `nodesConnectable={false}`) — ports
  `/home/bam/pyblocks/src/App.tsx` ~4832-4849 verbatim (same prop-to-tool
  mapping). The donor also sets `deleteKeyCode={null}` because it runs its
  own command-driven delete path; this board uses React Flow's built-in
  delete-key handling instead (`deleteKeyCode={['Delete', 'Backspace']}`),
  since it has no command system to route through.
- **`onDelete` anchor sweep** — implements the same *outcome* the brief
  names (`onEdgesDelete`/`onNodesDelete` wired to
  `cleanupUnusedAnchors`), but via React Flow's combined `onDelete` callback
  instead of the two separate ones. Read in the installed
  `@xyflow/react@12.11.6` bundle (`deleteElements`, in
  `node_modules/@xyflow/react/dist/esm/index.mjs`): `onEdgesDelete` fires
  with only the edges being removed, `onNodesDelete` fires afterward with
  only the nodes, and `onDelete` fires with `{ nodes, edges }` together
  where `edges` already includes any connector attached to a deleted shape.
  One callback with the full picture avoids reconstructing "which edges are
  about to disappear because their node is being deleted" from the two
  narrower callbacks.
- **`nodeDragThreshold={0}`** — ours, not a port, found by reading
  `@xyflow/system@0.0.82`'s `XYDrag` (`dist/esm/index.mjs`, the d3-drag
  `'start'`/`'drag'` handlers): with the library's default threshold (1px),
  the drag offset is computed from wherever the pointer was when it first
  crossed that threshold, not from the mousedown point, so whatever distance
  the pointer covered before crossing 1px is silently dropped from the
  total delta. Invisible with a real mouse (sub-pixel), but the acceptance
  suite's `drag()` helper interpolates in 8 discrete ~12px steps, so the
  very first step ate an entire step's worth of movement and every
  select-tool drag landed short by ~12px. Confirmed by instrumenting
  `window.__WB__` after each step of the suite's own drag pattern.

## `src/whiteboard/CenterHandles.tsx`

- **Rendering an inert `<Handle>` pair on `shape`/`anchor` nodes** — ours,
  not a port of pyblocks (that whiteboard uses full border-snap handles with
  real positions). Found by reading `@xyflow/system@0.0.82`'s
  `getEdgePosition`/`getHandle$1`: an edge's endpoint position comes only
  from a registered `<Handle>`'s measured DOM bounds; a node with none
  resolves to `null` and its edges render nothing at all. Centering both
  handles via CSS (rather than React Flow's edge-relative Top/Right/Bottom/
  Left offsets) is a deliberate simplification — this board has no notion of
  "which side" a freeform connector enters a node from.

## `src/whiteboard/ConnectorEdge.tsx`

- **Straight path + separate wide invisible hit-path** — the two-path
  technique (visible stroke + a much wider transparent one underneath as
  the click target) is exactly what the brief specifies; it is also how
  React Flow's own `<BaseEdge>` implements `interactionWidth`
  (`dist/esm/index.mjs`, `function BaseEdge`, using `strokeOpacity: 0` +
  `strokeWidth: interactionWidth`, default `20`). This file hand-rolls the
  same technique at `strokeWidth={12}` per the brief instead of delegating
  to `<BaseEdge>`, so it's listed as ours/ad hoc rather than a port of a
  named algorithm — the underlying trick (an SVG element with `pointer-events:
  visibleStroke` hit-tests on stroke geometry regardless of color/opacity)
  is standard SVG behavior, not something either codebase invented.
- **Arrowhead marker** — ours, ad hoc (a plain SVG `<marker>` with a
  triangle path); not a port.

## `/home/bam/openflowkit-reference/` — evaluated and rejected

122k LOC, MIT, evaluated and rejected as a source: no drag-to-draw gesture
and no freeform arrows, only fixed-size node palette adds and handle-to-handle
edges — noting this so nobody re-checks it.
