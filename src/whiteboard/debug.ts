import type { ConnectorEdge, Tool, WbNode } from './model'

/** Test hook only — see README "Testing" section. Not a public API. */
export interface WbDebugState {
  tool: Tool
  nodes: WbNode[]
  edges: ConnectorEdge[]
}

declare global {
  interface Window {
    __WB__: WbDebugState
  }
}

export function publishDebugState(state: WbDebugState) {
  window.__WB__ = state
}
