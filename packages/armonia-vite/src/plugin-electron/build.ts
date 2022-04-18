import fs from 'fs'
import path from 'path'
import type { InlineConfig, Plugin } from 'vite'
import { mergeConfig } from 'vite'

import { trim } from '../common/trim'
import type { ResolvedElectronOptions } from './index'

async function normalizePackageJson(pkg: Record<string, any>, options?: ResolvedElectronOptions) {
  pkg.main = options?.main

  const pkgDeps: Record<string, string> = pkg.dependencies || {}
  const pkgDevDeps: Record<string, string> = pkg.devDependencies || {}

  const resolvedDependencies: Record<string, string> = {}

  if (options?.dependencies) {
    if (Array.isArray(options.dependencies)) {
      for (const dep of options.dependencies) {
        if (pkgDeps[dep]) {
          resolvedDependencies[dep] = pkgDeps[dep] as string
        }

        if (pkgDevDeps[dep]) {
          resolvedDependencies[dep] = pkgDevDeps[dep] as string
        }

        if (pkgDeps[dep]) {
          resolvedDependencies[dep] = pkgDeps[dep] as string
        }
      }
    } else {
      Object.assign(resolvedDependencies, options.dependencies)
    }
  }

  if (options?.excludeDependencies) {
    const keys = Array.isArray(options.excludeDependencies) ? options.excludeDependencies : Object.keys(options.excludeDependencies)

    for (const dep of keys) {
      delete resolvedDependencies[dep]
    }
  }

  pkg.dependencies = resolvedDependencies

  delete pkg.scripts

  // HACK: this is wrong
  delete pkg.dependencies.vue
  delete pkg.dependencies['vue-router']
  delete pkg.dependencies['vuex']
  delete pkg.dependencies['react']
  delete pkg.dependencies['redux']

  const devElectron = pkg.devDependencies?.electron

  delete pkg.devDependencies

  // HACK: this is wrong, its a fix for electron-builder
  if (devElectron) {
    pkg.devDependencies = {}
    pkg.devDependencies.electron = trim(devElectron, '^')
  }

  await options?.transformPackageJson?.call(undefined, pkg)
}

type TransformPackageJson = ResolvedElectronOptions['transformPackageJson']

function emitPackageJsonPlugin(options: ResolvedElectronOptions, transformPackageJson: TransformPackageJson): Plugin {
  const packageJsonId = './package.json'

  return {
    name: 'armonia:electron-resolve-package-json',

    buildStart() {
      this.addWatchFile(packageJsonId)
    },

    async generateBundle() {
      // TODO: provide a way to resolve package.json manually
      const resolved = await this.resolve(packageJsonId)

      let pkg: Record<string, any> = {}

      if (resolved) {
        try {
          // TODO: get rid of `fs`, as right now, this is not possible
          if (fs.existsSync(resolved.id)) {
            pkg = JSON.parse(fs.readFileSync(resolved.id, 'utf8'))
          }
        } catch (error) {
          this.warn({
            id: packageJsonId,
            message: 'Could not parse package.json file'
          })
        }
      }

      await normalizePackageJson(pkg, options)

      await transformPackageJson?.call(undefined, pkg)

      // emit the file
      this.emitFile({
        type: 'asset',
        name: 'package.json',
        source: JSON.stringify(pkg, null, 2)
      })
    }
  }
}

interface ElectronBuildConfig {
  url?: string
}

export function resolveElectronConfig(config: ResolvedElectronOptions, extra?: ElectronBuildConfig): InlineConfig {
  if (!config.main) {
    throw new Error(`armonia-electron: electron.main is not defined`)
  }

  // NOTE: check: rollupOptions.output.entryFileNames
  const main = `${path.parse(config.main).name}.js`
  const preload = config.preload ? `./${path.parse(config.preload).name}.js` : undefined

  const electronConfig: InlineConfig = {
    configFile: false,
    publicDir: false,
    root: config.root,
    mode: config.mode,

    // ok what is this?
    customLogger: config._resolvedConfig.logger,

    define: {
      'import.meta.env.ELECTRON': true,
      'import.meta.env.ELECTRON_APP_URL': extra?.url ? JSON.stringify(extra?.url) : JSON.stringify(main),
      'import.meta.env.ELECTRON_PRELOAD_URL': preload ? JSON.stringify(preload) : 'undefined'
    },

    build: {
      outDir: config.outDir,
      ssr: true,

      // TODO: this should be configurable somehow
      // minify: false,

      rollupOptions: {
        input: config.preload ? [config.main, config.preload] : [config.main],

        // TODO: this should be configurable somehow
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        }
      }
    },

    plugins: [
      emitPackageJsonPlugin(config, (pkg) => {
        pkg.main = main
      })
    ]
  }

  return mergeConfig(config.electronConfig || {}, electronConfig)
}
