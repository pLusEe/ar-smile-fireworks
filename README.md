# AR Smile Fireworks

A browser-based AR LIVE prototype built with the same source used by the Desagent demo:

- Smile to reveal a wet-glass fog effect with moving water channels.
- Keep smiling and open your mouth to trigger fireworks.
- Falling firework particles collide with the tracked head region.
- Camera frames are processed locally in the browser and are never uploaded.
- The LIVE interface uses the vendored TUX Web and TUX Icons packages.

## Run locally

Requirements:

- Node.js 20+
- A modern browser with camera access

```bash
npm ci
npm run dev
```

Open the local HTTPS or localhost URL shown by Vite and allow camera access.

The TUX packages used by this project are checked into `vendor/` as npm tarballs.
Installation does not require access to ByteDance's internal npm registry.

## Production build

```bash
npm run build
npm run preview
```

Public deployments must use HTTPS for camera access.

## Routes

- `/ar-debug` — AR camera experience with expression metrics and effect controls
- `/` — host LIVE room scaffold

Vercel redirects `/` to `/ar-debug` for the hosted demo.

## How it works

- **Face tracking:** MediaPipe Face Landmarker
- **Interface:** TUX Web, TUX Icons, React, and React Router
- **Expression classifier:** custom geometry classifier using mouth landmarks
- **Personal calibration:** approximately 0.8 seconds of frontal neutral-expression samples
- **Smile:** mouth-corner lift relative to the personal baseline
- **Laugh:** smile plus mouth opening relative to the personal baseline
- **Side-face protection:** expression effects pause when face yaw exceeds the supported range
- **Effects:** Canvas 2D with fixed particle pools and `requestAnimationFrame`
- **Collision:** rotated ellipse approximating the full head, including the top of the head
- **Adaptive quality:** sustained effect FPS below 30 reduces inference frequency, particles, water channels, and fog update frequency

## Performance panel

Open the settings button to enable:

- Effect FPS
- Inference FPS
- Inference latency
- Active particle count
- Current quality mode

## Privacy

The app requests front-camera access. Frames are analyzed locally with MediaPipe. This project does not include analytics, a backend, recording, or camera-frame uploads.

The MediaPipe WASM runtime and face-landmarker model are loaded from pinned public URLs.

## Browser notes

- Chrome and Edge provide the most predictable experience.
- Safari requires HTTPS outside `localhost`.
- Camera permission errors can be retried from the in-app error panel.
