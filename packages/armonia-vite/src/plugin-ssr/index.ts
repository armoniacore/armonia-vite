import fs from 'fs'
import type { IncomingMessage, ServerResponse } from 'http'
import path from 'path'
import picocolors from 'picocolors'
import type { RollupOutput } from 'rollup'
import type { ConfigEnv, Plugin, ResolvedConfig, SSROptions, UserConfig } from 'vite'
import { build, mergeConfig, send } from 'vite'

import { ok } from '../common/log'
import { trimAny } from '../common/trim'

export type Manifest = Record<string, string[]>

export interface SSRRenderContext<TModule = Record<string, any>> {
  /** The ssr module that has been resolved by vite. */
  ssr: TModule

  /** The server request. */
  req: IncomingMessage

  /** The server response. */
  res: ServerResponse

  /** The html template string. */
  template: string

  /** The ssr manifest. */
  manifest: Manifest
}

export interface SSRPluginOptions {
  serverRoot?: string

  /** Set the default ssr input, will have no effect when build.ssr is used. */
  ssr?: boolean | string

  // /** Defaults to `ssr:manifest` */
  // manifestId?: string

  // /** Defaults to `ssr:template` */
  // templateId?: string

  /**
   * Overwrite the vite config.
   */
  config?: UserConfig & {
    ssr?: SSROptions
  }

  /** true to enable the output of ssr-manifest.json and index.html file */
  writeManifest?: boolean

  transformManifest?: (manifest: Manifest) => Promise<Manifest | void> | Manifest | void

  /**
   * Apply a transformation to the index.html file, note this will run after any vite just before render is called.
   * It will not run when render is called.
   */
  transformTemplate?: (html: string) => Promise<string | void> | string | void

  /**
   * The ssr render function.
   */
  render?: (context: SSRRenderContext) => Promise<string | void> | string | void
}

export interface SSGFile {
  id: string
  code: string
}

export interface SSGOptions {
  serverRoot?: string

  /** Set the default ssr input, will have no effect when build.ssr is used. */
  ssr?: boolean | string

  // /** Defaults to `ssr:manifest` */
  // manifestId?: string

  // /** Defaults to `ssr:template` */
  // templateId?: string

  /**
   * Overwrite the vite config.
   */
  config?: UserConfig & {
    ssr?: SSROptions
  }

  /** true to enable the output of ssr-manifest.json and index.html file */
  writeManifest?: boolean

  transformManifest?: (manifest: Manifest) => Promise<Manifest | void> | Manifest | void

  /**
   * Apply a transformation to the index.html file, note this will run after any vite just before render is called.
   * It will not run when render is called.
   */
  transformTemplate?: (html: string) => Promise<string | void> | string | void

  staticRender?: (ssr: Record<string, any>, config: ResolvedConfig) => Promise<SSGFile[]> | Promise<void> | SSGFile[] | void
}

function resolveSSRModule(config: UserConfig, options?: SSRPluginOptions): string | false | undefined {
  // ssr is explicitly disabled
  if (config.build?.ssr === false) {
    return false
  }

  const ssr = config.build?.ssr || options?.ssr

  // ssr is explicitly disabled
  if (ssr === false) {
    return false
  }

  // ssr has been set
  if (typeof ssr === 'string') {
    return ssr
  }

  const root = config.root ? path.resolve(config.root) : process.cwd()

  if (fs.existsSync(path.resolve(root, 'src/entry-server.ts'))) {
    return 'src/entry-server.ts'
  }

  if (fs.existsSync(path.resolve(root, 'src/entry-server.js'))) {
    return 'src/entry-server.js'
  }

  return undefined
}

function resolveSSRInput(config: ResolvedConfig, options?: SSRPluginOptions): string {
  // get the ssr module
  let ssrInput: unknown = options?.ssr || config.build?.ssr

  // as documented at https://vitejs.dev/config/#build-ssr
  if (ssrInput === true) {
    ssrInput = config.build?.rollupOptions?.input
  }

  if (typeof ssrInput === 'string') {
    return ssrInput
  }

  if (fs.existsSync(path.resolve(config.root, 'src/entry-server.ts'))) {
    return 'src/entry-server.ts'
  }

  // let vite warn the user when the ssr module is not found
  return 'src/entry-server.js'
}

/**
 * The vite ssr plugin, it apply a middleware to the vite dev server that allow development under ssr without leaving vite.
 */
