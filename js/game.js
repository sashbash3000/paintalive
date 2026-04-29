/**
 * Game scene: renders the chosen background, manages characters,
 * runs the game loop with requestAnimationFrame.
 */

import { paintBackground } from './backgrounds.js';
import Character from './character.js';

let canvas, ctx;
let bgId = null;
let bgCache = null; // pre-rendered background as ImageBitmap or canvas
let characters = [];
let running = false;
let lastTime = 0;

export function initGame(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (bgId) {
    renderBgToCache();
  }
  characters.forEach(c => c.resize(canvas.width, canvas.height));
}

function renderBgToCache() {
  bgCache = document.createElement('canvas');
  bgCache.width = canvas.width;
  bgCache.height = canvas.height;
  const bgCtx = bgCache.getContext('2d');
  paintBackground(bgId, bgCtx, canvas.width, canvas.height);
}

export function setBackground(id) {
  bgId = id;
  renderBgToCache();
}

export function addCharacter(spriteCanvas) {
  const c = new Character(spriteCanvas, canvas.width, canvas.height);
  characters.push(c);
  return c;
}

export function getCharacterCount() {
  return characters.length;
}

export function clearCharacters() {
  characters.forEach(c => c.destroy());
  characters = [];
}

export function start() {
  if (running) return;
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

export function stop() {
  running = false;
}

function loop(timestamp) {
  if (!running) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap at 100ms
  lastTime = timestamp;
  const now = performance.now();

  // update characters
  characters.forEach(c => c.update(dt, now));

  // draw
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background
  if (bgCache) {
    ctx.drawImage(bgCache, 0, 0);
  }

  // sort characters by Y for depth
  characters.sort((a, b) => (a.y + a.h) - (b.y + b.h));

  // draw characters
  characters.forEach(c => c.draw(ctx));

  // HUD: character count
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(10, 10, 140, 36, 12);
  } else {
    ctx.rect(10, 10, 140, 36);
  }
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px "Fredoka One", "Comic Sans MS", cursive';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Creatures: ${characters.length}`, 22, 28);
  ctx.restore();

  requestAnimationFrame(loop);
}
