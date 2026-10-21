// Hand-drawn (procedural) worlds. Each scene provides:
//  - zones: where animals can be (fractions of the screen height)
//      ground: walkers/hoppers, with perspective (far = small, near = big)
//      sky:    flyers          water: swimmers
//  - drawBackground / drawForeground: static layers, rendered once per resize
//  - createAmbient: small moving things (clouds, bubbles, leaves…)
//
// Scene ids must match SCENES in backend/src/app.js

export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TAU = Math.PI * 2

function circle(ctx, x, y, r) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

function vGradient(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c))
  return g
}

// a pointy leaf, base at (x,y), pointing along angle
function leaf(ctx, x, y, len, wid, angle, color, vein = 'rgba(255,255,255,0.25)') {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(len * 0.45, -wid, len, 0)
  ctx.quadraticCurveTo(len * 0.45, wid, 0, 0)
  ctx.fill()
  ctx.strokeStyle = vein
  ctx.lineWidth = Math.max(1, wid * 0.08)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(len * 0.9, 0)
  ctx.stroke()
  ctx.restore()
}

function flower(ctx, x, y, r, color) {
  ctx.fillStyle = color
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU
    circle(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8)
  }
  ctx.fillStyle = '#ffe14d'
  circle(ctx, x, y, r * 0.7)
}

function grassTufts(ctx, R, w, y0, y1, color, count, unit) {
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  for (let i = 0; i < count; i++) {
    const x = R() * w
    const y = y0 + R() * (y1 - y0)
    const s = unit * (0.012 + 0.02 * ((y - y0) / (y1 - y0)))
    ctx.lineWidth = Math.max(1, s * 0.25)
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath()
      ctx.moveTo(x + k * s * 0.3, y)
      ctx.quadraticCurveTo(x + k * s * 0.5, y - s, x + k * s * 1.1, y - s * 1.6)
      ctx.stroke()
    }
  }
}

function cloud(ctx, x, y, s) {
  circle(ctx, x, y, s)
  circle(ctx, x + s * 0.9, y + s * 0.15, s * 0.8)
  circle(ctx, x - s * 0.9, y + s * 0.2, s * 0.7)
  circle(ctx, x + s * 0.3, y - s * 0.45, s * 0.75)
  ctx.fillRect(x - s * 1.5, y + s * 0.2, s * 3.2, s * 0.7)
}

const unitOf = (w, h) => Math.min(h, w * 0.75)

// ---------------------------------------------------------------- jungle

