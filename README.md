# Drawing Alive!

A browser-based game where children draw animals (or anything!) on paper, scan them with a webcam, and watch them come alive inside a colorful scene.

## How to Play

1. **Pick a World** — Choose from Jungle, Ocean, Desert, Arctic, Outer Space, or Savanna Sunset
2. **Draw Something** — Grab paper and a dark pen/marker, draw an animal or creature
3. **Scan It** — Click the camera button, hold your drawing up to the webcam, and snap a photo
4. **Watch It Walk!** — Your drawing appears in the scene with animated legs and starts exploring

You can scan as many drawings as you like — they all share the same world!

## Features

- 6 procedurally-drawn background scenes with unique ambient sounds
- Webcam capture with automatic paper-background removal
- Procedural walking animation (legs, bobbing, wandering behavior)
- Multiple characters coexisting in the same scene
- Sound effects (ambient world sounds, spawn sounds, footsteps)
- Child-friendly UI with large buttons and bright colors
- Fully client-side — no server or API keys needed
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

## Deploying to GitHub Pages

Push to a branch, then enable GitHub Pages in the repository settings pointing to that branch. The site is fully static.

## Tech Stack

- Vanilla HTML5 / CSS3 / JavaScript (ES Modules)
- Canvas 2D API for rendering
- Web Audio API for procedural sounds
- MediaDevices API for webcam access
- Zero external dependencies

## Tips for Best Results

- Use **white paper** and a **dark marker or pen** for drawings
- Keep the background behind the paper plain (avoid busy patterns)
- Good lighting helps the camera capture clearly
- Drawings with a clear outline work best
