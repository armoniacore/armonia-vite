import type { Configuration as ElectronBuilderConfig } from 'electron-builder'
import type { Options as ElectronPackagerConfig } from 'electron-packager'
import fs from 'fs'
import path from 'path'
import type { RollupWatcher } from 'rollup'
import type { ConfigEnv, Plugin, ResolvedConfig, UserConfig, ViteDevServer } from 'vite'
import { mergeConfig } from 'vite'

import { emitBundle } from '../common/emit_bundle'
import { ok, warn } from '../common/log'
import { resolveAddress } from '../common/resolve_address'
import { buildElectron } from './build'
import type { ElectronProcess } from './electron_process'
import { runElectron } from './electron_process'

export type ElectronBuilderOptions = ElectronBuilderConfig
export type ElectronPackagerOptions = Omit<ElectronPackagerConfig, 'dir' | 'out'>

export interface ElectronOptions {
  /**
   * Electron argv.
   */
  argv?: string[]

  /**
   * Defines the electron main file.
   *
   * @note Omit the file extension to resolve `.js` and `.ts` automatically
   *
   * @default Resolved automatically from:
   * ```js
   *  'electron/main'
   *  'electron/index'
   *  'electron/electron'
   *  'src-electron/main'
   *  'src-electron/index'
   *  'src-electron/electron'
   *  'src-electron/electron-main'
   *  'src/electron'
   *  'src/electron-main'
   * ```
   */
  main?: string

  /**
   * Defines the electron preload file.
   *
   * @note Omit the file extension to resolve `.js` and `.ts` automatically
   *
   * @default Resolved automatically from:
   * ```js
   *  'electron/preload'
   *  'src-electron/preload'
   *  'src-electron/electron-preload'
   *  'src/preload'
   *  'src/electron-preload'
   * ```
   */
  preload?: string

  /**
   * Defines the electron bundler, either `electron-packager` or `electron-builder`.
   *
   * @note Resolved automatically from the package dependencies
   */
  bundler?: 'builder' | 'packager' | false

  /**
   * Defines the configuration for `electron-builder`.
   */
  builder?: ElectronBuilderOptions

  /**
   * Defines the configuration for `electron-packager`.
   */
  packager?: ElectronPackagerOptions

  /**
   * Defines the electron dependencies.
   */
  dependencies?: string[] | Record<string, string>

  /**
   * Dependencies to always exclude.
   */
  excludeDependencies?: string[]

  /**
   * The package.json file location relative the the vite project root.
   */
  packageJson?: string

  /**
   * Fine tune the generated `package.json`
   */
  transformPackageJson?: (pkg: Record<string, any>) => void | Promise<void>

  /**
   * Overwrite the vite config.
   */
  config?: UserConfig
}

type ElectronPackager = (opts: ElectronPackagerConfig) => Promise<string[]>

function createRunner(options?: ElectronOptions) {
  let electron: ElectronProcess | undefined
  let watcher: RollupWatcher | undefined

  return {
    async run(server: ViteDevServer) {
      const resolvedConfig = server.config

      watcher = (await buildElectron(
        {
          configFile: false, // do not load the config file
          mode: resolvedConfig.mode,
          root: resolvedConfig.root,
          build: {
            watch: {},
            minify: false,
            outDir: resolvedConfig.build.outDir
          },
          plugins: [
            {
              name: 'electron-restart',
              async closeBundle() {
                const el = electron
                electron = undefined
                await el?.close()
                electron = await runElectron(resolvedConfig.build.outDir, options?.argv)
              }
            }
          ]
        },
        {
          url: resolveAddress(server).href
        }
      )) as RollupWatcher
    },
    async close() {
      const wt = watcher
      watcher = undefined

      const el = electron
      electron = undefined

      await wt?.close()
      await el?.close()
    }
  }
}

// TODO: electron builder
// ElectronPlatformName = "darwin" | "linux" | "win32" | "mas";
// ArchType = "x64" | "ia32" | "armv7l" | "arm64" | "universal";

