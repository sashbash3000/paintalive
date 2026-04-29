/**
 * Character extractor: takes a captured photo of a drawing on paper,
 * removes the background using multi-pass adaptive techniques,
 * crops to bounding box, and returns a clean transparent-background canvas.
 *
 * Techniques used:
 * - Dense background sampling (edges + grid)
 * - Adaptive color-distance thresholding per region
 * - Flood-fill from edges to remove connected background
 * - Morphological open/close to clean noise & fill gaps
 * - Soft alpha feathering on edges for clean compositing
 */

export function extractCharacter(sourceCanvas, maxSize = 150) {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;

  // Work on a copy so we don't mutate the source
  const workCanvas = document.createElement('canvas');
  workCanvas.width = sw;
  workCanvas.height = sh;
  const ctx = workCanvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, sw, sh);
  const data = imageData.data;

  // 1. Sample background color densely from edges
  const bgColor = sampleBackgroundColor(data, sw, sh);

  // 2. Build a foreground mask using adaptive thresholding
  const mask = new Uint8Array(sw * sh);
  const baseThr = 55;
  const satBonus = 25; // extra tolerance for low-saturation (grayish/white) pixels

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const dist = colorDistanceLab(r, g, b, bgColor.r, bgColor.g, bgColor.b);

      // pixels with low saturation (close to gray/white) get a higher threshold
      const sat = pixelSaturation(r, g, b);
      const threshold = sat < 0.15 ? baseThr + satBonus : baseThr;

      mask[y * sw + x] = dist >= threshold ? 1 : 0;
    }
  }

  // 3. Flood-fill from edges to ensure connected background is removed
  // This catches areas inside the image that are background-colored
  // but weren't connected to the edges (paper within drawing folds etc.)
  floodFillEdges(mask, sw, sh, data, bgColor, baseThr + satBonus + 15);

  // 4. Morphological operations to clean up
  morphologicalOpen(mask, sw, sh, 2);   // remove small noise specks
  morphologicalClose(mask, sw, sh, 3);  // fill small gaps in the drawing

  // 5. Remove small disconnected components (noise)
  removeSmallComponents(mask, sw, sh, 80);

  // 6. Apply mask to image data with edge feathering
  const feather = computeFeatherMap(mask, sw, sh, 2);

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      const i = y * sw + x;
      if (mask[i] === 0) {
        data[idx + 3] = 0;
      } else {
        data[idx + 3] = Math.round(feather[i] * 255);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // 7. Find bounding box and crop
  let minX = sw, minY = sh, maxX = 0, maxY = 0;
  let hasContent = false;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (mask[y * sw + x]) {
        hasContent = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasContent) return null;

  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(sw - 1, maxX + pad);
  maxY = Math.min(sh - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // 8. Scale to maxSize preserving aspect ratio
  const scale = Math.min(maxSize / cropW, maxSize / cropH, 1);
  const finalW = Math.round(cropW * scale);
  const finalH = Math.round(cropH * scale);

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalW;
  finalCanvas.height = finalH;
  const fCtx = finalCanvas.getContext('2d');
  fCtx.drawImage(workCanvas, minX, minY, cropW, cropH, 0, 0, finalW, finalH);

  return finalCanvas;
}

/* =========================================================
   Background color sampling
   ========================================================= */

function sampleBackgroundColor(data, w, h) {
  const samples = [];
  const step = 8;

  // top & bottom edges
  for (let x = 0; x < w; x += step) {
    samples.push(getPixel(data, w, x, 0));
    samples.push(getPixel(data, w, x, 1));
    samples.push(getPixel(data, w, x, h - 1));
    samples.push(getPixel(data, w, x, h - 2));
  }
  // left & right edges
  for (let y = 0; y < h; y += step) {
    samples.push(getPixel(data, w, 0, y));
    samples.push(getPixel(data, w, 1, y));
    samples.push(getPixel(data, w, w - 1, y));
    samples.push(getPixel(data, w, w - 2, y));
  }

  // Use median rather than mean to be robust against outliers
  samples.sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b));
  const mid = Math.floor(samples.length / 2);
  const median = samples[mid];

  // Average the middle 40% for stability
  const lo = Math.floor(samples.length * 0.3);
  const hi = Math.floor(samples.length * 0.7);
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = lo; i < hi; i++) {
    r += samples[i].r;
    g += samples[i].g;
    b += samples[i].b;
    count++;
  }

  return { r: r / count, g: g / count, b: b / count };
}

