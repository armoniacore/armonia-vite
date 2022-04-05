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

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })

  // use vite as normally
  if (import.meta.env.DEV) {
    mainWindow.loadURL(import.meta.env.ELECTRON_APP_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(import.meta.env.ELECTRON_APP_URL)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
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
