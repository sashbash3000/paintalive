/**
 * Main entry point: wires up UI, screens, and all modules.
 */

import { getBackgrounds, paintBackground } from './backgrounds.js';
import { startCamera, captureFrame, stopCamera } from './webcam.js';
import { extractCharacter } from './extractor.js';
import { initGame, setBackground, addCharacter, start, stop, clearCharacters } from './game.js';
import { startAmbient, stopAmbient, toggleMute, isMuted, playSpawnSound } from './audio.js';

/* ---- DOM refs ---- */
const screenTitle  = document.getElementById('screen-title');
const screenGame   = document.getElementById('screen-game');
const bgGallery    = document.getElementById('bg-gallery');
const gameCanvas   = document.getElementById('game-canvas');
const modalWebcam  = document.getElementById('modal-webcam');
const webcamVideo  = document.getElementById('webcam-video');
const webcamPreview = document.getElementById('webcam-preview');
const btnScan      = document.getElementById('btn-scan');
const btnBack      = document.getElementById('btn-back');
const btnSound     = document.getElementById('btn-sound');
const soundIcon    = document.getElementById('sound-icon');
const btnSnap      = document.getElementById('btn-snap');
const btnRetake    = document.getElementById('btn-retake');
const btnUse       = document.getElementById('btn-use');
const btnCancel    = document.getElementById('btn-cancel-cam');

let currentBgId = null;
let capturedCanvas = null;

/* =========================================================
   Gallery
   ========================================================= */

function buildGallery() {
  const bgs = getBackgrounds();
  bgs.forEach(bg => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', bg.name);

    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 250;
    const cCtx = c.getContext('2d');
    bg.painter(cCtx, 400, 250);
    item.appendChild(c);

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = bg.name;
    item.appendChild(label);

    item.addEventListener('click', () => selectBackground(bg.id));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') selectBackground(bg.id);
    });

    bgGallery.appendChild(item);
  });
}

function selectBackground(id) {
  currentBgId = id;
  screenTitle.classList.remove('active');
  screenGame.classList.add('active');
  setBackground(id);
  start();
  startAmbient(id);
}

/* =========================================================
   Game UI buttons
   ========================================================= */

btnScan.addEventListener('click', openWebcam);
btnBack.addEventListener('click', goBackToGallery);
btnSound.addEventListener('click', () => {
  const m = toggleMute();
  soundIcon.textContent = m ? '\u{1F507}' : '\u{1F50A}';
});

function goBackToGallery() {
  stop();
  stopAmbient();
  clearCharacters();
  screenGame.classList.remove('active');
  screenTitle.classList.add('active');
}

/* =========================================================
   Webcam modal
   ========================================================= */

async function openWebcam() {
  modalWebcam.classList.remove('hidden');
  btnSnap.classList.remove('hidden');
  btnRetake.classList.add('hidden');
  btnUse.classList.add('hidden');
  webcamPreview.classList.add('hidden');
  webcamVideo.classList.remove('hidden');
  capturedCanvas = null;

  try {
    await startCamera();
  } catch {
    alert('Could not access the camera. Please allow camera access and try again.');
    closeWebcam();
  }
}

function closeWebcam() {
  stopCamera();
  modalWebcam.classList.add('hidden');
}

btnSnap.addEventListener('click', () => {
  capturedCanvas = captureFrame();

  // show preview
  const previewCtx = webcamPreview.getContext('2d');
  webcamPreview.width = capturedCanvas.width;
  webcamPreview.height = capturedCanvas.height;
  previewCtx.drawImage(capturedCanvas, 0, 0);

  webcamVideo.classList.add('hidden');
  webcamPreview.classList.remove('hidden');
  btnSnap.classList.add('hidden');
  btnRetake.classList.remove('hidden');
  btnUse.classList.remove('hidden');
});

btnRetake.addEventListener('click', () => {
  webcamPreview.classList.add('hidden');
  webcamVideo.classList.remove('hidden');
  btnSnap.classList.remove('hidden');
  btnRetake.classList.add('hidden');
  btnUse.classList.add('hidden');
  capturedCanvas = null;
});

btnUse.addEventListener('click', () => {
  if (!capturedCanvas) return;

  const sprite = extractCharacter(capturedCanvas);
  if (!sprite) {
    alert('Could not detect a drawing. Try using a darker pen on white paper!');
    return;
  }

  addCharacter(sprite);
  playSpawnSound();
  closeWebcam();
});

btnCancel.addEventListener('click', closeWebcam);

// close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modalWebcam.classList.contains('hidden')) {
    closeWebcam();
  }
});

/* =========================================================
   Init
   ========================================================= */

initGame(gameCanvas);
buildGallery();
