#!/usr/bin/env node
/**
 * Records the real running whiteboard: a hero video of the primary flow
 * (draw a rectangle, bind an arrow to it, drag it and watch the arrow follow)
 * plus stills of each state worth comparing.
 *
 * Evidence, not illustration — every frame here comes from the actual app on
 * http://127.0.0.1:5199, never from a mock or a hand-drawn animation.
 *
 * Usage: node docs/capture_media.mjs [--out DIR]
 */
import { chromium } from '@playwright/test'
import { mkdir, rm, readdir, rename } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const OUT = resolve(process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'reports/media')
const URL = process.env.WB_URL ?? 'http://127.0.0.1:5199'
const VIEWPORT = { width: 1280, height: 760 }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  await mkdir(OUT, { recursive: true })
  const videoDir = join(OUT, '.video')
  await rm(videoDir, { recursive: true, force: true })
  await mkdir(videoDir, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: videoDir, size: VIEWPORT },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.locator('.react-flow__pane').waitFor()

  const paneBox = await page.locator('.react-flow__pane').boundingBox()
  const origin = { x: paneBox.x, y: paneBox.y }
  const at = (x, y) => [origin.x + x, origin.y + y]

  // A human-paced drag: the recording has to be watchable, and a single
  // mouse jump would show none of the live preview the gesture is about.
  async function drag(from, to, steps = 26) {
    await page.mouse.move(...at(from[0], from[1]))
    await sleep(160)
    await page.mouse.down()
    for (let i = 1; i <= steps; i += 1) {
      await page.mouse.move(
        ...at(from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps),
      )
      await sleep(14)
    }
    await sleep(120)
    await page.mouse.up()
    await sleep(240)
  }

  const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) })

  await sleep(700)
  await shot('01-empty-canvas')

  // R — two rectangles
  await page.keyboard.press('r')
  await sleep(300)
  await shot('02-rect-tool-armed')
  await drag([240, 200], [460, 340])
  await page.keyboard.press('r')
  await drag([760, 420], [980, 560])
  await sleep(300)
  await shot('03-two-rectangles')

  // A — an arrow bound at both ends
  await page.keyboard.press('a')
  await sleep(250)
  await drag([400, 300], [800, 460])
  await sleep(300)
  await shot('04-arrow-bound-both-ends')

  // L — a free headless line on two anchors
  await page.keyboard.press('l')
  await sleep(250)
  await drag([250, 560], [600, 660])
  await sleep(300)
  await shot('05-free-line')

  // The payoff: drag a bound rectangle and the arrow follows.
  await drag([350, 270], [300, 180], 30)
  await sleep(400)
  await shot('06-arrow-follows-the-shape')

  // Select and delete, proving anchors do not leak.
  await page.mouse.click(...at(425, 610))
  await sleep(300)
  await page.keyboard.press('Delete')
  await sleep(400)
  await shot('07-after-delete')

  const model = await page.evaluate(() => window.__WB__)
  console.log('final model:', JSON.stringify({
    tool: model.tool,
    nodes: model.nodes.map((n) => n.type),
    edges: model.edges.map((e) => e.data?.arrowHead ? 'arrow' : 'line'),
  }))

  await sleep(600)
  await context.close()
  await browser.close()

  // Playwright names videos by a random id; give it a stable one.
  const [video] = (await readdir(videoDir)).filter((f) => f.endsWith('.webm'))
  if (!video) throw new Error('no video recorded')
  const webm = join(OUT, 'hero.webm')
  await rename(join(videoDir, video), webm)
  await rm(videoDir, { recursive: true, force: true })

  // MP4 for the <video> element, GIF as the fallback the report can always show.
  const mp4 = join(OUT, 'hero.mp4')
  spawnSync('ffmpeg', ['-y', '-i', webm, '-vf', 'scale=1000:-2', '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p', '-crf', '30', mp4], { stdio: 'inherit' })
  const gif = join(OUT, 'hero.gif')
  spawnSync('ffmpeg', ['-y', '-i', webm, '-vf',
    'fps=12,scale=760:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
    '-loop', '0', gif], { stdio: 'inherit' })

  console.log('wrote', OUT)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
