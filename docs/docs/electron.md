# Electron

## Introduction

Make sure `electron` is installed:

```bash
$ pnpm i electron -D
```

Create the file `src-electron/index.ts`, it will be automatically discovered by Armonia:

```ts
// src-electron/index.ts
import { app, BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | undefined

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    useContentSize: true
  })

  if (import.meta.env.DEV) {
    mainWindow.loadURL(import.meta.env.ELECTRON_APP_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools()
    })

    mainWindow.loadFile(import.meta.env.ELECTRON_APP_URL)
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

`import.meta.env.ELECTRON_APP_URL` is resolved by Armonia, and it will contain the vite server address during dev, and the relative path of the `index.html` file on production.

### Preload Script

::: warning
- This file runs in the Node.js context.
- Context isolation is not automatically safe, make sure to validate the arguments and not expose accidentally sensitive information or dangerous functions.
:::

Create the file `src-electron/preload.ts`, it will be automatically discovered by Armonia:

```ts
// src-electron/preload.ts
import { contextBridge } from 'electron'
import * as fs from 'node:fs'

contextBridge.exposeInMainWorld('fs', {
  readSettings() {
    return JSON.parse(fs.readFileSync('./settings.json', 'utf8')) as Record<string, any>
  }
})
```

In your electron main file:

```ts
import { resolve } from 'path'

new BrowserWindow({
  width: 800,
  height: 600,
  useContentSize: true,
  webPreferences: {
    contextIsolation: true,
    // preload scripts must be an absolute path
    preload: resolve(__dirname, import.meta.env.ELECTRON_PRELOAD_URL)
  }
})
```

Electron requires the full path when resolving the preload script.

`import.meta.env.ELECTRON_PRELOAD_URL` is replaced by Armonia with the relative path from the project root.
