/**
 * Main entry point: wires up UI, screens, and all modules.
 */

import { getBackgrounds } from './backgrounds.js';
import { startCamera, captureFrame, stopCamera } from './webcam.js';
import { extractCharacter } from './extractor.js';
import { initGame, setBackground, addCharacter, start, stop, clearCharacters } from './game.js';
import { startAmbient, stopAmbient, toggleMute, playSpawnSound } from './audio.js';
import {
  hasApiKey,
  getApiKey,
  setApiKey,
  getProvider,
  setProvider,
  getProviders,
  getCustomBaseUrl,
  setCustomBaseUrl,
  getCustomVisionModel,
  setCustomVisionModel,
  processDrawing,
  prepareSprite,
} from './ai.js';

/* ---- DOM refs ---- */
const screenTitle = document.getElementById('screen-title');
const screenGame = document.getElementById('screen-game');
const bgGallery = document.getElementById('bg-gallery');
const gameCanvas = document.getElementById('game-canvas');

const modalWebcam = document.getElementById('modal-webcam');
const webcamTitle = document.getElementById('webcam-title');
const webcamSubtitle = document.getElementById('webcam-subtitle');
const webcamVideo = document.getElementById('webcam-video');
const webcamPreview = document.getElementById('webcam-preview');
const aiLoading = document.getElementById('ai-loading');
const aiStatus = document.getElementById('ai-status');
const aiResult = document.getElementById('ai-result');
const aiSpritePreview = document.getElementById('ai-sprite-preview');
const btnScan = document.getElementById('btn-scan');
const btnBack = document.getElementById('btn-back');
const btnSound = document.getElementById('btn-sound');
const soundIcon = document.getElementById('sound-icon');
const btnSettings = document.getElementById('btn-settings');
const btnSnap = document.getElementById('btn-snap');
const btnUpload = document.getElementById('btn-upload');
const fileInput = document.getElementById('file-input');
const btnRetake = document.getElementById('btn-retake');
const btnUse = document.getElementById('btn-use');
const btnCancel = document.getElementById('btn-cancel-cam');

