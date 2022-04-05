# # Vue 3 + Typescript + Vite + Electron

Start with a [vite project](https://vitejs.dev/guide/#scaffolding-your-first-vite-project):

```bash
pnpm create vite electron-vue -- --template vue-ts
```

Add Armonia:

```bash
pnpm i @armonia/vite -D
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { armonia } from '@armonia/vite'

export default defineConfig({
  plugins: [
    vue(),
    armonia({
      target: 'electron'
    })
  ]
})
```

Place your electron files in a folder named `src-electron` or `electron`

```ts
// src-electron/index.ts
import { app, BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | undefined

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      preload: import.meta.env.ELECTRON_PRELOAD_URL
    }
  })

  if (import.meta.env.DEV) {
    mainWindow.loadURL(import.meta.env.ELECTRON_APP_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(import.meta.env.ELECTRON_APP_URL)
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools()
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow == null) {
    createWindow()
  }
})
```

Run vite as usual:

```bash
pnpm run dev
```

Build:

```bash
pnpm run build
```
