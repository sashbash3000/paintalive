// Turns a photo of a painting on paper into a transparent cut-out.
//
// 1. Estimate the paper colour locally (photos have uneven light and shadows).
// 2. Divide every pixel by the paper colour: paper becomes pure white, paint gets vivid.
// 3. "Ink score" = how far a pixel is from white. Threshold it (Otsu, adjustable).
// 4. Clean up, keep the main drawing, fill its inside (outline drawings become solid).
// 5. Soft edge, crop, scale down.

const WORK_SIZE = 900
const OUT_SIZE = 512

export async function loadImage(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

// Expensive part, done once per photo. The result is reused while the slider moves.
export function analyze(source) {
  const sw = source.width, sh = source.height
  const scale = Math.min(1, WORK_SIZE / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data

  const paper = estimatePaper(data, w, h)
  const colors = new Uint8ClampedArray(w * h * 4)
  const score = new Uint8Array(w * h)
  const hist = new Uint32Array(256)
  const p = [0, 0, 0]

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      paperAt(paper, x, y, p)
      const i = (y * w + x) * 4
      let r = (data[i] / p[0]) * 255
      let g = (data[i + 1] / p[1]) * 255
      let b = (data[i + 2] / p[2]) * 255
      // a little extra saturation – photos of crayons look dull
      const avg = (r + g + b) / 3
      r = avg + (r - avg) * 1.25
      g = avg + (g - avg) * 1.25
      b = avg + (b - avg) * 1.25
      colors[i] = r
      colors[i + 1] = g
      colors[i + 2] = b
      colors[i + 3] = 255
      const s = 255 - Math.min(colors[i], colors[i + 1], colors[i + 2])
      score[y * w + x] = s
      hist[s]++
    }
  }

  const otsu = otsuThreshold(hist, w * h)
  return { w, h, colors, score, baseThreshold: clamp(otsu, 28, 110) }
}

// sensitivity: -1 (only strong colours) … +1 (also faint pencil lines)
export function cutout(analysis, sensitivity = 0) {
  const { w, h, colors, score, baseThreshold } = analysis
  const threshold = clamp(baseThreshold * Math.pow(2, -sensitivity), 8, 220)
  const n = w * h
  const dim = Math.max(w, h)

  let mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = score[i] >= threshold ? 1 : 0

  mask = open(mask, w, h, 1) // remove paper grain
  const closeR = Math.max(2, Math.round(dim * 0.008))
  mask = close(mask, w, h, closeR) // connect strokes, close small gaps in outlines

  const selected = selectDrawing(mask, w, h)
  if (!selected) return { canvas: null, empty: true }

  let final = fillHoles(selected, w, h)
  final = erode(final, w, h, 1) // avoid a white paper halo
  const alpha = blurMask(final, w, h)

  // bounding box
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return { canvas: null, empty: true }
  const pad = 4
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad)
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad)
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1

  const crop = document.createElement('canvas')
  crop.width = cw
  crop.height = ch
  const cctx = crop.getContext('2d')
  const out = cctx.createImageData(cw, ch)
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = (y + y0) * w + (x + x0)
      const di = (y * cw + x) * 4
      out.data[di] = colors[si * 4]
      out.data[di + 1] = colors[si * 4 + 1]
      out.data[di + 2] = colors[si * 4 + 2]
      out.data[di + 3] = alpha[si]
    }
  }
  cctx.putImageData(out, 0, 0)

  const s = Math.min(1, OUT_SIZE / Math.max(cw, ch))
  const result = document.createElement('canvas')
  result.width = Math.max(1, Math.round(cw * s))
  result.height = Math.max(1, Math.round(ch * s))
  const rctx = result.getContext('2d')
  rctx.imageSmoothingQuality = 'high'
  rctx.drawImage(crop, 0, 0, result.width, result.height)
  return { canvas: result, empty: false }
}

// ---------- paper estimation ----------

