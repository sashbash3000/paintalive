# 🎨 Paint Zoo

Kids paint an animal on real paper, take a photo of it with the app, and the
painting is cut out and comes alive in a world: a jungle, a farm or the ocean.
Every new painting joins the others, so over time the world fills up with
self-painted animals walking, hopping, flying and swimming around.

## How it works

1. **Pick a world** on the start screen (Jungle, Farm, Ocean).
2. Tap **📷 Add a painting** and take a photo of the paper.
3. The app cuts out the painting automatically: it removes the paper, shadows
   and the table, and fills in the inside of outline drawings. If something is
   missing or there's too much paper, use the **Less / More** slider.
4. Give it a name, choose how it moves (walk, hop, fly, swim) and which way it
   is looking, then send it into the world. It appears with a little sparkle.
5. Tap an animal in the world and it jumps and shows its name.
   The 🧹 button lets a grown-up remove animals.

Animals are stored on the server, so you can show the world on a TV or laptop
(⛶ full screen) and add paintings from a phone at the same time. New animals
appear on the big screen within a few seconds.

## Running it

Needs Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The start screen shows the address to open on a
phone in the same Wi-Fi (e.g. `http://192.168.1.20:5173`).

For a permanent setup, build the frontend once and let the backend serve it:

```bash
npm run build
npm start
```

Then everything runs on port 3000 (`http://<computer-ip>:3000`).
Set `API_PORT` to use another port and `DATA_DIR` to store the paintings
somewhere else (default: `backend/data/`).

## Project structure

```
backend/src/app.js          Small Express server: stores the cut-out PNGs + an index file
frontend/src/game/cutout.js Turns a photo of a painting into a transparent cut-out
frontend/src/game/scenes.js The worlds (drawn in code) and where animals can be in each
frontend/src/game/world.js  Animation: walking, hopping, flying, swimming, tapping
frontend/src/views/         Start screen, world screen, add-a-painting screen
```

### Adding a new world

Add an entry to `SCENES` in `frontend/src/game/scenes.js` (background drawing,
zones for ground/sky/water, allowed movements) and add its id to `SCENES` in
`backend/src/app.js`.
