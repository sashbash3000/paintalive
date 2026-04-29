/**
 * Procedurally-drawn background scenes rendered to canvas.
 * Each painter function receives (ctx, w, h) and fills the entire canvas.
 */

const BACKGROUNDS = [
  { id: 'jungle',      name: 'Jungle',        painter: paintJungle },
  { id: 'ocean',       name: 'Ocean',          painter: paintOcean },
  { id: 'desert',      name: 'Desert',         painter: paintDesert },
  { id: 'arctic',      name: 'Arctic',         painter: paintArctic },
  { id: 'space',       name: 'Outer Space',    painter: paintSpace },
  { id: 'savanna',     name: 'Savanna Sunset', painter: paintSavanna },
];

export function getBackgrounds() {
  return BACKGROUNDS;
}

export function paintBackground(id, ctx, w, h) {
  const bg = BACKGROUNDS.find(b => b.id === id);
  if (bg) bg.painter(ctx, w, h);
}

/* =========================================================
   Individual scene painters
   ========================================================= */

function paintJungle(ctx, w, h) {
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#0b3d0b');
  grd.addColorStop(0.5, '#145a14');
  grd.addColorStop(1, '#1a7a1a');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  // ground
  ctx.fillStyle = '#3d2b1f';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  ctx.fillStyle = '#5a3a28';
  ctx.fillRect(0, h * 0.78, w, h * 0.04);

  // trees
  for (let i = 0; i < 8; i++) {
    const tx = (w / 8) * i + Math.sin(i * 3) * 30;
    drawTree(ctx, tx, h * 0.78, 30 + i * 5, h * 0.4 + i * 10);
  }

  // vines
  ctx.strokeStyle = '#2e7d32';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const vx = Math.random() * w;
    ctx.beginPath();
    ctx.moveTo(vx, 0);
    ctx.bezierCurveTo(vx - 30, h * 0.3, vx + 40, h * 0.5, vx - 10, h * 0.7);
    ctx.stroke();
  }

  // leaves scattered on ground
  ctx.fillStyle = '#4caf50';
  for (let i = 0; i < 20; i++) {
    const lx = Math.random() * w;
    const ly = h * 0.80 + Math.random() * h * 0.15;
    drawLeaf(ctx, lx, ly, 8 + Math.random() * 12);
  }

  // small flowers
  for (let i = 0; i < 12; i++) {
    const fx = Math.random() * w;
    const fy = h * 0.73 + Math.random() * h * 0.06;
    drawFlower(ctx, fx, fy, 4 + Math.random() * 4);
  }
}

