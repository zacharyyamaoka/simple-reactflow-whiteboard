import { useEffect } from 'react'
import type { Tool } from './model'

/**
 * PROVENANCE: hotkey table ported from
 * /home/bam/pyblocks/src/whiteboard/bindings.ts:24-58 (`DEFAULT_HOTKEYS`),
 * trimmed to the five tools this board has (that file also binds o/t/f/b
 * and every edit/arrange/view command; none of that exists here).
 */
export const HOTKEYS: Record<string, Tool> = {
  v: 'select',
  h: 'hand',
  r: 'rect',
  l: 'line',
  a: 'arrow',
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
}

/** Wires the R/L/A/V/H tool hotkeys plus Escape; a no-op while typing in a form field. */
export function useToolHotkeys(setTool: (tool: Tool) => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'Escape') {
        setTool('select')
        return
      }
      const tool = HOTKEYS[event.key.toLowerCase()]
      if (tool) setTool(tool)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setTool])
}
