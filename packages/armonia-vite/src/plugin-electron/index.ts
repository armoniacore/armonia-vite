import fs from 'fs'
import path from 'path'
import picocolors from 'picocolors'
import type { PluginContext, RollupOutput, RollupWatcher } from 'rollup'
import type { ConfigEnv, Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import { buildElectron } from './build'
import type { ElectronProcess } from './run'
import { runElectron } from './run'
import type { Options as ElectronPackagerConfig } from 'electron-packager'
import type { PackageJson, ElectronOptions, ElectronPackagerOptions, ElectronBuilderOptions } from '../config'

export { PackageJson, ElectronOptions, ElectronPackagerOptions, ElectronBuilderOptions }

type ElectronPackager = (opts: ElectronPackagerConfig) => Promise<string[]>

function resolveAddress(server: ViteDevServer): URL {
  const address = server.httpServer?.address()

  if (address) {
    // string address
    if (typeof address === 'string') {
      return new URL(address)
    }

    const host = address.address === '127.0.0.1' ? 'localhost' : address.address

    return new URL(`http://${host}:${address.port}`)
  }

  const port = server.config.server.port || 3000

  return new URL(`http://localhost:${port}`)
}

type Bundle = RollupOutput | RollupOutput[] | RollupWatcher

function emitBundle(ctx: PluginContext, bundle: Bundle) {
  function emit(bundle: Bundle): RollupOutput[] {
    if (Array.isArray(bundle)) {
      return bundle
    }

    if (bundle && Array.isArray((bundle as unknown as RollupOutput).output)) {
      return [bundle as unknown as RollupOutput]
    }

    return []
  }

  for (const { output } of emit(bundle)) {
    for (const chunk of output) {
      if (chunk.type === 'asset') {
        ctx.emitFile({
          type: 'asset',
          fileName: chunk.fileName,
          source: chunk.source
        })
      }

      if (chunk.type === 'chunk') {
        ctx.emitFile({
          type: 'asset',
          fileName: chunk.fileName,
          source: chunk.code
        })
      }
    }
  }
}

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

      if (command === 'build') {
        return {
          base: './' // critical or we cant build properly
        }
      }

      return undefined
    },

    configResolved(config) {
      if (command === 'build') {
        // electron resolve the path relative to the file system
        // vite build uses / which will result in electron loading index.html and assets from the OS root
        if (config.base !== './') {
          config.logger.warn(
            picocolors.yellow(
              `config.base must be './' when building electron, '${config.base}' provided instead, the output could not work as expected.`
            )
          )
        }
      }

      resolvedConfig = config
    },

    async configureServer(server) {
      // do not run electron in middleware mode
      if (!server.httpServer) {
        return
      }

      server.httpServer.on('listening', () => {
        electronManager.run(server).catch((err) => {
          server.config.logger.error(err)
        })
      })

      server.httpServer.on('close', () => {
        electronManager.close().catch((err) => {
          server.config.logger.error(err)
        })
      })
    },

    async buildEnd() {
      if (command !== 'build') {
        return
      }

      // TODO: colors are confusing, we use the same color as vite and that can cause confusions when reading the output
      resolvedConfig.logger.info(
        `\n\n${picocolors.cyan('armonia')} ${picocolors.green(`building electron for ${resolvedConfig.mode}...`)}\n`
      )

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

      let packageJson: Record<string, any> = {}

      const packageJsonFile = path.resolve(resolvedConfig.root, options?.packageJson || './package.json')
      if (fs.existsSync(packageJsonFile)) {
        packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8'))
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
        const { build } = await import('electron-builder')

        const builderOptions = options?.builder || {}

        await build({
          projectDir: dir,
          config: builderOptions
        })
      }

      if (bundler === 'packager') {
        const electronPackager = (await import('electron-packager')) as unknown as ElectronPackager

        const packagerOptions = options?.packager || {}

        await electronPackager({
          ...packagerOptions,
          dir,
          out
        })
      }
    }
  }
}
