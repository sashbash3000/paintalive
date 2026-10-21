<template>
  <div class="add">
    <header>
      <router-link :to="`/world/${scene.id}`" class="back">← Back to the {{ scene.title }}</router-link>
    </header>

    <!-- 1. take the photo -->
    <section v-if="step === 'photo'" class="card">
      <h2>📷 Take a photo of your painting</h2>
      <ul class="tips">
        <li>☀️ Good light, no shadow of the phone on the paper</li>
        <li>📄 Hold the phone right above the paper</li>
        <li>🔍 Only the paper should be in the picture</li>
      </ul>
      <div class="actions">
        <label class="big-button">
          📷 Take photo
          <input type="file" accept="image/*" capture="environment" hidden @change="onFile" />
        </label>
        <label class="big-button secondary">
          🖼️ Pick a picture
          <input type="file" accept="image/*" hidden @change="onFile" />
        </label>
      </div>
      <p v-if="processing" class="busy">✂️ Cutting out your painting…</p>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <!-- 2. check the cut-out -->
    <section v-else-if="step === 'adjust'" class="card">
      <h2>✂️ Does it look right?</h2>
      <div class="preview" :style="{ backgroundImage: `url(${sceneThumb})` }">
        <img v-if="cutoutUrl" :src="cutoutUrl" alt="Your cut-out painting" />
        <p v-else class="nothing">Hmm, I can't find the painting. Try “More” or take a new photo.</p>
      </div>
      <div class="slider">
        <span>Less</span>
        <input v-model.number="sensitivity" type="range" min="-1" max="1" step="0.1" @input="scheduleCutout" />
        <span>More</span>
      </div>
      <p class="hint">Missing parts? Slide to “More”. Too much paper or shadow? Slide to “Less”.</p>
      <div class="actions">
        <button class="big-button secondary" @click="reset">🔄 New photo</button>
        <button class="big-button" :disabled="!cutoutUrl" @click="step = 'details'">👍 Looks good</button>
      </div>
    </section>

    <!-- 3. name & movement -->
    <section v-else class="card">
      <h2>✨ Almost there!</h2>
      <div class="preview small" :style="{ backgroundImage: `url(${sceneThumb})` }">
        <img :src="cutoutUrl" :class="{ flipped: facing === 'left' }" alt="Your painting" />
      </div>

      <label class="field">
        <span>What's its name?</span>
        <input v-model="name" type="text" maxlength="30" placeholder="e.g. Leo the Lion" />
      </label>

      <div class="field">
        <span>How does it move?</span>
        <div class="choices">
          <button
            v-for="m in scene.motions"
            :key="m"
            class="choice"
            :class="{ selected: motion === m }"
            @click="motion = m"
          >
            <span class="emoji">{{ motions[m].emoji }}</span>
            {{ motions[m].label }}
          </button>
        </div>
      </div>

      <div class="field">
        <span>Which way is it looking?</span>
        <div class="choices">
          <button class="choice" :class="{ selected: facing === 'left' }" @click="facing = 'left'">
            <span class="emoji">⬅️</span> Left
          </button>
          <button class="choice" :class="{ selected: facing === 'right' }" @click="facing = 'right'">
            <span class="emoji">➡️</span> Right
          </button>
        </div>
      </div>

      <div class="actions">
        <button class="big-button secondary" @click="step = 'adjust'">← Back</button>
        <button class="big-button" :disabled="saving" @click="save">
          {{ saving ? 'Sending…' : `${scene.emoji} Into the ${scene.title}!` }}
        </button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </div>
</template>

<script>
import api from '../services/api'
import { SCENES, MOTIONS } from '../game/scenes'
import { loadImage, analyze, cutout } from '../game/cutout'

