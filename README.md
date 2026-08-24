# mesh-particles

[![pages](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh-particles-d7b3ff)](https://baditaflorin.github.io/mesh-particles/)
[![version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/baditaflorin/mesh-particles/blob/main/package.json)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> Installation rehearsal: synchronized screen light, optional torch, and local multi-angle capture.

**Live → https://baditaflorin.github.io/mesh-particles/**

**Source → https://github.com/baditaflorin/mesh-particles**

**Tip the dev (buy a coffee) → https://www.paypal.com/paypalme/florinbadita**

---

![screenshot](docs/screenshot.png)

> Two peers, side-by-side, in the same room. Drop a `tests/demo/scenario.mjs`
> exporting `default async (a, b) => …` and run `npm run demo` to regenerate
> `docs/preview.png` plus `docs/demo-a.webm` / `docs/demo-b.webm` clips.

![preview](docs/preview.png)

## What it is

`mesh-particles` rehearses the visual language of a larger installation: many recycled phones held by cast hands create one sudden white-screen flash, with optional rear-camera capture and hardware torch.

The rehearsal mode is a **rootless-computing** Yjs/WebRTC room. It is deliberately intended for small field tests, not as the final 200-phone topology. At 50–200 phones the same scheduled-cue protocol needs a dedicated coordinator relay; the app keeps the capture local and does not send photos through the peer mesh.

### Capability truth

- The screen flash works everywhere once the page is armed and visible.
- Camera capture is a frame from an explicitly permitted rear-camera stream; it does **not** open the native camera app.
- Torch is checked per device and is optional. It should never be treated as a guaranteed photo flash.
- The single cue is not a repeated strobe. The app shows an explicit warning and always offers cancellation before it fires.

Read the principles → **https://baditaflorin.github.io/rootless-computing/principles.html**

## Quickstart

Open the live URL on two devices in the same room (set in ⚙ settings, or scan the room QR). Arm each device, then use **Test cue** before any camera/torch rehearsal. Enable capture only on devices that should retain a local frame.

For local hacking:

```bash
git clone https://github.com/baditaflorin/mesh-common
git clone https://github.com/baditaflorin/mesh-particles
cd mesh-particles
npm install
npm run dev
```

`mesh-common` must sit as a **sibling** directory because `package.json` references it via `file:../mesh-common`.

## Self-hosted infrastructure

| Repo                                              | Endpoint                               | Purpose                     |
| ------------------------------------------------- | -------------------------------------- | --------------------------- |
| https://github.com/baditaflorin/signaling-server  | `wss://turn.0docker.com/ws`            | y-webrtc signaling fan-out  |
| https://github.com/baditaflorin/turn-token-server | `https://turn.0docker.com/credentials` | HMAC TURN creds, 1-hour TTL |
| https://github.com/baditaflorin/coturn-hetzner    | `turn:turn.0docker.com:3479`           | TURN relay                  |

## Settings overrides

The settings drawer lets the user override signaling and TURN endpoints. localStorage keys:

- `mesh-particles:signalingUrl`
- `mesh-particles:turnTokenUrl`
- `mesh-particles:iceServers`
- `mesh-particles:room`

If endpoints are blank or unreachable, the app falls back to STUN-only.

## Version + commit on every screen

The bottom-right footer on every screen of the live app shows:

- `source` → this repo
- `tip ♥` → PayPal
- `vX.Y.Z · <short-sha>` — version from `package.json` plus the build-time git commit

## Build & deploy

GitHub Pages serves the committed `docs/` directory on the `main` branch. There is no GitHub Actions build workflow; local Husky-style hooks gate formatting / typecheck / smoke build before each push.

```bash
npm run smoke                                    # build + sanity-check docs/
bash ../mesh-common/scripts/screenshot-app.sh    # regenerate docs/screenshot.png
```

## Privacy

<!-- mesh:privacy-section:start -->

The shared room carries only a small scheduled cue and ephemeral capability flags. A captured camera frame stays on the device unless its operator manually downloads or exports it. Camera and torch permissions are requested only after an explicit arming action. The room URL is access control—share it deliberately.

See `docs/privacy.md` for the full threat model — capabilities used, what other peers in the mesh see, what the self-hosted infra sees, what stays local.
<!-- mesh:privacy-section:end -->

## License

MIT — see `LICENSE`.
