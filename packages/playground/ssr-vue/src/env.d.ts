/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'ssr:manifest' {
  const manifest: Record<string, string[]>
  export default manifest
}

declare module 'ssr:template' {
  const template: string
  export default template
}