function estimatePaper(data, w, h) {
  const cells = 12
  const cs = Math.ceil(Math.max(w, h) / cells)
  const gw = Math.ceil(w / cs), gh = Math.ceil(h / cs)
  const lum = (i) => (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000

  // global reference: brightness of the brightest 5%
  const ghist = new Uint32Array(256)
  for (let i = 0; i < w * h * 4; i += 16) ghist[lum(i) | 0]++
  const globalBright = percentile(ghist, 0.95)

  const grid = new Float32Array(gw * gh * 3)
  const valid = new Uint8Array(gw * gh)
  const hist = new Uint32Array(256)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const xa = gx * cs, xb = Math.min(w, xa + cs)
      const ya = gy * cs, yb = Math.min(h, ya + cs)
      hist.fill(0)
      for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) hist[lum((y * w + x) * 4) | 0]++
      const t = percentile(hist, 0.85)
      let r = 0, g = 0, b = 0, c = 0
      for (let y = ya; y < yb; y++) {
        for (let x = xa; x < xb; x++) {
          const i = (y * w + x) * 4
          if (lum(i) >= t) { r += data[i]; g += data[i + 1]; b += data[i + 2]; c++ }
        }
      }
      if (!c) continue
      r /= c; g /= c; b /= c
      const k = (gy * gw + gx) * 3
      grid[k] = r; grid[k + 1] = g; grid[k + 2] = b
      const chroma = Math.max(r, g, b) - Math.min(r, g, b)
      // cells completely covered by paint (or the table) don't tell us the paper colour
      valid[gy * gw + gx] = (r * 0.299 + g * 0.587 + b * 0.114) >= globalBright * 0.7 && chroma < 70 ? 1 : 0
    }
  }

  // fill invalid cells from valid neighbours
  if (!valid.some(Boolean)) {
    const v = Math.max(globalBright, 1)
    for (let i = 0; i < gw * gh; i++) { grid.fill(v, i * 3, i * 3 + 3); valid[i] = 1 }
  }
  for (let pass = 0; pass < gw + gh && valid.includes(0); pass++) {
    const next = valid.slice()
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const idx = gy * gw + gx
        if (valid[idx]) continue
        let r = 0, g = 0, b = 0, c = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = gx + dx, ny = gy + dy
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh || !valid[ny * gw + nx]) continue
            const k = (ny * gw + nx) * 3
            r += grid[k]; g += grid[k + 1]; b += grid[k + 2]; c++
          }
        }
        if (c) {
          grid[idx * 3] = r / c; grid[idx * 3 + 1] = g / c; grid[idx * 3 + 2] = b / c
          next[idx] = 1
        }
      }
    }
    valid.set(next)
  }
  for (let i = 0; i < grid.length; i++) grid[i] = Math.max(grid[i], 20)
  return { grid, gw, gh, cs }
}

function paperAt({ grid, gw, gh, cs }, x, y, out) {
  const fx = clamp(x / cs - 0.5, 0, gw - 1), fy = clamp(y / cs - 0.5, 0, gh - 1)
  const x0 = Math.floor(fx), y0 = Math.floor(fy)
  const x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1)
  const tx = fx - x0, ty = fy - y0
  for (let c = 0; c < 3; c++) {
    const a = grid[(y0 * gw + x0) * 3 + c], b = grid[(y0 * gw + x1) * 3 + c]
    const d = grid[(y1 * gw + x0) * 3 + c], e = grid[(y1 * gw + x1) * 3 + c]
    out[c] = (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty
  }
}

// ---------- mask helpers ----------

