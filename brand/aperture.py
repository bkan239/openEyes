#!/usr/bin/env python3
"""OpenEyes — finalize the APERTURE mark.

A camera aperture that doubles as a lens onto the truth: interlocking blades
(pinwheel) opening onto a red hexagonal core (the verified event). One mark,
many treatments — exported as standalone, theme-ready SVGs.

Run:  python3 brand/aperture.py
  -> brand/aperture.html          (variants + context board)
  -> brand/exports/*.svg          (ready-to-use assets)
"""
import math
import os

CX = CY = 60.0
ICE = "#eaf2ff"     # stroke on dark
INK = "#0e1730"     # stroke on light
RED = "#ff453a"     # accent / core


def P(r, deg, cx=CX, cy=CY):
    a = math.radians(deg)
    return (cx + r * math.cos(a), cy - r * math.sin(a))


def _poly(pts):
    return "M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in pts) + " Z"


def aperture(stroke, accent=RED, *, N=6, twist=44, hr=17.5, R=50,
             sw=4.4, style="line", center="hex", highlight=True):
    """Return inner SVG markup (explicit colors, no external CSS)."""
    s = []
    base = 90  # a blade tip points up
    B = [P(hr, base + 360 / N * k) for k in range(N)]
    A = [P(R, base + 360 / N * k + twist) for k in range(N)]
    cap = 'stroke-linecap="round" stroke-linejoin="round"'

    # outer lens ring
    s.append(f'<circle cx="60" cy="60" r="{R}" fill="none" stroke="{stroke}" stroke-width="{sw}"/>')

    if style == "line":
        for k in range(N):
            s.append(f'<line x1="{B[k][0]:.2f}" y1="{B[k][1]:.2f}" '
                     f'x2="{A[k][0]:.2f}" y2="{A[k][1]:.2f}" stroke="{stroke}" '
                     f'stroke-width="{sw * 0.82:.2f}" {cap} opacity="0.62"/>')
    else:  # solid pinwheel blades: triangles base=hex edge, apex twisted on ring
        for k in range(N):
            apex = P(R - sw / 2, base + 360 / N * (k + 0.5) + twist)
            tri = _poly([B[k], B[(k + 1) % N], apex])
            s.append(f'<path d="{tri}" fill="{stroke}" fill-opacity="0.16" '
                     f'stroke="{stroke}" stroke-width="{sw * 0.7:.2f}" {cap}/>')

    # center: red hexagonal opening or red dot
    if center == "hex":
        hexp = _poly(B)
        if accent:
            s.append(f'<path d="{hexp}" fill="{accent}" stroke="none"/>')
        else:
            s.append(f'<path d="{hexp}" fill="none" stroke="{stroke}" stroke-width="{sw}" {cap}/>')
    else:  # dot
        if accent:
            s.append(f'<circle cx="60" cy="60" r="{hr * 0.62:.2f}" fill="{accent}"/>')
        else:
            s.append(f'<circle cx="60" cy="60" r="{hr * 0.62:.2f}" fill="none" stroke="{stroke}" stroke-width="{sw}"/>')

    if highlight and accent:
        s.append(f'<circle cx="{60 - hr * 0.34:.2f}" cy="{60 - hr * 0.34:.2f}" '
                 f'r="{hr * 0.22:.2f}" fill="#fff" opacity="0.85"/>')
    return "".join(s)


def doc(inner, vb=120, size=None, bg=None, rx=None, pad=0):
    """Wrap inner markup as a standalone SVG document string."""
    w = size or vb
    bgrect = ""
    if bg:
        if rx is not None:
            bgrect = f'<rect x="0" y="0" width="{vb}" height="{vb}" rx="{rx}" fill="{bg}"/>'
        else:
            bgrect = f'<rect width="{vb}" height="{vb}" fill="{bg}"/>'
    g = inner
    if pad:
        sc = (vb - 2 * pad) / vb
        g = f'<g transform="translate({pad},{pad}) scale({sc:.4f})">{inner}</g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb} {vb}" '
            f'width="{w}" height="{w}">{bgrect}{g}</svg>')


