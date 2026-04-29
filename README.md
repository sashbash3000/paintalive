# Drawing Alive!

A browser-based game where children draw animals (or anything!) on paper, scan them with a webcam, and watch them come alive inside a colorful scene.

## How to Play

1. **Pick a World** — Choose from Jungle, Ocean, Desert, Arctic, Outer Space, or Savanna Sunset
2. **Draw Something** — Grab paper and a dark pen/marker, draw an animal or creature
3. **Scan It** — Click the camera button, hold your drawing up to the webcam, and snap a photo
4. **Watch It Walk!** — Your drawing appears in the scene with animated legs and starts exploring

You can scan as many drawings as you like — they all share the same world!

## Features

- **AI-Powered Drawing Recognition** — GPT-4o Vision analyzes photos of drawings, then GPT Image generates clean cartoon character sprites (requires OpenAI API key)
- **Fallback Mode** — Works without an API key using basic pixel-based background removal
- 6 procedurally-drawn background scenes with unique ambient sounds
- Webcam capture with child-friendly snap-and-go workflow
- Procedural walking animation (legs, bobbing, wandering behavior)
- Multiple characters coexisting in the same scene
- Sound effects (ambient world sounds, spawn sounds, footsteps)
- Child-friendly UI with large buttons and bright colors
- Fully client-side — API key and optional proxy settings stored in the browser for this site only
- Works on desktop and mobile browsers

## Running Locally

No build step required. Serve the files with any static HTTP server:

```bash
# Python
python3 -m http.server 8000

# Node.js (npx)
npx serve .

# Or simply open index.html in a browser that supports ES modules
```

Then open `http://localhost:8000` in your browser.

## JavaScript checks (CI and local)

Formatting uses [Prettier](https://prettier.io/); syntax uses Node’s parse-only `node --check` on every file under `js/`.

```bash
npm ci
npm run build        # format check + syntax check (same as prebuild)
npm run format       # auto-format all js/**/*.js
```

GitHub Actions runs `npm run build` on every push and pull request to `main`, and deploys GitHub Pages only after that step succeeds (configure the repository’s Pages source to **GitHub Actions**).

## Setting Up AI Mode

1. Get an API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. In the game, click the gear icon (settings)
3. Paste your API key and click Save
4. Drawings are processed with AI when a key is configured

The API key is stored in your browser (localStorage for this site) and sent to the AI provider when you scan a drawing.

### GitHub Pages and CORS

When the game is served from **another website** (for example GitHub Pages), the browser enforces **CORS**. **OpenAI’s API does not include the headers needed for browser `fetch`**, so requests appear to fail with a CORS error (you may still see HTTP **401** in the network tab if the key is wrong).

**Fix:** deploy the small proxy in `workers/openai-cors-proxy.js` (for example as a **Cloudflare Worker** — see `workers/README.md`), then in Settings set **API proxy base URL** to that worker’s origin (for example `https://your-name.workers.dev`, no path). The game will call the worker, which forwards to OpenAI and returns CORS-safe responses. Optional **Proxy shared secret** matches the worker’s `PROXY_SHARED_SECRET` if you set one.

For **local** testing (`localhost`), calling OpenAI directly usually works because the failure mode differs; the proxy is mainly for static hosting.

## Deploying to GitHub Pages

Use the **GitHub Actions** workflow in `.github/workflows/pages.yml`: it verifies JavaScript, then publishes the static site. In the repository settings, set Pages **Build and deployment** source to **GitHub Actions** (not “Deploy from a branch”).

## Tech Stack

- Vanilla HTML5 / CSS3 / JavaScript (ES Modules)
- Canvas 2D API for rendering
- Web Audio API for procedural sounds
- MediaDevices API for webcam access
- OpenAI API (GPT-4o-mini Vision + gpt-image-1 / DALL-E 3 fallback)
- Dev-only npm tooling (Prettier + CI scripts); the game itself is plain static files

## Tips for Best Results

- Use **white paper** and a **dark marker or pen** for drawings
- Keep the background behind the paper plain (avoid busy patterns)
- Good lighting helps the camera capture clearly
- Drawings with a clear outline work best