function drawJungle(ctx, w, h) {
  const R = rng(11)
  const u = unitOf(w, h)
  const horizon = h * 0.6

  ctx.fillStyle = vGradient(ctx, 0, horizon, ['#8fd27e', '#d9f2b0', '#f2fbd2'])
  ctx.fillRect(0, 0, w, horizon + 2)
  const sun = ctx.createRadialGradient(w * 0.62, h * 0.22, 0, w * 0.62, h * 0.22, u * 0.45)
  sun.addColorStop(0, 'rgba(255,255,215,0.95)')
  sun.addColorStop(1, 'rgba(255,255,215,0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, w, horizon)

  // distant jungle walls
  for (const [yOff, color, r] of [[0.16, '#9ccf8a', 0.07], [0.09, '#74b86f', 0.075], [0.03, '#4f9a55', 0.07]]) {
    ctx.fillStyle = color
    const rr = u * r
    for (let x = -rr; x < w + rr; x += rr * 0.9) circle(ctx, x, horizon - h * yOff + R() * rr * 0.6, rr * (0.8 + R() * 0.5))
    ctx.fillRect(0, horizon - h * yOff, w, h * yOff + 2)
  }

  // tree trunks
  const trees = Math.max(4, Math.round(w / u * 3))
  for (let i = 0; i < trees; i++) {
    const x = ((i + 0.5) / trees) * w + (R() - 0.5) * (w / trees) * 0.6
    const tw = u * (0.025 + R() * 0.02)
    const base = horizon + h * (0.005 + R() * 0.02)
    ctx.fillStyle = R() > 0.5 ? '#7a5132' : '#6a4529'
    ctx.beginPath()
    ctx.moveTo(x - tw * 0.6, 0)
    ctx.lineTo(x + tw * 0.6, 0)
    ctx.quadraticCurveTo(x + tw * 0.5, base * 0.6, x + tw * 1.3, base)
    ctx.lineTo(x - tw * 1.3, base)
    ctx.quadraticCurveTo(x - tw * 0.5, base * 0.6, x - tw * 0.6, 0)
    ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(x + tw * 0.15, 0, tw * 0.35, base * 0.95)
  }

  // canopy along the top
  const greens = ['#2c7a3a', '#3a8f43', '#4fa84c', '#62b955']
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = greens[layer]
    const rr = u * (0.11 - layer * 0.02)
    for (let x = -rr; x < w + rr; x += rr * 0.8) circle(ctx, x, h * (0.02 + layer * 0.035) + R() * rr * 0.5, rr * (0.7 + R() * 0.5))
  }
  ctx.fillStyle = greens[0]
  ctx.fillRect(0, 0, w, h * 0.03)

  // vines
  const vines = Math.round(w / u * 4)
  for (let i = 0; i < vines; i++) {
    const x = R() * w
    const len = h * (0.18 + R() * 0.3)
    const sway = (R() - 0.5) * u * 0.08
    ctx.strokeStyle = '#2f6e2f'
    ctx.lineWidth = Math.max(1.5, u * 0.004)
    ctx.beginPath()
    ctx.moveTo(x, h * 0.05)
    ctx.quadraticCurveTo(x + sway, h * 0.05 + len * 0.6, x + sway * 0.3, h * 0.05 + len)
    ctx.stroke()
    for (let k = 1; k < 7; k++) {
      const t = k / 7
      const lx = x + sway * (2 * t * (1 - t)) + sway * 0.3 * t * t
      const ly = h * 0.05 + len * t
      leaf(ctx, lx, ly, u * 0.025, u * 0.01, k % 2 ? 0.6 : Math.PI - 0.6, '#3c8a3a')
    }
  }

  // ground
  ctx.fillStyle = vGradient(ctx, horizon, h, ['#86c65f', '#6cb24c', '#4e963a'])
  ctx.fillRect(0, horizon, w, h - horizon)
  // bushes on the horizon
  for (let x = -20; x < w + 20; x += u * 0.05) {
    ctx.fillStyle = R() > 0.5 ? '#3f8c3c' : '#4c9d44'
    circle(ctx, x, horizon + u * 0.005, u * (0.025 + R() * 0.025))
  }
  // a muddy path
  ctx.fillStyle = 'rgba(150,110,60,0.25)'
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.82, w * 0.55, h * 0.06, 0, 0, TAU)
  ctx.fill()

  grassTufts(ctx, R, w, horizon + h * 0.03, h, '#3e8a34', Math.round(w / u * 60), u)
  const colors = ['#ff6fa3', '#ffb347', '#ff5e5e', '#c77dff', '#fff176']
  for (let i = 0; i < w / u * 25; i++) {
    const y = horizon + h * 0.04 + R() * (h - horizon - h * 0.04)
    flower(ctx, R() * w, y, u * (0.004 + 0.006 * ((y - horizon) / (h - horizon))), colors[(R() * colors.length) | 0])
  }
}

function drawJungleFront(ctx, w, h) {
  const u = unitOf(w, h)
  const fan = (x, y, dir) => {
    const shades = ['#1f6b2e', '#2b8039', '#35924a', '#28763a']
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + dir * (0.25 + i * 0.28)
      leaf(ctx, x, y, u * (0.2 + (i % 2) * 0.05), u * 0.055, a, shades[i % shades.length], 'rgba(255,255,255,0.3)')
    }
  }
  fan(-u * 0.02, h + u * 0.02, 1)
  fan(w + u * 0.02, h + u * 0.02, -1)
}

