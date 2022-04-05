import { createApp as createVueApp, createSSRApp } from 'vue'
import App from './App.vue'

export function createApp() {
  const app = import.meta.env.SSR ? createSSRApp(App) : createVueApp(App)

  return { app }
}
