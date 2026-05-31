#!/usr/bin/env python3
"""Generate the OpenEyes "Aperture-Auge" mark.

A camera aperture whose blades read as an iris/eye, with a red pupil at the
center. Geometry is computed so the six blades are an exact pinwheel:
each blade = a hexagon edge extended past its vertex to the rim (all one way).

Outputs:
  - openeyes-mark.svg   transparent, light line-art (for on-dark use)
  - openeyes-icon.svg   navy rounded app-tile + mark (favicon / app-icon source)
"""
import math

# ---- palette (matches the design comp) -----------------------------------
NAVY_BG      = "#0C1222"   # deep navy tile
NAVY_BG2     = "#0A0F1C"   # radial-gradient outer
TILE_STROKE  = "rgba(255,255,255,0.07)"
APERTURE     = "#E9EEF7"   # cool off-white blades / ring
PUPIL        = "#F2353A"   # red pupil
PUPIL_GLOW   = "#FF5A5E"

# ---- geometry --------------------------------------------------------------
C   = 120.0            # canvas (square)
cx = cy = C / 2.0
R   = 47.0             # outer ring radius
HEXR = 21.0            # iris hexagon circumradius
N   = 6                # blade count
ROT = math.radians(-90)  # a hexagon vertex points straight up

def pt(r, a):
    return (cx + r * math.cos(a), cy + r * math.sin(a))

def fmt(p):
    return f"{p[0]:.3f},{p[1]:.3f}"

