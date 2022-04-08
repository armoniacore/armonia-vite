import fs from 'fs'
import path from 'path'
import type { InlineConfig } from 'vite'
import { build as viteBuild, mergeConfig } from 'vite'

import { trim } from '../common/trim'
import type { ElectronOptions } from '../config'

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
      'src-electron/electron-main.js'
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
    'src-electron/electron-preload.js'
  ])
}

function resolveUrl(config: InlineConfig): string {
  let url = config.build?.rollupOptions?.input
  if (typeof url !== 'string' || !url.endsWith('.html')) {
    url = 'index.html'
  }

  return url
}

export interface ElectronBuildConfig {
  url?: string
  main?: string
  preload?: string
}

export async function buildElectron(config: InlineConfig, electronConfig?: ElectronBuildConfig, options?: ElectronOptions) {
  const resolvedRoot = config.root ? path.resolve(config.root) : process.cwd()

  const mainEntry = electronConfig?.main || findElectronMain(resolvedRoot)
  const preloadEntry = electronConfig?.preload || findElectronPreload(resolvedRoot)

  // NOTE: entryFileNames will dictate the name of this file
  const mainName = `${path.parse(mainEntry).name}.js`

  const appUrl = electronConfig?.url || resolveUrl(config)
  const preloadUrl = preloadEntry ? `./${path.parse(preloadEntry).name}.js` : false

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
          interop: false, // TODO: this could break for older electron versions
          format: 'cjs',
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        },

        external: [
          'electron',
          // node core modules
          'assert',
          'buffer',
          'child_process',
          'console',
          'cluster',
          'crypto',
          'dgram',
          'dns',
          'events',
          'fs',
          'http',
          'http2',
          'https',
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
          'node:buffer',
          'node:child_process',
          'node:console',
          'node:cluster',
          'node:crypto',
          'node:dgram',
          'node:dns',
          'node:events',
          'node:fs',
          'node:http',
          'node:http2',
          'node:https',
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
