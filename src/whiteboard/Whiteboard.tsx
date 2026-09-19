import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type OnDelete,
} from '@xyflow/react'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import AnchorNode from './AnchorNode'
import ConnectorEdge from './ConnectorEdge'
import { publishDebugState } from './debug'
import { commitDrawingGesture, isDrawTool, type DrawingGesture } from './drawing'
import DrawPreview from './DrawPreview'
import { cleanupUnusedAnchors, type ConnectorEdge as ConnectorEdgeType, type Tool, type WbNode } from './model'
import ShapeNode from './ShapeNode'
import Toolbar from './Toolbar'
import { useToolHotkeys } from './tools'

// Stable references: React Flow warns (and can loop) if nodeTypes/edgeTypes
// are recreated on every render.
const nodeTypes = { shape: ShapeNode, anchor: AnchorNode }
const edgeTypes = { connector: ConnectorEdge }

function cursorForTool(tool: Tool): string | undefined {
  // 'hand' is left alone: React Flow's own `.react-flow__pane.draggable` /
  // `.dragging` classes already swap grab/grabbing for a truthy panOnDrag.
  return isDrawTool(tool) ? 'crosshair' : undefined
}

export default function Whiteboard() {
  const reactFlow = useReactFlow()
  const [tool, setTool] = useState<Tool>('select')
  const [nodes, setNodes, onNodesChange] = useNodesState<WbNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<ConnectorEdgeType>([])
  const [gesture, setGesture] = useState<DrawingGesture | null>(null)

  // PROVENANCE: the drawingRef + screenToFlowPosition gesture below ports
  // /home/bam/pyblocks/src/App.tsx onToolPointerDown (~3051-3073) and
  // onToolPointerMove (~3075-3091), and the per-tool <ReactFlow> prop table
  // (~4832-4848, panOnDrag/selectionOnDrag/nodesDraggable/elementsSelectable).
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const drawingRef = useRef<{ pointerId: number; gesture: DrawingGesture; target: HTMLDivElement } | null>(null)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])
  useEffect(() => {
    publishDebugState({ tool, nodes, edges })
  }, [tool, nodes, edges])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !isDrawTool(tool)) return
      // A second pointer must not steal the gesture already in flight — its
      // own pointerup would fail the id guard in finishGesture and vanish
      // with no commit and no preview cleanup, leaving the first gesture's
      // preview stuck on screen.
      if (drawingRef.current) return
      // WHY: gated on panel chrome (Controls/MiniMap/attribution), but
      // deliberately NOT gated on event.target being the pane more broadly.
      // Nodes yes: a rectangle sits on top of the pane in z-order, so an
      // arrow that starts *inside* an existing shape (the binding test drags
      // from a point inside a drawn rectangle) would otherwise never reach
      // this handler — the node div would eat the pointerdown and
      // select/drag it instead. Whenever a draw tool is armed the gesture
      // owns the press over a node, full stop; nodesDraggable/
      // elementsSelectable are already false for every non-select tool (see
      // the <ReactFlow> props below), so nodes render with pointer-events:
      // none anyway and this is belt-and-braces rather than load-bearing on
      // its own. Panels no: <Controls>/<MiniMap> render *inside* <ReactFlow>,
      // on top of these same pointer handlers, so without this guard a
      // pointerdown on the zoom-in button armed a gesture and took pointer
      // capture instead of reaching the button — zoom went dead the moment
      // any draw tool was armed, and with `rect` it also dropped a stray
      // default-sized rectangle at the button's position.
      if (event.target instanceof Element && event.target.closest('.react-flow__panel')) return
      event.currentTarget.setPointerCapture(event.pointerId)
      const point = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const next: DrawingGesture = { tool, start: point, current: point }
      drawingRef.current = { pointerId: event.pointerId, gesture: next, target: event.currentTarget }
      setGesture(next)
    },
    [tool, reactFlow],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const active = drawingRef.current
      if (!active || active.pointerId !== event.pointerId) return
      const point = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const next: DrawingGesture = { ...active.gesture, current: point }
      active.gesture = next
      setGesture(next)
    },
    [reactFlow],
  )

  const finishGesture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const active = drawingRef.current
      if (!active || active.pointerId !== event.pointerId) return
      drawingRef.current = null
      const result = commitDrawingGesture(active.gesture, nodesRef.current, reactFlow.getZoom())
      if (result) {
        const newEdges = result.edges ?? []
        setNodes((current) => [...current, ...result.nodes])
        if (newEdges.length > 0) setEdges((current) => [...current, ...newEdges])
      }
      setGesture(null)
      // Excalidraw-style one-shot: back to select after every draw.
      setTool('select')
      try {
        active.target.releasePointerCapture(active.pointerId)
      } catch {
        // Already released — pointerup releases capture implicitly too.
      }
    },
    [setNodes, setEdges, reactFlow],
  )

  /** Discards an in-flight gesture without committing anything: no shape, no edge, no preview. */
  const abortGesture = useCallback(() => {
    const active = drawingRef.current
    if (!active) return
    drawingRef.current = null
    setGesture(null)
    try {
      active.target.releasePointerCapture(active.pointerId)
    } catch {
      // Already released.
    }
  }, [])

  // A real pointercancel (palm rejection, system gesture takeover) must
  // discard the gesture, not commit it — unlike finishGesture, which runs on
  // a genuine pointerup and always commits.
  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const active = drawingRef.current
      if (!active || active.pointerId !== event.pointerId) return
      abortGesture()
    },
    [abortGesture],
  )

  useToolHotkeys(setTool, abortGesture)

  // WHY (two invariants this relies on, not just the ordering below):
  // (1) an anchor can only be orphaned by an edge removal — a shape node is
  // never itself an anchor, so deleting a shape can only ever orphan the
  // anchor at the *other* end of a connector, which is exactly what the
  // cascade-deleted edge already accounts for; (2) no anchor is ever shared
  // by two edges — createAnchorNode mints a fresh one per free endpoint and
  // resolveEndpoint never returns an existing anchor's id, so `used` below
  // can only shrink, never race, between edges.
  const handleDelete = useCallback<OnDelete<WbNode, ConnectorEdgeType>>(
    ({ edges: deletedEdges }) => {
      if (deletedEdges.length === 0) return
      const deletedIds = new Set(deletedEdges.map((edge) => edge.id))
      // edgesRef still holds the pre-removal list here — NOT because
      // onDelete fires before React Flow applies the remove changes (it
      // fires last: onEdgesDelete -> triggerEdgeChanges -> onNodesDelete ->
      // triggerNodeChanges -> onDelete, confirmed by reading
      // @xyflow/react@12.11.6's deleteElements in dist/esm/index.mjs). It's
      // because this app is controlled: with no defaultEdges, triggerEdgeChanges
      // only calls onEdgesChange, which *queues* the setEdges state update
      // React Flow doesn't own here — edgesRef is synced from the committed
      // `edges` prop in a useEffect above, which hasn't re-run yet at this
      // point in the same synchronous deleteElements call. So edgesRef still
      // holds the pre-removal list, which is exactly the survivor set once
      // that update lands. A future rewrite that syncs edgesRef synchronously
      // in the render body would break this — the ordering above is not what
      // protects it.
      const survivingEdges = edgesRef.current.filter((edge) => !deletedIds.has(edge.id))
      setNodes((current) => cleanupUnusedAnchors(current, survivingEdges))
    },
    [setNodes],
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ReactFlow<WbNode, ConnectorEdgeType>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onDelete={handleDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={handlePointerCancel}
        panOnDrag={tool === 'hand' ? true : [1]}
        selectionOnDrag={tool === 'select'}
        nodesDraggable={tool === 'select'}
        elementsSelectable={tool === 'select'}
        nodesConnectable={false}
        // WHY: React Flow renders the edges layer before the nodes layer and
        // gives both z-index 0 by default, so nodes paint (and hit-test) on
        // top of edges — an arrow drawn across or wholly inside a shape is
        // otherwise invisible and unclickable, hidden behind the shape's own
        // fill. Lifting connectors to z-index 1 puts them above every shape.
        // This is safe everywhere else too: each edge's `pointer-events:
        // visibleStroke` only claims hits exactly on its stroke (plus the
        // interactionWidth pad), so a shape stays normally clickable at every
        // point that isn't on a connector crossing it.
        defaultEdgeOptions={{ zIndex: 1 }}
        // WHY: React Flow's default nodeDragThreshold (1px) computes the
        // drag offset from wherever the pointer was when it first crossed
        // that threshold, not from the mousedown point — a chunk of the
        // gesture that happened before the threshold-crossing event gets
        // silently dropped from the total delta. With a coarse-grained drag
        // (a real trackpad, or Playwright's synthetic mouse.move stepping)
        // that chunk is visible: a rectangle dragged (100, 100) lands short.
        // 0 makes drag start exactly at mousedown, so the full gesture
        // counts.
        nodeDragThreshold={0}
        deleteKeyCode={['Delete', 'Backspace']}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        style={{ cursor: cursorForTool(tool) }}
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls />
        <DrawPreview gesture={gesture} />
      </ReactFlow>
      <Toolbar tool={tool} onSelect={setTool} />
    </div>
  )
}
