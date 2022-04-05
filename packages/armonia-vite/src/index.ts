import type {
  Options,
  Target,
  ElectronOptions,
  SSRPluginOptions,
  ElectronPackagerOptions,
  ElectronBuilderOptions,
  PackageJson,
  SSRRenderContext,
  Manifest
} from './config'
import type { Plugin } from 'vite'
import electron from './plugin-electron'
import ssr from './plugin-ssr'

export {
  Options,
  Target,
  ElectronOptions,
  SSRPluginOptions,
  ElectronPackagerOptions,
  ElectronBuilderOptions,
  PackageJson,
  Manifest,
  SSRRenderContext as RenderContext
}

export default function armonia(options?: Options): Plugin {
  const target = options?.target || (process.env['ARMONIA_TARGET'] as Target) || 'spa'

  const targets = target.split('-')

  if (targets[0] === 'electron') {
    return electron(options?.electron)
  }

  if (targets[0] === 'ssr') {
    return ssr(options?.ssr)
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
