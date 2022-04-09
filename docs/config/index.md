---
title: Configuring Armonia
---

# Configuring Armonia

## Config File

### Config Targets

Armonia supports multiple targets within a single project, therefore each target gets its own configuration.

```js
// vite.config.js
export default {
  plugins: [
    armonia({
      electron: { ... },
      ssr: { ... },
      ssg: { ... }
    })
  ]
}
```

To choose a target, use the `target` options:

```js
armonia({
  target: 'ssr'
})
```

Or use the env variable `ARMONIA_TARGET` using `cross-env`:

```bash
$ pnpm i cross-env -D
```

```json
"scripts": {
  "dev:electron": "cross-env ARMONIA_TARGET=electron vite",
  "build:electron": "cross-env ARMONIA_TARGET=electron vite build",
}
```

### Environment Variable

It is suggested that you use the environment variable instead of hard-coding a target, it will be more convenient in the long run.

The env variable `ARMONIA_TARGET` is needed since the `vite` CLI do not accepts unknown options, see the [PR 1188](https://github.com/vitejs/vite/pull/1188#issuecomment-753506897) for more information.

## Options

### target

- **Type:** `string`
- **Default:** `spa`

  The default target, you should use an [environment variable](#environment-variable) instead.

  Available targets: `spa` `ssr` `ssg` `electron`

## Electron Options

### electron.argv

- **Type:** `string[]`

  Specify the args to pass to the electron cli.

### electron.main

- **Type:** `string`

  The electron main file, it will be de file containing the code to run the electron applications.

  Omit the file extension to resolve `.js` and `.ts` automatically.

  Armonia will look for:
  - `electron/main.{ts,js}`
  - `electron/index.{ts,js}`
  - `electron/electron.{ts,js}`
  - `src-electron/main.{ts,js}`
  - `src-electron/index.{ts,js}`
  - `src-electron/electron.{ts,js}`
  - `src-electron/electron-main.{ts,js}`
  - `src/electron.{ts,js}`
  - `src/electron-main.{ts,js}`

### electron.preload

- **Type:** `string`

  The electron preload file.

  Omit the file extension to resolve `.js` and `.ts` automatically.

  Armonia will look for:
  - `electron/preload.{ts,js}`
  - `src-electron/preload.{ts,js}`
  - `src-electron/electron-preload.{ts,js}`
  - `src/preload.{ts,js}`
  - `src/electron-preload.{ts,js}`

### electron.bundler

- **Type:** `'packager' | 'builder' | false`

  The electron bundler to use during build, automatically resolved by Armonia.

  You need to install one of the bundler in order to use it:

  ```bash
  $ pnpm i electron-builder -D
  ```

  ```bash
  $ pnpm i electron-packager -D
  ```

  Set it to `false` to disable bundling, useful if you wish to bundle electron manually.

  Refer to the official bundler documentation for more information:

  - [Electron Builder](https://www.electron.build/)
  - [Electron Packager](https://github.com/electron/electron-packager)

### electron.packager

- **Type:** `ElectronPackagerOptions`

  The `electron-packager` options to use during build.

### electron.builder

- **Type:** `ElectronBuilderOptions`

  The `electron-builder` options to use during build.

### electron.transformPackageJson

- **Type:** `(pkg: Record<string, any>) => void | Promise<void>`

  Hook for transforming the `package.json`. The hook receives the content of the `package.json` as an `object`.

  Edit the object that will be saved and used to build electron.

  This hook is most used for fine tuning the generated `package.json`, such as for example, delete unused dependencies.

### electron.config

- **Type:** `UserConfig`

  Overwrite the vite config for this target.

## SSR Options

### ssr.ssr

- **Type:** `boolean | string`
- **Default:** `undefined`

  Specify the default SSR entry, similar to `build.ssr`, this value can be a string to directly specify the SSR entry, or `true`, which requires specifying the SSR entry via `rollupOptions.input`.

  This options is automatically resolved by Armonia.

  Armonia will look for:
  - `src/entry-server.{ts,js}`

### ssr.serverRoot

- **Type:** `string`
- **Default:** `'www'`

  Specify the directory that contains the server static assets, including the static generated files (relative to `build.outDir`).

### ssr.writeManifest

- **Type:** `boolean`
- **Default:** `false`

  Enable or disable the output of `ssr-manifest.json` and `index.html`.

### ssr.transformTemplate

- **Type:** `(html: string) => Promise<string | void> | string | void`

  Apply a transformation to the `index.html` file, note this will run after vite and just before `render` is called.
  It will not run when render is called.

### ssr.render

- **Type:** `(context: SSRRenderContext) => Promise<string | void> | string | void`

  Hook to invoke a custom renderer function, due to the nature of SSR rendering, you may want to use this function to replicate any custom server-side logic.

  An example usage:

  ```js
  render({ req, res, template, manifest, ssr }) {
    const html = ssr.customRenderFunction(req, res, template, manifest)

    // Armonia will serve this exact string as text/html
    return html
  }
  ```

### ssr.config

- **Type:** `UserConfig`

  Overwrite the vite config for this target.

## SSG Options

### ssg.ssr

- **Inherit** - See [ssr.ssr](#ssr-ssr)

### ssg.serverRoot

- **Inherit** - See [ssr.serverRoot](#ssr-serverroot)

### ssg.writeManifest

- **Inherit** - See [ssr.writeManifest](#ssr-writemanifest)

### ssg.transformTemplate

- **Inherit** - See [ssr.transformTemplate](#ssr-transformtemplate)

### ssg.staticRender

- **Type:** `(ssr: Record<string, any>, config: ResolvedConfig) => Promise<SSGFile[]> | Promise<void> | SSGFile[] | void`

  Render the SSG target, return an array containing a list of file `id` and `code`, the files will be written under `ssg.serverRoot`.

  An example usage:

  ```js
  async staticRender({ render }) {
    const code = await render()

    return [
      {
        id: '/index.html',
        code
      }
    ]
  }
  ```

### ssg.config

- **Type:** `UserConfig`

  Overwrite the vite config for this target.

<div style="height: 75vh; display: flex; justify-content: center; align-items: center; color: var(--c-divider-dark)">
  <svg style="width: 150px; height: 150px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
</div>
