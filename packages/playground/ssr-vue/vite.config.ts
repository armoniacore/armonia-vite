import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { ssr } from '@armonia/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), ssr()]
})
