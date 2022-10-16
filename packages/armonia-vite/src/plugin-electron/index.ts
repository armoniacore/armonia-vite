import type { Configuration as ElectronBuilderConfig } from 'electron-builder'
import type { Options as ElectronPackagerConfig } from 'electron-packager'
import fs from 'node:fs'
import path from 'node:path'
import type { RollupWatcher } from 'rollup'
import type { ConfigEnv, Plugin, ResolvedConfig, SSROptions, UserConfig, ViteDevServer } from 'vite'
import { build, loadConfigFromFile, mergeConfig, normalizePath } from 'vite'

import { emitBundle } from '../common/emit_bundle'
import { ok, warn } from '../common/log'
import { resolveAddress } from '../common/resolve_address'
import { resolveElectronConfig } from './build'
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
   * Defines the electron main file, relative to the project root.
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
   * Defines the electron preload file, relative to the project root.
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
  excludeDependencies?: string[] | Record<string, string>

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

  /**
   * Overwrite the vite config for electron.
   */
  electronConfig?: UserConfig & {
    ssr?: SSROptions
  }
}

type ElectronPackager = (opts: ElectronPackagerConfig) => Promise<string[]>

function createManager() {
  let electron: ElectronProcess | undefined
  let watcher: RollupWatcher | undefined

  return {
    async run(server: ViteDevServer, options: ResolvedElectronOptions) {
      const url = resolveAddress(server).href

      const config = resolveElectronConfig(options, {
        url
      })

      const bundle = await build(
        mergeConfig(config, {
          build: {
            watch: {}
          },
          plugins: [
            {
              name: 'electron-restart',
              async closeBundle() {
                const el = electron
                electron = undefined

                ok(server.config.logger, 'restarting electron...')

                await el?.close()
                electron = await runElectron(options.outDir, options?.argv)
              }
            }
          ]
        })
      )

      watcher = bundle as unknown as RollupWatcher
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

function resolveFileEntry(root: string, file: string | undefined, locations: string[]): string | false {
  if (file) {
    locations = [file]
  }

  for (const location of locations) {
    // get the full path
    const fileName = path.resolve(root, location)

    // get the file extension, if any
    const { ext } = path.parse(fileName)

    // no extension, guess it
    if (ext === '') {
      // typescript
      if (fs.existsSync(`${fileName}.ts`)) {
        return path.relative(root, `${fileName}.ts`)
      }

      // javascript
      if (fs.existsSync(`${fileName}.js`)) {
        return path.relative(root, `${fileName}.js`)
      }
    } else {
      if (fs.existsSync(fileName)) {
        return path.relative(root, fileName)
      }
    }
  }

  return false
}

export interface ResolvedElectronOptions extends ElectronOptions {
  root: string
  outDir: string
  mode: ConfigEnv['mode']
  /** @private  */
  _resolvedConfig: ResolvedConfig
}

async function resolveElectronOptions(
  env: ConfigEnv,
  resolvedConfig: ResolvedConfig,
  options?: ElectronOptions
): Promise<ResolvedElectronOptions> {
  const root = resolvedConfig.root

  let main =
    resolveFileEntry(root, options?.main, [
      'electron/main',
      'electron/index',
      'electron/electron',
      //
      'src-electron/main',
      'src-electron/index',
      'src-electron/electron',
      'src-electron/electron-main',
      //
      'src/electron',
      'src/electron-main'
    ]) || undefined

  if (main) {
    main = normalizePath(path.relative(root, path.resolve(root, main)))
  }

  let preload =
    resolveFileEntry(root, options?.preload, [
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
    ]) || undefined

  if (preload) {
    preload = normalizePath(path.relative(root, path.resolve(root, preload)))
  }

  // package.json
  const packageJsonFile = path.resolve(root, options?.packageJson || 'package.json')
  let packageJson = fs.existsSync(packageJsonFile) ? packageJsonFile : undefined

  if (packageJson) {
    packageJson = normalizePath(path.relative(root, path.resolve(root, packageJson)))
  }

  // user config
  let config = options?.config

  if (typeof config === 'string') {
    const overwriteConfig = await loadConfigFromFile(env, config, undefined, resolvedConfig.logLevel)

    config = overwriteConfig ? overwriteConfig.config : undefined
  }

  // bundler
  let bundler = options?.bundler

  if ((bundler === undefined || bundler == null) && packageJson) {
    // TODO: consider using: require.resolve('electron-builder') instead of package.json
    const jsonPackage = JSON.parse(fs.readFileSync(path.resolve(root, packageJson), 'utf8'))

    if (jsonPackage.devDependencies && jsonPackage.devDependencies['electron-builder']) {
      bundler = 'builder'
    } else if (jsonPackage.devDependencies && jsonPackage.devDependencies['electron-packager']) {
      bundler = 'packager'
    }
  }

  const resolvedElectronOptions: ResolvedElectronOptions = {
    root,
    outDir: resolvedConfig.build.outDir,
    mode: resolvedConfig.mode,
    // this field will be removed
    _resolvedConfig: resolvedConfig
  }

  // this is temporary, i want to rewrite this piece of code eventually
  return Object.assign(resolvedElectronOptions, {
    main,
    preload,
    packageJson,
    config,
    bundler,
    builder: options?.builder,
    packager: options?.packager,
    dependencies: options?.dependencies,
    excludeDependencies: options?.excludeDependencies,
    transformPackageJson: options?.transformPackageJson,
    electronConfig: options?.electronConfig,
    argv: options?.argv
  }) as ResolvedElectronOptions
}

export default function electron(options?: ElectronOptions): Plugin {
  const electronManager = createManager()
  let resolvedConfig: ResolvedConfig
  let resolvedElectronOptions: ResolvedElectronOptions
  let command: ConfigEnv['command']
  let env: ConfigEnv

  return {
    name: 'armonia:vite-plugin-electron',

    config(_, envConfig) {
      env = envConfig
      command = envConfig.command

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

    async configResolved(config) {
      resolvedConfig = config

      // resolve the electron options
      resolvedElectronOptions = await resolveElectronOptions(env, config)

      // throw if we do not have a main input file
      if (!resolvedElectronOptions.main) {
        throw new Error(`armonia-electron: electron.main is not defined`)
      }

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
        electronManager.run(server, resolvedElectronOptions).catch((error) => {
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

      const electronBuildConfig = resolveElectronConfig(resolvedElectronOptions)

      const bundle = await build(
        mergeConfig(electronBuildConfig, {
          build: {
            write: false // emit manually
          }
        })
      )

      emitBundle(this as any, bundle as any)
    },

    // we need closeBundle and not writeBundle as bundling requires all the files to be written on disk to properly work
    async closeBundle() {
      await electronManager.close()

      // forcefully bundle only on build
      if (command !== 'build') {
        return
      }

      // bundling is disabled
      if (resolvedElectronOptions?.bundler === false) {
        return
      }

      const dir = path.resolve(resolvedElectronOptions.root, resolvedElectronOptions.outDir)
      const out = path.resolve(resolvedElectronOptions.root, resolvedElectronOptions.outDir, 'dist')

      const bundler = resolvedElectronOptions.bundler

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
