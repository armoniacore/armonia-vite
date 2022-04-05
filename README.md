# Armonia Vite [![npm](https://img.shields.io/npm/v/@armonia/vite.svg)](https://npmjs.com/package/@armonia/vite)

Armonia is a vite plugin for quick application development.

Almost bare metal, Armonia allows you to develop and build application across multiple target without leaving the comfort of vite.

It currently supports:

- SSR
- Electron

Read the [documentation](https://vite.armoniacore.com/) or explore the [examples](/packages/playground/)

`pnpm i @armonia/vite`

```ts
import { defineConfig } from 'vite'
import defineConfig from '@armonia/vite'

// vite.config.ts
export default defineConfig({
  plugins: [armonia()]
})
```
