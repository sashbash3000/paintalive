/**
 * Character class: a scanned drawing that walks around the scene
 * with procedural leg animation, bobbing body, and edge bouncing.
 */

import { playFootstep } from './audio.js';

const GRAVITY = 600; // px/s^2
const GROUND_OFFSET = 0.82; // fraction of canvas height where ground is
const WALK_SPEED_MIN = 30;
const WALK_SPEED_MAX = 80;
const LEG_CYCLE_SPEED = 8; // radians/sec
const BOB_AMOUNT = 3; // pixels
const WANDER_INTERVAL = [2000, 6000]; // ms range before changing direction
const FOOTSTEP_INTERVAL = 400; // ms between footstep sounds

let nextId = 0;

export default class Character {
  constructor(spriteCanvas, canvasW, canvasH) {
    this.id = nextId++;
    this.sprite = spriteCanvas;
    this.w = spriteCanvas.width;
    this.h = spriteCanvas.height;

    this.groundY = canvasH * GROUND_OFFSET;

    // position: start at random X, on the ground
    this.x = Math.random() * Math.max(0, canvasW - this.w);
    this.y = this.groundY - this.h;

    // velocity
    this.vx = 0;
    this.vy = 0;
    this.speed = WALK_SPEED_MIN + Math.random() * (WALK_SPEED_MAX - WALK_SPEED_MIN);
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.vx = this.direction * this.speed;

    // animation state
    this.legPhase = Math.random() * Math.PI * 2;
    this.alive = true;
    this.spawnTimer = 0; // for spawn pop-in animation
    this.scaleAnim = 0;

    // wander timer
    this.wanderTimeout = null;
    this.idleTimeout = null;
    this.scheduleWander();

    // footstep timing
    this.lastFootstep = 0;

    // canvas dimensions (updated on resize)
    this.canvasW = canvasW;
    this.canvasH = canvasH;
  }

  scheduleWander() {
    this.clearWanderTimers();

    const delay = WANDER_INTERVAL[0] + Math.random() * (WANDER_INTERVAL[1] - WANDER_INTERVAL[0]);
    this.wanderTimeout = setTimeout(() => {
      if (!this.alive) return;
      // randomly: stop, reverse, or keep going
      const r = Math.random();
      if (r < 0.25) {
        this.vx = 0; // idle for a moment
        this.idleTimeout = setTimeout(
          () => {
            if (!this.alive) return;
            this.direction = Math.random() < 0.5 ? 1 : -1;
            this.speed = WALK_SPEED_MIN + Math.random() * (WALK_SPEED_MAX - WALK_SPEED_MIN);
            this.vx = this.direction * this.speed;
            this.scheduleWander();
          },
          800 + Math.random() * 1500
        );
      } else if (r < 0.6) {
        this.direction *= -1;
        this.vx = this.direction * this.speed;
        this.scheduleWander();
      } else {
        this.speed = WALK_SPEED_MIN + Math.random() * (WALK_SPEED_MAX - WALK_SPEED_MIN);
        this.vx = this.direction * this.speed;
        this.scheduleWander();
      }
    }, delay);
  }

  clearWanderTimers() {
    clearTimeout(this.wanderTimeout);
    clearTimeout(this.idleTimeout);
    this.wanderTimeout = null;
    this.idleTimeout = null;
  }

  resize(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.groundY = canvasH * GROUND_OFFSET;
    this.y = this.groundY - this.h;
    this.x = Math.max(0, Math.min(this.x, Math.max(0, canvasW - this.w)));
  }

  update(dt, now) {
    this.spawnTimer += dt;

    // horizontal movement
    this.x += this.vx * dt;

    // bounce off edges
    if (this.x < 0) {
      this.x = 0;
      this.direction = 1;
      this.vx = this.speed;
    } else if (this.x + this.w > this.canvasW) {
      this.x = Math.max(0, this.canvasW - this.w);
      this.direction = -1;
      this.vx = -this.speed;
    }

    // keep on ground
    this.y = this.groundY - this.h;

    // leg animation phase
    if (Math.abs(this.vx) > 1) {
      this.legPhase += LEG_CYCLE_SPEED * dt * Math.sign(this.vx);
    }

    // footstep sounds
    if (Math.abs(this.vx) > 1 && now - this.lastFootstep > FOOTSTEP_INTERVAL) {
      this.lastFootstep = now;
      playFootstep();
    }
  }

  draw(ctx) {
    const isMoving = Math.abs(this.vx) > 1;

    // spawn pop-in animation
    let popScale = 1;
    if (this.spawnTimer < 0.4) {
      const t = this.spawnTimer / 0.4;
      popScale = easeOutBack(t);
    }

    // body bobbing
    const bob = isMoving ? Math.sin(this.legPhase * 2) * BOB_AMOUNT : 0;

    // slight tilt when walking
    const tilt = isMoving ? Math.sin(this.legPhase) * 0.05 : 0;

    ctx.save();

    // translate to character center-bottom
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h;
    ctx.translate(cx, cy);
    ctx.scale(popScale, popScale);

    // flip sprite based on direction
    if (this.direction < 0) {
      ctx.scale(-1, 1);
    }

    ctx.rotate(tilt);

    // draw legs (procedural stick legs)
    if (isMoving) {
      this.drawLegs(ctx);
    } else {
      this.drawLegsIdle(ctx);
    }

    // draw sprite body (offset up by bob)
    ctx.drawImage(this.sprite, -this.w / 2, -this.h + bob);

    // shadow under character
    ctx.restore();

    // ground shadow
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, this.groundY + 2, this.w * 0.4 * popScale, 4 * popScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawLegs(ctx) {
    const legLen = this.h * 0.25;
    const legSpread = this.w * 0.2;

    // two legs with alternating stride
    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(2, this.w * 0.06);
    ctx.lineCap = 'round';

    for (let leg = 0; leg < 2; leg++) {
      const phase = this.legPhase + leg * Math.PI;
      const hipX = (leg === 0 ? -legSpread : legSpread) * 0.5;
      const footDx = Math.sin(phase) * legLen * 0.7;
      const footDy = Math.abs(Math.cos(phase)) * legLen * 0.3;

      ctx.beginPath();
      ctx.moveTo(hipX, 0);
      // knee
      const kneeX = hipX + footDx * 0.4;
      const kneeY = legLen * 0.5;
      ctx.lineTo(kneeX, kneeY);
      // foot
      const footX = hipX + footDx;
      const footY = legLen - footDy;
      ctx.lineTo(footX, footY);
      ctx.stroke();

      // little foot circle
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(footX, footY, Math.max(2, this.w * 0.03), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawLegsIdle(ctx) {
    const legLen = this.h * 0.22;
    const legSpread = this.w * 0.15;

    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(2, this.w * 0.06);
    ctx.lineCap = 'round';

    for (let leg = 0; leg < 2; leg++) {
      const hipX = leg === 0 ? -legSpread : legSpread;
      ctx.beginPath();
      ctx.moveTo(hipX, 0);
      ctx.lineTo(hipX, legLen);
      ctx.stroke();

      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(hipX, legLen, Math.max(2, this.w * 0.03), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  destroy() {
    this.alive = false;
    this.clearWanderTimers();
  }
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