function jungleAmbient() {
  const R = rng(5)
  const butterflies = Array.from({ length: 4 }, () => ({
    x: R(), y: 0.25 + R() * 0.4, a: R() * TAU, s: 0.6 + R() * 0.6,
    color: ['#ff7aa8', '#ffd23f', '#6ec6ff', '#ff9f43'][(R() * 4) | 0],
  }))
  const leaves = Array.from({ length: 6 }, () => ({ x: R(), y: R(), sp: 0.02 + R() * 0.03, ph: R() * TAU }))
  return {
    update(dt, t) {
      for (const b of butterflies) {
        b.a += (Math.sin(t * 0.7 + b.s * 10) * 1.5) * dt
        b.x += Math.cos(b.a) * 0.03 * b.s * dt
        b.y += Math.sin(b.a) * 0.03 * b.s * dt
        if (b.x < -0.05) b.x = 1.05
        if (b.x > 1.05) b.x = -0.05
        if (b.y < 0.15 || b.y > 0.8) b.a = -b.a
      }
      for (const l of leaves) {
        l.y += l.sp * dt
        if (l.y > 1.05) { l.y = -0.05; l.x = Math.random() }
      }
    },
    drawBack(ctx, w, h, t) {
      const u = unitOf(w, h)
      for (const b of butterflies) {
        const x = b.x * w, y = b.y * h
        const flap = Math.abs(Math.sin(t * 14 + b.s * 7))
        ctx.fillStyle = b.color
        ctx.beginPath()
        ctx.ellipse(x - u * 0.008 * flap, y, u * 0.009 * flap + 1, u * 0.012, 0.4, 0, TAU)
        ctx.ellipse(x + u * 0.008 * flap, y, u * 0.009 * flap + 1, u * 0.012, -0.4, 0, TAU)
        ctx.fill()
      }
    },
    drawFront(ctx, w, h, t) {
      const u = unitOf(w, h)
      for (const l of leaves) {
        leaf(ctx, l.x * w + Math.sin(t + l.ph) * u * 0.05, l.y * h, u * 0.03, u * 0.012, Math.sin(t * 1.5 + l.ph), '#7fbf4f')
      }
    },
  }
}

// ---------------------------------------------------------------- meadow

function drawMeadow(ctx, w, h) {
  const R = rng(23)
  const u = unitOf(w, h)
  const horizon = h * 0.58

  ctx.fillStyle = vGradient(ctx, 0, horizon, ['#6ec1f0', '#a9dcf7', '#e3f5ff'])
  ctx.fillRect(0, 0, w, horizon + 2)

  // sun
  const sx = w * 0.86, sy = h * 0.14
  ctx.strokeStyle = 'rgba(255,214,60,0.7)'
  ctx.lineWidth = u * 0.008
  ctx.lineCap = 'round'
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    ctx.beginPath()
    ctx.moveTo(sx + Math.cos(a) * u * 0.085, sy + Math.sin(a) * u * 0.085)
    ctx.lineTo(sx + Math.cos(a) * u * 0.12, sy + Math.sin(a) * u * 0.12)
    ctx.stroke()
  }
  ctx.fillStyle = '#ffd93b'
  circle(ctx, sx, sy, u * 0.065)

  // hills
  ctx.fillStyle = '#b5e08f'
  ctx.beginPath()
  ctx.ellipse(w * 0.2, horizon + h * 0.03, w * 0.45, h * 0.16, 0, Math.PI, TAU)
  ctx.fill()
  ctx.fillStyle = '#a2d67c'
  ctx.beginPath()
  ctx.ellipse(w * 0.75, horizon + h * 0.04, w * 0.5, h * 0.13, 0, Math.PI, TAU)
  ctx.fill()

  // barn on the left hill
  const bx = w * 0.16, by = horizon - h * 0.07, bs = u * 0.1
  ctx.fillStyle = '#d64545'
  ctx.fillRect(bx - bs * 0.5, by - bs * 0.55, bs, bs * 0.55)
  ctx.fillStyle = '#9e2f2f'
  ctx.beginPath()
  ctx.moveTo(bx - bs * 0.62, by - bs * 0.53)
  ctx.lineTo(bx, by - bs)
  ctx.lineTo(bx + bs * 0.62, by - bs * 0.53)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillRect(bx - bs * 0.15, by - bs * 0.35, bs * 0.3, bs * 0.35)
  ctx.strokeStyle = '#d64545'
  ctx.lineWidth = Math.max(1, bs * 0.04)
  ctx.beginPath()
  ctx.moveTo(bx - bs * 0.15, by - bs * 0.35); ctx.lineTo(bx + bs * 0.15, by)
  ctx.moveTo(bx + bs * 0.15, by - bs * 0.35); ctx.lineTo(bx - bs * 0.15, by)
  ctx.stroke()

  // tree on the right
  const tx = w * 0.7, ty = horizon - h * 0.06
  ctx.fillStyle = '#8a5a34'
  ctx.fillRect(tx - u * 0.012, ty - u * 0.12, u * 0.024, u * 0.13)
  ctx.fillStyle = '#4caf50'
  circle(ctx, tx, ty - u * 0.16, u * 0.07)
  circle(ctx, tx - u * 0.06, ty - u * 0.12, u * 0.05)
  circle(ctx, tx + u * 0.06, ty - u * 0.12, u * 0.05)
  ctx.fillStyle = '#e53935'
  for (let i = 0; i < 6; i++) circle(ctx, tx + (R() - 0.5) * u * 0.14, ty - u * (0.1 + R() * 0.1), u * 0.008)

  // ground
  ctx.fillStyle = vGradient(ctx, horizon, h, ['#94d46c', '#78c254', '#5aa83e'])
  ctx.fillRect(0, horizon, w, h - horizon)

  // fence along the horizon
  ctx.fillStyle = '#c9965e'
  const fy = horizon + h * 0.005, fh = u * 0.05
  for (let x = u * 0.02; x < w; x += u * 0.07) ctx.fillRect(x, fy - fh, u * 0.01, fh + u * 0.005)
  ctx.fillRect(0, fy - fh * 0.8, w, u * 0.007)
  ctx.fillRect(0, fy - fh * 0.4, w, u * 0.007)

  grassTufts(ctx, R, w, horizon + h * 0.02, h, '#4f9e36', Math.round(w / u * 70), u)
  const colors = ['#ffffff', '#ffeb3b', '#ff80ab', '#ba68c8', '#ff7043']
  for (let i = 0; i < w / u * 45; i++) {
    const y = horizon + h * 0.03 + R() * (h - horizon - h * 0.03)
    flower(ctx, R() * w, y, u * (0.003 + 0.007 * ((y - horizon) / (h - horizon))), colors[(R() * colors.length) | 0])
  }
}

