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
Capture  ──▶  Match  ──▶  Score  ──▶  Show
 signed       audio       trust       public event
 metadata     sync        score       + every angle
```

---

## Features

### 1. AI verification — is it real or AI?
Every uploaded clip is checked on its own before anything else:
- Deepfake / manipulation detection on frames and audio
- Capture provenance & integrity check (see below)
- Produces a per-clip signal that feeds the overall trust score

> This is the first line of defense, but a single clip is still only a *claim*. The real strength comes from corroboration in the next steps.

#### Capture provenance (hash + signature)

At the moment of capture, the app computes a hash over the media **plus** its context, signs it on-device, and registers it:

```
capture ──▶  hash = SHA-256( image_bytes + GPS + timestamp + device_id )
        ──▶  signature = sign(hash)        # Secure Enclave / Android Keystore
        ──▶  push { hash, signature, gps, time, device } to DB
```

When the same media appears again, we re-hash it and compare:

- **Hash matches** → bit-for-bit identical to what was registered → untampered, captured through OpenEyes
- **Hash differs** → the media was altered after capture
- We can also surface the registered **GPS + time** as context

**What this proves:** *integrity* (not modified since capture) and *provenance* (came through our app).

**What it does NOT prove — and we say this openly:**
- It does not prove the *content* is real. Filming an AI image or a screen still produces a valid hash (the "analog hole"). This is exactly why corroboration across multiple independent angles matters — a single signed upload is not enough.
- Client GPS can be spoofed on rooted devices, and a client clock can be faked → the **server stamps its own receive-time**, and GPS is treated as a signal, not proof.
- A hash alone is worthless without the **on-device signature** — otherwise anyone could forge a matching DB entry. The private key never leaves the secure hardware.

### 2. News clustering — everyone can be a journalist
Scattered uploads are automatically grouped into a single verified **story**:
- Time + geo clustering groups candidate clips
- **Audio fingerprinting** confirms clips share the same moment (same soundtrack = same event)
- The crowd reports, the evidence confirms — no newsroom required
- Output is an event page, not an article: it proves itself

### 3. Footage from different angles
The differentiator. Multiple confirmed clips of one event are presented together:
- Side-by-side, audio-synced multi-angle player
- Each angle cross-checks the others for consistency
- Trust score reflects how many independent sources corroborate, not just a yes/no

### 4. 3D reconstruction
From multiple angles we reconstruct the scene geometry:
- Buildings and spaces rebuilt from independent viewpoints
- Geometry that lines up across uncoordinated sources is extremely hard to fake
- Strongest corroboration signal, and the clearest "wow" for the demo

---

## Trust score

The output is never a naked number. It's an explainable **chain of evidence**:

| Signal | Example |
| --- | --- |
| Capture provenance | signed hash matches, untampered since capture |
| Independent sources | 4 unrelated uploads |
| Time & location consistency | all within the same window/place |
| Audio sync | matching soundtrack across clips |
| Manipulation scan | no tampering detected |
| Geometry (3D) | angles reconstruct a consistent scene |

The score is a **probability, not a verdict**. Corroboration drastically lowers the chance of a fake; it does not claim absolute certainty.

---

## Architecture (high level)

```
┌─────────────┐     ┌──────────────────────────────┐     ┌──────────────┐
│  Mobile /   │     │           Backend             │     │   Verified   │
│  Web upload │ ──▶ │                               │ ──▶ │     Hub      │
│  (signed    │     │  • AI verify (deepfake/meta)  │     │  (event      │
│   capture)  │     │  • Audio-sync clustering      │     │   pages,     │
└─────────────┘     │  • Multi-angle matching       │     │   badge/API) │
                    │  • 3D reconstruction          │     └──────────────┘
                    │  • Trust scoring              │
                    └──────────────────────────────┘
```

---

## Tech stack

A shared AWS backend with several independent frontend clients:

- **Capture (native):** iOS / SwiftUI app — on-device hashing + Secure Enclave signing.
- **Web showcase:** `angles` — Vite + React + MapLibre GL (the multi-angle map view).
- **Backend / API:** Python (FastAPI) on AWS Lambda (via Mangum), behind a Function URL.
- **Shared model:** TypeScript types + trust-score logic in `packages/shared`, mirrored by the API and clients.
- **AI verification:** OpenAI for the per-clip manipulation signal + metadata checks.
- **Audio sync:** time/geo clustering now; audio fingerprinting (chromaprint-style) next.
- **Storage:** Amazon S3 for media, Amazon DynamoDB for events/clips/sources.
- **Infrastructure:** SST v3 (Ion) — one TypeScript definition provisions the backend on AWS.

See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for setup and the day-to-day workflow.

### Live demos (Vercel)

| Demo | URL |
| --- | --- |
| **Angles** — Minneapolis multi-angle map | [open-eyes-angles.vercel.app](https://open-eyes-angles.vercel.app) |
| **API** — health + OpenAPI docs | [open-eyes-three.vercel.app](https://open-eyes-three.vercel.app) |

Both auto-deploy from `main` via separate Vercel projects (`angles/` vs repo root).

---

## Repository structure

```
openeyes/
├── iOSApp/             # native SwiftUI capture client (hardware-signed)
├── angles/             # Vite + MapLibre web showcase (multi-angle map)
├── services/
│   └── api/            # FastAPI on Lambda: verify · cluster · trust · storage
├── packages/
│   └── shared/         # canonical TS data model + trust-score logic
├── sst.config.ts       # AWS backend infra (SST v3): S3, DynamoDB, API Lambda
└── DEVELOPMENT.md      # setup & day-to-day workflow
```

Multiple frontends share one backend + data model. The heavier pipeline pieces
from the original plan (3D reconstruction, richer multi-angle matching) grow out
of `services/` and `angles` as they're built.

---

## Hackathon plan

The goal of the hackathon build is a **convincing demo**, not a production system. Priorities:

### Must build (the demo)
- [ ] Upload flow that accepts multiple clips with metadata
- [ ] Audio-sync clustering: group clips of the same event
- [ ] Multi-angle player: same event, several angles side by side
- [ ] Trust score with an explainable breakdown
- [ ] Hub UI: one verified event page

### Strong to have (differentiators)
- [ ] AI deepfake/tamper signal feeding the score
- [ ] Basic 3D reconstruction from the demo clips (even rough)

### Demo strategy
- Pre-record 3–4 clips of the same staged event from different angles
- The pipeline shows what happens when they're uploaded
- Audio sync is the visual star: "these clips were matched automatically because the soundtracks line up"
- Show the 3D reconstruction as the closer if it's working; otherwise present it as roadmap

### Out of scope (for now)
- Live streaming
- Full editorial / moderation system
- Rewards or tokens for uploads (creates an incentive to fake — deliberately avoided)

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
