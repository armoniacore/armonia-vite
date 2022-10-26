<script lang="ts">
import HelloWorld from './components/HelloWorld.vue'
import { defineComponent, ref } from 'vue'

interface ElectronBridge {
  readSettings(): {
    settings: {
      motd: string
    }
  }
}

declare global {
  var electron: ElectronBridge
}

export default defineComponent({
  components: { HelloWorld },
  setup() {
    const { settings } = window.electron.readSettings()

    const motd = ref(settings.motd)

    // print the message to the console also
    console.log(settings.motd)

    return {
      motd
    }
  }
})
</script>

<template>
  <p>{{ motd }}</p>
  <img alt="Vue logo" src="./assets/logo.png" />
  <HelloWorld msg="Hello Vue 3 + TypeScript + Vite" />
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
