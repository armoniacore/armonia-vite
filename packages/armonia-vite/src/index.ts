import type {
  Options,
  Target,
  ElectronOptions,
  SSRPluginOptions,
  ElectronPackagerOptions,
  ElectronBuilderOptions,
  PackageJson,
  SSRRenderContext,
  SSRFile,
  Manifest
} from './config'
import type { Plugin } from 'vite'
import electron from './plugin-electron'
import ssr from './plugin-ssr'
import minify from './minify'

export {
  Options,
  Target,
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
