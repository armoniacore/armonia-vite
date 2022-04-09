<div align="center">
  Armonia - Vite plugin for quick cross-platform application development.
  <br />
  <br />
  <a href="https://github.com/armoniacore/armonia-vite/discussions">Ask a Question</a>
</div>

<div align="center">
<br />

[![license](https://img.shields.io/github/license/armoniacore/armonia-vite.svg?style=flat-square)](LICENSE)
[![npm](https://img.shields.io/npm/v/@armonia/vite.svg?style=flat-square)](https://npmjs.com/package/@armonia/vite)
</div>

<details open="open">
<summary>Table of Contents</summary>

- [About](#about)
- [Getting Started](#getting-started)
  - [For Electron](#for-electron)
  - [For SSR](#for-ssr)
  - [For SSG](#for-ssg)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

</details>

---

## About

**Armonia** is a vite plugin for quick application development.

Almost bare metal, **Armonia** allows you to develop and build application across multiple target without leaving the comfort of vite.

It currently supports:

- SSR
- SSG (preview)
- Electron

Read the [online documentation](https://vite.armoniacore.com/), explore the [examples](/packages/playground/) or take a look at the [not so starter project](https://github.com/armoniacore/starter-template-vue-ts).

## Getting Started

In your vite project install `armonia` and `cross-env`:

```bash
$ pnpm i @armonia/vite cross-env -D
```

Add the `armonia` plugin to your `vite.config.ts`

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { armonia } from '@armonia/vite'

export default defineConfig({
  plugins: [armonia()]
})
```

### For Electron

<details open>
<br>

Install `electron` and `electron-builder`:

```bash
$ pnpm i electron electron-builder -D
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

Add new `scripts` in your package.json

```json
"scripts": {
  "dev:electron": "cross-env ARMONIA_TARGET=electron vite",
  "build:electron": "cross-env ARMONIA_TARGET=electron vite build",
}
```

Run the project with:

```bash
$ pnpm dev:electron
```

Build the project with:

```bash
$ pnpm build:electron
```

---

</details>

### For SSR

<details open>
<br>

Create the file `src/entry-server.ts`, it will be automatically discovered by Armonia. This will be your main entry point for the server-side code and it will run on `node`.

```ts
// src/entry-server.ts

// import the ssr manifest
import manifest from 'ssr:manifest'

// import the index.html string
import template from 'ssr:template'

export async function render(req: Request): Promise<string> {
  // execute your custom logic to render the page
  const app = await createAppToRoute(req.originalUrl)

  const appHtml = await renderToString(app, ctx)

  // inject the template
  return template
    .replace('</head>', `${preloadLinks}</head>`)
    .replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`)
}
```

Add new `scripts` in your package.json

```json
"scripts": {
  "dev:ssr": "cross-env ARMONIA_TARGET=ssr vite",
  "build:ssr": "cross-env ARMONIA_TARGET=ssr vite build",
}
```

Run the project with:

```bash
$ pnpm dev:ssr
```

Build the project with:

```bash
$ pnpm build:ssr
```

---

</details>

### For SSG

<details open>
<br>

Follow the [SSR steps](#for-ssr).

Update your `vite.config.ts` to support SSG:

```ts
// vite.config.ts
armonia({
  ssg: {
    async staticRender({ render }) {
      const code = await render('/')

      // return a list file and text
      return [
        {
          id: '/index.html',
          code
        }
      ]
    }
  }
})
```

`staticRender` will be executed when building the `SSG` target, `render` is the name of the exported function from the `src/entry-server.ts` file.

Add new `scripts` in your package.json

```json
"scripts": {
  "build:ssg": "cross-env ARMONIA_TARGET=ssg vite build",
}
```

Run the project in ssr:

```bash
$ pnpm dev:ssr
```

Build the project with:

```bash
$ pnpm build:ssg
```

---

</details>

## Roadmap

See the [open issues](https://github.com/armoniacore/armonia-vite/issues) for a list of proposed features (and known issues).

- [ ] Add support for Capacitor
- [ ] Provide examples and templates for `react` and `svelte`
- [ ] Stabilize the API
- [ ] Improve the documentation
- [ ] Implement a specialized CLI
- [ ] Actually do a proper CHANGELOG
- [ ] Workflow, everybody likes workflows
- [ ] Tests, tests and more tests

## Contributing

First off, thanks for taking the time to contribute! Contributions are what makes the open-source community such an amazing place to learn, inspire, and create. Any contributions you make will benefit everybody else and are **greatly appreciated**.

Please try to create bug reports that are:

- _Reproducible._ Include steps to reproduce the problem.
- _Specific._ Include as much detail as possible: which version, what environment, etc.
- _Unique._ Do not duplicate existing opened issues.
- _Scoped to a Single Bug._ One bug per report.

Please adhere to this project's [code of conduct](CODE_OF_CONDUCT.md).

## Support

Reach out to the maintainer at one of the following places:

- [GitHub discussions](https://github.com/armoniacore/armonia-vite/discussions)
- [Discord](https://discord.gg/GQT7mrXgvc)

## License

This project is licensed under the **MIT license**.

See [LICENSE](LICENSE) for more information.

---

> [docs](https://vite.armoniacore.com/) &nbsp;&middot;&nbsp;
> GitHub [Nucleo Armonico](https://github.com/armoniacore) &nbsp;&middot;&nbsp;
> [Discord](https://discord.gg/GQT7mrXgvc)