const modalSettings = document.getElementById('modal-settings');
const selectProvider = document.getElementById('select-provider');
const customFields = document.getElementById('custom-fields');
const inputBaseUrl = document.getElementById('input-base-url');
const inputVisionModel = document.getElementById('input-vision-model');
const inputApiKey = document.getElementById('input-api-key');
const keyStatus = document.getElementById('key-status');
const providerInfo = document.getElementById('provider-info');
const btnSaveKey = document.getElementById('btn-save-key');
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
  bgs.forEach((bg) => {
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
    item.addEventListener('keydown', (e) => {
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

const PROVIDER_HINTS = {
  openai:
    'Get a key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>. Supports vision analysis + AI image generation (best quality).',
  openrouter:
    'Get a key at <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai</a>. Uses Gemini Flash for vision. Drawing is extracted from the photo (no AI image generation).',
  custom:
    'Enter any OpenAI-compatible API endpoint. Must support vision (image input in chat completions).',
};

function openSettings() {
  modalSettings.classList.remove('hidden');

  selectProvider.value = getProvider();
  inputApiKey.value = getApiKey();
  inputBaseUrl.value = getCustomBaseUrl();
  inputVisionModel.value = getCustomVisionModel();

  updateProviderUI();

  keyStatus.textContent = '';
  keyStatus.className = 'key-status';
  if (hasApiKey()) {
    keyStatus.textContent = 'API key is configured for this tab';
    keyStatus.classList.add('success');
  }
}

function closeSettings() {
  modalSettings.classList.add('hidden');
}

function updateProviderUI() {
  const id = selectProvider.value;
  customFields.classList.toggle('hidden', id !== 'custom');
  providerInfo.innerHTML = PROVIDER_HINTS[id] || '';

  // Update placeholder
  const placeholders = { openai: 'sk-...', openrouter: 'sk-or-v1-...', custom: 'your-api-key' };
  inputApiKey.placeholder = placeholders[id] || 'api-key';
}

selectProvider.addEventListener('change', updateProviderUI);

btnSaveKey.addEventListener('click', () => {
  const providerId = selectProvider.value;
  const key = inputApiKey.value.trim();

  setProvider(providerId);
  setApiKey(key);

  if (providerId === 'custom') {
    setCustomBaseUrl(inputBaseUrl.value);
    setCustomVisionModel(inputVisionModel.value);

    if (!inputBaseUrl.value.trim()) {
      keyStatus.textContent = 'Please enter a base URL for your custom API';
      keyStatus.className = 'key-status error';
      return;
    }
  }

  if (key) {
    keyStatus.textContent = 'Saved! AI mode is active';
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
  webcamSubtitle.innerHTML =
    'Hold your drawing in front of the camera and press <strong>Snap!</strong>, or upload an image.';
  btnSnap.classList.remove('hidden');
  btnUpload.classList.remove('hidden');
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
    // Camera not available — hide snap, keep upload
    webcamSubtitle.innerHTML =
      'Camera not available. You can <strong>upload an image</strong> of your drawing instead!';
    btnSnap.classList.add('hidden');
    webcamVideo.classList.add('hidden');
  }
}

function closeWebcam() {
  stopCamera();
  modalWebcam.classList.add('hidden');
  processing = false;
}

async function handleCapturedImage(canvas) {
  capturedCanvas = canvas;

  // Show preview
  const previewCtx = webcamPreview.getContext('2d');
  webcamPreview.width = canvas.width;
  webcamPreview.height = canvas.height;
  previewCtx.drawImage(canvas, 0, 0);

  webcamVideo.classList.add('hidden');
  webcamPreview.classList.remove('hidden');
  btnSnap.classList.add('hidden');
  btnUpload.classList.add('hidden');

  if (hasApiKey()) {
    await runAiPipeline();
  } else {
    // Fallback: basic extraction
    pendingSpriteCanvas = extractCharacter(canvas);
    btnRetake.classList.remove('hidden');
    if (pendingSpriteCanvas) {
      btnUse.classList.remove('hidden');
      btnUse.textContent = 'Add to World!';
    } else {
      webcamSubtitle.textContent =
        'Could not detect a drawing. Try a darker pen on white paper, or set up AI in settings!';
    }
  }
}

btnSnap.addEventListener('click', () => {
  handleCapturedImage(captureFrame());
});

// File upload handler
fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const maxDim = 800;
    let w = img.width,
      h = img.height;
    if (w > maxDim || h > maxDim) {
      const scale = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    handleCapturedImage(canvas);
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
  fileInput.value = '';
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
    const result = await processDrawing(capturedCanvas, (msg) => {
      aiStatus.textContent = msg;
    });

    let sprite = result.spriteCanvas;

    if (sprite) {
      // AI generated a full sprite image
      pendingSpriteCanvas = prepareSprite(sprite, 150);
    } else {
      // Vision-only provider: use improved extractor on the original photo
      // The AI described it but couldn't generate an image
      aiStatus.textContent = 'Extracting your drawing...';
      pendingSpriteCanvas = extractCharacter(capturedCanvas);
    }

    if (!pendingSpriteCanvas) {
      throw new Error('Could not extract a character from the image');
    }

    // Show result preview
    aiLoading.classList.add('hidden');
    webcamPreview.classList.add('hidden');
    aiResult.classList.remove('hidden');

    const previewCtx = aiSpritePreview.getContext('2d');
    aiSpritePreview.width = pendingSpriteCanvas.width;
    aiSpritePreview.height = pendingSpriteCanvas.height;
    previewCtx.clearRect(0, 0, aiSpritePreview.width, aiSpritePreview.height);
    previewCtx.drawImage(pendingSpriteCanvas, 0, 0);

    webcamTitle.textContent = 'Your creature is ready!';
    webcamSubtitle.textContent = result.spriteCanvas
      ? 'AI created this character from your drawing!'
      : `AI sees: "${result.description}" — extracted from your photo!`;

    btnRetake.classList.remove('hidden');
    btnUse.classList.remove('hidden');
    btnUse.textContent = 'Add to World!';
  } catch (err) {
    console.error('AI pipeline error:', err);
    aiLoading.classList.add('hidden');

    // Try fallback extraction
    pendingSpriteCanvas = extractCharacter(capturedCanvas);

    webcamTitle.textContent = 'Oops!';
    webcamSubtitle.textContent = err.message || 'Something went wrong.';

    if (pendingSpriteCanvas) {
      webcamPreview.classList.remove('hidden');
      webcamSubtitle.textContent += ' Used basic detection instead.';
      btnUse.classList.remove('hidden');
      btnUse.textContent = 'Add Anyway';
    }

    btnRetake.classList.remove('hidden');
  } finally {
    processing = false;
  }
}

btnRetake.addEventListener('click', async () => {
  resetWebcamUI();
  try {
    await startCamera();
  } catch {
    btnSnap.classList.add('hidden');
    webcamVideo.classList.add('hidden');
    webcamSubtitle.innerHTML =
      'Camera not available. You can <strong>upload an image</strong> instead!';
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
document.addEventListener('keydown', (e) => {
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