function paintOcean(ctx, w, h) {
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  sky.addColorStop(0, '#87ceeb');
  sky.addColorStop(1, '#e0f7fa');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.45);

  // sun
  ctx.fillStyle = '#fff59d';
  ctx.beginPath();
  ctx.arc(w * 0.8, h * 0.12, 40, 0, Math.PI * 2);
  ctx.fill();

  // water
  const water = ctx.createLinearGradient(0, h * 0.4, 0, h);
  water.addColorStop(0, '#0277bd');
  water.addColorStop(0.5, '#01579b');
  water.addColorStop(1, '#002f6c');
  ctx.fillStyle = water;
  ctx.fillRect(0, h * 0.4, w, h * 0.6);

  // waves
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let j = 0; j < 6; j++) {
    const wy = h * 0.42 + j * (h * 0.08);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 5) {
      const y = wy + Math.sin(x * 0.02 + j * 2) * 8;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // sand bottom
  ctx.fillStyle = '#f9e4b7';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.92);
  for (let x = 0; x <= w; x += 20) {
    ctx.lineTo(x, h * 0.90 + Math.sin(x * 0.03) * 8);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  // bubbles
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 15; i++) {
    const bx = Math.random() * w;
    const by = h * 0.5 + Math.random() * h * 0.35;
    const br = 3 + Math.random() * 8;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintDesert(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#ff8f00');
  sky.addColorStop(1, '#ffe082');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.55);

  // sun
  ctx.fillStyle = '#fff176';
  ctx.beginPath();
  ctx.arc(w * 0.7, h * 0.15, 50, 0, Math.PI * 2);
  ctx.fill();

  // sand dunes
  const sand = ctx.createLinearGradient(0, h * 0.5, 0, h);
  sand.addColorStop(0, '#f4c542');
  sand.addColorStop(1, '#d4a017');
  ctx.fillStyle = sand;

  ctx.beginPath();
  ctx.moveTo(0, h * 0.6);
  ctx.bezierCurveTo(w * 0.2, h * 0.45, w * 0.4, h * 0.55, w * 0.5, h * 0.5);
  ctx.bezierCurveTo(w * 0.7, h * 0.42, w * 0.85, h * 0.55, w, h * 0.5);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  // second dune layer
  ctx.fillStyle = '#c49000';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.bezierCurveTo(w * 0.3, h * 0.65, w * 0.6, h * 0.75, w, h * 0.68);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  // cacti
  for (let i = 0; i < 4; i++) {
    drawCactus(ctx, w * 0.15 + i * w * 0.22, h * 0.68 - i * 10, 15 + i * 3, 50 + i * 10);
  }

  // small rocks
  ctx.fillStyle = '#8d6e63';
  for (let i = 0; i < 8; i++) {
    const rx = Math.random() * w;
    const ry = h * 0.75 + Math.random() * h * 0.2;
    ctx.beginPath();
    ctx.ellipse(rx, ry, 6 + Math.random() * 8, 4 + Math.random() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintArctic(ctx, w, h) {
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#4fc3f7');
  sky.addColorStop(1, '#e1f5fe');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.55);

  // snow ground
  ctx.fillStyle = '#eceff1';
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  // snow hills
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.6);
  ctx.bezierCurveTo(w * 0.2, h * 0.48, w * 0.35, h * 0.56, w * 0.5, h * 0.52);
  ctx.bezierCurveTo(w * 0.7, h * 0.46, w * 0.85, h * 0.55, w, h * 0.50);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  // ice chunks
  ctx.fillStyle = 'rgba(144,202,249,0.5)';
  for (let i = 0; i < 5; i++) {
    const ix = w * 0.1 + i * w * 0.18;
    const iy = h * 0.58 + Math.random() * h * 0.05;
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ix + 30, iy - 20);
    ctx.lineTo(ix + 60, iy);
    ctx.closePath();
    ctx.fill();
  }

  // mountains in background
  ctx.fillStyle = '#b0bec5';
  for (let i = 0; i < 3; i++) {
    const mx = w * 0.1 + i * w * 0.35;
    ctx.beginPath();
    ctx.moveTo(mx - 80, h * 0.55);
    ctx.lineTo(mx, h * 0.2 + i * 20);
    ctx.lineTo(mx + 80, h * 0.55);
    ctx.fill();
  }
  // snow caps
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) {
    const mx = w * 0.1 + i * w * 0.35;
    ctx.beginPath();
    ctx.moveTo(mx - 20, h * 0.28 + i * 20);
    ctx.lineTo(mx, h * 0.2 + i * 20);
    ctx.lineTo(mx + 20, h * 0.28 + i * 20);
    ctx.fill();
  }

  // snowflakes
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 30; i++) {
    const sx = Math.random() * w;
    const sy = Math.random() * h * 0.7;
    const sr = 2 + Math.random() * 3;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintSpace(ctx, w, h) {
  // deep space gradient
  const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  grd.addColorStop(0, '#1a0033');
  grd.addColorStop(0.5, '#0d0021');
  grd.addColorStop(1, '#000');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  // stars
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 0.5 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // nebula clouds
  for (let i = 0; i < 3; i++) {
    const nx = Math.random() * w;
    const ny = Math.random() * h;
    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 80 + Math.random() * 60);
    const hue = [280, 200, 340][i];
    ng.addColorStop(0, `hsla(${hue}, 80%, 50%, 0.15)`);
    ng.addColorStop(1, 'transparent');
    ctx.fillStyle = ng;
    ctx.fillRect(0, 0, w, h);
  }

  // planet surface (the ground characters walk on)
  ctx.fillStyle = '#4a148c';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.82);
  for (let x = 0; x <= w; x += 20) {
    ctx.lineTo(x, h * 0.82 + Math.sin(x * 0.02) * 10);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  // craters
  ctx.fillStyle = '#38006b';
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * w;
    const cy = h * 0.85 + Math.random() * h * 0.12;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10 + Math.random() * 20, 5 + Math.random() * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintSavanna(ctx, w, h) {
  // sunset sky
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, '#ff5722');
  sky.addColorStop(0.4, '#ff9800');
  sky.addColorStop(0.7, '#ffc107');
  sky.addColorStop(1, '#ffeb3b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.6);

  // sun
  ctx.fillStyle = '#fff9c4';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.35, 55, 0, Math.PI * 2);
  ctx.fill();

  // ground
  const ground = ctx.createLinearGradient(0, h * 0.55, 0, h);
  ground.addColorStop(0, '#8d6e63');
  ground.addColorStop(0.3, '#795548');
  ground.addColorStop(1, '#5d4037');
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  // grass tufts
  ctx.strokeStyle = '#9e9d24';
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const gx = Math.random() * w;
    const gy = h * 0.55 + Math.random() * h * 0.4;
    for (let j = -2; j <= 2; j++) {
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + j * 4, gy - 10 - Math.random() * 8);
      ctx.stroke();
    }
  }

  // acacia trees (silhouettes)
  for (let i = 0; i < 3; i++) {
    drawAcacia(ctx, w * 0.15 + i * w * 0.33, h * 0.55);
  }
}

