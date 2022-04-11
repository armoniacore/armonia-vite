import fs from 'fs'
import path from 'path'
import type { InlineConfig } from 'vite'
import { build as viteBuild, mergeConfig } from 'vite'

import { trim } from '../common/trim'

function locate(root: string, locations: string[]) {
  for (const location of locations) {
    if (fs.existsSync(path.resolve(root, location))) {
      return location
    }
  }

  return false
}

function findElectronMain(root: string) {
  return (
    locate(root, [
      'electron/main.ts',
      'electron/main.js',
      'electron/index.ts',
      'electron/index.js',
      'electron/electron.ts',
      'electron/electron.js',
      //
      'src-electron/main.ts',
      'src-electron/main.js',
      'src-electron/index.ts',
      'src-electron/index.js',
      'src-electron/electron.ts',
      'src-electron/electron.js',
      'src-electron/electron-main.ts',
      'src-electron/electron-main.js',
      //
      'src/electron.ts',
      'src/electron.js',
      'src/electron-main.ts',
      'src/electron-main.js'
    ]) || 'src/electron.js'
  )
}

function findElectronPreload(root: string) {
  return locate(root, [
    'electron/preload.ts',
    'electron/preload.js',
    //
    'src-electron/preload.ts',
    'src-electron/preload.js',
    'src-electron/electron-preload.ts',
    'src-electron/electron-preload.js',
    //
    'src/preload.ts',
    'src/preload.js',
    'src/electron-preload.ts',
    'src/electron-preload.js'
  ])
}

function resolveUrl(config: InlineConfig): string {
  let url = config.build?.rollupOptions?.input
  if (typeof url !== 'string' || !url.endsWith('.html')) {
    url = 'index.html'
  }

  return url
}

interface ElectronBuildConfig {
  url?: string
  main?: string
  preload?: string
}

interface ExtraOptions {
  transformPackageJson?: (pkg: Record<string, any>) => void | Promise<void>
}

export async function buildElectron(config: InlineConfig, electronConfig?: ElectronBuildConfig, options?: ExtraOptions) {
  const resolvedRoot = config.root ? path.resolve(config.root) : process.cwd()

  const mainEntry = electronConfig?.main || findElectronMain(resolvedRoot)
  const preloadEntry = electronConfig?.preload || findElectronPreload(resolvedRoot)

  // NOTE: entryFileNames will dictate the name of this file
  const mainName = `${path.parse(mainEntry).name}.js`

  const appUrl = electronConfig?.url || resolveUrl(config)
  const preloadUrl = preloadEntry ? `./${path.parse(preloadEntry).name}.js` : false

  const external: string[] = []

  if (fs.existsSync(path.resolve(resolvedRoot, 'package.json'))) {
    const packageJson = JSON.parse(fs.readFileSync(path.resolve(resolvedRoot, 'package.json'), 'utf8'))

    if (packageJson.dependencies) {
      external.push(...Object.keys(packageJson.dependencies))
    }

    // if (packageJson.devDependencies) {
    //   external.push(...Object.keys(packageJson.devDependencies))
    // }
  }

  const buildConfig = mergeConfig(config, {
    configFile: false, // TODO: we do not allow the user to reference a config file
    publicDir: false,

    define: {
      'import.meta.env.ELECTRON': true,
      'import.meta.env.ELECTRON_APP_URL': JSON.stringify(appUrl),
      'import.meta.env.ELECTRON_PRELOAD_URL': preloadUrl ? JSON.stringify(preloadUrl) : 'undefined'
    },

    build: {
      rollupOptions: {
        input: preloadEntry ? [mainEntry, preloadEntry] : [mainEntry],

        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        },

        // TODO: this looks more like an hack than an actual smart way to go about it
        external: [
          ...external,

          'electron',

          // node core modules
          'assert',
          'async_hooks',
          'buffer',
          'child_process',
          'cluster',
          'console',
          'crypto',
          'dgram',
          'dns',
          'events',
          'fs',
          'fs/promises',
          'http',
          'http2',
          'https',
          'inspector',
          'module',
          'net',
          'os',
          'path',
          'perf_hooks',
          'process',
          'querystring',
          'readline',
          'repl',
          'stream',
          'string_decoder',
          'timers',
          'tls',
          'tty',
          'url',
          'util',
          'v8',
          'vm',
          'wasi',
          'worker',
          'zlib',

          // for node 16
          'node:assert',
          'node:async_hooks',
          'node:buffer',
          'node:child_process',
          'node:cluster',
          'node:console',
          'node:crypto',
          'node:dgram',
          'node:dns',
          'node:events',
          'node:fs',
          'node:fs/promises',
          'node:http',
          'node:http2',
          'node:https',
          'node:inspector',
          'node:module',
          'node:net',
          'node:os',
          'node:path',
          'node:perf_hooks',
          'node:process',
          'node:querystring',
          'node:readline',
          'node:repl',
          'node:stream',
          'node:string_decoder',
          'node:timers',
          'node:tls',
          'node:tty',
          'node:url',
          'node:util',
          'node:v8',
          'node:vm',
          'node:wasi',
          'node:worker',
          'node:zlib'
        ]
      }
    },

    plugins: [
      // {
      //   name: 'electron-external',
      //   resolveId(source, importer) {
      //     if (importer && ['.', '/', '\\'].some((id) => source.startsWith(id))) {
      //       return {
      //         id: source,
      //         external: true,
      //         moduleSideEffects: true
      //       }
      //     }

      //     return null
      //   }
      // },
      {
        name: 'electron-resolve-package-json',

        buildStart() {
          this.addWatchFile('./package.json')
        },

        async buildEnd() {
          // TODO: provide a way to resolve package.json manually
          const resolved = await this.resolve('./package.json')

          let pkg: any = {}

          if (resolved) {
            try {
              // TODO: get rid of `fs`, as right now, this is not possible
              if (fs.existsSync(resolved.id)) {
                pkg = JSON.parse(fs.readFileSync(resolved.id, 'utf8'))
              }
            } catch (error) {
              const message = 'Could not parse package.json file'
              this.warn({ message, id: './package.json' })
            }
          }

          pkg.main = mainName

          // use this as a configuration object instead
          // const configDependencies: string[] | Record<string, string> = {}

          // HACK: this is wrong
          delete pkg.dependencies.vue
          delete pkg.dependencies['vue-router']
          delete pkg.dependencies['vuex']
          delete pkg.dependencies['react']
          delete pkg.dependencies['redux']

          // HACK: this is wrong, its a fix for electron-builder
          if (pkg.devDependencies?.electron) {
            pkg.devDependencies.electron = trim(pkg.devDependencies.electron, '^')
          }

          if (options?.transformPackageJson) {
            await options?.transformPackageJson(pkg)
          }

          // emit the file
          this.emitFile({
            type: 'asset',
            name: 'package.json',
            source: JSON.stringify(pkg, null, 2) // TODO: allow customizations? the dev could write a plugin for cleanup
          })
        }
      }
    ]
  } as InlineConfig)

  return await viteBuild(buildConfig)
}
