/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly ELECTRON_APP_URL: string
  readonly ELECTRON_PRELOAD_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
