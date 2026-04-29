/**
 * AI module: uses OpenAI APIs to interpret a child's drawing
 * and generate a clean cartoon sprite from it.
 *
 * Pipeline:
 * 1. GPT-4o-mini Vision → analyze the webcam photo, describe what was drawn
 * 2. GPT Image (gpt-image-1) → generate a clean cartoon character with transparent background
 */

const VISION_MODEL = 'gpt-4o-mini';
const IMAGE_MODEL = 'gpt-image-1';
const IMAGE_FALLBACK_MODEL = 'dall-e-3';

const STORAGE_KEY = 'drawing-alive-api-key';

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setApiKey(key) {
  if (key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function hasApiKey() {
  return getApiKey().length > 10;
}

/**
 * Full pipeline: photo → description → generated sprite canvas.
 * Calls onStatus(message) with progress updates.
 * Returns a canvas element with the generated character, or null on failure.
 */
export async function processDrawing(photoCanvas, onStatus) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key configured');

  // Step 1: analyze the drawing with vision
  onStatus('Looking at your drawing...');
  const description = await analyzeDrawing(photoCanvas, apiKey);

  // Step 2: generate a clean character sprite
  onStatus('Bringing it to life...');
  const spriteCanvas = await generateSprite(description, apiKey);

  return spriteCanvas;
}

async function analyzeDrawing(photoCanvas, apiKey) {
  const dataUrl = photoCanvas.toDataURL('image/jpeg', 0.8);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are helping a children's game. A child has drawn something on paper and photographed it. 
Describe ONLY what the child drew (the subject), in a short phrase suitable as an image generation prompt.
Focus on: what animal/creature/object it is, its colors, any distinctive features.
Keep it to 1-2 sentences. Be specific but concise.
Example outputs:
- "A green turtle with a big smile and a spotted shell"
- "A purple dinosaur with tiny arms and sharp teeth"
- "A yellow cat with stripes and a long curly tail"
If you cannot identify any drawing, respond with "a friendly colorful creature".`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What did the child draw? Describe it briefly.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 100,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Vision API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'a friendly colorful creature';
}

async function generateSprite(description, apiKey) {
  const prompt = `A single cute cartoon character: ${description}. 
Full body view, facing slightly to the right, standing upright. 
Simple, colorful, child-friendly cartoon style with bold outlines. 
The character should look like it belongs in a children's picture book.
No background, no ground, no shadows, no extra objects. Just the character.`;

  // Try gpt-image-1 first (supports transparent background)
  try {
    return await generateWithGptImage(prompt, apiKey);
  } catch (e) {
    console.warn('gpt-image-1 failed, trying dall-e-3 fallback:', e.message);
    return await generateWithDalle3(prompt, apiKey);
  }
}

async function generateWithGptImage(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: '1024x1024',
      background: 'transparent',
      output_format: 'png',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Image API error: ${response.status}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data returned');

  return await loadBase64Image(`data:image/png;base64,${b64}`);
}

async function generateWithDalle3(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: IMAGE_FALLBACK_MODEL,
      prompt: prompt + ' White background.',
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `DALL-E API error: ${response.status}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data returned');

  const canvas = await loadBase64Image(`data:image/png;base64,${b64}`);

  // Remove white background since DALL-E 3 doesn't support transparency
  removeWhiteBackground(canvas);
  return canvas;
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
  // Find bounding box of non-transparent pixels
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
