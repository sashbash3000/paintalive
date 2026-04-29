/**
 * AI module: uses an OpenAI-compatible API to interpret a child's drawing
 * and generate a clean cartoon sprite from it.
 *
 * Supports multiple providers:
 * - OpenAI (default)
 * - OpenRouter (access to many models with one key)
 * - Any OpenAI-compatible API (custom base URL)
 *
 * Pipeline:
 * 1. Vision model → analyze the webcam photo, describe what was drawn
 * 2. Image generation model → generate a clean cartoon character sprite
 */

const STORAGE_PREFIX = 'drawing-alive-';
const FALLBACK_DESCRIPTION = 'a friendly colorful creature';

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    visionModel: 'gpt-4o-mini',
    imageModel: 'gpt-image-1',
    imageFallbackModel: 'dall-e-3',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-...',
    supportsTransparentBg: true,
    authHeader: (key) => `Bearer ${key}`,
    extraHeaders: () => ({}),
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    visionModel: 'google/gemini-2.0-flash-001',
    imageModel: null,
    imageFallbackModel: null,
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-or-v1-...',
    supportsTransparentBg: false,
    authHeader: (key) => `Bearer ${key}`,
    extraHeaders: () => ({
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Drawing Alive!',
    }),
  },
  custom: {
    name: 'Custom API',
    baseUrl: '',
    visionModel: '',
    imageModel: null,
    imageFallbackModel: null,
    keyPrefix: '',
    keyPlaceholder: 'your-api-key',
    supportsTransparentBg: false,
    authHeader: (key) => `Bearer ${key}`,
    extraHeaders: () => ({}),
  },
};

export function getProviders() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({ id, name: p.name }));
}

/* =========================================================
   Settings persistence
   ========================================================= */

function store(key, value) {
  if (value != null && value !== '') {
    localStorage.setItem(STORAGE_PREFIX + key, String(value));
  } else {
    localStorage.removeItem(STORAGE_PREFIX + key);
  }
}

function load(key) {
  return localStorage.getItem(STORAGE_PREFIX + key) || '';
}

export function getProvider() {
  return load('provider') || 'openai';
}
export function setProvider(id) {
  store('provider', id);
}

export function getApiKey() {
  return load('api-key');
}
export function setApiKey(key) {
  store('api-key', key?.trim());
}

export function getCustomBaseUrl() {
  return load('custom-base-url');
}
export function setCustomBaseUrl(url) {
  store('custom-base-url', url?.trim());
}

export function getCustomVisionModel() {
  return load('custom-vision-model');
}
export function setCustomVisionModel(m) {
  store('custom-vision-model', m?.trim());
}

export function hasApiKey() {
  return getApiKey().length > 5;
}

function getProviderConfig() {
  const id = getProvider();
  const base = { ...PROVIDERS[id] } || { ...PROVIDERS.openai };

  if (id === 'custom') {
    base.baseUrl = getCustomBaseUrl() || base.baseUrl;
    base.visionModel = getCustomVisionModel() || base.visionModel;
  }

  return base;
}

/* =========================================================
   Main pipeline
   ========================================================= */

/**
 * Full pipeline: photo → description → generated sprite canvas.
 * When image generation is not available for the provider, the vision
 * description is used to enhance the extracted drawing instead.
 * Calls onStatus(message) with progress updates.
 * Returns { spriteCanvas, description }.
 */
export async function processDrawing(photoCanvas, onStatus) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key configured');

  const config = getProviderConfig();

  // Step 1: analyze the drawing with vision
  onStatus('Looking at your drawing...');
  const description = await analyzeDrawing(photoCanvas, apiKey, config);

  // Step 2: generate a clean character sprite (if provider supports image gen)
  let spriteCanvas = null;

  if (config.imageModel) {
    onStatus('Bringing it to life...');
    try {
      spriteCanvas = await generateSprite(description, apiKey, config);
    } catch (e) {
      console.warn('Image generation failed:', e.message);
      // Fall through — will return null spriteCanvas, caller handles fallback
    }
  }

  return { spriteCanvas, description };
}

/* =========================================================
   Vision analysis
   ========================================================= */