export default {
  name: 'AddAnimal',
  data() {
    const scene = SCENES[this.$route.params.scene]
    return {
      scene,
      motions: MOTIONS,
      step: 'photo',
      processing: false,
      saving: false,
      error: null,
      sensitivity: 0,
      cutoutUrl: null,
      name: '',
      motion: scene.motions[0],
      facing: 'right',
      sceneThumb: '',
    }
  },
  mounted() {
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 400
    this.scene.drawBackground(c.getContext('2d'), c.width, c.height)
    this.sceneThumb = c.toDataURL('image/jpeg', 0.8)
  },
  methods: {
    async onFile(event) {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      this.error = null
      this.processing = true
      try {
        const image = await loadImage(file)
        await nextPaint()
        this.analysis = analyze(image)
        this.sensitivity = 0
        this.runCutout()
        this.step = 'adjust'
      } catch (error) {
        console.error(error)
        this.error = 'That picture did not work, please try another one.'
      } finally {
        this.processing = false
      }
    },
    scheduleCutout() {
      clearTimeout(this.cutoutTimer)
      this.cutoutTimer = setTimeout(() => this.runCutout(), 120)
    },
    runCutout() {
      const result = cutout(this.analysis, this.sensitivity)
      this.cutoutUrl = result.empty ? null : result.canvas.toDataURL('image/png')
    },
    reset() {
      this.step = 'photo'
      this.cutoutUrl = null
      this.analysis = null
    },
    async save() {
      this.saving = true
      this.error = null
      try {
        const animal = await api.createAnimal({
          scene: this.scene.id,
          name: this.name.trim(),
          motion: this.motion,
          facing: this.facing,
          image: this.cutoutUrl,
        })
        this.$router.push({ name: 'World', params: { scene: this.scene.id }, query: { welcome: animal.id } })
      } catch (error) {
        this.error = 'Could not save: ' + error.message
        this.saving = false
      }
    },
  },
}

// let the "cutting out…" message render before the heavy work starts
function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
}
</script>

<style scoped>
.add {
  min-height: 100%;
  padding: 12px 16px 40px;
  background: #fff8e7;
}

header {
  max-width: 720px;
  margin: 0 auto 12px;
}

.back {
  color: #9a6a3a;
  font-weight: bold;
  text-decoration: none;
  font-size: 1.1rem;
}

.card {
  max-width: 720px;
  margin: 0 auto;
  background: #fff;
  border-radius: 28px;
  padding: 20px;
  box-shadow: 0 6px 0 #e5d4b0;
  text-align: center;
}

h2 {
  margin: 0.2em 0 0.8em;
  font-size: 1.7rem;
}

.tips {
  list-style: none;
  padding: 0;
  margin: 0 auto 1.4em;
  font-size: 1.1rem;
  line-height: 1.9;
  text-align: left;
  display: inline-block;
}

.actions {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 18px;
}

.preview {
  position: relative;
  aspect-ratio: 8 / 5;
  border-radius: 20px;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview.small {
  max-width: 420px;
  margin: 0 auto;
}

.preview img {
  max-width: 70%;
  max-height: 85%;
  filter: drop-shadow(0 6px 6px rgba(0, 0, 0, 0.25));
  transition: transform 0.3s;
}

.preview img.flipped {
  transform: scaleX(-1);
}

.nothing {
  background: rgba(255, 255, 255, 0.9);
  padding: 12px 18px;
  border-radius: 14px;
  margin: 16px;
}

.slider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px auto 0;
  max-width: 460px;
  font-weight: bold;
}

.slider input {
  flex: 1;
  accent-color: #ff8a3d;
  height: 32px;
}

.hint {
  color: #8a7458;
  margin: 6px 0 0;
}

.field {
  display: block;
  margin: 18px auto 0;
  max-width: 460px;
  font-size: 1.15rem;
  font-weight: bold;
}

.field > span {
  display: block;
  margin-bottom: 8px;
}

.field input[type='text'] {
  width: 100%;
  font: inherit;
  font-size: 1.2rem;
  padding: 10px 16px;
  border-radius: 14px;
  border: 3px solid #ecdcbc;
  text-align: center;
}

.choices {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.choice {
  border: 3px solid #ecdcbc;
  background: #fffaf0;
  border-radius: 18px;
  padding: 10px 16px;
  min-width: 96px;
  font-size: 1.05rem;
  font-weight: bold;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: inherit;
}

.choice .emoji {
  font-size: 1.8rem;
}

.choice.selected {
  border-color: #ff8a3d;
  background: #fff0e2;
}

.busy {
  font-size: 1.2rem;
  margin-top: 1em;
}

.error {
  color: #c62828;
  font-weight: bold;
}
</style>