function drawMeadowFront(ctx, w, h) {
  const R = rng(99)
  const u = unitOf(w, h)
  ctx.strokeStyle = '#4a9a32'
  ctx.lineCap = 'round'
  for (let x = 0; x < w; x += u * 0.012) {
    const len = u * (0.02 + R() * 0.05)
    ctx.lineWidth = u * 0.006
    ctx.beginPath()
    ctx.moveTo(x, h + 2)
    ctx.quadraticCurveTo(x + (R() - 0.5) * u * 0.02, h - len * 0.6, x + (R() - 0.5) * u * 0.04, h - len)
    ctx.stroke()
  }
}

function meadowAmbient() {
  const R = rng(3)
  const clouds = Array.from({ length: 5 }, () => ({ x: R() * 1.2 - 0.1, y: 0.06 + R() * 0.25, s: 0.04 + R() * 0.04, sp: 0.005 + R() * 0.01 }))
  return {
    update(dt) {
      for (const c of clouds) {
        c.x += c.sp * dt
        if (c.x > 1.2) c.x = -0.2
      }
    },
    drawBack(ctx, w, h) {
      const u = unitOf(w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      for (const c of clouds) cloud(ctx, c.x * w, c.y * h, c.s * u)
    },
    drawFront() {},
  }
}

// ---------------------------------------------------------------- ocean

function drawOcean(ctx, w, h) {
  const R = rng(41)
  const u = unitOf(w, h)

  ctx.fillStyle = vGradient(ctx, 0, h, ['#62d3f2', '#2a9fd6', '#1569a8', '#0d4a85'])
  ctx.fillRect(0, 0, w, h)

  // light rays
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  for (let i = 0; i < 6; i++) {
    const x = R() * w, wd = u * (0.04 + R() * 0.08)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + wd, 0)
    ctx.lineTo(x + wd * 3 + u * 0.2, h * 0.85)
    ctx.lineTo(x + u * 0.2, h * 0.85)
    ctx.fill()
  }

  // distant rocks
  ctx.fillStyle = 'rgba(12,60,110,0.55)'
  for (let x = -u * 0.1; x < w + u * 0.1; x += u * 0.09) circle(ctx, x, h * 0.83 + R() * u * 0.03, u * (0.05 + R() * 0.06))

  // sand
  const top = h * 0.84
  ctx.fillStyle = vGradient(ctx, top - u * 0.03, h, ['#f4dea6', '#e2c07c', '#c9a45f'])
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(0, top)
  for (let x = 0; x <= w; x += w / 12) ctx.quadraticCurveTo(x + w / 24, top - u * 0.025 * R(), x + w / 12, top + u * 0.01 * (R() - 0.5))
  ctx.lineTo(w, h)
  ctx.fill()

  // corals
  const corals = Math.round(w / u * 2.5)
  const coralColors = ['#ff6f91', '#ff9671', '#c34a9f', '#ffc75f']
  for (let i = 0; i < corals; i++) {
    const x = R() * w, y = top + u * 0.02 + R() * u * 0.03
    const color = coralColors[(R() * coralColors.length) | 0]
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineCap = 'round'
    ctx.lineWidth = u * 0.012
    for (let b = 0; b < 4; b++) {
      const a = -Math.PI / 2 + (b - 1.5) * 0.4
      const len = u * (0.05 + R() * 0.05)
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      circle(ctx, ex, ey, u * 0.01)
    }
  }

  // rocks, shells, starfish
  for (let i = 0; i < w / u * 3; i++) {
    ctx.fillStyle = R() > 0.5 ? '#8a9bb0' : '#6f8197'
    const x = R() * w, y = top + u * 0.04 + R() * (h - top - u * 0.04)
    ctx.beginPath()
    ctx.ellipse(x, y, u * (0.02 + R() * 0.03), u * 0.015, 0, Math.PI, TAU)
    ctx.fill()
  }
  for (let i = 0; i < w / u * 2; i++) {
    const x = R() * w, y = top + u * 0.05 + R() * (h - top - u * 0.06), r = u * 0.018
    ctx.fillStyle = '#ff8a3d'
    ctx.beginPath()
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * TAU
      const rr = k % 2 ? r * 0.45 : r
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    }
    ctx.fill()
  }
}

