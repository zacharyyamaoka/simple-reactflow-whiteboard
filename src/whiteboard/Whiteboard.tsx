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

  useToolHotkeys(setTool)

  // PROVENANCE: the drawingRef + screenToFlowPosition gesture below ports
  // /home/bam/pyblocks/src/App.tsx onToolPointerDown/onToolPointerMove
  // (~3051-3073) and the per-tool <ReactFlow> prop table
  // (~4572-4847, panOnDrag/selectionOnDrag/nodesDraggable/elementsSelectable).
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const drawingRef = useRef<{ pointerId: number; gesture: DrawingGesture } | null>(null)

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
      // WHY: deliberately NOT gated on event.target being the pane. A
      // rectangle sits on top of the pane in z-order, so an arrow that
      // starts *inside* an existing shape (the binding test drags from a
      // point inside a drawn rectangle) would otherwise never reach this
      // handler — the node div would eat the pointerdown and select/drag it
      // instead. Whenever a draw tool is armed the gesture owns the press,
      // full stop; nodesDraggable/elementsSelectable are already false for
      // every non-select tool (see the <ReactFlow> props below), so nodes
      // render with pointer-events: none anyway and this is belt-and-braces
      // rather than load-bearing on its own.
      event.currentTarget.setPointerCapture(event.pointerId)
      const point = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const next: DrawingGesture = { tool, start: point, current: point }
      drawingRef.current = { pointerId: event.pointerId, gesture: next }
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
      const result = commitDrawingGesture(active.gesture, nodesRef.current)
      if (result) {
        const newEdges = result.edges ?? []
        setNodes((current) => [...current, ...result.nodes])
        if (newEdges.length > 0) setEdges((current) => [...current, ...newEdges])
      }
      setGesture(null)
      // Excalidraw-style one-shot: back to select after every draw.
      setTool('select')
    },
    [setNodes, setEdges],
  )

  const handleDelete = useCallback<OnDelete<WbNode, ConnectorEdgeType>>(
    ({ edges: deletedEdges }) => {
      if (deletedEdges.length === 0) return
      const deletedIds = new Set(deletedEdges.map((edge) => edge.id))
      // edgesRef still holds the pre-removal list here — onDelete fires
      // before React Flow applies the matching remove changes — so this is
      // exactly the survivor set once those changes land.
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
        onPointerCancel={finishGesture}
        panOnDrag={tool === 'hand' ? true : [1]}
        selectionOnDrag={tool === 'select'}
        nodesDraggable={tool === 'select'}
        elementsSelectable={tool === 'select'}
        nodesConnectable={false}
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