export default function electron(options?: ElectronOptions): Plugin {
  const electronManager = createRunner(options)
  let resolvedConfig: ResolvedConfig
  let command: ConfigEnv['command']

  return {
    name: 'vite-plugin-armonia-electron',

    config(_, env) {
      command = env.command

      const electronConfig: UserConfig = {
        define: {
          'import.meta.env.ELECTRON': true
        }
      }

      // critical or we cant build properly
      if (command === 'build' && electronConfig.base === undefined) {
        electronConfig.base = './'
      }

      return mergeConfig(options?.config || {}, electronConfig)
    },

    configResolved(config) {
      resolvedConfig = config

      // electron resolve the path relative to the binary location
      // vite build uses '/' which will result in electron loading index.html and assets from the OS root
      if (command === 'build' && !config.base.startsWith('./')) {
        warn(
          config.logger,
          `config.base must be a relative path when building electron, '${config.base}' provided instead, the output could not work as expected.`
        )
      }
    },

    async configureServer(server) {
      // do not run electron in middleware mode
      if (!server.httpServer) {
        return
      }

      server.httpServer.on('listening', () => {
        electronManager.run(server).catch((error) => {
          server.config.logger.error(error)
        })
      })

      server.httpServer.on('close', () => {
        electronManager.close().catch((error) => {
          server.config.logger.error(error)
        })
      })
    },

    async buildEnd() {
      if (command !== 'build') {
        return
      }

      // notify we are building electron
      ok(resolvedConfig.logger, `building electron assets for ${resolvedConfig.mode}...`)

      const bundle = await buildElectron(
        {
          configFile: false, // do not load the config file
          mode: resolvedConfig.mode,
          root: resolvedConfig.root,
          build: {
            minify: false,
            write: false, // emit manually
            outDir: resolvedConfig.build.outDir
          }
        },
        undefined,
        options
      )

      emitBundle(this, bundle)
    },

    // we need closeBundle and not writeBundle as bundling requires all the files to be written on disk to properly work
    async closeBundle() {
      await electronManager.close()

      if (command !== 'build') {
        return
      }

      if (options?.bundler === false) {
        return
      }

      const dir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir)
      const out = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir, 'dist')

      let packageJson: Record<string, any> = {}

      const packageJsonFile = path.resolve(resolvedConfig.root, options?.packageJson || './package.json')

      if (fs.existsSync(packageJsonFile)) {
        packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'))
      }

      let bundler = options?.bundler

      if (typeof bundler === 'undefined' || bundler == null) {
        if (packageJson.devDependencies && packageJson.devDependencies['electron-builder']) {
          bundler = 'builder'
        } else if (packageJson.devDependencies && packageJson.devDependencies['electron-packager']) {
          bundler = 'packager'
        }
      }

      if (bundler === 'builder') {
        // notify we are bundling electron
        ok(resolvedConfig.logger, `bundling electron with electron-${bundler}...`)

        const { build } = await import('electron-builder')

        const builderOptions = options?.builder || {}

        // TODO: overwrite this
        // builderOptions.win = []
        // builderOptions.mac = []
        // builderOptions.linux = []
        // builderOptions.publish = '' // this is advanced

        await build({
          projectDir: dir,
          config: builderOptions
        })
      } else if (bundler === 'packager') {
        // notify we are bundling electron
        ok(resolvedConfig.logger, `bundling electron with electron-${bundler}...`)

        const electronPackager = (await import('electron-packager')) as unknown as ElectronPackager

        const packagerOptions = options?.packager || {}

        // TODO: overwrite this, can be a string or an array
        // packagerOptions.platform = 'linux'
        // packagerOptions.arch = 'x64'

        await electronPackager({
          ...packagerOptions,
          dir,
          out
        })
      } else {
        warn(resolvedConfig.logger, "no electron bundler found, install either 'electron-builder' or 'electron-packager'")
      }
    }
  }
}