/* =========================================================
   Flood fill from edges
   ========================================================= */

function floodFillEdges(mask, w, h, data, bgColor, threshold) {
  const visited = new Uint8Array(w * h);
  const queue = [];

  // seed from all edge pixels that are currently marked as background
  for (let x = 0; x < w; x++) {
    if (!mask[x]) queue.push(x);
    const bot = (h - 1) * w + x;
    if (!mask[bot]) queue.push(bot);
  }
  for (let y = 1; y < h - 1; y++) {
    if (!mask[y * w]) queue.push(y * w);
    const right = y * w + w - 1;
    if (!mask[right]) queue.push(right);
  }

  queue.forEach(i => { visited[i] = 1; mask[i] = 0; });

  const dx = [-1, 1, 0, 0];
  const dy = [0, 0, -1, 1];

  let head = 0;
  while (head < queue.length) {
    const ci = queue[head++];
    const cx = ci % w;
    const cy = (ci - cx) / w;

    for (let d = 0; d < 4; d++) {
      const nx = cx + dx[d];
      const ny = cy + dy[d];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (visited[ni]) continue;
      visited[ni] = 1;

      const idx = ni * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const dist = colorDistanceLab(r, g, b, bgColor.r, bgColor.g, bgColor.b);

      if (dist < threshold) {
        mask[ni] = 0;
        queue.push(ni);
      }
    }
  }
}

/* =========================================================
   Morphological operations
   ========================================================= */

function morphologicalOpen(mask, w, h, radius) {
  erode(mask, w, h, radius);
  dilate(mask, w, h, radius);
}

function morphologicalClose(mask, w, h, radius) {
  dilate(mask, w, h, radius);
  erode(mask, w, h, radius);
}

function erode(mask, w, h, radius) {
  const copy = new Uint8Array(mask);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!copy[y * w + x]) continue;
      let allSet = true;
      outer: for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || !copy[ny * w + nx]) {
            allSet = false;
            break outer;
          }
        }
      }
      if (!allSet) mask[y * w + x] = 0;
    }
  }
}

function dilate(mask, w, h, radius) {
  const copy = new Uint8Array(mask);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (copy[y * w + x]) continue;
      let anySet = false;
      for (let dy = -radius; dy <= radius && !anySet; dy++) {
        for (let dx = -radius; dx <= radius && !anySet; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && copy[ny * w + nx]) {
            anySet = true;
          }
        }
      }
      if (anySet) mask[y * w + x] = 1;
    }
  }
}

/* =========================================================
   Connected component analysis - remove small noise regions
   ========================================================= */

function removeSmallComponents(mask, w, h, minSize) {
  const labels = new Int32Array(w * h);
  let label = 0;
  const sizes = [0];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i] || labels[i]) continue;

      label++;
      let size = 0;
      const queue = [i];
      labels[i] = label;
      let head = 0;

      while (head < queue.length) {
        const ci = queue[head++];
        size++;
        const cx = ci % w;
        const cy = (ci - cx) / w;

        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const ni = ny * w + nx;
          if (mask[ni] && !labels[ni]) {
            labels[ni] = label;
            queue.push(ni);
          }
        }
      }
      sizes[label] = size;
    }
  }

  for (let i = 0; i < w * h; i++) {
    if (labels[i] && sizes[labels[i]] < minSize) {
      mask[i] = 0;
    }
  }
}

/* =========================================================
   Edge feathering for smooth alpha transitions
   ========================================================= */

function computeFeatherMap(mask, w, h, radius) {
  const feather = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;

      // Check if this pixel is near a background pixel
      let minDist = radius + 1;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < minDist) minDist = d;
            continue;
          }
          if (!mask[ny * w + nx]) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < minDist) minDist = d;
          }
        }
      }

      feather[i] = Math.min(1, minDist / radius);
    }
  }

  return feather;
}

/* =========================================================
   Color utilities
   ========================================================= */

function getPixel(data, w, x, y) {
  const idx = (y * w + x) * 4;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

function pixelSaturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Perceptual color distance using a simplified CIE Lab-like weighting.
 * Much better than raw Euclidean RGB for distinguishing drawn lines from paper.
 */
function colorDistanceLab(r1, g1, b1, r2, g2, b2) {
  const rmean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  // Weighted Euclidean approximation of perceptual color difference
  return Math.sqrt(
    (2 + rmean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rmean) / 256) * db * db
  );
}
