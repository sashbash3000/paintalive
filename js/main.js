/**
 * Main entry point: wires up UI, screens, and all modules.
 */

import { getBackgrounds } from './backgrounds.js';
import { startCamera, captureFrame, stopCamera } from './webcam.js';
import { extractCharacter } from './extractor.js';
import { initGame, setBackground, addCharacter, start, stop, clearCharacters } from './game.js';
import { startAmbient, stopAmbient, toggleMute, playSpawnSound } from './audio.js';
import { hasApiKey, getApiKey, setApiKey, processDrawing, prepareSprite } from './ai.js';

/* ---- DOM refs ---- */
const screenTitle     = document.getElementById('screen-title');
const screenGame      = document.getElementById('screen-game');
const bgGallery       = document.getElementById('bg-gallery');
const gameCanvas      = document.getElementById('game-canvas');

const modalWebcam     = document.getElementById('modal-webcam');
const webcamTitle     = document.getElementById('webcam-title');
const webcamSubtitle  = document.getElementById('webcam-subtitle');
const webcamVideo     = document.getElementById('webcam-video');
const webcamPreview   = document.getElementById('webcam-preview');
const aiLoading       = document.getElementById('ai-loading');
const aiStatus        = document.getElementById('ai-status');
const aiResult        = document.getElementById('ai-result');
const aiSpritePreview = document.getElementById('ai-sprite-preview');
const btnScan         = document.getElementById('btn-scan');
const btnBack         = document.getElementById('btn-back');
const btnSound        = document.getElementById('btn-sound');
const soundIcon       = document.getElementById('sound-icon');
const btnSettings     = document.getElementById('btn-settings');
const btnSnap         = document.getElementById('btn-snap');
const btnRetake       = document.getElementById('btn-retake');
const btnUse          = document.getElementById('btn-use');
const btnCancel       = document.getElementById('btn-cancel-cam');

const modalSettings   = document.getElementById('modal-settings');
const inputApiKey     = document.getElementById('input-api-key');
const keyStatus       = document.getElementById('key-status');
const btnSaveKey      = document.getElementById('btn-save-key');
const btnCloseSettings = document.getElementById('btn-close-settings');

let currentBgId = null;
let capturedCanvas = null;
let pendingSpriteCanvas = null;
let processing = false;

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
btnSettings.addEventListener('click', openSettings);

function goBackToGallery() {
  stop();
  stopAmbient();
  clearCharacters();
  screenGame.classList.remove('active');
  screenTitle.classList.add('active');
}

/* =========================================================
   Settings modal
   ========================================================= */

function openSettings() {
  modalSettings.classList.remove('hidden');
  inputApiKey.value = getApiKey();
  keyStatus.textContent = '';
  keyStatus.className = 'key-status';
  if (hasApiKey()) {
    keyStatus.textContent = 'API key is configured';
    keyStatus.classList.add('success');
  }
}

function closeSettings() {
  modalSettings.classList.add('hidden');
}

btnSaveKey.addEventListener('click', () => {
  const key = inputApiKey.value.trim();
  if (key && !key.startsWith('sk-')) {
    keyStatus.textContent = 'API key should start with sk-';
    keyStatus.className = 'key-status error';
    return;
  }
  setApiKey(key);
  if (key) {
    keyStatus.textContent = 'Saved! AI mode is now active';
    keyStatus.className = 'key-status success';
  } else {
    keyStatus.textContent = 'Key removed. Using basic detection mode.';
    keyStatus.className = 'key-status info';
  }
});

btnCloseSettings.addEventListener('click', closeSettings);

/* =========================================================
   Webcam modal
   ========================================================= */

function resetWebcamUI() {
  webcamTitle.textContent = 'Show your drawing!';
  webcamSubtitle.innerHTML = 'Hold your drawing in front of the camera and press <strong>Snap!</strong>';
  btnSnap.classList.remove('hidden');
  btnRetake.classList.add('hidden');
  btnUse.classList.add('hidden');
  webcamPreview.classList.add('hidden');
  webcamVideo.classList.remove('hidden');
  aiLoading.classList.add('hidden');
  aiResult.classList.add('hidden');
  capturedCanvas = null;
  pendingSpriteCanvas = null;
  processing = false;
}

