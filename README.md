# simple-reactflow-whiteboard

A minimal Excalidraw-style freeform whiteboard built on
[React Flow](https://reactflow.dev). MIT-licensed, no tldraw — draw
rectangles and lines/arrows on an infinite canvas. No ports, no frames, no
style panel, no persistence, no collaboration; the point is to stay small
and readable.

## Tools

| Key | Tool | Behaviour |
|---|---|---|
| `V` | Select | Default. Select, box-select, drag nodes. |
| `H` | Hand | Pan on left-drag. |
| `R` | Rectangle | Drag on the canvas to draw a rectangle at that size. |
| `L` | Line | Drag to draw a connector with no arrowhead. |
| `A` | Arrow | Drag to draw a connector with an arrowhead at the target end. |
| `Escape` | — | Back to Select. |
| `Delete` / `Backspace` | — | Delete the selection. |

Hotkeys are ignored while focus is in an input, textarea or contenteditable.
After any draw the tool reverts to Select — one shape/line/arrow per drag,
matching Excalidraw.

## The anchor-node mechanism

React Flow edges require a real node id at each end. An Excalidraw-style
line floating between two bare canvas points is expressed as two invisible
1x1 `anchor` nodes at those points plus one `connector` edge between them.
Dragging a point onto an existing rectangle binds that end to the rectangle
directly instead — see the `WHY:` comment on `createAnchorNode` in
`src/whiteboard/model.ts` for the full rationale, and
`docs/ALGORITHM-PROVENANCE.md` for where this pattern came from.

## Development

```bash
pnpm install
pnpm dev      # http://127.0.0.1:5199
pnpm build    # tsc -b && vite build
pnpm lint     # oxlint
pnpm test     # Playwright, against a real dev server
```

## Testing

`window.__WB__ = { tool, nodes, edges }` is published on every render (see
`src/whiteboard/debug.ts`), **dev-only** — gated on `import.meta.env.DEV`, so
it never ships in `pnpm build`'s output. **This is a test hook for
`tests/whiteboard.spec.ts`, not a public API** — it exposes React Flow's live
node/edge arrays so the acceptance suite (which runs against the dev server)
can assert on the model directly rather than scrape the DOM. Don't build
against it from outside the test suite.

## Prior art

The anchor-node mechanism, the `r`/`l`/`a` bindings and the pointer gesture are
ported from an earlier React Flow whiteboard of mine in
[pyblocks](https://github.com/zacharyyamaoka/pyblocks) (`src/whiteboard/`,
~14.5k lines). `docs/ALGORITHM-PROVENANCE.md` cites the exact donor lines for
every file that does real work.

[openflowkit](https://github.com/Vrun-design/openflowkit) was evaluated and
**not** used as a source: 122k lines, and it has no drag-to-draw gesture and no
freeform arrows — every shape is a fixed-size palette add and every edge is
handle-to-handle.

## Licence

MIT. That is the whole point — [tldraw](https://tldraw.dev) is the better
whiteboard, but its licence forbids commercial use without a paid key, and
React Flow is plain MIT.
