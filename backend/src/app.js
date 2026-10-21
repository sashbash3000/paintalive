// Paint Zoo backend: stores the cut-out paintings so every device
// (the phone that takes the photo, the TV that shows the world) sees the same animals.
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.API_PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const IMAGE_DIR = path.join(DATA_DIR, 'animals');
const INDEX_FILE = path.join(DATA_DIR, 'animals.json');
const DIST_DIR = path.join(__dirname, '..', '..', 'frontend', 'dist');

// Keep in sync with frontend/src/game/scenes.js
const SCENES = ['jungle', 'meadow', 'ocean'];
const MOTIONS = ['walk', 'hop', 'fly', 'swim'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const PNG_PREFIX = 'data:image/png;base64,';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ID_PATTERN = /^[0-9a-f-]{36}$/;

fs.mkdirSync(IMAGE_DIR, { recursive: true });

let animals = [];
try {
  animals = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not read animal index, starting empty:', error.message);
}

function saveIndex() {
  const tmp = INDEX_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(animals, null, 2));
  fs.renameSync(tmp, INDEX_FILE);
}

function toPublic(animal) {
  return { ...animal, url: `/animal-images/${animal.id}.png` };
}

const app = express();
app.use(express.json({ limit: '8mb' }));

app.get('/api/animals', (req, res) => {
  const { scene } = req.query;
  const list = scene ? animals.filter((a) => a.scene === scene) : animals;
  res.json({ animals: list.map(toPublic) });
});

app.post('/api/animals', (req, res) => {
  const { scene, motion, facing, image } = req.body || {};
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 30) : '';

  if (!SCENES.includes(scene)) return res.status(400).json({ error: 'Unknown scene' });
  if (!MOTIONS.includes(motion)) return res.status(400).json({ error: 'Unknown motion' });
  if (typeof image !== 'string' || !image.startsWith(PNG_PREFIX)) {
    return res.status(400).json({ error: 'Image must be a PNG data URL' });
  }
  const buffer = Buffer.from(image.slice(PNG_PREFIX.length), 'base64');
  if (buffer.length > MAX_IMAGE_BYTES || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return res.status(400).json({ error: 'Invalid or too large PNG' });
  }

  const animal = {
    id: crypto.randomUUID(),
    name,
    scene,
    motion,
    facing: facing === 'left' ? 'left' : 'right',
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(IMAGE_DIR, `${animal.id}.png`), buffer);
  animals.push(animal);
  saveIndex();
  res.status(201).json(toPublic(animal));
});

app.delete('/api/animals/:id', (req, res) => {
  const { id } = req.params;
  const index = ID_PATTERN.test(id) ? animals.findIndex((a) => a.id === id) : -1;
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  animals.splice(index, 1);
  saveIndex();
  fs.rm(path.join(IMAGE_DIR, `${id}.png`), { force: true }, () => {});
  res.json({ ok: true });
});

// LAN addresses, so the big screen can tell you which address to open on the phone.
app.get('/api/info', (req, res) => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  res.json({ addresses });
});

app.use('/animal-images', express.static(IMAGE_DIR, { maxAge: '30d', immutable: true }));

// In production the backend also serves the built frontend.
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Paint Zoo backend on http://localhost:${PORT} (${animals.length} animals)`);
});