/* =========================================================
   Helpers for drawing scene elements
   ========================================================= */

function drawTree(ctx, x, groundY, trunkW, trunkH) {
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);

  ctx.fillStyle = '#2e7d32';
  ctx.beginPath();
  ctx.arc(x, groundY - trunkH, trunkW * 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#388e3c';
  ctx.beginPath();
  ctx.arc(x - trunkW, groundY - trunkH + 10, trunkW * 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawLeaf(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.random() * Math.PI);
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size / 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFlower(ctx, x, y, r) {
  const colors = ['#e91e63', '#ff5722', '#ffeb3b', '#9c27b0', '#03a9f4'];
  ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffeb3b';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function drawCactus(ctx, x, y, w, h) {
  ctx.fillStyle = '#2e7d32';
  // body
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x - r, y - h);
  ctx.arc(x, y - h, r, Math.PI, 0);
  ctx.lineTo(x + r, y);
  ctx.fill();

  // arms
  ctx.beginPath();
  ctx.moveTo(x - r, y - h * 0.4);
  ctx.lineTo(x - r - 18, y - h * 0.4);
  ctx.lineTo(x - r - 18, y - h * 0.65);
  ctx.arc(x - r - 12, y - h * 0.65, 6, Math.PI, 0);
  ctx.lineTo(x - r - 6, y - h * 0.4);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + r, y - h * 0.55);
  ctx.lineTo(x + r + 15, y - h * 0.55);
  ctx.lineTo(x + r + 15, y - h * 0.78);
  ctx.arc(x + r + 10, y - h * 0.78, 5, Math.PI, 0);
  ctx.lineTo(x + r + 5, y - h * 0.55);
  ctx.fill();
}

function drawAcacia(ctx, x, groundY) {
  ctx.fillStyle = '#3e2723';
  // trunk
  ctx.fillRect(x - 6, groundY - 90, 12, 90);
  // canopy — flat wide top
  ctx.fillStyle = '#33691e';
  ctx.beginPath();
  ctx.ellipse(x, groundY - 90, 60, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#558b2f';
  ctx.beginPath();
  ctx.ellipse(x + 10, groundY - 85, 50, 18, 0.2, 0, Math.PI * 2);
  ctx.fill();
}
