import type { Tool } from './model'

const TOOLS: ReadonlyArray<{ id: Tool; label: string; key: string; glyph: string }> = [
  { id: 'select', label: 'Select', key: 'V', glyph: '↖' },
  { id: 'hand', label: 'Hand', key: 'H', glyph: '✋' },
  { id: 'rect', label: 'Rectangle', key: 'R', glyph: '▭' },
  { id: 'line', label: 'Line', key: 'L', glyph: '╱' },
  { id: 'arrow', label: 'Arrow', key: 'A', glyph: '↗' },
]

export default function Toolbar({ tool, onSelect }: { tool: Tool; onSelect: (tool: Tool) => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 4,
        padding: 6,
        background: 'var(--wb-toolbar-bg)',
        border: '1px solid var(--wb-toolbar-border)',
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        zIndex: 5,
      }}
    >
      {TOOLS.map((entry) => {
        const active = tool === entry.id
        return (
          <button
            key={entry.id}
            type="button"
            data-testid={`tool-${entry.id}`}
            aria-pressed={active}
            title={`${entry.label} (${entry.key})`}
            onClick={() => onSelect(entry.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              width: 40,
              height: 40,
              border: 'none',
              borderRadius: 6,
              background: active ? 'var(--wb-accent)' : 'transparent',
              color: active ? 'var(--wb-toolbar-active-fg)' : 'var(--wb-toolbar-fg)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            <span aria-hidden="true">{entry.glyph}</span>
            <span style={{ fontSize: 9, opacity: 0.75 }}>{entry.key}</span>
          </button>
        )
      })}
    </div>
  )
}
