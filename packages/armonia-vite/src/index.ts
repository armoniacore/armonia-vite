import type { Plugin } from 'vite'
import type { SSRPluginOptions, SSRRenderContext, SSRFile, Manifest } from './plugin-ssr'
import type { ElectronOptions, ElectronPackagerOptions, ElectronBuilderOptions, PackageJson } from './config'
import minify from './minify'
import electron from './plugin-electron'
import ssr from './plugin-ssr'

export {
  ElectronOptions,
  SSRPluginOptions,
  ElectronPackagerOptions,
  ElectronBuilderOptions,
  PackageJson,
  Manifest,
  SSRRenderContext,
  SSRFile,
  minify,
  electron,
  ssr
}

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

  if (mode === 'ssr' || mode === 'ssg') {
    options.ssr = options.ssr || {}
    options.ssr.ssg = mode === 'ssg'

    return ssr(options.ssr)
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