def lockup(stroke, vb_w=430, accent=RED, **kw):
    mark = aperture(stroke, accent, **kw)
    light = "300"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w} 120" '
            f'width="{vb_w}" height="120">'
            f'<g transform="translate(2,6) scale(0.9)">{mark}</g>'
            f'<text x="128" y="76" font-family="Inter, system-ui, sans-serif" '
            f'font-size="58" letter-spacing="-2.4">'
            f'<tspan font-weight="{light}" fill="{stroke}" opacity="0.72">open</tspan>'
            f'<tspan font-weight="700" fill="{stroke}">eyes</tspan></text></svg>')


# ------------------------------------------------------------------ exports

NIGHT_BG = ('<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#15233f"/>'
            '<stop offset="1" stop-color="#070d1c"/></linearGradient></defs>'
            '<rect width="120" height="120" rx="27" fill="url(#g)"/>')


def export():
    os.makedirs("brand/exports", exist_ok=True)
    files = {}
    # core mark, theme variants
    files["mark-ondark.svg"] = doc(aperture(ICE))
    files["mark-onlight.svg"] = doc(aperture(INK))
    files["mark-mono-black.svg"] = doc(aperture("#000", accent=None, highlight=False))
    files["mark-mono-white.svg"] = doc(aperture("#fff", accent=None, highlight=False))
    files["mark-solid-ondark.svg"] = doc(aperture(ICE, style="solid"))
    # app icon (rounded night-blue tile + inset mark)
    icon_inner = NIGHT_BG + f'<g transform="translate(60,60) scale(0.74) translate(-60,-60)">{aperture(ICE, sw=4.8)}</g>'
    files["icon-app.svg"] = doc(icon_inner)
    # favicon (bold, legible at 16px)
    files["favicon.svg"] = doc(aperture(ICE, sw=6.2, hr=18, R=48, highlight=False))
    # lockups
    files["lockup-ondark.svg"] = lockup(ICE)
    files["lockup-onlight.svg"] = lockup(INK)
    for name, data in files.items():
        with open(f"brand/exports/{name}", "w") as fh:
            fh.write(data)
    return list(files)


# ------------------------------------------------------------------ board

VARIANTS = [
    ("Linie · Hexagon-Kern", "Empfohlen — Blenden-Linien öffnen auf das rote Hexagon.", dict()),
    ("Linie · Punkt-Kern", "Runder roter Kern statt Hexagon (Original).", dict(center="dot")),
    ("Gefüllt · Hexagon", "Massive Lamellen-Flügel, wertiger / besser bei Mini.", dict(style="solid")),
    ("7 Blätter", "Sieben Lamellen statt sechs — feiner, mehr 'Objektiv'.", dict(N=7)),
    ("Mehr Drall", "Stärker verdrehte Blende (twist 58°), dynamischer.", dict(twist=58)),
    ("Mono", "Einfarbig, offener Kern — Stempel / Print / Gravur.", dict(accent=None, highlight=False)),
]

CSS = """
:root{--bg:#070b16;--ink:#e8f0ff;--dim:#8aa0c8;--line:rgba(150,180,255,.12)}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;
 color:var(--ink);background:radial-gradient(1100px 640px at 50% -8%,#101a33,#070b16 60%);
 min-height:100vh;padding:52px 28px 80px;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto}
.tag{display:inline-block;font-size:12px;letter-spacing:.18em;text-transform:uppercase;
 color:#cfe0ff;background:rgba(120,160,255,.1);border:1px solid var(--line);padding:6px 12px;border-radius:999px}
h1{font-size:32px;font-weight:700;letter-spacing:-.02em;margin:16px 0 6px}
.sub{color:var(--dim);font-size:15px;margin:0 0 36px;max-width:620px;line-height:1.5}
h2.sec{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);
 margin:40px 0 16px;border-top:1px solid var(--line);padding-top:20px}
.hero{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch}
.hero .big{background:linear-gradient(180deg,#0f1a33,#0a1020);border:1px solid var(--line);
 border-radius:22px;display:grid;place-items:center;color:#eaf2ff;min-height:260px}
.hero .lock{background:#0b1120;border:1px solid var(--line);border-radius:22px;display:grid;
 place-items:center;padding:24px}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.card{background:linear-gradient(180deg,#0f1730,#0b1120);border:1px solid var(--line);
 border-radius:18px;padding:18px;display:flex;flex-direction:column}
.card .st{display:grid;place-items:center;height:150px;color:#eaf2ff;
 background:radial-gradient(320px 150px at 50% 42%,rgba(80,130,255,.12),transparent 70%);border-radius:13px}
.card h3{font-size:14px;font-weight:600;margin:12px 0 4px}
.card p{font-size:12px;color:var(--dim);line-height:1.45;margin:0}
.ctx{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.swatch{border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;
 flex-direction:column;align-items:center;justify-content:center;min-height:150px;gap:10px;padding:16px}
.swatch.lightbg{background:#f4f7fd;color:#0e1730}
.swatch.darkbg{background:#0a0f1d;color:#eaf2ff}
.swatch small{font-size:11px;color:#7d8aa6;letter-spacing:.04em}
.swatch.lightbg small{color:#8893a8}
.favrow{display:flex;align-items:flex-end;gap:22px}
.favrow .f{display:flex;flex-direction:column;align-items:center;gap:6px}
.favrow .f small{font-size:10px;color:#7d8aa6}
.note{color:#5a6b88;font-size:12.5px;margin-top:30px;text-align:center}
"""


