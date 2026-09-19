#!/usr/bin/env python3
"""
Builds the self-contained HTML review report for simple-reactflow-whiteboard.

Everything is inlined as data: URIs so the page opens from file:// with no
server and no network. Media captures come from docs/capture_media.mjs, which
drives the REAL app — this script never invents a frame.

Usage: python3 docs/build_report.py [--media reports/media] [--out reports/media/whiteboard-<date>.html]
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import html
import json
import mimetypes
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
PREVIEW_BUDGET = 1_900_000  # desktop preview dies past ~2 MB of encoded data: URL


def data_uri(path: pathlib.Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if path.suffix == ".webm":
        mime = "video/webm"
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{payload}"


def figure(media: pathlib.Path, name: str, caption: str) -> str:
    path = media / f"{name}.png"
    if not path.exists():
        return f'<p class="missing">missing capture: {html.escape(name)}.png</p>'
    return (
        '<figure class="shot">'
        f'<img src="{data_uri(path)}" alt="{html.escape(caption)}" loading="lazy">'
        f"<figcaption>{caption}</figcaption>"
        "</figure>"
    )


CSS = """
:root{--bg:#fbfbfa;--fg:#1b1b1a;--muted:#6b6b66;--line:#e2e1dd;--card:#fff;
--accent:#2f6f4f;--warn:#9a5b1e;--code:#f4f3f0;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:56px 28px 120px}
header.top{border-bottom:1px solid var(--line);padding-bottom:28px;margin-bottom:40px}
h1{font-size:2.1rem;line-height:1.2;margin:0 0 10px;letter-spacing:-.02em}
.sub{color:var(--muted);font-size:1.02rem;margin:0}
.meta{margin-top:18px;display:flex;flex-wrap:wrap;gap:8px}
.pill{font:600 12px/1 var(--mono);letter-spacing:.04em;text-transform:uppercase;
padding:7px 11px;border-radius:999px;background:#eceae5;color:#4a4a45}
.pill.ok{background:#e3f0e7;color:#1f5c3b}
.pill.warn{background:#faeede;color:var(--warn)}
h2{font-size:1.35rem;margin:52px 0 6px;letter-spacing:-.01em}
h2:first-of-type{margin-top:34px}
h3{font-size:1.05rem;margin:32px 0 6px}
.lede{color:var(--muted);margin:0 0 20px}
p{margin:0 0 14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:22px 24px;margin:18px 0}
.hero{background:#15161a;border-radius:14px;padding:14px;margin:26px 0 8px}
.hero video,.hero img{width:100%;display:block;border-radius:8px}
.cap{color:var(--muted);font-size:.9rem;margin:10px 2px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:18px;margin:18px 0}
figure.shot{margin:0;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
figure.shot img{width:100%;display:block;border-bottom:1px solid var(--line)}
figure.shot figcaption{font-size:.86rem;color:var(--muted);padding:10px 12px}
.tablewrap{overflow-x:auto;margin:18px 0}
table{border-collapse:collapse;width:100%;font-size:.92rem;min-width:620px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:600 12px/1.3 var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
tr.stock td{background:#f5f7f5}
code{font-family:var(--mono);font-size:.88em;background:var(--code);padding:2px 5px;border-radius:4px}
pre{background:#17181c;color:#e6e6e1;border-radius:10px;padding:16px 18px;overflow-x:auto;
font-family:var(--mono);font-size:.84rem;line-height:1.6}
pre b{color:#8fd6a8;font-weight:600}
pre i{color:#e0a86a;font-style:normal}
ul,ol{margin:0 0 14px;padding-left:22px}
li{margin:5px 0}
.kbd{font:600 12px/1 var(--mono);border:1px solid #cfcec8;border-bottom-width:2px;border-radius:5px;
padding:4px 7px;background:#fff}
.decision li{margin:10px 0}
.decision b{display:block}
.missing{color:var(--warn);font-family:var(--mono);font-size:.85rem}
details.fallback{margin:6px 0 0}
details.fallback summary{cursor:pointer;color:var(--muted);font-size:.88rem;padding:4px 2px}
footer{margin-top:64px;padding-top:22px;border-top:1px solid var(--line);color:var(--muted);font-size:.86rem}
a{color:var(--accent)}
"""


def build(media: pathlib.Path, out: pathlib.Path, facts: dict) -> pathlib.Path:
    today = dt.date.today().isoformat()

    # Hero: prefer mp4, fall back to the gif, and inline whichever fits.
    hero = ""
    mp4, gif = media / "hero.mp4", media / "hero.gif"
    if mp4.exists():
        hero = (
            '<div class="hero"><video autoplay muted loop playsinline controls '
            f'src="{data_uri(mp4)}"></video></div>'
            '<p class="cap">Recorded from the running app at <code>127.0.0.1:5199</code>: '
            'draw two rectangles with <span class="kbd">R</span>, bind an arrow with '
            '<span class="kbd">A</span>, draw a free line with <span class="kbd">L</span>, '
            'then drag a rectangle and watch the bound arrow follow it.</p>'
        )
    elif gif.exists():
        hero = f'<div class="hero"><img src="{data_uri(gif)}" alt="whiteboard demo"></div>'

    # A GIF fallback for anywhere the inline <video> refuses to play, tucked
    # into a <details> so it costs nothing visually when the video works.
    fallback = media / "hero-fallback.gif"
    if mp4.exists() and fallback.exists():
        hero += (
            '<details class="fallback"><summary>Video not playing? Open the GIF fallback</summary>'
            f'<div class="hero"><img src="{data_uri(fallback)}" alt="whiteboard demo, GIF"></div>'
            "</details>"
        )

    stock_rows = "".join(
        f'<tr class="{"stock" if row.get("unchanged") else ""}">'
        f'<td>{row["element"]}</td><td>{row["today"]}</td>'
        f'<td><code>{row["part"]}</code></td><td>{row["survives"]}</td></tr>'
        for row in facts["stock_parts"]
    )

    shots = "".join(figure(media, name, caption) for name, caption in facts["shots"])

    prov_rows = "".join(
        f'<tr><td><code>{row["file"]}</code></td><td>{row["source"]}</td></tr>'
        for row in facts["provenance"]
    )

    facts_audit = facts["audit"]
    decisions = "".join(
        f'<li><b>{item["q"]}</b>{item["a"]}</li>' for item in facts["decisions"]
    )

    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>simple-reactflow-whiteboard — {today}</title>
<style>{CSS}</style></head><body><div class="wrap">

<header class="top">
<h1>simple-reactflow-whiteboard</h1>
<p class="sub">An MIT whiteboard on React Flow. Rectangles on <span class="kbd">R</span>,
lines on <span class="kbd">L</span>, arrows on <span class="kbd">A</span> — and nothing else yet.</p>
<div class="meta">
<span class="pill ok">{facts['tests_summary']}</span>
<span class="pill">{facts['loc']} lines of src</span>
<span class="pill">MIT</span>
<span class="pill">@xyflow/react 12.11.6</span>
<span class="pill">{today}</span>
</div>
</header>

{hero}

<h2>The headline</h2>
<div class="card">{facts['headline']}</div>

<h2>What already existed</h2>
<p class="lede">You asked whether there was prior work. There is — a lot of it, and it is yours.</p>
{facts['prior_art']}

<h2>The one mechanism that makes this work</h2>
{facts['mechanism']}

<h2>Stock parts — what React Flow supplies and what we wrote</h2>
<p class="lede">One row per element. The last block is the stock seam left deliberately untouched.</p>
<div class="tablewrap"><table>
<thead><tr><th>Element</th><th>Hand-rolled today</th><th>Off-the-shelf part</th><th>Behaviour that must survive</th></tr></thead>
<tbody>{stock_rows}</tbody>
</table></div>

<h2>Every state, captured from the real app</h2>
<div class="grid">{shots}</div>

<h2>Acceptance</h2>
<p class="lede">Ten assertions, written and committed <i>before</i> the implementation and off-limits
to it. Driven against the real dev server in a real browser — not a component mock.</p>
<pre>{facts['tests_output']}</pre>

<h2>What an independent audit found</h2>
<p class="lede">A different model, read-only by construction, was pointed at the finished code with
instructions to attack it — including two decisions I was already suspicious of.</p>
{facts_audit}

<h2>Algorithm provenance</h2>
<p class="lede">Every file carrying real logic cites a source that exists on disk.</p>
<div class="tablewrap"><table>
<thead><tr><th>File</th><th>Where the approach came from</th></tr></thead>
<tbody>{prov_rows}</tbody>
</table></div>

<h2>The decision surface</h2>
<ul class="decision">{decisions}</ul>

<footer>{facts['footer']}</footer>
</div></body></html>
"""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc, encoding="utf-8")
    size = out.stat().st_size
    note = "fits the desktop preview" if size < PREVIEW_BUDGET else "OVER the preview budget — browser only"
    print(f"wrote {out} ({size:,} bytes — {note})")
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--media", default="reports/media")
    parser.add_argument("--facts", default="docs/report_facts.json")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    media = (REPO / args.media).resolve()
    facts = json.loads((REPO / args.facts).read_text(encoding="utf-8"))
    out = pathlib.Path(args.out) if args.out else (
        media / f"simple-reactflow-whiteboard-{dt.date.today().isoformat()}.html"
    )
    build(media, out, facts)
    return 0


if __name__ == "__main__":
    sys.exit(main())