def extend_to_rim(p0, p1):
    """From p0 through p1, continue along the line until it meets circle R."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    ex, ey = p0[0] - cx, p0[1] - cy
    a = dx * dx + dy * dy
    b = 2 * (ex * dx + ey * dy)
    c = ex * ex + ey * ey - R * R
    t = (-b + math.sqrt(b * b - 4 * a * c)) / (2 * a)  # forward root
    return (p0[0] + t * dx, p0[1] + t * dy)

verts = [pt(HEXR, ROT + i * (2 * math.pi / N)) for i in range(N)]

# Each blade: hexagon edge V_i -> V_{i+1}, extended past V_{i+1} to the rim.
blades = []
for i in range(N):
    a = verts[i]
    b = verts[(i + 1) % N]
    rim = extend_to_rim(a, b)
    blades.append((a, rim))   # covers the edge + its extension (one blade)

hexpath = "M" + " L".join(fmt(v) for v in verts) + " Z"

# red pupil = small rotated square (diamond)
pr = 7.6
diamond_path = "M" + " L".join(
    fmt(pt(pr, math.radians(d))) for d in (-90, 0, 90, 180)
) + " Z"

blade_lines = "\n".join(
    f'    <line x1="{a[0]:.3f}" y1="{a[1]:.3f}" x2="{b[0]:.3f}" y2="{b[1]:.3f}" />'
    for a, b in blades
)

def svg(tile: bool, rx: float = 28) -> str:
    bg = ""
    if tile:
        bg = (
            f'  <rect x="0" y="0" width="{C:.0f}" height="{C:.0f}" rx="{rx:g}" fill="url(#bg)"/>\n'
        )
        if rx:
            bg += (
                f'  <rect x="1.5" y="1.5" width="{C-3:.0f}" height="{C-3:.0f}" rx="{rx-1.5:g}" '
                f'fill="none" stroke="{TILE_STROKE}"/>\n'
            )
    defs = (
        '  <defs>\n'
        f'    <radialGradient id="bg" cx="50%" cy="38%" r="78%">\n'
        f'      <stop offset="0%" stop-color="{NAVY_BG}"/>\n'
        f'      <stop offset="100%" stop-color="{NAVY_BG2}"/>\n'
        f'    </radialGradient>\n'
        f'    <radialGradient id="pup" cx="50%" cy="42%" r="65%">\n'
        f'      <stop offset="0%" stop-color="{PUPIL_GLOW}"/>\n'
        f'      <stop offset="100%" stop-color="{PUPIL}"/>\n'
        f'    </radialGradient>\n'
        '  </defs>\n'
    ) if tile else ''
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {C:.0f} {C:.0f}" '
        f'fill="none" role="img" aria-label="OpenEyes">\n'
        f'  <title>OpenEyes</title>\n'
        f'{defs}{bg}'
        f'  <circle cx="{cx:.0f}" cy="{cy:.0f}" r="{R:.0f}" stroke="{APERTURE}" stroke-width="3.2"/>\n'
        f'  <g stroke="{APERTURE}" stroke-width="3.0" stroke-linecap="round">\n'
        f'{blade_lines}\n'
        f'  </g>\n'
        f'  <path d="{hexpath}" stroke="{APERTURE}" stroke-width="2.4" stroke-linejoin="round"/>\n'
        f'  <path d="{diamond_path}" fill="{"url(#pup)" if tile else PUPIL}" stroke="none"/>\n'
        f'</svg>\n'
    )

with open("brand/openeyes-mark.svg", "w") as f:
    f.write(svg(tile=False))
with open("brand/openeyes-icon.svg", "w") as f:
    f.write(svg(tile=True))
# iOS marketing icon: full-bleed square (no rounded corners — iOS masks them),
# opaque navy. Rasterize this one to a 1024 PNG with the alpha channel stripped.
with open("brand/openeyes-icon-ios.svg", "w") as f:
    f.write(svg(tile=True, rx=0))

# ---- wordmark lockups ------------------------------------------------------
WORD_OPEN = "#E9EEF7"   # "open" — cool off-white
WORD_EYES = "#33CFC8"   # "eyes" — cyan/teal
FONT = ('"Hanken Grotesk","Hanken Grotesk",-apple-system,'
        '"Segoe UI",Helvetica,Arial,sans-serif')

def inner_mark(scale, tx, ty):
    """The mark geometry as a <g> transformed into place (no tile)."""
    return (
        f'  <g transform="translate({tx},{ty}) scale({scale})">\n'
        f'    <circle cx="{cx:.0f}" cy="{cy:.0f}" r="{R:.0f}" stroke="{APERTURE}" stroke-width="3.2" fill="none"/>\n'
        f'    <g stroke="{APERTURE}" stroke-width="3.0" stroke-linecap="round" fill="none">\n'
        f'{blade_lines}\n'
        f'    </g>\n'
        f'    <path d="{hexpath}" stroke="{APERTURE}" stroke-width="2.4" stroke-linejoin="round" fill="none"/>\n'
        f'    <path d="{diamond_path}" fill="{PUPIL}"/>\n'
        f'  </g>\n'
    )

# Horizontal: mark left, wordmark right
s = 0.80
mh = C * s
horiz = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 120" fill="none" '
    f'role="img" aria-label="OpenEyes">\n'
    f'  <title>OpenEyes</title>\n'
    f'{inner_mark(s, 6, (120-mh)/2)}'
    f'  <text x="118" y="78" font-family={chr(34)}placeholder{chr(34)} '
    f'font-size="62" font-weight="800" letter-spacing="-2">'
    f'<tspan fill="{WORD_OPEN}">open</tspan><tspan fill="{WORD_EYES}">eyes</tspan></text>\n'
    f'</svg>\n'
).replace('font-family="placeholder"', f"font-family='{FONT}'")

# Stacked: mark above wordmark (like the comp card)
stacked = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 220" fill="none" '
    f'role="img" aria-label="OpenEyes">\n'
    f'  <title>OpenEyes</title>\n'
    f'{inner_mark(1.0, 70, 4)}'
    f"  <text x=\"130\" y=\"190\" text-anchor=\"middle\" font-family='{FONT}' "
    f'font-size="46" font-weight="800" letter-spacing="-1.5">'
    f'<tspan fill="{WORD_OPEN}">open</tspan><tspan fill="{WORD_EYES}">eyes</tspan></text>\n'
    f'</svg>\n'
)

with open("brand/openeyes-logo.svg", "w") as f:
    f.write(horiz)
with open("brand/openeyes-logo-stacked.svg", "w") as f:
    f.write(stacked)

# ---- README banner: self-contained navy panel (theme-independent, -> PNG) --
BW, BH = 1200.0, 380.0
mscale = 1.45                      # mark height ~174
mh2 = C * mscale
group_w = mh2 + 36 + 540           # mark + gap + approx wordmark width
gx = (BW - group_w) / 2
my = (BH - mh2) / 2
wx = gx + mh2 + 36
banner = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BW:.0f} {BH:.0f}" '
    f'fill="none" role="img" aria-label="OpenEyes">\n'
    f'  <title>OpenEyes</title>\n'
    f'  <defs>\n'
    f'    <radialGradient id="bbg" cx="50%" cy="34%" r="85%">\n'
    f'      <stop offset="0%" stop-color="{NAVY_BG}"/>\n'
    f'      <stop offset="100%" stop-color="{NAVY_BG2}"/>\n'
    f'    </radialGradient>\n'
    f'  </defs>\n'
    f'  <rect x="0" y="0" width="{BW:.0f}" height="{BH:.0f}" rx="44" fill="url(#bbg)"/>\n'
    f'  <rect x="2" y="2" width="{BW-4:.0f}" height="{BH-4:.0f}" rx="42" fill="none" stroke="{TILE_STROKE}"/>\n'
    f'{inner_mark(mscale, gx, my)}'
    f"  <text x=\"{wx:.0f}\" y=\"{BH/2 + 46:.0f}\" font-family='{FONT}' "
    f'font-size="128" font-weight="800" letter-spacing="-3">'
    f'<tspan fill="{WORD_OPEN}">open</tspan><tspan fill="{WORD_EYES}">eyes</tspan></text>\n'
    f'</svg>\n'
)
with open("brand/openeyes-banner.svg", "w") as f:
    f.write(banner)

print("wrote brand/openeyes-mark.svg, openeyes-icon.svg, openeyes-logo.svg, openeyes-logo-stacked.svg")
