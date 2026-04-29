/**
 * Character extractor: takes a captured photo of a drawing on paper,
 * removes the white/light background, crops to bounding box, and
 * returns a clean transparent-background ImageData on a canvas.
 */

export function extractCharacter(sourceCanvas, maxSize = 150) {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, sw, sh);
  const data = imageData.data;

  // 1. Detect dominant background color (sample corners)
  const bgSamples = [
    getPixel(data, sw, 5, 5, sw, sh),
    getPixel(data, sw, sw - 5, 5, sw, sh),
    getPixel(data, sw, 5, sh - 5, sw, sh),
    getPixel(data, sw, sw - 5, sh - 5, sw, sh),
    getPixel(data, sw, Math.floor(sw / 2), 5, sw, sh),
    getPixel(data, sw, 5, Math.floor(sh / 2), sw, sh),
  ];
  const avgBg = averageColor(bgSamples);

  // 2. Remove background: compare each pixel to the average background color
  const threshold = 90;
  let minX = sw, minY = sh, maxX = 0, maxY = 0;
  let hasContent = false;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const dist = colorDistance(r, g, b, avgBg.r, avgBg.g, avgBg.b);
      if (dist < threshold) {
        data[idx + 3] = 0; // make transparent
      } else {
        hasContent = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasContent) {
    return null;
  }

  // 3. Add small padding
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(sw - 1, maxX + pad);
  maxY = Math.min(sh - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // 4. Put processed data back and crop
  ctx.putImageData(imageData, 0, 0);

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  // 5. Scale to maxSize while preserving aspect ratio
  const scale = Math.min(maxSize / cropW, maxSize / cropH, 1);
  const finalW = Math.round(cropW * scale);
  const finalH = Math.round(cropH * scale);

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalW;
  finalCanvas.height = finalH;
  const finalCtx = finalCanvas.getContext('2d');
  finalCtx.drawImage(cropCanvas, 0, 0, finalW, finalH);

  // 6. Second-pass: clean up any remaining near-background fringe around edges
  const fData = finalCtx.getImageData(0, 0, finalW, finalH);
  const fd = fData.data;
  for (let i = 0; i < fd.length; i += 4) {
    if (fd[i + 3] > 0 && fd[i + 3] < 60) {
      fd[i + 3] = 0;
    }
  }
  finalCtx.putImageData(fData, 0, 0);

  return finalCanvas;
}

function getPixel(data, w, x, y, maxW, maxH) {
  const safeX = Math.min(Math.max(x, 0), maxW - 1);
  const safeY = Math.min(Math.max(y, 0), maxH - 1);
  const idx = (safeY * w + safeX) * 4;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

function averageColor(samples) {
  let r = 0;
  let g = 0;
  let b = 0;

  for (const s of samples) {
    r += s.r;
    g += s.g;
    b += s.b;
  }

  const n = samples.length;
  return { r: r / n, g: g / n, b: b / n };
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
