<template>
  <div class="home">
    <h1>🎨 Paint Zoo</h1>
    <p class="tagline">Paint an animal, take a photo, and watch it come alive!</p>

    <div class="worlds">
      <router-link v-for="scene in scenes" :key="scene.id" :to="`/world/${scene.id}`" class="world-card">
        <canvas :ref="(el) => drawThumb(el, scene)" class="thumb"></canvas>
        <div class="label">
          <span>{{ scene.emoji }} {{ scene.title }}</span>
          <span class="count">{{ counts[scene.id] || 0 }} 🐾</span>
        </div>
      </router-link>
    </div>

    <p v-if="phoneUrls.length" class="phone-hint">
      📱 On a phone in the same Wi-Fi, open
      <strong v-for="url in phoneUrls" :key="url">{{ url }}</strong>
    </p>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script>
import api from '../services/api'
import { SCENES } from '../game/scenes'

export default {
  name: 'Home',
  data() {
    return { scenes: Object.values(SCENES), counts: {}, phoneUrls: [], error: null }
  },
  async mounted() {
    try {
      const [animals, info] = await Promise.all([api.getAnimals(), api.getInfo()])
      for (const a of animals) this.counts[a.scene] = (this.counts[a.scene] || 0) + 1
      const port = window.location.port ? `:${window.location.port}` : ''
      if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        this.phoneUrls = info.addresses.map((ip) => `http://${ip}${port}`)
      }
    } catch (error) {
      this.error = 'Cannot reach the server – is the backend running? (' + error.message + ')'
    }
  },
  methods: {
    drawThumb(canvas, scene) {
      if (!canvas || canvas.dataset.drawn) return
      canvas.dataset.drawn = '1'
      const w = 480, h = 300
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      scene.drawBackground(ctx, w, h)
      scene.drawForeground(ctx, w, h)
    },
  },
}
</script>

<style scoped>
.home {
  min-height: 100%;
  padding: 24px 16px 40px;
  text-align: center;
  background: radial-gradient(circle at 20% 10%, #ffe9b8, transparent 40%),
    radial-gradient(circle at 90% 80%, #d6f5c6, transparent 40%), #fff8e7;
}

h1 {
  font-size: clamp(2.4rem, 7vw, 4rem);
  margin: 0.2em 0 0;
}

.tagline {
  font-size: 1.2rem;
  margin: 0.4em 0 1.6em;
}

.worlds {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  max-width: 1100px;
  margin: 0 auto;
}

.world-card {
  display: block;
  background: #fff;
  border-radius: 24px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 6px 0 #e5d4b0, 0 10px 24px rgba(0, 0, 0, 0.08);
  transition: transform 0.15s;
}

.world-card:hover {
  transform: translateY(-4px) rotate(-0.5deg);
}

.thumb {
  display: block;
  width: 100%;
  aspect-ratio: 8 / 5;
}

.label {
  display: flex;
  justify-content: space-between;
  padding: 12px 18px;
  font-size: 1.4rem;
  font-weight: bold;
}

.count {
  color: #9a7b54;
}

.phone-hint {
  margin-top: 2em;
  font-size: 1.05rem;
}

.phone-hint strong {
  display: inline-block;
  margin: 0 0.3em;
  padding: 0.1em 0.5em;
  background: #fff;
  border-radius: 8px;
}

.error {
  color: #c62828;
}
</style>
