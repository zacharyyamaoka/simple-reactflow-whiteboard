import { test, expect, type Page } from '@playwright/test'

/**
 * Acceptance for the whole product promise: draw rectangles on R, lines on L,
 * arrows on A, bind an arrow to a shape, and delete without leaking anchors.
 *
 * These assertions were written BEFORE the implementation and are off-limits
 * to it — the implementation moves, the ruler does not.
 */

type Vec = { x: number; y: number }

interface WbNode {
  id: string
  type: string
  position: Vec
  width?: number
  height?: number
  data?: { kind?: string }
}

interface WbEdge {
  id: string
  type: string
  source: string
  target: string
  data?: { arrowHead?: boolean }
}

interface WbDebug {
  tool: string
  nodes: WbNode[]
  edges: WbEdge[]
}

/** The app publishes its live model here purely so this suite can read it. */
async function model(page: Page): Promise<WbDebug> {
  return page.evaluate(() => (window as unknown as { __WB__: WbDebug }).__WB__)
}

/** Pane origin in client coords. With zoom 1 at origin, flow = client - origin. */
async function paneOrigin(page: Page): Promise<Vec> {
  const box = await page.locator('.react-flow__pane').boundingBox()
  if (!box) throw new Error('no react-flow pane')
  return { x: box.x, y: box.y }
}

async function drag(page: Page, from: Vec, to: Vec) {
  const o = await paneOrigin(page)
  await page.mouse.move(o.x + from.x, o.y + from.y)
  await page.mouse.down()
  // Several intermediate moves: a single jump does not exercise the live preview.
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(
      o.x + from.x + ((to.x - from.x) * i) / 8,
      o.y + from.y + ((to.y - from.y) * i) / 8,
    )
  }
  await page.mouse.up()
  await page.waitForTimeout(60)
}

const shapes = (m: WbDebug) => m.nodes.filter((n) => n.type === 'shape')
const anchors = (m: WbDebug) => m.nodes.filter((n) => n.type === 'anchor')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.react-flow__pane').waitFor()
  await expect.poll(async () => (await model(page)).tool).toBe('select')
})

test('the canvas starts empty at zoom 1, origin 0,0', async ({ page }) => {
  const m = await model(page)
  expect(m.nodes).toHaveLength(0)
  expect(m.edges).toHaveLength(0)
  const viewport = await page.evaluate(() => {
    const el = document.querySelector('.react-flow__viewport') as HTMLElement | null
    return el?.style.transform ?? ''
  })
  // A fitView on an empty board would move the viewport and break every
  // screen-to-flow assertion below; assert it is genuinely identity.
  expect(viewport.replace(/\s+/g, '')).toContain('translate(0px,0px)scale(1)')
})

test('R draws a rectangle at the dragged size, then falls back to select', async ({ page }) => {
  await page.keyboard.press('r')
  expect((await model(page)).tool).toBe('rect')

  await drag(page, { x: 300, y: 200 }, { x: 500, y: 340 })

  const m = await model(page)
  expect(shapes(m)).toHaveLength(1)
  const rect = shapes(m)[0]
  expect(rect.data?.kind).toBe('rect')
  expect(rect.position.x).toBeCloseTo(300, -1)
  expect(rect.position.y).toBeCloseTo(200, -1)
  expect(rect.width).toBeCloseTo(200, -1)
  expect(rect.height).toBeCloseTo(140, -1)

  // The tool is not sticky: one draw, back to select, exactly like Excalidraw.
  expect(m.tool).toBe('select')

  // The model is not the picture. Measure what actually rendered.
  const box = await page.locator(`.react-flow__node[data-id="${rect.id}"]`).boundingBox()
  expect(box!.width).toBeCloseTo(200, -1)
  expect(box!.height).toBeCloseTo(140, -1)
})

test('a rectangle dragged up-and-left is normalised, not negative', async ({ page }) => {
  await page.keyboard.press('r')
  await drag(page, { x: 600, y: 400 }, { x: 440, y: 280 })

  const rect = shapes(await model(page))[0]
  expect(rect.position.x).toBeCloseTo(440, -1)
  expect(rect.position.y).toBeCloseTo(280, -1)
  expect(rect.width).toBeCloseTo(160, -1)
  expect(rect.height).toBeCloseTo(120, -1)
})

test('A draws a free arrow on two anchors; L draws a headless line', async ({ page }) => {
  await page.keyboard.press('a')
  expect((await model(page)).tool).toBe('arrow')
  await drag(page, { x: 600, y: 200 }, { x: 800, y: 300 })

  let m = await model(page)
  expect(m.edges).toHaveLength(1)
  expect(m.edges[0].data?.arrowHead).toBe(true)
  // Both ends are free, so both ends own an anchor node.
  expect(anchors(m)).toHaveLength(2)
  expect(anchors(m).map((a) => a.id).sort()).toEqual(
    [m.edges[0].source, m.edges[0].target].sort(),
  )
  await expect(page.locator(`.react-flow__edge[data-id="${m.edges[0].id}"]`)).toBeVisible()

  await page.keyboard.press('l')
  await drag(page, { x: 600, y: 500 }, { x: 800, y: 600 })

  m = await model(page)
  expect(m.edges).toHaveLength(2)
  const line = m.edges.find((e) => e.data?.arrowHead === false)
  expect(line).toBeTruthy()
  expect(anchors(m)).toHaveLength(4)
})

