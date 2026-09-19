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

/** Dev-only: the acceptance suite runs against the dev server, never the built bundle. */
export function publishDebugState(state: WbDebugState) {
  if (!import.meta.env.DEV) return
  window.__WB__ = state
}
