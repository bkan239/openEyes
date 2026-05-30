#!/usr/bin/env python3
"""Rasterize the OpenEyes aperture mark into every asset the project needs.

Outputs:
  angles/public/  favicon.svg/.ico/-16/-32 · apple-touch-icon · icon-192/512 · og-image
  iOSApp .../AppIcon.appiconset/  AppIcon-1024 (light/dark/tinted)
  brand/  banner.png (README)

Run from repo root:  python3 brand/render.py   (needs playwright + Pillow)
"""
import os
import sys

sys.path.insert(0, "brand")
import aperture as ap  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402
from PIL import Image  # noqa: E402

ICE, INK, RED = ap.ICE, ap.INK, ap.RED
PUB = "angles/public"
IOS = "iOSApp/openEyes/openEyes/Assets.xcassets/AppIcon.appiconset"
SVGNS = 'xmlns="http://www.w3.org/2000/svg"'


def _mark(stroke, accent, sw=4.8, highlight=True):
    return ap.aperture(stroke, accent=accent, sw=sw, highlight=highlight)


def square_tile(c0, c1, *, stroke=ICE, accent=RED, scale=0.62, highlight=True):
    mark = _mark(stroke, accent, highlight=highlight)
    g = f'<g transform="translate(60,60) scale({scale}) translate(-60,-60)">{mark}</g>'
    return (f'<svg {SVGNS} viewBox="0 0 120 120">'
            f'<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{c0}"/><stop offset="1" stop-color="{c1}"/>'
            f'</linearGradient></defs><rect width="120" height="120" fill="url(#bg)"/>{g}</svg>')


def rounded_tile(*, rx=27, scale=0.60):
    mark = _mark(ICE, RED)
    g = f'<g transform="translate(60,60) scale({scale}) translate(-60,-60)">{mark}</g>'
    return (f'<svg {SVGNS} viewBox="0 0 120 120">'
            f'<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="#15233f"/><stop offset="1" stop-color="#070d1c"/>'
            f'</linearGradient></defs>'
            f'<rect width="120" height="120" rx="{rx}" fill="url(#bg)"/>{g}</svg>')


def tinted_tile(*, scale=0.62):
    mark = ap.aperture("#ffffff", accent=None, sw=5.0, highlight=False)
    g = f'<g transform="translate(60,60) scale({scale}) translate(-60,-60)">{mark}</g>'
    return f'<svg {SVGNS} viewBox="0 0 120 120">{g}</svg>'


# ------------------------------------------------------------- raster jobs
# (filename, svg-string, pixel-size, transparent?)
NIGHT = ("#15233f", "#070d1c")
JOBS = [
    (f"{PUB}/favicon-16.png", rounded_tile(scale=0.66), 16, True),
    (f"{PUB}/favicon-32.png", rounded_tile(), 32, True),
    (f"{PUB}/_favicon-256.png", rounded_tile(), 256, True),
    (f"{PUB}/apple-touch-icon.png", square_tile(*NIGHT), 180, False),
    (f"{PUB}/icon-192.png", square_tile(*NIGHT), 192, False),
    (f"{PUB}/icon-512.png", square_tile(*NIGHT), 512, False),
    (f"{IOS}/AppIcon-1024.png", square_tile(*NIGHT), 1024, False),
    (f"{IOS}/AppIcon-1024-dark.png", square_tile("#10182b", "#05080f"), 1024, False),
    (f"{IOS}/AppIcon-1024-tinted.png", tinted_tile(), 1024, True),
]


def wordmark_html(px, tagline=True):
    mark = _mark(ICE, RED, sw=4.6)
    tag = ('<div style="margin-top:26px;font-size:25px;color:#90a4c8;'
           'letter-spacing:.01em">One witness can lie. Five cannot.</div>') if tagline else ""
    return (f'<div style="font-family:Inter,sans-serif">'
            f'<svg viewBox="0 0 120 120" width="{px}" height="{px}">{mark}</svg></div>')


def og_html():
    mark = _mark(ICE, RED, sw=4.6)
    return ('<div id="og" style="width:1200px;height:630px;'
            'background:radial-gradient(900px 520px at 50% 26%,#17274a,#070b16 72%);'
            'display:flex;flex-direction:column;align-items:center;justify-content:center;'
            'font-family:Inter,sans-serif;color:#eaf2ff">'
            f'<svg viewBox="0 0 120 120" width="150" height="150">{mark}</svg>'
            '<div style="font-size:78px;letter-spacing:-3px;margin-top:18px">'
            '<span style="font-weight:300;opacity:.72">open</span>'
            '<span style="font-weight:700">eyes</span></div>'
            '<div style="margin-top:18px;font-size:27px;color:#90a4c8">'
            'One witness can lie. Five cannot.</div></div>')


def banner_html():
    mark = _mark(ICE, RED, sw=4.6)
    return ('<div id="banner" style="width:1280px;height:340px;'
            'background:radial-gradient(820px 460px at 50% 36%,#17274a,#080e1e 74%);'
            'display:flex;flex-direction:column;align-items:center;justify-content:center;'
            'font-family:Inter,sans-serif;color:#eaf2ff">'
            '<div style="display:flex;align-items:center;gap:22px">'
            f'<svg viewBox="0 0 120 120" width="96" height="96">{mark}</svg>'
            '<div style="font-size:78px;letter-spacing:-3px">'
            '<span style="font-weight:300;opacity:.72">open</span>'
            '<span style="font-weight:700">eyes</span></div></div>'
            '<div style="margin-top:20px;font-size:24px;color:#90a4c8;letter-spacing:.04em">'
            'One witness can lie. Five cannot.</div></div>')


def main():
    os.makedirs(PUB, exist_ok=True)
    os.makedirs(IOS, exist_ok=True)

    # 1) write the scalable SVG favicon
    with open(f"{PUB}/favicon.svg", "w") as fh:
        fh.write(rounded_tile())

    with sync_playwright() as p:
        b = p.chromium.launch()

        def shot(svg, px, transparent, out):
            pg = b.new_page(viewport={"width": px, "height": px}, device_scale_factor=1)
            pg.set_content(f'<body style="margin:0;background:transparent">'
                           f'<div id="c" style="width:{px}px;height:{px}px">'
                           f'<svg viewBox="0 0 120 120" width="{px}" height="{px}">'
                           f'{svg[svg.find(">") + 1:svg.rfind("</svg>")]}</svg></div></body>')
            pg.locator("#c").screenshot(path=out, omit_background=transparent)
            pg.close()

        for out, svg, px, transparent in JOBS:
            os.makedirs(os.path.dirname(out), exist_ok=True)
            shot(svg, px, transparent, out)
            print("png", out)

        # HTML-based assets (need Inter web font)
        def html_shot(body, sel, out, w, h, dsf=2):
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=dsf)
            pg.set_content(
                '<head><link rel="preconnect" href="https://fonts.googleapis.com">'
                '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet"></head>'
                f'<body style="margin:0">{body}</body>')
            pg.wait_for_timeout(1100)
            pg.locator(sel).screenshot(path=out)
            pg.close()
            print("png", out)

        html_shot(og_html(), "#og", f"{PUB}/og-image.png", 1200, 630, dsf=2)
        html_shot(banner_html(), "#banner", "brand/banner.png", 1280, 340, dsf=2)

        b.close()

    # 2) favicon.ico (16/32/48 multi-res) from the 256 render
    src = Image.open(f"{PUB}/_favicon-256.png")
    src.save(f"{PUB}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    os.remove(f"{PUB}/_favicon-256.png")
    print("ico", f"{PUB}/favicon.ico")


if __name__ == "__main__":
    main()