function oceanAmbient() {
  const R = rng(8)
  const weeds = Array.from({ length: 9 }, (_, i) => ({ x: (i + R()) / 9, len: 0.15 + R() * 0.15, ph: R() * TAU }))
  const bubbles = Array.from({ length: 25 }, () => ({ x: R(), y: R(), r: 0.004 + R() * 0.008, sp: 0.03 + R() * 0.05, ph: R() * TAU }))
  return {
    update(dt) {
      for (const b of bubbles) {
        b.y -= b.sp * dt
        if (b.y < -0.02) { b.y = 1.0; b.x = Math.random() }
      }
    },
    drawBack(ctx, w, h, t) {
      const u = unitOf(w, h)
      ctx.strokeStyle = '#2e9e5b'
      ctx.lineCap = 'round'
      ctx.lineWidth = u * 0.014
      for (const s of weeds) {
        const x0 = s.x * w, y0 = h * 0.9, len = s.len * h
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        for (let k = 1; k <= 8; k++) {
          const f = k / 8
          ctx.lineTo(x0 + Math.sin(t * 1.2 + s.ph + f * 3) * u * 0.03 * f, y0 - len * f)
        }
        ctx.stroke()
      }
    },
    drawFront(ctx, w, h, t) {
      const u = unitOf(w, h)
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = Math.max(1, u * 0.0025)
      for (const b of bubbles) {
        ctx.beginPath()
        ctx.arc(b.x * w + Math.sin(t * 2 + b.ph) * u * 0.01, b.y * h, b.r * u, 0, TAU)
        ctx.stroke()
      }
    },
  }
}

// ----------------------------------------------------------------

export const SCENES = {
  jungle: {
    id: 'jungle',
    title: 'Jungle',
    emoji: '🌴',
    motions: ['walk', 'hop', 'fly'],
    zones: {
      ground: { top: 0.63, bottom: 0.95, far: 0.13, near: 0.26 },
      sky: { top: 0.12, bottom: 0.45, size: 0.14 },
    },
    drawBackground: drawJungle,
    drawForeground: drawJungleFront,
    createAmbient: jungleAmbient,
  },
  meadow: {
    id: 'meadow',
    title: 'Farm',
    emoji: '🌻',
    motions: ['walk', 'hop', 'fly'],
    zones: {
      ground: { top: 0.61, bottom: 0.95, far: 0.12, near: 0.26 },
      sky: { top: 0.08, bottom: 0.42, size: 0.14 },
    },
    drawBackground: drawMeadow,
    drawForeground: drawMeadowFront,
    createAmbient: meadowAmbient,
  },
  ocean: {
    id: 'ocean',
    title: 'Ocean',
    emoji: '🐠',
    motions: ['swim', 'walk', 'hop'],
    zones: {
      water: { top: 0.1, bottom: 0.74, size: 0.17 },
      ground: { top: 0.86, bottom: 0.97, far: 0.11, near: 0.16 },
    },
    drawBackground: drawOcean,
    drawForeground: () => {},
    createAmbient: oceanAmbient,
  },
}

export const MOTIONS = {
  walk: { label: 'Walk', emoji: '🚶' },
  hop: { label: 'Hop', emoji: '🐸' },
  fly: { label: 'Fly', emoji: '🦋' },
  swim: { label: 'Swim', emoji: '🐟' },
}

export const ZONE_FOR_MOTION = { walk: 'ground', hop: 'ground', fly: 'sky', swim: 'water' }

export { unitOf }