async function openWebcam() {
  modalWebcam.classList.remove('hidden');
  resetWebcamUI();

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
  processing = false;
}

btnSnap.addEventListener('click', async () => {
  capturedCanvas = captureFrame();

  // Show preview of the photo
  const previewCtx = webcamPreview.getContext('2d');
  webcamPreview.width = capturedCanvas.width;
  webcamPreview.height = capturedCanvas.height;
  previewCtx.drawImage(capturedCanvas, 0, 0);

  webcamVideo.classList.add('hidden');
  webcamPreview.classList.remove('hidden');
  btnSnap.classList.add('hidden');

  if (hasApiKey()) {
    // AI mode: automatically process
    await runAiPipeline();
  } else {
    // Fallback: basic extraction, show retake/use buttons
    btnRetake.classList.remove('hidden');
    btnUse.classList.remove('hidden');
    btnUse.textContent = 'Add to World!';
  }
});

async function runAiPipeline() {
  if (processing) return;
  processing = true;

  webcamTitle.textContent = 'Creating your creature...';
  webcamSubtitle.textContent = 'AI is turning your drawing into a living character!';
  aiLoading.classList.remove('hidden');
  btnRetake.classList.add('hidden');
  btnUse.classList.add('hidden');

  try {
    const spriteCanvas = await processDrawing(capturedCanvas, (msg) => {
      aiStatus.textContent = msg;
    });

    if (!spriteCanvas) {
      throw new Error('Could not generate a character');
    }

    // Scale and crop the sprite
    pendingSpriteCanvas = prepareSprite(spriteCanvas, 150);

    // Show the AI result preview
    aiLoading.classList.add('hidden');
    webcamPreview.classList.add('hidden');
    aiResult.classList.remove('hidden');

    const previewCtx = aiSpritePreview.getContext('2d');
    aiSpritePreview.width = pendingSpriteCanvas.width;
    aiSpritePreview.height = pendingSpriteCanvas.height;
    previewCtx.clearRect(0, 0, aiSpritePreview.width, aiSpritePreview.height);
    previewCtx.drawImage(pendingSpriteCanvas, 0, 0);

    webcamTitle.textContent = 'Your creature is ready!';
    webcamSubtitle.textContent = 'Add it to your world or try another drawing.';

    btnRetake.classList.remove('hidden');
    btnUse.classList.remove('hidden');
    btnUse.textContent = 'Add to World!';
  } catch (err) {
    console.error('AI pipeline error:', err);
    aiLoading.classList.add('hidden');
    webcamTitle.textContent = 'Oops!';
    webcamSubtitle.textContent = err.message || 'Something went wrong. Try again!';

    // Fall back to basic extraction
    pendingSpriteCanvas = extractCharacter(capturedCanvas);

    if (pendingSpriteCanvas) {
      webcamPreview.classList.remove('hidden');
      webcamSubtitle.textContent += ' Using basic detection instead.';
    }

    btnRetake.classList.remove('hidden');
    if (pendingSpriteCanvas) {
      btnUse.classList.remove('hidden');
      btnUse.textContent = 'Add Anyway';
    }
  } finally {
    processing = false;
  }
}

btnRetake.addEventListener('click', async () => {
  resetWebcamUI();
  try {
    await startCamera();
  } catch {
    // Camera may already be running
  }
});

btnUse.addEventListener('click', () => {
  let sprite = pendingSpriteCanvas;

  if (!sprite && capturedCanvas) {
    sprite = extractCharacter(capturedCanvas);
  }

  if (!sprite) {
    alert('Could not detect a drawing. Try using a darker pen on white paper!');
    return;
  }

  addCharacter(sprite);
  playSpawnSound();
  closeWebcam();
});

btnCancel.addEventListener('click', closeWebcam);

// close modals on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!modalWebcam.classList.contains('hidden')) closeWebcam();
    else if (!modalSettings.classList.contains('hidden')) closeSettings();
  }
});

/* =========================================================
   Init
   ========================================================= */

initGame(gameCanvas);
buildGallery();

// Show a hint if no API key configured
if (!hasApiKey()) {
  console.info('Drawing Alive: No API key configured. Click the gear icon to set up AI mode for much better drawing detection!');
}