// Picks the drawing: the biggest blob that doesn't touch the photo border
// (border blobs are usually the table or the paper edge), plus big nearby parts.
function selectDrawing(mask, w, h) {
  const labels = new Int32Array(w * h)
  const comps = []
  const stack = []
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start]) continue
    const id = comps.length + 1
    const comp = { id, area: 0, x0: w, y0: h, x1: 0, y1: 0, border: false }
    labels[start] = id
    stack.push(start)
    while (stack.length) {
      const i = stack.pop()
      const x = i % w, y = (i - x) / w
      comp.area++
      if (x < comp.x0) comp.x0 = x
      if (x > comp.x1) comp.x1 = x
      if (y < comp.y0) comp.y0 = y
      if (y > comp.y1) comp.y1 = y
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) comp.border = true
      if (x > 0 && mask[i - 1] && !labels[i - 1]) { labels[i - 1] = id; stack.push(i - 1) }
      if (x < w - 1 && mask[i + 1] && !labels[i + 1]) { labels[i + 1] = id; stack.push(i + 1) }
      if (y > 0 && mask[i - w] && !labels[i - w]) { labels[i - w] = id; stack.push(i - w) }
      if (y < h - 1 && mask[i + w] && !labels[i + w]) { labels[i + w] = id; stack.push(i + w) }
    }
    comps.push(comp)
  }
  if (!comps.length) return null

  const minArea = w * h * 0.004
  const inner = comps.filter((c) => !c.border && c.area >= minArea)
  const pool = inner.length ? inner : comps
  const main = pool.reduce((a, b) => (b.area > a.area ? b : a))
  if (main.area < minArea * 0.25) return null

  const mw = main.x1 - main.x0, mh = main.y1 - main.y0
  const ex0 = main.x0 - mw * 0.3, ex1 = main.x1 + mw * 0.3
  const ey0 = main.y0 - mh * 0.3, ey1 = main.y1 + mh * 0.3
  const keep = new Uint8Array(comps.length + 1)
  keep[main.id] = 1
  for (const c of comps) {
    if (c.border || c.area < main.area * 0.08) continue
    if (c.x1 < ex0 || c.x0 > ex1 || c.y1 < ey0 || c.y0 > ey1) continue
    keep[c.id] = 1
  }
  const out = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) out[i] = keep[labels[i]]
  return out
}

// Everything not reachable from the border through empty pixels is "inside".
function fillHoles(mask, w, h) {
  const outside = new Uint8Array(w * h)
  const stack = []
  const push = (i) => { if (!mask[i] && !outside[i]) { outside[i] = 1; stack.push(i) } }
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }
  while (stack.length) {
    const i = stack.pop()
    const x = i % w
    if (x > 0) push(i - 1)
    if (x < w - 1) push(i + 1)
    if (i >= w) push(i - w)
    if (i < w * (h - 1)) push(i + w)
  }
  const out = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) out[i] = outside[i] ? 0 : 1
  return out
}

// Square dilation via prefix sums (separable).
function dilate(mask, w, h, r) {
  const tmp = new Uint8Array(w * h)
  const out = new Uint8Array(w * h)
  const pre = new Int32Array(Math.max(w, h) + 1)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) pre[x + 1] = pre[x] + mask[y * w + x]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = pre[Math.min(w, x + r + 1)] - pre[Math.max(0, x - r)] > 0 ? 1 : 0
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) pre[y + 1] = pre[y] + tmp[y * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = pre[Math.min(h, y + r + 1)] - pre[Math.max(0, y - r)] > 0 ? 1 : 0
    }
  }
  return out
}

function invert(mask) {
  const out = new Uint8Array(mask.length)
  for (let i = 0; i < mask.length; i++) out[i] = mask[i] ? 0 : 1
  return out
}

const erode = (m, w, h, r) => invert(dilate(invert(m), w, h, r))
const open = (m, w, h, r) => dilate(erode(m, w, h, r), w, h, r)
const close = (m, w, h, r) => erode(dilate(m, w, h, r), w, h, r)

// 0/1 mask -> 0..255 alpha with a soft 1–2px edge.
function blurMask(mask, w, h) {
  let a = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) a[i] = mask[i] * 255
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        b[i] = (a[i] * 2 + a[x > 0 ? i - 1 : i] + a[x < w - 1 ? i + 1 : i]) / 4
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        a[i] = (b[i] * 2 + b[y > 0 ? i - w : i] + b[y < h - 1 ? i + w : i]) / 4
      }
    }
  }
  const out = new Uint8ClampedArray(w * h)
  for (let i = 0; i < w * h; i++) out[i] = a[i]
  return out
}

// ---------- small utils ----------

function otsuThreshold(hist, total) {
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, best = 0, bestT = 60
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB, mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > best) { best = between; bestT = t + 1 }
  }
  return bestT
}

function percentile(hist, p) {
  let total = 0
  for (let i = 0; i < 256; i++) total += hist[i]
  let acc = 0
  for (let i = 0; i < 256; i++) {
    acc += hist[i]
    if (acc >= total * p) return i
  }
  return 255
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v
}