test('an arrow started inside a rectangle binds to it instead of making an anchor', async ({
  page,
}) => {
  await page.keyboard.press('r')
  await drag(page, { x: 300, y: 200 }, { x: 500, y: 340 })
  const rectId = shapes(await model(page))[0].id

  await page.keyboard.press('a')
  await drag(page, { x: 400, y: 270 }, { x: 850, y: 430 })

  const m = await model(page)
  expect(m.edges).toHaveLength(1)
  expect(m.edges[0].source).toBe(rectId)
  // Only the free end needed an anchor.
  expect(anchors(m)).toHaveLength(1)
  expect(m.edges[0].target).toBe(anchors(m)[0].id)
})

test('deleting an edge takes its orphaned anchors with it', async ({ page }) => {
  await page.keyboard.press('a')
  await drag(page, { x: 400, y: 300 }, { x: 800, y: 300 })

  const before = await model(page)
  expect(anchors(before)).toHaveLength(2)

  const o = await paneOrigin(page)
  // Click the arrow at its midpoint to select it.
  await page.mouse.click(o.x + 600, o.y + 300)
  await page.waitForTimeout(60)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(60)

  const after = await model(page)
  expect(after.edges).toHaveLength(0)
  expect(anchors(after)).toHaveLength(0)
  expect(after.nodes).toHaveLength(0)
})

test('a selected rectangle is deleted by Delete', async ({ page }) => {
  await page.keyboard.press('r')
  await drag(page, { x: 300, y: 200 }, { x: 500, y: 340 })

  const o = await paneOrigin(page)
  await page.mouse.click(o.x + 400, o.y + 270)
  await page.waitForTimeout(60)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(60)

  expect((await model(page)).nodes).toHaveLength(0)
})

test('Escape returns to the select tool', async ({ page }) => {
  await page.keyboard.press('r')
  expect((await model(page)).tool).toBe('rect')
  await page.keyboard.press('Escape')
  expect((await model(page)).tool).toBe('select')
})

test('with the select tool a rectangle can be dragged', async ({ page }) => {
  await page.keyboard.press('r')
  await drag(page, { x: 300, y: 200 }, { x: 500, y: 340 })
  const id = shapes(await model(page))[0].id

  await drag(page, { x: 400, y: 270 }, { x: 500, y: 370 })

  const moved = shapes(await model(page)).find((n) => n.id === id)!
  expect(moved.position.x).toBeCloseTo(400, -1)
  expect(moved.position.y).toBeCloseTo(300, -1)
})

/**
 * Second wave — two things the first nine could not see, written after
 * watching the real app and before the fix that makes them pass.
 */

/** The `d` of a connector's visible path, as {start, end} in flow coords. */
async function edgeEndpoints(page: Page, edgeId: string) {
  const d = await page
    .locator(`.react-flow__edge[data-id="${edgeId}"] path.react-flow__edge-path`)
    .getAttribute('d')
  const numbers = (d ?? '').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  if (numbers.length < 4) throw new Error(`unreadable edge path: ${d}`)
  return {
    start: { x: numbers[0], y: numbers[1] },
    end: { x: numbers[numbers.length - 2], y: numbers[numbers.length - 1] },
  }
}

test('deleting a bound shape sweeps the connector and its far anchor', async ({ page }) => {
  await page.keyboard.press('r')
  await drag(page, { x: 300, y: 200 }, { x: 500, y: 340 })
  await page.keyboard.press('a')
  await drag(page, { x: 400, y: 270 }, { x: 850, y: 430 })

  const before = await model(page)
  expect(before.edges).toHaveLength(1)
  expect(before.nodes).toHaveLength(2) // the shape + one free-end anchor

  const o = await paneOrigin(page)
  await page.mouse.click(o.x + 320, o.y + 330) // inside the rect, off the arrow
  await page.waitForTimeout(60)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(120)

  const after = await model(page)
  // React Flow cascade-deletes the connector with its source node; the anchor
  // that connector owned is then an orphan and must go too.
  expect(after.edges).toHaveLength(0)
  expect(after.nodes).toHaveLength(0)
})

test('a bound connector stops at the shape boundary, not its centre', async ({ page }) => {
  await page.keyboard.press('r')
  await drag(page, { x: 300, y: 200 }, { x: 500, y: 340 })
  await page.keyboard.press('a')
  await drag(page, { x: 400, y: 270 }, { x: 850, y: 430 })

  const m = await model(page)
  const { start } = await edgeEndpoints(page, m.edges[0].id)

  // Drawn from the rect's centre (400,270) toward (850,430), the line leaves
  // through the right edge at x=500. Anything materially left of that is the
  // arrow overdrawing the shape it points out of.
  expect(start.x).toBeGreaterThan(497)
  expect(start.x).toBeLessThan(510)
  expect(start.y).toBeGreaterThan(295)
  expect(start.y).toBeLessThan(316)
})

test('a free connector still reaches its exact drawn endpoints', async ({ page }) => {
  await page.keyboard.press('a')
  await drag(page, { x: 400, y: 300 }, { x: 800, y: 500 })

  const m = await model(page)
  const { start, end } = await edgeEndpoints(page, m.edges[0].id)
  // Clipping must apply to shapes only — a 1x1 anchor has no boundary worth
  // clipping to, and shortening here would make free lines miss the cursor.
  expect(start.x).toBeCloseTo(400, -1)
  expect(start.y).toBeCloseTo(300, -1)
  expect(end.x).toBeCloseTo(800, -1)
  expect(end.y).toBeCloseTo(500, -1)
})
