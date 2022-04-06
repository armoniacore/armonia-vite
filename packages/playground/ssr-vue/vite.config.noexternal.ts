import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { armonia } from '@armonia/vite'

export default defineConfig({
  plugins: [
    vue(),
    armonia({
      target: 'ssr',
      ssr: {
        writeManifest: false,
        config: {
          ssr: {
            noExternal: /./
          },
          resolve: {
            // necessary because vue.ssrUtils is only exported on cjs modules
            alias: [
              {
                find: '@vue/runtime-dom',
                replacement: '@vue/runtime-dom/dist/runtime-dom.cjs.js'
              },
              {
                find: '@vue/runtime-core',
                replacement: '@vue/runtime-core/dist/runtime-core.cjs.js'
              }
            ]
          }
        }
      }
    })
  ]
})
