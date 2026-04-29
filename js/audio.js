/**
 * Audio manager using Web Audio API for procedural ambient sounds
 * and character sound effects. No external audio files needed.
 */

let audioCtx = null;
let masterGain = null;
let ambientNodes = [];
let muted = false;
let currentAmbientId = null;

function ensureCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  ensureCtx();
  muted = !muted;
  masterGain.gain.setTargetAtTime(muted ? 0 : 0.35, audioCtx.currentTime, 0.1);
  return muted;
}

export function startAmbient(bgId) {
  ensureCtx();
  if (currentAmbientId === bgId) return;
  stopAmbient();
  currentAmbientId = bgId;

  switch (bgId) {
    case 'jungle':  ambientJungle(); break;
    case 'ocean':   ambientOcean();  break;
    case 'desert':  ambientDesert(); break;
    case 'arctic':  ambientArctic(); break;
    case 'space':   ambientSpace();  break;
    case 'savanna': ambientSavanna(); break;
  }
}

export function stopAmbient() {
  ambientNodes.forEach(n => {
    try { n.stop?.(); } catch {}
    try { n.disconnect(); } catch {}
  });
  ambientNodes = [];
  currentAmbientId = null;
}

export function playSpawnSound() {
  ensureCtx();
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.4);

  // sparkle overtone
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(1200, now + 0.1);
  osc2.frequency.exponentialRampToValueAtTime(1800, now + 0.25);
  gain2.gain.setValueAtTime(0.15, now + 0.1);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.35);
}

export function playFootstep() {
  ensureCtx();
  const now = audioCtx.currentTime;
  const bufferSize = audioCtx.sampleRate * 0.06;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(now);
}

/* =========================================================
   Ambient scene generators (looping procedural audio)
   ========================================================= */

function makeNoise(duration, lowFreq, highFreq, volume) {
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = (lowFreq + highFreq) / 2;
  bp.Q.value = 0.5;

  const gain = audioCtx.createGain();
  gain.gain.value = volume;

  src.connect(bp);
  bp.connect(gain);
  gain.connect(masterGain);
  src.start();
  ambientNodes.push(src, bp, gain);
  return { src, gain, bp };
}

function ambientJungle() {
  // low hum / rustling
  makeNoise(2, 100, 800, 0.08);
  // birds: periodic chirps via scheduled oscillators
  scheduleBirdChirps();
}

function scheduleBirdChirps() {
  if (currentAmbientId !== 'jungle') return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  const baseFreq = 1800 + Math.random() * 1200;
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.15);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.2);
  ambientNodes.push(osc, gain);
  setTimeout(() => scheduleBirdChirps(), 1500 + Math.random() * 4000);
}

function ambientOcean() {
  makeNoise(3, 80, 400, 0.15);
  makeNoise(2, 200, 1200, 0.04);
}

function ambientDesert() {
  // wind
  makeNoise(4, 200, 1500, 0.06);
}

function ambientArctic() {
  // howling wind
  makeNoise(3, 300, 2000, 0.09);
  makeNoise(2, 100, 500, 0.05);
}

function ambientSpace() {
  // deep drone
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 55;
  gain.gain.value = 0.08;
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  ambientNodes.push(osc, gain);

  // subtle shimmer
  makeNoise(3, 2000, 6000, 0.02);
}

function ambientSavanna() {
  // warm wind
  makeNoise(3, 150, 800, 0.07);
  // cricket-like chirps
  scheduleCrickets();
}

function scheduleCrickets() {
  if (currentAmbientId !== 'savanna') return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = 4000 + Math.random() * 1000;
  gain.gain.setValueAtTime(0.03, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.05);
  ambientNodes.push(osc, gain);
  setTimeout(() => scheduleCrickets(), 300 + Math.random() * 2000);
}