export default function ssr(options: SSRPluginOptions = {}, ssgOptions: SSGOptions | undefined | false): Plugin {
  const SSR_MANIFEST_NAME = /* options?.manifestId || */ 'ssr:manifest'
  const SSR_TEMPLATE_NAME = /* options?.manifestId || */ 'ssr:template'

  if (ssgOptions) {
    if (typeof ssgOptions.serverRoot !== 'undefined') {
      options.serverRoot = ssgOptions.serverRoot
    }
    if (typeof ssgOptions.ssr !== 'undefined') {
      options.ssr = ssgOptions.ssr
    }
    if (typeof ssgOptions.writeManifest !== 'undefined') {
      options.writeManifest = ssgOptions.writeManifest
    }
    if (typeof ssgOptions.transformManifest !== 'undefined') {
      options.transformManifest = ssgOptions.transformManifest
    }
    if (typeof ssgOptions.transformTemplate !== 'undefined') {
      options.transformTemplate = ssgOptions.transformTemplate
    }

    options.config = mergeConfig(options.config || {}, ssgOptions.config || {})
  }

  let resolvedConfig: ResolvedConfig
  let manifestSource: Manifest = {}
  let templateSource = ''
  let command: ConfigEnv['command']
  let mode: ConfigEnv['mode']
  let bundled: RollupOutput | undefined

  async function applyManifestTransformation() {
    let manifest: unknown = await options?.transformManifest?.call(undefined, manifestSource)

    if (typeof manifest === 'string') {
      manifest = JSON.parse(manifest)
    }

    if (manifest && typeof manifest === 'object') {
      // save the manifest
      manifestSource = manifest as Manifest
    }
  }

  async function applyTemplateTransformation() {
    const template: unknown = await options?.transformTemplate?.call(undefined, templateSource)

    if (typeof template === 'string') {
      // save the template
      templateSource = template
    }
  }

  return {
    name: 'vite-plugin-armonia-ssr',
    enforce: 'post',

    config(config, env) {
      command = env.command
      mode = env.mode

      if (env.mode !== 'production' || env.command !== 'build') {
        // run only on production build SSR
        return options?.config
      }

      const ssr = resolveSSRModule(config, options)

      // ssr is explicitly disabled
      if (ssr === false) {
        return
      }

      let ssrConfig: UserConfig = {
        // this config will reset some common vite spa config
        // we do not need them in ssr most of the time
        build: {
          // do not minify server side code
          minify: false,

          // this will preserve the original file name
          rollupOptions: {
            output: {
              // format: 'esm',
              entryFileNames: '[name].js'
            }
          }
        }
      }

      // prepare the config
      ssrConfig = mergeConfig(ssrConfig, options?.config || {})

      // the client will do this
      ssrConfig.publicDir = false

      // force ssr build
      if (typeof ssr === 'string') {
        if (ssrConfig.build) {
          ssrConfig.build.ssr = ssr
        } else {
          ssrConfig.build = { ssr }
        }
      }

      return ssrConfig
    },

    configResolved(config) {
      resolvedConfig = config

      if (command === 'build' && typeof resolvedConfig.build.ssr === 'string') {
        ok(config.logger, `building SSR bundle for ${mode}...`)
      }
    },

    transformIndexHtml: {
      // enforce: 'post' will make sure we get
      // the most "recent" html version
      enforce: 'post',

      transform(html) {
        templateSource = html || ''
      }
    },

    resolveId(source) {
      return source === SSR_MANIFEST_NAME || source === SSR_TEMPLATE_NAME ? source : undefined
    },

    load(id): string | undefined {
      // load the manifest
      if (id === SSR_MANIFEST_NAME) {
        // await applyManifestTransformation()

        return `export default ${JSON.stringify(manifestSource, null, 2)}`
      }

      // load the template
      if (id === SSR_TEMPLATE_NAME) {
        // await applyTemplateTransformation()

        return `export default ${JSON.stringify(templateSource)}`
      }

      return undefined
    },

    configureServer(server) {
      const ssrModule = resolveSSRInput(server.config, options)

      // let vite warn the user when the ssr module is not found

      // see: https://vitejs.dev/guide/api-plugin.html#configureserver
      // runs after internal middlewares are installed
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (res.writableEnded) {
            return next()
          }

          // get only the path, without query or fragment
          const url = req.url && req.url.replace(/#.*$/s, '').replace(/\?.*$/s, '')

          if (url?.endsWith('.html') && req.headers['sec-fetch-dest'] !== 'script') {
            const filename = decodeURIComponent(path.join(server.config.root, url.slice(1)))

            if (fs.existsSync(filename)) {
              try {
                // read the index html file
                let template = fs.readFileSync(filename, 'utf8')

                // transform the index html file
                template = await server.transformIndexHtml(url, template, req.originalUrl)

                // set the template source
                templateSource = template

                // transform the template
                await applyTemplateTransformation()

                // set the template
                template = templateSource

                // load the ssr module
                const ssr = await server.ssrLoadModule(ssrModule)

                let renderedTemplate

                // render the html page
                if (options?.render) {
                  renderedTemplate = await options.render({
                    ssr,
                    req,
                    res,
                    template,
                    manifest: manifestSource
                  })
                } else {
                  renderedTemplate = ssr.renderVite
                    ? await ssr.renderVite(req.originalUrl, template, {})
                    : // the default renderer, it assumes an export named 'render'
                      await ssr.render(req, res, template, {})
                }

                // do not modify the template source
                template = typeof renderedTemplate === 'string' ? renderedTemplate : template

                // send back the rendered page
                if (typeof renderedTemplate === 'string') {
                  return send(req, res, template, 'html', {
                    headers: server.config.server.headers || {}
                  })
                }
              } catch (error) {
                return next(error)
              }
            }
          }

          next()
        })
      }
    },

    async buildStart() {
      if (typeof resolvedConfig.build.ssr !== 'string') {
        return
      }

      ok(resolvedConfig.logger, `generating the SSR target...`)

      bundled = (await build({
        configFile: resolvedConfig.configFile || false,
        build: {
          write: false,
          ssr: false,
          ssrManifest: true
        }
      })) as RollupOutput

      const ssrManifestFileName =
        typeof resolvedConfig.build.ssrManifest === 'string' ? resolvedConfig.build.ssrManifest : 'ssr-manifest.json'

      for (const chunk of bundled.output) {
        if (chunk.type === 'asset' && chunk.fileName === ssrManifestFileName) {
          manifestSource = JSON.parse(chunk.source as string)
          await applyManifestTransformation()
          continue
        }

        if (chunk.type === 'asset' && chunk.fileName === 'index.html') {
          templateSource = chunk.source as string
          await applyTemplateTransformation()
        }
      }
    },

    generateBundle() {
      if (!bundled) {
        return
      }

      const serverRoot = trimAny(options?.serverRoot || 'www', ['.', '/', '\\']) || 'www'

      const ssrManifestFileName =
        typeof resolvedConfig.build.ssrManifest === 'string' ? resolvedConfig.build.ssrManifest : 'ssr-manifest.json'

      const templateFileName =
        typeof resolvedConfig.build.rollupOptions.input === 'string' ? resolvedConfig.build.rollupOptions.input : 'index.html'

      for (const chunk of bundled.output) {
        if (chunk.type === 'asset' && (chunk.fileName === ssrManifestFileName || chunk.fileName === templateFileName)) {
          if (options?.writeManifest === true) {
            this.emitFile({
              type: 'asset',
              fileName: chunk.fileName,
              source: chunk.source
            })
          }

          continue
        }

        if (chunk.type === 'asset') {
          this.emitFile({
            type: 'asset',
            fileName: `${serverRoot}/${chunk.fileName}`,
            source: chunk.source
          })
        }

        if (chunk.type === 'chunk') {
          this.emitFile({
            type: 'asset',
            fileName: `${serverRoot}/${chunk.fileName}`,
            source: chunk.code
          })
        }
      }
    },

    async writeBundle(_, bundle) {
      if (command !== 'build' || typeof resolvedConfig.build.ssr !== 'string') {
        return
      }

      if (ssgOptions === false) {
        return
      }

      const serverRoot = trimAny(options?.serverRoot || 'www', ['.', '/', '\\']) || 'www'

      const rootDir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir)

      // eslint-disable-next-line unicorn/prefer-module
      const ssr = require(path.resolve(resolvedConfig.root, resolvedConfig.build.outDir, Object.keys(bundle)[0]!))

      const files = await ssgOptions?.staticRender?.call(undefined, ssr, resolvedConfig)

      if (files) {
        for (const file of files) {
          const fileName = `${serverRoot}/${trimAny(file.id, ['.', '/', '\\'])}`
          const source = file.code

          this.emitFile({
            type: 'asset',
            fileName,
            source
          })

          const filePath = path.join(rootDir, fileName)

          if (path.relative(rootDir, filePath)) {
            fs.writeFileSync(filePath, source, 'utf8')
            resolvedConfig.logger.info(`${resolvedConfig.build.outDir}/${picocolors.green(fileName)}`)
          }
        }
      }
    }
  }
}
