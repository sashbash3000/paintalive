<template>
  <div class="world" ref="root">
    <canvas ref="canvas" class="stage" @pointerdown="onTap"></canvas>

    <div class="toolbar left">
      <router-link to="/" class="icon-btn" title="Home">🏠</router-link>
    </div>
    <div class="toolbar right">
      <button class="icon-btn" :class="{ active: removeMode }" title="Remove animals" @click="removeMode = !removeMode">
        🧹
      </button>
      <button class="icon-btn" title="Full screen" @click="toggleFullscreen">⛶</button>
    </div>

    <router-link :to="`/world/${sceneId}/add`" class="big-button add-btn">📷 Add a painting</router-link>

    <div v-if="loaded && count === 0" class="empty">
      <p>The {{ scene.title.toLowerCase() }} is still empty!</p>
      <p>Paint an animal on paper, then tap <strong>📷 Add a painting</strong>.</p>
    </div>
    <div v-if="removeMode" class="remove-hint">Tap an animal to send it home 👋</div>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script>
import api from '../services/api'
import { SCENES } from '../game/scenes'
import { World } from '../game/world'

const POLL_MS = 3000

export default {
  name: 'World',
  data() {
    return { count: 0, loaded: false, removeMode: false, error: null }
  },
  computed: {
    sceneId() {
      return this.$route.params.scene
    },
    scene() {
      return SCENES[this.sceneId]
    },
  },
  mounted() {
    this.world = new World(this.$refs.canvas, this.sceneId)
    this.world.start()
    this.resizeObserver = new ResizeObserver(() => this.world.resize())
    this.resizeObserver.observe(this.$refs.canvas)
    this.refresh(this.$route.query.welcome)
    this.timer = setInterval(() => this.refresh(), POLL_MS)
  },
  beforeUnmount() {
    clearInterval(this.timer)
    this.resizeObserver.disconnect()
    this.world.stop()
  },
  methods: {
    async refresh(welcomeId) {
      try {
        const animals = await api.getAnimals(this.sceneId)
        this.world.setAnimals(animals, { welcomeId })
        this.count = animals.length
        this.loaded = true
        this.error = null
      } catch (error) {
        this.error = 'Cannot reach the server'
      }
    },
    async onTap(event) {
      const rect = this.$refs.canvas.getBoundingClientRect()
      const animal = this.world.hitTest(event.clientX - rect.left, event.clientY - rect.top)
      if (!animal) return
      if (!this.removeMode) {
        this.world.poke(animal)
        return
      }
      const who = animal.name ? `"${animal.name}"` : 'this animal'
      if (!confirm(`Remove ${who} from the ${this.scene.title}?`)) return
      try {
        await api.deleteAnimal(animal.id)
        await this.refresh()
      } catch (error) {
        this.error = 'Could not remove: ' + error.message
      }
    },
    toggleFullscreen() {
      if (document.fullscreenElement) document.exitFullscreen()
      else this.$refs.root.requestFullscreen?.()
    },
  },
}
</script>

<style scoped>
.world {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #222;
  user-select: none;
}

.stage {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: manipulation;
}

.toolbar {
  position: absolute;
  top: 12px;
  display: flex;
  gap: 10px;
}

.toolbar.left {
  left: 12px;
}

.toolbar.right {
  right: 12px;
}

.icon-btn {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.8);
  font-size: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #3b2a1a;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
}

.icon-btn.active {
  background: #ffd23f;
  outline: 3px solid #fff;
}

.add-btn {
  position: absolute;
  right: 16px;
  bottom: 16px;
}

.empty {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.9);
  padding: 16px 24px;
  border-radius: 20px;
  text-align: center;
  font-size: 1.2rem;
  max-width: calc(100% - 32px);
}

.empty p {
  margin: 0.3em 0;
}

.remove-hint,
.error {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  padding: 8px 16px;
  border-radius: 999px;
  font-weight: bold;
}

.error {
  top: auto;
  bottom: 16px;
  color: #c62828;
}
</style>
