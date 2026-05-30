#!/usr/bin/env python3
"""Generate the OpenEyes logo-mockup gallery.

Ten *distinct* metaphors — different silhouettes, not ten eyes — all circling the
same idea: many independent recordings corroborate ONE verified event
("One witness can lie. Five cannot."). Geometry is parametric so shapes stay
crisp at any size.

Run:  python3 brand/gen_logos.py   ->  brand/logo-mockups.html
"""
import math

CX = CY = 60.0


def P(r, deg, cx=CX, cy=CY):
    a = math.radians(deg)
    return (cx + r * math.cos(a), cy - r * math.sin(a))  # y-down


def f2(x):
    return f"{x:.2f}"


def pupil(r=8.0, glow=True):
    out = f'<circle class="red" cx="60" cy="60" r="{r:.2f}"/>'
    if glow:
        out += (f'<circle cx="{60 - r * 0.32:.2f}" cy="{60 - r * 0.32:.2f}" '
                f'r="{r * 0.26:.2f}" fill="#fff" opacity=".85"/>')
    return out


def hexpath(cx, cy, r, rot=30):
    pts = [P(r, 60 * i + rot, cx, cy) for i in range(6)]
    return 'M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in pts) + ' Z'


# ---------------------------------------------------------------- marks

def m_aperture():
    """1 - Camera aperture / lens: the capture device itself."""
    hr, R = 17.0, 46.0
    s = ['<circle class="m" cx="60" cy="60" r="46"/>']
    inner = [P(hr, 60 * k + 20) for k in range(6)]
    s.append('<path class="m" d="M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in inner) + ' Z"/>')
    for k in range(6):
        a, b = inner[k], P(R, 60 * k + 20 + 44)
        s.append(f'<line class="dim" x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{b[0]:.2f}" y2="{b[1]:.2f}"/>')
    s.append(pupil(7))
    return ''.join(s)


def m_tally():
    """2 - Tally of five: a literal nod to 'five cannot lie'."""
    s = []
    for x in (42, 51, 60, 69):
        s.append(f'<line class="m" x1="{x}" y1="40" x2="{x}" y2="80" stroke-width="5.4"/>')
    s.append('<line class="reds" x1="36" y1="84" x2="75" y2="36" stroke-width="5.4"/>')
    return ''.join(s)


def m_triangulate():
    """3 - Three upright map-pins triangulating one event (capture + geo)."""
    s = []
    rh = 8.0
    pins = [P(32, 90 + 120 * k) for k in range(3)]
    for px, py in pins:
        s.append(f'<line class="dim" x1="{px:.2f}" y1="{py:.2f}" x2="60" y2="60"/>')
    for px, py in pins:
        lx = px - rh * math.sin(math.radians(50))
        ly = py + rh * math.cos(math.radians(50))
        rx = px + rh * math.sin(math.radians(50))
        ry = py + rh * math.cos(math.radians(50))
        tipy = py + rh + 9
        s.append(f'<path class="m" d="M{lx:.2f},{ly:.2f} A{rh},{rh} 0 1 1 {rx:.2f},{ry:.2f} '
                 f'L{px:.2f},{tipy:.2f} Z"/>')
        s.append(f'<circle class="fillc" cx="{px:.2f}" cy="{py:.2f}" r="2.7"/>')
    s.append(pupil(7))
    return ''.join(s)


def m_waveform():
    """4 - Audio-sync waveform: clips aligned on their shared soundtrack."""
    heights = [9, 16, 24, 13, 30, 39, 30, 13, 24, 16, 9]
    n = len(heights)
    x0, x1 = 22.0, 98.0
    step = (x1 - x0) / (n - 1)
    s = []
    for i, h in enumerate(heights):
        x = x0 + i * step
        cls = 'reds' if i == n // 2 else 'm'
        s.append(f'<line class="{cls}" x1="{x:.1f}" y1="{60 - h}" x2="{x:.1f}" y2="{60 + h}" stroke-width="5"/>')
    return ''.join(s)


def m_shield():
    """5 - Shield + check: trust & justice (SDG 16), verified."""
    shield = 'M60,15 L97,29 L97,57 Q97,87 60,105 Q23,87 23,57 L23,29 Z'
    s = [f'<path class="m" d="{shield}"/>']
    s.append('<path class="reds" d="M45,60 l10,12 l23,-28" stroke-width="6"/>')
    return ''.join(s)


def m_key():
    """6 - Key: Secure-Enclave hardware signature on every capture."""
    s = ['<circle class="m" cx="45" cy="45" r="15"/>',
         '<circle class="red" cx="45" cy="45" r="6"/>',
         '<line class="m" x1="54" y1="54" x2="87" y2="87" stroke-width="7"/>',
         '<line class="m" x1="73" y1="79" x2="81" y2="71" stroke-width="6"/>',
         '<line class="m" x1="82" y1="88" x2="90" y2="80" stroke-width="6"/>']
    return ''.join(s)


def m_arrows():
    """7 - Converging arrows: many angles closing in on one point."""
    s = []
    for k in range(6):
        a = 60 * k
        tip = P(24, a)
        w1 = P(40, a + 11)
        w2 = P(40, a - 11)
        s.append(f'<path class="m" d="M{w1[0]:.2f},{w1[1]:.2f} L{tip[0]:.2f},{tip[1]:.2f} L{w2[0]:.2f},{w2[1]:.2f}"/>')
    s.append(pupil(7))
    return ''.join(s)


def m_hexcluster():
    """8 - Honeycomb cluster: scattered recordings clustered into one event."""
    s = []
    R = 23.0
    for k in range(6):
        cx, cy = P(R, 60 * k + 30)
        s.append(f'<path class="dim" d="{hexpath(cx, cy, 12.6)}"/>')
    s.append(f'<path class="m" d="{hexpath(60, 60, 12.6)}"/>')
    s.append(pupil(6))
    return ''.join(s)


def m_chain():
    """9 - Witness chain: five linked nodes forming one unbroken ring."""
    R = 33.0
    C = 2 * math.pi * R
    unit = C / 5
    dash = unit * 0.64
    gap = unit - dash
    s = [f'<circle cx="60" cy="60" r="{R}" fill="none" stroke="currentColor" '
         f'stroke-width="7" stroke-linecap="round" stroke-dasharray="{dash:.2f} {gap:.2f}"/>']
    nodes = [P(R, 90 + 72 * k) for k in range(5)]
    s.append(pupil(7))
    return ''.join(s)


def m_clips():
    """10 - Clip stack: several recordings resolve into one playable event."""
    s = ['<rect class="dim" x="33" y="30" width="46" height="38" rx="8" transform="rotate(-11 56 49)"/>',
         '<rect class="dim" x="45" y="32" width="46" height="38" rx="8" transform="rotate(9 68 51)"/>',
         '<rect class="m" x="36" y="44" width="48" height="40" rx="9"/>',
         '<path class="red" d="M54,54 L54,74 L72,64 Z"/>']
    return ''.join(s)


MARKS = [
    ("Aperture-Linse", "Kamera-Blende: das Aufnahmegerät als Marke. Skaliert top.", m_aperture),
    ("Strichliste „5“", "Tally mit fünf Strichen — „fünf können nicht lügen“.", m_tally),
    ("Triangulation", "Drei Aufnahmen triangulieren ein Ereignis — Capture + Geo.", m_triangulate),
    ("Audio-Sync", "Wellenform: Clips über ihre gemeinsame Tonspur synchronisiert.", m_waveform),
    ("Schild + Haken", "Vertrauen & Justiz (SDG 16) — verifiziert.", m_shield),
    ("Schlüssel / Signatur", "Secure-Enclave-Signatur: hardware-signierte Echtheit.", m_key),
    ("Konvergenz-Pfeile", "Viele Blickwinkel laufen auf einen Punkt zu.", m_arrows),
    ("Hex-Cluster", "Verstreute Aufnahmen, geclustert zu einem Ereignis.", m_hexcluster),
    ("Zeugen-Kette", "Fünf verkettete Knoten — ein unzerbrechlicher Ring.", m_chain),
    ("Clip-Stapel", "Mehrere Clips lösen sich in ein abspielbares Ereignis auf.", m_clips),
]


def svg(inner, size):
    return (f'<svg viewBox="0 0 120 120" width="{size}" height="{size}" '
            f'role="img"><g fill="none" stroke-width="4" stroke-linecap="round" '
            f'stroke-linejoin="round">{inner}</g></svg>')


def wordmark():
    return ('<div class="wm"><span class="wm-light">open</span>'
            '<span class="wm-bold">eyes</span></div>')


def card(i, name, concept, fn):
    inner = fn()
    return f'''  <article class="card">
    <header class="card-h"><span class="num">{i:02d}</span><h2>{name}</h2></header>
    <div class="stage">{svg(inner, 140)}</div>
    {wordmark()}
    <div class="swatches">
      <div class="chip light">{svg(inner, 40)}</div>
      <div class="chip dark">{svg(inner, 40)}</div>
      <div class="chip light fav">{svg(inner, 16)}<span>16px</span></div>
    </div>
    <p class="concept">{concept}</p>
  </article>'''


CSS = '''
:root{ --bg:#070b16; --card:#0d1424; --line:rgba(150,180,255,.12);
  --ink:#e8f0ff; --dim:#8aa0c8; --ice:#eaf2ff; --red:#ff453a; }
*{box-sizing:border-box} html{-webkit-font-smoothing:antialiased}
/* logo primitives (inherit color from container via currentColor) */
.m{stroke:currentColor;fill:none}
.dim{stroke:currentColor;fill:none;opacity:.5}
.reds{stroke:var(--red);fill:none}
.red{fill:var(--red);stroke:none}
.fillc{fill:currentColor;stroke:none}
body{margin:0;font-family:Inter,system-ui,sans-serif;color:var(--ink);
  background:radial-gradient(1200px 700px at 50% -10%,#101a33 0%,var(--bg) 60%);
  min-height:100vh;padding:56px 28px 80px}
.head{max-width:1120px;margin:0 auto 40px}
.tag{display:inline-block;font-size:12px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--ice);background:rgba(120,160,255,.1);border:1px solid var(--line);
  padding:6px 12px;border-radius:999px}
h1{font-size:34px;font-weight:700;letter-spacing:-.02em;margin:18px 0 6px}
.head p{color:var(--dim);font-size:15px;margin:0;max-width:640px;line-height:1.5}
.grid{max-width:1120px;margin:0 auto;display:grid;gap:20px;
  grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.card{background:linear-gradient(180deg,#0f1730,#0b1120);border:1px solid var(--line);
  border-radius:20px;padding:20px;display:flex;flex-direction:column;
  transition:transform .15s ease,border-color .15s ease}
.card:hover{transform:translateY(-3px);border-color:rgba(150,180,255,.28)}
.card-h{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.num{font-size:11px;font-weight:600;color:var(--dim);letter-spacing:.1em;
  border:1px solid var(--line);border-radius:6px;padding:2px 6px}
.card-h h2{font-size:15px;font-weight:600;margin:0;letter-spacing:-.01em}
.stage{display:grid;place-items:center;height:168px;color:var(--ice);
  background:radial-gradient(380px 180px at 50% 40%,rgba(80,130,255,.12),transparent 70%);
  border-radius:14px;margin:6px 0 4px}
.wm{text-align:center;font-size:24px;letter-spacing:-.03em;margin:6px 0 16px}
.wm-light{color:var(--dim);font-weight:300}
.wm-bold{color:var(--ink);font-weight:700}
.swatches{display:flex;gap:10px;align-items:center;justify-content:center;margin-bottom:14px}
.chip{display:grid;place-items:center;width:58px;height:58px;border-radius:12px;
  border:1px solid var(--line)}
.chip.light{background:#f4f8ff;color:#0b1020}
.chip.dark{background:#0a0f1d;color:var(--ice)}
.chip.fav{position:relative;width:58px}
.chip.fav span{position:absolute;bottom:3px;font-size:8px;color:#5a6b88;letter-spacing:.05em}
.concept{color:var(--dim);font-size:12.5px;line-height:1.5;margin:auto 0 0;
  border-top:1px solid var(--line);padding-top:12px}
.foot{max-width:1120px;margin:44px auto 0;color:#5a6b88;font-size:12.5px;text-align:center}
'''


def main():
    cards = '\n'.join(card(i + 1, n, c, fn) for i, (n, c, fn) in enumerate(MARKS))
    html = f'''<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenEyes — Logo-Mockups</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head>
<body>
  <div class="head">
    <span class="tag">OpenEyes · Brand Exploration</span>
    <h1>10 Konzepte — komplett verschieden</h1>
    <p>Zehn eigenständige Metaphern (nicht zehnmal ein Auge), die dieselbe Idee tragen:
       viele unabhängige Aufnahmen bestätigen <em>ein</em> Ereignis.
       Groß auf Dunkel, plus Inversion auf Weiß und 16-px-Favicon-Test.</p>
  </div>
  <main class="grid">
{cards}
  </main>
  <p class="foot">Vektor (SVG), parametrisch generiert · Akzent #ff453a · Eis-Blau #eaf2ff · Nachtblau #070b16</p>
</body></html>'''
    with open('brand/logo-mockups.html', 'w') as f:
        f.write(html)
    print('wrote brand/logo-mockups.html')


if __name__ == '__main__':
    main()
