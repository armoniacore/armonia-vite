import type { Plugin } from 'vite'

import type { ElectronOptions } from './config'
import electron from './plugin-electron'
import type { SSGOptions, SSRPluginOptions } from './plugin-ssr'
import ssr from './plugin-ssr'

export { type ElectronBuilderOptions, type ElectronOptions, type ElectronPackagerOptions, type PackageJson } from './config'
export { default as minify } from './minify'
export { default as electron } from './plugin-electron'
export {
  type Manifest,
  type SSGOptions,
  type SSGFile as SSRFile,
  type SSRPluginOptions,
  type SSRRenderContext,
  default as ssr
} from './plugin-ssr'

export type Target =
  | 'spa'
  | 'pwa'
  | 'ssr'
  | 'ssr-pwa'
  | 'ssg'
  | 'electron'
  | 'capacitor-ios'
  | 'capacitor-android'
  | 'bex-chromium'
  | 'bex-firefox'
  | 'bex-edge'

export interface Options {
  target?: Target
  electron?: ElectronOptions
  ssr?: SSRPluginOptions
  ssg?: SSGOptions
}

interface TargetTriple {
  mode: string
  sys: string | null
}

function parseTarget(value?: string): TargetTriple {
  const targets = (value || '').split('-')

  const mode = targets[0] || 'spa'
  const sys = targets[1] || null

  return {
    mode,
    sys
  }
}

export function armonia(options?: Options): Plugin {
  options = options || {}

  const { mode } = parseTarget(options?.target || process.env['ARMONIA_TARGET'])

  if (mode === 'electron') {
    return electron(options.electron)
  }

  if (mode === 'ssr') {
    return ssr(options.ssr, false)
  }

  if (mode === 'ssg') {
    return ssr(options.ssr, options.ssg)
  }

  return {
    name: 'vite-plugin-spa',

    config() {
      return {
        define: {
          // capacitor
          'import.meta.env.CAPACITOR': true,
          // electron
          'import.meta.env.ELECTRON': true,
          'import.meta.env.ELECTRON_APP_URL': 'undefined',
          'import.meta.env.ELECTRON_PRELOAD_URL': 'undefined'
        }
      }
    }
  }
}
