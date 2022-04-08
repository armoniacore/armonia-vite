import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { armonia } from '@armonia/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    armonia({
      target: 'ssg',
      ssg: {
        serverRoot: 'public',
        config: {
          build: {
            outDir: 'dist-ssg'
          }
        },
        async staticRender({ render }) {
          const code = await render()

          return [
            {
              id: '/index.html',
              code
            }
          ]
        }
      }
    })
  ]
})
