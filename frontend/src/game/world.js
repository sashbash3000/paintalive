// The living world: draws the scene and moves the painted animals around.
import { SCENES, ZONE_FOR_MOTION, unitOf } from './scenes'

const SPEED = { walk: 0.35, hop: 0.45, fly: 0.6, swim: 0.3 } // in "units" (≈ screen height) per second
const ZONE_ORDER = { sky: 0, water: 1, ground: 2 }
const rand = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t

export class World {
  constructor(canvas, sceneId) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.scene = SCENES[sceneId]
    this.ambient = this.scene.createAmbient()
    this.animals = new Map()
    this.particles = []
    this.loaded = false
    this.time = 0
    this.running = false
    this.frame = this.frame.bind(this)
    this.resize()
  }

  start() {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    requestAnimationFrame(this.frame)
  }

  stop() {
    this.running = false
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = Math.max(1, rect.width)
    this.h = Math.max(1, rect.height)
    this.unit = unitOf(this.w, this.h)
    this.canvas.width = Math.round(this.w * this.dpr)
    this.canvas.height = Math.round(this.h * this.dpr)
    this.bg = this.renderLayer(this.scene.drawBackground)
    this.fg = this.renderLayer(this.scene.drawForeground)
  }

  renderLayer(draw) {
    const c = document.createElement('canvas')
    c.width = this.canvas.width
    c.height = this.canvas.height
    const ctx = c.getContext('2d')
    ctx.scale(this.dpr, this.dpr)
    draw(ctx, this.w, this.h)
    return c
  }

  // Sync with the list from the server. Animals that show up after the first
  // load (or the one we were told about) get a big entrance.
  setAnimals(list, { welcomeId } = {}) {
    const ids = new Set(list.map((a) => a.id))
    for (const id of this.animals.keys()) if (!ids.has(id)) this.animals.delete(id)
    for (const data of list) {
      if (this.animals.has(data.id)) continue
      this.animals.set(data.id, this.createAnimal(data, this.loaded || data.id === welcomeId))
    }
    this.loaded = true
  }

  createAnimal(data, entering) {
    let zoneName = ZONE_FOR_MOTION[data.motion] || 'ground'
    if (!this.scene.zones[zoneName]) zoneName = 'ground'
    const facing = data.facing === 'left' ? -1 : 1
    const dir = Math.random() < 0.5 ? -1 : 1
    const a = {
      id: data.id,
      name: data.name,
      motion: zoneName === 'ground' && data.motion !== 'hop' ? 'walk' : data.motion,
      zoneName,
      facing,
      img: new Image(),
      ready: false,
      aspect: 1,
      x: entering ? rand(0.3, 0.7) : rand(0.05, 0.95),
      d: entering ? rand(0.5, 0.8) : rand(0, 1),
      vx: 0,
      vy: 0,
      dir,
      flip: dir * facing,
      speedMul: rand(0.75, 1.25),
      state: 'idle',
      timer: entering ? 1.5 : rand(0, 2),
      tx: 0,
      td: 0,
      move: 0, // 0 = standing, 1 = full speed (smoothed)
      phase: rand(0, 10),
      jumpY: 0,
      jumpV: 0,
      appear: entering ? 0 : 1,
      entering,
      label: entering ? 4 : 0,
      box: null,
    }
    a.img.onload = () => {
      a.ready = true
      a.aspect = a.img.width / a.img.height
      if (a.entering) this.burst(a)
    }
    a.img.src = data.url
    this.pickTarget(a)
    return a
  }

  pickTarget(a) {
    if (a.zoneName === 'ground') {
      a.tx = rand(0.05, 0.95)
      a.td = rand(Math.max(0, a.d - 0.4), Math.min(1, a.d + 0.4)) // no clamping: it would pile animals up at the edges
    } else {
      a.tx = rand(0.05, 0.95)
      a.td = rand(0, 1)
    }
  }

  zoneY(a) {
    const z = this.scene.zones[a.zoneName]
    return (z.top + a.d * (z.bottom - z.top)) * this.h
  }

  zoneHeight(a) {
    const z = this.scene.zones[a.zoneName]
    return (z.bottom - z.top) * this.h
  }

  sizeOf(a) {
    const z = this.scene.zones[a.zoneName]
    const crowd = clamp(1 - (this.animals.size - 10) * 0.015, 0.6, 1)
    const base = z.size ?? lerp(z.far, z.near, a.d)
    return base * this.unit * crowd
  }

  // ------------------------------------------------------------ input

  hitTest(x, y) {
    let hit = null
    for (const a of this.sorted || []) {
      const b = a.box
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) hit = a // last = topmost
    }
    return hit
  }

  poke(a) {
    if (a.jumpY <= 0.001) a.jumpV = 2.4
    a.label = 2.5
    this.burst(a, 8, ['❤', '✦'])
  }

  burst(a, count = 18, shapes = ['✦', '★', '✿']) {
    const s = this.sizeOf(a)
    const cx = a.x * this.w, cy = this.zoneY(a) - (a.zoneName === 'ground' ? s * 0.5 : 0)
    const colors = ['#ffd23f', '#ff6fa3', '#6ec6ff', '#8bd17c', '#ffffff']
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2), sp = rand(0.4, 1.2) * s
      this.particles.push({
        x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - s * 0.3,
        life: rand(0.8, 1.4), age: 0, size: rand(0.08, 0.16) * s,
        color: colors[i % colors.length], shape: shapes[i % shapes.length],
      })
    }
  }

  // ------------------------------------------------------------ simulation

  frame(now) {
    if (!this.running) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.time += dt
    this.update(dt)
    this.draw()
    requestAnimationFrame(this.frame)
  }

  update(dt) {
    this.ambient.update(dt, this.time)
    for (const a of this.animals.values()) {
      if (!a.ready) continue
      a.appear = Math.min(1, a.appear + dt * 1.5)
      a.label = Math.max(0, a.label - dt)
      if (a.zoneName === 'ground') this.updateWalker(a, dt)
      else this.updateFloater(a, dt)

      // jump from poking
      if (a.jumpY > 0 || a.jumpV > 0) {
        a.jumpV -= 9 * dt
        a.jumpY = Math.max(0, a.jumpY + a.jumpV * dt)
        if (a.jumpY === 0) a.jumpV = 0
      }
      const targetFlip = a.dir * a.facing
      a.flip += clamp(targetFlip - a.flip, -dt * 6, dt * 6)
    }
    for (const p of this.particles) {
      p.age += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += this.unit * 0.4 * dt
    }
    this.particles = this.particles.filter((p) => p.age < p.life)
  }

  updateWalker(a, dt) {
    if (a.state === 'idle') {
      a.move = Math.max(0, a.move - dt * 4)
      a.timer -= dt
      if (a.timer <= 0) {
        this.pickTarget(a)
        a.state = 'move'
      }
      return
    }
    const s = this.sizeOf(a)
    const dx = (a.tx - a.x) * this.w
    const dy = (a.td - a.d) * this.zoneHeight(a)
    const dist = Math.hypot(dx, dy)
    const depthScale = Math.sqrt(s / (this.scene.zones.ground.near * this.unit))
    const step = SPEED[a.motion] * a.speedMul * this.unit * depthScale * dt * a.move
    a.move = Math.min(1, a.move + dt * 3)
    if (Math.abs(dx) > 2) a.dir = Math.sign(dx)
    if (dist <= step || dist < 1) {
      a.state = 'idle'
      a.timer = a.motion === 'hop' ? rand(0.4, 1.5) : rand(1, 4.5)
      return
    }
    a.x += (dx / dist) * step / this.w
    a.d += (dy / dist) * step / this.zoneHeight(a)
    a.phase += dt * a.speedMul * (a.motion === 'hop' ? 1.7 : 9) * a.move
  }

  updateFloater(a, dt) {
    const dx = (a.tx - a.x) * this.w
    const dy = (a.td - a.d) * this.zoneHeight(a)
    const dist = Math.hypot(dx, dy)
    if (dist < this.unit * 0.15) this.pickTarget(a)
    const sp = SPEED[a.motion] * a.speedMul * this.unit
    const k = Math.min(1, dt * 1.2)
    a.vx += ((dx / (dist || 1)) * sp - a.vx) * k
    a.vy += ((dy / (dist || 1)) * sp - a.vy) * k
    a.x = clamp(a.x + (a.vx * dt) / this.w, -0.1, 1.1)
    a.d = clamp(a.d + (a.vy * dt) / this.zoneHeight(a), 0, 1)
    if (Math.abs(a.vx) > sp * 0.15) a.dir = Math.sign(a.vx)
    a.move = 1
    a.phase += dt
  }

  // ------------------------------------------------------------ drawing

  draw() {
    const { ctx, w, h, time: t } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.bg, 0, 0, w, h)
    this.ambient.drawBack(ctx, w, h, t)

    this.sorted = [...this.animals.values()]
      .filter((a) => a.ready)
      .sort((p, q) => ZONE_ORDER[p.zoneName] - ZONE_ORDER[q.zoneName] || p.d - q.d)
    for (const a of this.sorted) this.drawAnimal(a, t)

    ctx.drawImage(this.fg, 0, 0, w, h)
    this.ambient.drawFront(ctx, w, h, t)
    this.drawParticles()
    for (const a of this.sorted) if (a.label > 0 && a.name) this.drawLabel(a)
  }

  drawAnimal(a, t) {
    const { ctx } = this
    const s = this.sizeOf(a)
    const r = Math.sqrt(a.aspect)
    const dw = Math.min(s * r, s * 2.2), dh = Math.min(s / r, s * 2.2)
    const px = a.x * this.w
    let py = this.zoneY(a)
    let lift = a.jumpY * dh * 0.5
    let sx = 1, sy = 1, tilt = 0, legs = 0

    if (a.motion === 'walk') {
      lift += Math.abs(Math.sin(a.phase)) * dh * 0.04 * a.move
      legs = Math.sin(a.phase) * 0.22 * a.move
      sy = 1 + Math.sin(t * 2.5 + a.phase) * 0.015 * (1 - a.move) // breathing while standing
      tilt = Math.sin(a.phase * 0.5) * 0.03 * a.move
    } else if (a.motion === 'hop') {
      const f = a.phase % 1
      const air = Math.sin(Math.PI * f) * a.move
      lift += air * dh * 0.45
      sy = 1 + air * 0.1 - (1 - air) * 0.06 * a.move
      sx = 2 - sy
    } else if (a.motion === 'fly') {
      sy = 1 + Math.sin(t * 12 + a.phase * 3) * 0.08
      lift += Math.sin(t * 2 + a.phase) * s * 0.15
      tilt = clamp(a.vy / (this.unit * 2), -0.3, 0.3) * a.dir
      py += dh * 0.5
    } else if (a.motion === 'swim') {
      tilt = Math.atan2(a.vy, Math.abs(a.vx) + 1) * 0.5 * a.dir + Math.sin(t * 3 + a.phase) * 0.05
      lift += Math.sin(t * 1.5 + a.phase) * s * 0.06
      py += dh * 0.5
    }

    const pop = a.appear < 1 ? elastic(a.appear) : 1

    if (a.zoneName === 'ground') {
      const shrink = 1 / (1 + lift / dh)
      ctx.fillStyle = `rgba(0,0,0,${0.18 * shrink * pop})`
      ctx.beginPath()
      ctx.ellipse(px, py, dw * 0.38 * shrink * pop, dw * 0.07 * shrink * pop, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.save()
    ctx.translate(px, py - lift)
    ctx.rotate(tilt)
    ctx.scale(a.flip * sx * pop, sy * pop)
    drawBody(ctx, a.img, dw, dh, legs)
    ctx.restore()

    a.box = { x: px - dw / 2, y: py - lift - dh, w: dw, h: dh }
  }

  drawParticles() {
    const { ctx } = this
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const p of this.particles) {
      ctx.globalAlpha = 1 - p.age / p.life
      ctx.fillStyle = p.color
      ctx.font = `${p.size}px sans-serif`
      ctx.fillText(p.shape, p.x, p.y)
    }
    ctx.globalAlpha = 1
  }

  drawLabel(a) {
    const { ctx } = this
    const b = a.box
    const fs = Math.max(14, this.unit * 0.035)
    ctx.font = `bold ${fs}px "Comic Sans MS", "Chalkboard SE", system-ui, sans-serif`
    const tw = ctx.measureText(a.name).width
    const bw = tw + fs * 1.2, bh = fs * 1.7
    const x = clamp(b.x + b.w / 2, bw / 2 + 4, this.w - bw / 2 - 4)
    const y = Math.max(bh + 4, b.y - fs * 0.4)
    ctx.globalAlpha = Math.min(1, a.label * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath()
    ctx.roundRect(x - bw / 2, y - bh, bw, bh, bh / 2)
    ctx.fill()
    ctx.fillStyle = '#3b2a1a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(a.name, x, y - bh / 2)
    ctx.globalAlpha = 1
  }
}

// Draws the painting with its bottom-centre at (0,0). While walking, the lower
// part is split in a front and back half that swing in opposite directions –
// a cheap but convincing "legs moving" effect for any drawing.
function drawBody(ctx, img, w, h, legs) {
  const iw = img.width, ih = img.height
  if (Math.abs(legs) < 0.005) {
    ctx.drawImage(img, -w / 2, -h, w, h)
    return
  }
  const split = 0.62
  const sy = ih * split, sh = ih - sy
  const dy = h * split, dh = h - dy
  const overlap = h / ih // one source pixel, hides the seam
  ctx.drawImage(img, 0, 0, iw, sy + 1, -w / 2, -h, w, dy + overlap)
  for (const half of [0, 1]) {
    ctx.save()
    ctx.translate(0, -dh)
    ctx.transform(1, 0, half ? legs : -legs, 1, 0, 0)
    ctx.drawImage(img, (half * iw) / 2, sy, iw / 2, sh, -w / 2 + (half * w) / 2, 0, w / 2 + overlap, dh)
    ctx.restore()
  }
}

function elastic(t) {
  return t === 0 ? 0 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
}
