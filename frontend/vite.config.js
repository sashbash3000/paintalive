import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const backend = { target: 'http://localhost:3000', changeOrigin: true }

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true, // reachable from phones on the same Wi-Fi
    port: 5173,
    proxy: {
      '/api': backend,
      '/animal-images': backend,
    },
  },
})
