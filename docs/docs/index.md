# Getting Started

Armonia is a vite plugin for quick application development.

Almost bare metal, Armonia allows you to develop and build application across multiple target without leaving the comfort of vite.

Armonia supports as right now:

- [Electron](./electron)
- [SSR](./ssr)
- [SSG](./ssg)

```bash
$ pnpm i @armonia/vite -D
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { armonia } from '@armonia/vite'

export default defineConfig({
  plugins: [armonia()]
})
```

> Explore the [example projects](https://github.com/armoniacore/armonia-vite/tree/main/packages/playground)

Or explore the [not so starter template](https://github.com/armoniacore/starter-template-vue-ts)
