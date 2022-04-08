import type { Options as ElectronPackagerConfig } from 'electron-packager'
import fs from 'fs'
import path from 'path'
import type { RollupWatcher } from 'rollup'
import type { ConfigEnv, Plugin, ResolvedConfig, UserConfig, ViteDevServer } from 'vite'
import { mergeConfig } from 'vite'

import { emitBundle } from '../common/emit_bundle'
import { ok, warn } from '../common/log'
import { resolveAddress } from '../common/resolve_address'
import type { ElectronOptions } from '../config'
import { buildElectron } from './build'
import type { ElectronProcess } from './run'
import { runElectron } from './run'

export { type ElectronBuilderOptions, type ElectronOptions, type ElectronPackagerOptions, type PackageJson } from '../config'

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
      if (command === 'build') {
        electronConfig.base = './'
      }

      return mergeConfig(options?.config || {}, electronConfig)
    },

    configResolved(config) {
      resolvedConfig = config

      if (
        command === 'build' && // electron resolve the path relative to the file system
        // vite build uses / which will result in electron loading index.html and assets from the OS root
        config.base !== './'
      ) {
        warn(
          config.logger,
          `config.base must be './' when building electron, '${config.base}' provided instead, the output could not work as expected.`
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

    async closeBundle() {
      await electronManager.close()

      if (command !== 'build') {
        return
      }

      if (options?.bundler === false) {
        return
      }

      let packageJson: Record<string, any> = {}

      const packageJsonFile = path.resolve(resolvedConfig.root, options?.packageJson || './package.json')
      if (fs.existsSync(packageJsonFile)) {
        packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'))
      }

      const dir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir)
      const out = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir, 'dist')

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

        await build({
          projectDir: dir,
          config: builderOptions
        })
      } else if (bundler === 'packager') {
        // notify we are bundling electron
        ok(resolvedConfig.logger, `bundling electron with electron-${bundler}...`)

        const electronPackager = (await import('electron-packager')) as unknown as ElectronPackager

        const packagerOptions = options?.packager || {}

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