async function analyzeDrawing(photoCanvas, apiKey, config) {
  const dataUrl = photoCanvas.toDataURL('image/jpeg', 0.8);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': config.authHeader(apiKey),
    ...config.extraHeaders(),
  };

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.visionModel,
      messages: [
        {
          role: 'system',
          content: `You are helping a children's game where a child's drawing is brought to life. A child has drawn something on paper and photographed it.

Your job is to describe the drawing in PRECISE VISUAL DETAIL so that an image generator can recreate something that looks like the SAME drawing, not a generic version.

Describe:
1. What it is (animal, creature, person, object)
2. The EXACT colors the child used (e.g. "drawn with red and blue crayon", "black marker outline with green colored pencil fill")
3. The drawing STYLE — is it wobbly, scribbly, stick-figure-like, carefully colored, messy, simple, detailed?
4. Specific quirks that make this drawing UNIQUE — oversized head, tiny legs, big round eyes, crooked smile, spiky hair, long neck, missing features, extra features, etc.
5. Proportions — is the body round/tall/thin? Are the legs long or short relative to the body?

Keep it to 2-4 sentences. Be VERY specific about what makes THIS particular drawing look the way it does.

Example outputs:
- "A cat drawn in wobbly black marker with a very round body, pointy triangle ears, long whiskers sticking out sideways, and a curly tail. It has big round green eyes and a wide smile. The legs a[...]
- "A dinosaur drawn in green and purple crayon with a huge head, tiny stick arms, and a row of red triangular spikes along its back. It has a big toothy grin with individual teeth drawn as zigzag[...]
- "A simple stick-figure bird drawn in blue pen with a round body, two lines for legs, and large spread-out wings. It has a small orange beak drawn as a triangle."

If you cannot identify any drawing, respond with "${FALLBACK_DESCRIPTION}".`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this child\'s drawing in precise visual detail. Focus on what makes it look unique — the colors, style, proportions, and quirky features of THIS specif[...]
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 250,
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  return sanitizeDescription(data.choices?.[0]?.message?.content) || FALLBACK_DESCRIPTION;
}

/* =========================================================
   Image generation (OpenAI only for now)
   ========================================================= */

async function generateSprite(description, apiKey, config) {
  const prompt = `Recreate this child's hand-drawn character as a clean digital version that CLOSELY RESEMBLES the original drawing:

${description}

CRITICAL RULES:
- Keep the SAME colors, proportions, and quirky features as described — do NOT "fix" or "improve" the drawing
- If the original has a huge head and tiny legs, keep the huge head and tiny legs
- If the original is wobbly and simple, make it look like a cleaned-up version of a wobbly simple drawing, NOT a professional cartoon
- Preserve the charm and personality of a child's drawing
- The result should look like a polished version of the SAME character the child drew, so the child immediately recognizes it as their own creation
- Full body view, standing upright
- No background, no ground, no shadows, no extra objects — just the character`;

  if (config.imageModel === 'gpt-image-1') {
    try {
      return await generateWithGptImage(prompt, apiKey, config);
    } catch (e) {
      console.warn('gpt-image-1 failed, trying dall-e-3 fallback:', e.message);
      if (config.imageFallbackModel) {
        return await generateWithDalle3(prompt, apiKey, config);
      }
      throw e;
    }
  } else if (config.imageModel) {
    return await generateWithDalle3(prompt, apiKey, config);
  }

  throw new Error('No image generation model configured for this provider');
}

async function generateWithGptImage(prompt, apiKey, config) {
  const response = await fetch(`${config.baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': config.authHeader(apiKey),
      ...config.extraHeaders(),
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      background: 'transparent',
      output_format: 'png',
    }),
  });

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data returned');

  return await loadBase64Image(`data:image/png;base64,${b64}`);
}

async function generateWithDalle3(prompt, apiKey, config) {
  const model = config.imageFallbackModel || config.imageModel;
  const response = await fetch(`${config.baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': config.authHeader(apiKey),
      ...config.extraHeaders(),
    },
    body: JSON.stringify({
      model,
      prompt: prompt + ' White background.',
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Image API error: ${response.status}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data returned');

  const canvas = await loadBase64Image(`data:image/png;base64,${b64}`);
  removeWhiteBackground(canvas);
  return canvas;
}

/* =========================================================
   Utilities
   ========================================================= */

function sanitizeDescription(description) {
  return description
    ?.replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function loadBase64Image(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Failed to load generated image'));
    img.src = dataUrl;
  });
}

function removeWhiteBackground(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const threshold = 240;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
      data[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Scale a sprite canvas down to fit within maxSize while preserving aspect ratio,
 * and crop to the visible (non-transparent) bounding box.
 */
export function prepareSprite(canvas, maxSize = 150) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  let minX = w, minY = h, maxX = 0, maxY = 0;
  let hasContent = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha > 20) {
        hasContent = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasContent) return canvas;

  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const scale = Math.min(maxSize / cropW, maxSize / cropH, 1);
  const finalW = Math.round(cropW * scale);
  const finalH = Math.round(cropH * scale);

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalW;
  finalCanvas.height = finalH;
  const fCtx = finalCanvas.getContext('2d');
  fCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, finalW, finalH);

  return finalCanvas;
}