def card_st(inner, size=132):
    return (f'<svg viewBox="0 0 120 120" width="{size}" height="{size}">{inner}</svg>')


def main():
    exported = export()

    hero_big = card_st(aperture(ICE, sw=4.6), 190)
    hero_lock = (f'<svg viewBox="0 0 430 120" width="360">'
                 f'<g transform="translate(2,6) scale(0.9)">{aperture(ICE)}</g>'
                 f'<text x="128" y="76" font-family="Inter" font-size="58" letter-spacing="-2.4">'
                 f'<tspan font-weight="300" fill="#eaf2ff" opacity=".72">open</tspan>'
                 f'<tspan font-weight="700" fill="#eaf2ff">eyes</tspan></text></svg>')

    cards = ""
    for name, desc, kw in VARIANTS:
        col = ICE
        if kw.get("accent", "x") is None:
            col = ICE
        cards += (f'<div class="card"><div class="st">{card_st(aperture(col, **kw))}</div>'
                  f'<h3>{name}</h3><p>{desc}</p></div>')

    # context swatches (recommended treatment)
    rec = dict()
    ctx = ""
    ctx += f'<div class="swatch lightbg">{card_st(aperture(INK), 96)}<small>auf Weiß</small></div>'
    ctx += f'<div class="swatch darkbg">{card_st(aperture(ICE), 96)}<small>auf Nachtblau</small></div>'
    ctx += f'<div class="swatch lightbg">{card_st(aperture("#000", accent=None, highlight=False), 96)}<small>Mono</small></div>'
    app_icon = NIGHT_BG + f'<g transform="translate(60,60) scale(0.74) translate(-60,-60)">{aperture(ICE, sw=4.8)}</g>'
    ctx += f'<div class="swatch darkbg" style="background:#0a0f1d">{card_st(app_icon, 104)}<small>App-Icon</small></div>'

    favs = ""
    for sz in (16, 24, 32, 48):
        fav = aperture(ICE, sw=6.2, hr=18, R=48, highlight=False)
        favs += f'<div class="f"><svg viewBox="0 0 120 120" width="{sz}" height="{sz}">{fav}</svg><small>{sz}px</small></div>'

    html = f'''<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenEyes — Aperture</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body><div class="wrap">
<span class="tag">OpenEyes · Aperture-Mark</span>
<h1>Die Blende — final</h1>
<p class="sub">Eine Kamera-Blende, die zugleich eine Linse auf die Wahrheit ist:
verschränkte Lamellen öffnen auf einen roten Hexagon-Kern (das verifizierte Ereignis).</p>

<div class="hero">
  <div class="big">{hero_big}</div>
  <div class="lock">{hero_lock}</div>
</div>

<h2 class="sec">Treatments — welches ist „das" Logo?</h2>
<div class="grid">{cards}</div>

<h2 class="sec">Im Einsatz</h2>
<div class="ctx">{ctx}</div>

<h2 class="sec">Favicon-Test</h2>
<div class="favrow">{favs}</div>

<p class="note">Exportiert nach brand/exports/ · {len(exported)} SVG-Assets · Akzent {RED} · Eis {ICE} · Tinte {INK}</p>
</div></body></html>'''
    with open("brand/aperture.html", "w") as fh:
        fh.write(html)
    print("wrote brand/aperture.html")
    print("exports:", ", ".join(exported))


if __name__ == "__main__":
    main()
