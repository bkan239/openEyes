<p align="center">
  <img src="brand/banner.png" alt="OpenEyes — One witness can lie. Five cannot." width="760" />
</p>

# OpenEyes

**One witness can lie. Five cannot.**

OpenEyes verifies whether real-world events actually happened, by corroboration instead of single-source detection. Instead of asking one video *"are you real?"*, we ask *"did anyone else see it too?"* — and turn scattered, independent recordings into one verifiable event.

Built for the Open Innovation track, aligned with **UN SDG 16 — Peace, Justice and Strong Institutions**.

---

## The problem

A single video can be faked, and increasingly nobody can tell. That breaks trust in two directions:

- **The lie wins** — a fake spreads faster than it can be debunked.
- **The truth loses** — a real video gets dismissed as a "deepfake," and nobody can prove otherwise (the *liar's dividend*).

A society only holds together while it trusts a shared reality. OpenEyes rebuilds that shared reality from the bottom up.

---

## How it works

The core idea is **corroboration**. One angle is a claim. Many independent angles that line up are proof. You can fake one clip; you cannot easily fake five devices recording the same second, in the same place, from different angles.

```
Citizen capture ─┐
 (signed media)  │
                 ├─▶  Cluster  ──▶  Corroborate  ──▶  Score  ──▶  Show
                 │    (embed /      (multi-angle      (trust     (event page,
 News (RSS) ─────┘     geo / time)   + 3D geometry)    score)     map, fly-through)
```

Two things feed the same pipeline: **eyewitness uploads** from the capture app and a **news/RSS layer** that clusters what mainstream outlets are reporting into single stories. Both are evidence; the trust score weighs them.

---

## What's built today

OpenEyes is a multi-frontend system on a shared model. Maturity differs by component — this table is the honest map of what runs versus what's still vision:

| Component | What it is | Status |
| --- | --- | --- |
| **News pipeline** (`services/api`) | RSS ingest → OpenAI embeddings → story clustering → LLM enrichment → store | ✅ **Live** (Azure) |
| **Angles showcase** (`angles`) | Map + synced multi-angle video panels + scrubbable live timeline | ✅ **Live** (Vercel) |
| **iOS capture app** (`iOSApp`) | Camera + GPS/heading/motion metadata + on-device SHA-256 hashing; reads the live news API | 🟡 **Partial** — capture & hashing real; Secure Enclave signing + clip upload are roadmap |
| **3D reconstruction** (`services/recon3d`) | VGGT/VGGT-Omega → colored point cloud + camera poses, plus a nerfstudio/Splatfacto fly-through video | 🧪 **Experimental** (GPU-only, run by hand) |
| **Shared model + trust score** (`packages/shared`) | Canonical TS types + explainable trust score, mirrored in Python/Swift | ✅ model live · 🟡 trust scoring defined but not yet wired to a live endpoint |
| **Clip provenance API** (clips/events/verify routers) | Presigned upload → register → AI verify → cluster → trust | 📋 **Roadmap** — code exists but is not mounted in the running API |

---

## Features

### 1. News clustering — everyone can be a journalist *(live)*

The working heart of the backend. Scattered reporting is automatically grouped into single verified **stories**:

- Pulls headlines from **~18 western outlets** (BBC, Reuters, CNN, NPR, Guardian, NYT, AP, DW, …) via RSS.
- Embeds each article with **OpenAI `text-embedding-3-small`** and clusters by cosine similarity, gated by a 24-hour time window and shared-entity overlap so unrelated stories don't merge.
- Enriches each cluster with **`gpt-4o-mini`** — a title, summary, location (label + lat/lng), time, and a representative image.
- Degrades gracefully: with no OpenAI key it falls back to deterministic behavior so the pipeline still runs.

Exposed as `POST /news/ingest`, `GET /news/clusters`, `GET /news/clusters/{id}`. The iOS **Discover** and **Map** tabs read this API directly.

### 2. Capture provenance — hash + (planned) signature *(partial)*

The iOS app is the capture client. At the moment of capture it records GPS, heading, motion and timestamp, and computes a hash over the media **plus** its context:

```
capture ──▶  hash = SHA-256( media_bytes + ":" + "{lat}:{lon}:{iso8601_utc}:{heading}" )
```

When the same media appears again, we re-hash and compare — a match means bit-for-bit identical to what was captured; a difference means it was altered.

**What this proves:** *integrity* (not modified since capture).

**What's honest about the current state:**
- ✅ Camera capture, spatial/time metadata, and the SHA-256 hash are **implemented** on-device (`CaptureHasher`, CryptoKit).
- 📋 **Secure Enclave signing is not implemented yet** — and a hash without a hardware signature is forgeable, so this is the most important piece still to land. The private key must never leave secure hardware.
- 📋 **Clip upload to the API is a local mock today** — the presigned-upload → register flow exists in the backend code (`routers/clips.py`) but is not mounted, and the app doesn't call it yet.
- It does not prove the *content* is real — filming an AI image still produces a valid hash (the "analog hole"). This is exactly why corroboration across independent angles matters.
- Client GPS/time can be spoofed → the server stamps its own receive-time, and GPS is treated as a signal, not proof.

### 3. Footage from different angles *(live showcase)*

The visual differentiator, built as the `angles` web app. Multiple confirmed clips of one event are presented together over a map:

- A dark map with **camera dots + view-cone arrows** that appear only while a camera's clip is active under the playhead.
- Click a camera to open a **floating, draggable, resizable 9:16 video panel**; multiple panels stay **audio/time-synced** to a shared **scrubbable live timeline**.
- The demo is a staged Minneapolis event (5 independent angles, real GPS/heading trajectories at ~5 Hz).

### 4. 3D reconstruction *(experimental)*

From multiple angles we reconstruct the scene geometry in `services/recon3d`:

- **VGGT / VGGT-Omega** (feed-forward multi-view) turns clips or photos into camera poses + dense depth — **no COLMAP**.
- Outputs a colored **point cloud (`scene.glb`)** with camera frustums, and via a **nerfstudio / Splatfacto** branch a rendered **fly-through video**.
- Moving people are masked out (YOLOv8-seg) so the geometry reflects the static scene. Geometry that lines up across uncoordinated sources is extremely hard to fake — the strongest corroboration signal and the clearest demo "wow."
- GPU-only and run manually on a pod (e.g. RunPod) — not yet a deployed service.

### 5. AI per-clip verification *(roadmap)*

A per-clip manipulation signal (`services/verify.py`, OpenAI) exists and feeds the trust score, but it is **text-based today** (no frame/audio analysis yet) and lives behind the unmounted `verify` router. Real deepfake detection on frames + audio is future work.

---

## Trust score

The output is never a naked number. It's an explainable **chain of evidence** — five weighted signals (the weights live in both `packages/shared/src/trust.ts` and `services/api/app/services/trust.py` and must sum to 1.0):

| Signal (`key`) | Weight | Example |
| --- | --- | --- |
| `independentSources` | 0.30 | 4 unrelated uploads |
| `provenance` | 0.20 | signed hash matches, untampered since capture |
| `audioSync` | 0.20 | matching soundtrack across clips |
| `timeLocation` | 0.15 | all within the same window/place |
| `manipulation` | 0.15 | no tampering detected |

The score is a **probability, not a verdict**. Corroboration drastically lowers the chance of a fake; it does not claim absolute certainty. *(The scoring code is defined and parity-checked across TS/Python, but is currently only reachable from the not-yet-mounted clips router.)*

---

## Architecture: one backend, many frontends

A shared backend serves several independent frontend clients. They all speak the same API and the same data model (JSON on the wire is **camelCase**).

```
┌──────────────┐    ┌───────────────────────────────┐    ┌──────────────┐
│ iOS capture  │    │           Backend API          │    │  Frontends   │
│ + RSS feeds  │ ─▶ │  • news ingest / clustering    │ ─▶ │  • angles    │
│              │    │  • (clips/verify/trust — wip)  │    │  • iOS app   │
└──────────────┘    │  storage: DynamoDB *or* Azure  │    │  • recon3d   │
                    │  Tables (single-table pk/sk)   │    │    viewer    │
                    └───────────────────────────────┘    └──────────────┘
```

| Path | What | Stack |
| --- | --- | --- |
| `services/api` | Verification + news API | FastAPI, Mangum, boto3 / `azure-data-tables`, OpenAI |
| `services/recon3d` | 3D reconstruction pipeline | Python, VGGT/VGGT-Omega, nerfstudio (Splatfacto), YOLO, trimesh |
| `packages/shared` | Canonical data model + trust score (source of truth) | TypeScript |
| `iOSApp` | Native capture + news/map client | SwiftUI (Xcode) |
| `angles` | Multi-angle map showcase | Vite, React 18, MapLibre GL, Zustand |
| `infra/` + `azure.yaml` | Azure App Service + Storage | Bicep, `azd` |
| `sst.config.ts` | AWS Lambda Function URL | SST v3 (Ion) |

---

## Tech stack

- **Backend / API:** Python **FastAPI**, runnable as an **Azure App Service** (Oryx, the live path), an **AWS Lambda** Function URL (Mangum via SST), or locally with uvicorn.
- **Storage:** a backend-agnostic single-table store (`pk`/`sk` + `gsi1`) that targets **Amazon DynamoDB** *or* **Azure Table Storage**, selected by `STORAGE_BACKEND`. Media via Amazon S3 (AWS path only).
- **AI:** OpenAI for news embeddings (`text-embedding-3-small`) + cluster enrichment (`gpt-4o-mini`); a text-based per-clip verification signal.
- **3D:** VGGT / VGGT-Omega → point cloud + poses; nerfstudio/Splatfacto for the fly-through; YOLOv8-seg for person masking.
- **Capture (native):** iOS / SwiftUI — camera, GPS/heading/motion, on-device SHA-256 hashing.
- **Web showcase:** `angles` — Vite 5 + React 18 + MapLibre GL 4 + Zustand 5; keyless OpenFreeMap tiles.
- **Shared model:** TypeScript types + trust-score logic in `packages/shared`, mirrored by the API (Pydantic) and clients (Swift `Codable`).
- **Infrastructure:** Azure Bicep (`infra/`, via `azd`) for the live API; SST v3 for the AWS Lambda alternative.

See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for setup and the day-to-day workflow.

### Live demos

| Demo | URL |
| --- | --- |
| **Angles** — Minneapolis multi-angle map | [open-eyes-angles.vercel.app](https://open-eyes-angles.vercel.app) |
| **API** (Azure) — health · docs · news | `https://app-api-w2xlpc7ldi7ve.azurewebsites.net` → `/health`, `/docs`, `/news/clusters` |
| **API** (Vercel) — health only | [open-eyes-three.vercel.app/health](https://open-eyes-three.vercel.app/health) |

`angles` auto-deploys to Vercel when `angles/` changes; the API auto-deploys to Azure (GitHub Actions) when `services/api/` or `infra/` change.

---

## Repository structure

```
openeyes/
├── iOSApp/             # native SwiftUI client: capture (camera + hash) · Discover · Map
├── angles/             # Vite + MapLibre web showcase (multi-angle synced map/video)
├── services/
│   ├── api/            # FastAPI: news pipeline (live) · clips/verify/trust (wip)
│   └── recon3d/        # 3D reconstruction: clips/photos → point cloud + fly-through
├── packages/
│   └── shared/         # canonical TS data model + trust-score logic
├── infra/              # Azure Bicep (App Service + Storage) — the live API deploy
├── azure.yaml          # azd service map
├── sst.config.ts       # AWS Lambda Function URL (alternative backend target)
├── api/health.ts       # Vercel /health serverless function
├── scripts/            # Azure OIDC + deploy helpers
└── DEVELOPMENT.md       # setup & day-to-day workflow
```

Only `packages/*` is a pnpm/Turborepo workspace. `services/api` (uv/Python), `services/recon3d` (its own venv), `iOSApp` (Xcode), and `angles` (own npm) are intentionally independent. There is **no `apps/web`** — the old Next.js hub was removed in favour of the native iOS client.

---

## Deploying

Three deploy targets, by component:

| Target | Deploys | How |
| --- | --- | --- |
| **Azure App Service** *(live API)* | `services/api` with Azure Table Storage | `azd provision && azd deploy`, or push to `main` → `.github/workflows/deploy-api-azure.yml` |
| **AWS Lambda** *(alt API)* | `services/api` with DynamoDB | `pnpm deploy` (SST); `pnpm deploy:prod` for production |
| **Vercel** | `angles` (full app) + `api/health.ts` (`/health` only) | auto-deploy from `main` (separate Vercel projects) |

The frontends (iOS via Xcode/TestFlight; `angles` via Vercel) deploy independently of the API. `services/recon3d` is run by hand on a GPU box, not deployed.

---

## Design system

**"Editorial Ink" — a light theme, on purpose.** A verification product sells one
thing: trust. A clean, bright, restrained interface reads as *serious* and
*credible* (think a newsroom or a bank), where a dark, neon UI reads as "tool" or
"toy." So the whole identity is built around a warm, paper-like light theme. (The
`angles` showcase and the iOS app share these tokens; the multi-angle video stage
is the deliberate dark exception.)

The rule is **discipline, not decoration**:

1. **One warm neutral base** — the "warmth" comes from the greys, not the accent.
2. **A single accent** — deep petrol/teal. One chroma, nothing competing with it.
3. **A separate status trias** — green / amber / red for verification states, kept
   visually distinct from the brand so *brand never looks like status*. (This is
   why a green brand was rejected: everything would look "verified.")
4. **Dark "Ink" sections** for hero/footer/video — contrast comes from *surfaces*,
   not from adding more colour. The dark stage also makes the `angles` video
   panels and camera pins pop far more than white would.

### Tokens

```css
:root {
  /* — Warm neutrals (the warmth lives here, not in the accent) — */
  --bg:             #FCFBF8;  /* app background, warm off-white            */
  --surface:        #FFFFFF;  /* cards / panels lift off the background     */
  --surface-sunken: #F7F5F0;  /* inset areas, code, inputs                  */
  --border:         #ECE9E1;  /* default hairline                           */
  --border-strong:  #DEDAD0;  /* emphasised divider                         */
  --text:           #1C1B19;  /* ink — near-black, slightly warm (not #000) */
  --text-muted:     #6B6862;  /* secondary text, captions                   */
  --text-subtle:    #908B80;  /* placeholders, disabled                     */

  /* — Primary: petrol / teal scale — */
  --primary-50:     #EDF7F5;  /* tint bg: hover, active nav, badges         */
  --primary-100:    #D2EAE5;
  --primary-200:    #A7D6CD;
  --primary-300:    #6FBDB0;
  --primary-500:    #16847A;
  --primary:        #0F766E;  /* buttons, links, focus                      */
  --primary-hover:  #115E59;
  --primary-press:  #134E4A;
  --on-primary:     #FFFFFF;

  /* — Status trias: each as text / tint-bg / border — */
  --verified: #15803D;  --verified-bg: #EAF6EC;  --verified-border: #C7E6CE;
  --pending:  #B45309;  --pending-bg:  #FBF1E3;  --pending-border:  #F0D9B5;
  --disputed: #B91C1C;  --disputed-bg: #FBEBEB;  --disputed-border: #F2CFCF;

  /* — Ink / inverse sections (hero, footer, video stage) — */
  --ink:            #1C1B19;  /* section background                         */
  --ink-surface:    #26241F;  /* cards on dark                              */
  --ink-border:     #3A3833;  /* hairline on dark                          */
  --on-ink:         #FCFBF8;  /* text on dark (= the warm off-white)        */
  --on-ink-muted:   #A8A296;  /* secondary text on dark                     */
  --primary-on-ink: #6FBDB0;  /* lighter teal so the accent glows on ink    */

  /* — Effects (warm-tinted, never neutral grey) — */
  --focus-ring: 0 0 0 3px rgba(15, 118, 110, .28);
  --shadow-sm:  0 1px 2px rgba(28, 27, 25, .06);
  --shadow-md:  0 4px 16px -4px rgba(28, 27, 25, .10);
}
```

### Usage notes (the details that keep it clean)

- **Status is never bare text.** A badge is `color: var(--verified)` on
  `background: var(--verified-bg)` with `border: var(--verified-border)`. The tints
  keep the chips calm and stop them clashing with the teal of buttons.
- **Text is `#1C1B19`, not `#000`.** On a warm off-white, pure black is too harsh;
  this still clears ~15:1 contrast (WCAG AAA).
- **Focus rings are teal**, not browser-blue — otherwise the palette breaks at
  every input.
- **On dark Ink, switch the accent** to `--primary-on-ink` (lighter teal). The
  base `--primary` sinks into the dark; the lighter tone glows instead.

---

## Known risks & honest answers (for Q&A)

- **Collusion:** if several people coordinate a fake, corroboration weakens — which is exactly why the trust score is a probability, not a yes/no.
- **The analog hole:** a signed hash proves the file wasn't altered, not that the *content* is real — someone can film an AI image. Corroboration across independent angles + 3D geometry is what closes this gap.
- **GPS / time spoofing:** treated as signals, with the server stamping receive-time, not as proof on their own.
- **Source safety:** linking footage to time, place and device can endanger people filming under surveillance/authoritarian conditions. Protecting contributor identity is a core design requirement, not an afterthought.
- **Liar's dividend:** corroboration defends both ways — it exposes fakes *and* proves a real video was real.

---

## Why this matters

When the internet goes dark or footage gets dismissed as "fake," whatever happens next can be denied — no proof, no witnesses. Some places live this already; the rest of the world is heading the same way.

**We don't build the truth. We build the ground it can stand on again.**
