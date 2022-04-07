# Armonia Vite [![npm](https://img.shields.io/npm/v/@armonia/vite.svg)](https://npmjs.com/package/@armonia/vite)

Armonia is a vite plugin for quick application development.

Almost bare metal, Armonia allows you to develop and build application across multiple target without leaving the comfort of vite.

It currently supports:

- SSR
- SSG (preview)
- Electron

Read the [documentation](https://vite.armoniacore.com/), explore the [examples](/packages/playground/) or take a look at the [not so starter project](https://github.com/armoniacore/starter-template-vue-ts)

`pnpm i @armonia/vite`

```ts
import { defineConfig } from 'vite'
import { armonia } from '@armonia/vite'

// vite.config.ts
export default defineConfig({
  plugins: [armonia()]
})
```
