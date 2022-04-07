import fs from 'fs'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'http'
import type { Plugin, ResolvedConfig, UserConfig, ConfigEnv, SSROptions } from 'vite'
import { mergeConfig, send, build } from 'vite'
import { ok } from '../common/log'
import type { RollupOutput } from 'rollup'
import { trimAny } from '../common/trim'

export type Manifest = Record<string, string[]>

export interface SSRRenderContext<TModule = any> {
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

export interface SSRFile {
  id: string
  code: string
}

export interface SSRPluginOptions {
  serverRoot?: string

  ssg?: boolean

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
  render?: <TModule = any>(context: SSRRenderContext<TModule>) => Promise<string | void> | string | void

  staticRender?: <TModule = any>(ssr: TModule, config: ResolvedConfig) => Promise<SSRFile[]> | Promise<void> | SSRFile[] | void
}

/**
 * The vite ssr plugin, it apply a middleware to the vite dev server that allow development under ssr without leaving vite.
 */
export default function ssr(options?: SSRPluginOptions): Plugin {
  const SSR_MANIFEST_NAME = /* options?.manifestId || */ 'ssr:manifest'
  const SSR_TEMPLATE_NAME = /* options?.manifestId || */ 'ssr:template'

  let generateSSRBuild = false
  let resolvedConfig: ResolvedConfig
  let manifestSource: Manifest = {}
  let templateSource = ''
  let mode: ConfigEnv['mode']

  let bundled: RollupOutput | undefined = undefined

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
      mode = env.mode

      if (options?.config === false) {
        return
      }

      if (env.mode !== 'production' || env.command !== 'build') {
        // run only on production build SSR
        return options?.config
      }

      // ssr is explicitly disabled
      if (config.build?.ssr === false) {
        return
      }

      let ssr1 = config.build?.ssr || options?.ssr

      // ssr is explicitly disabled
      if (ssr1 === false) {
        return
      }

      if (!ssr1) {
        const root = config.root || process.cwd()

        if (fs.existsSync(path.resolve(root, 'src/entry-server.ts'))) {
          ssr1 = 'src/entry-server.ts'
        }

        if (fs.existsSync(path.resolve(root, 'src/entry-server.js'))) {
          ssr1 = 'src/entry-server.js'
        }
      }

      if (!ssr1) {
        return
      }

      generateSSRBuild = true

      let ssrConfig: UserConfig = {
        // this config will reset some common vite spa config
        // we do not need them in ssr most of the time
        build: {
          ssr: ssr1,

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

      return ssrConfig
    },

    configResolved(config) {
      resolvedConfig = config

      if (generateSSRBuild) {
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
      if (source === SSR_MANIFEST_NAME || source === SSR_TEMPLATE_NAME) {
        return source
      }

      return undefined
    },

    load(id) {
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
      // get the ssr module
      let ssrInput: unknown = options?.ssr || server.config.build?.ssr

      // as documented at https://vitejs.dev/config/#build-ssr
      if (ssrInput === true) {
        ssrInput = server.config.build?.rollupOptions?.input
      }

      let ssrModule = 'src/entry-server.js'

      if (typeof ssrInput === 'string') {
        ssrModule = ssrInput
      } else if (fs.existsSync(path.resolve(server.config.root, 'src/entry-server.ts'))) {
        ssrModule = 'src/entry-server.ts'
      }

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
                let template = fs.readFileSync(filename, 'utf-8')

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
                  if (ssr.renderVite) {
                    renderedTemplate = await ssr.renderVite(req.originalUrl, template, {})
                  } else {
                    // the default renderer, it assumes an export named 'render'
                    renderedTemplate = await ssr.render(req, res, template, {})
                  }
                }

                // do not modify the template source
                template = typeof renderedTemplate === 'string' ? renderedTemplate : template

                // send back the rendered page
                if (typeof renderedTemplate === 'string') {
                  return send(req, res, template, 'html', {
                    headers: server.config.server.headers || {}
                  })
                }
              } catch (e) {
                return next(e)
              }
            }
          }

          next()
        })
      }
    },

    async buildStart() {
      if (!generateSSRBuild) {
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
          continue
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

    async closeBundle() {
      if (!generateSSRBuild) {
        return
      }

      if (options?.ssg !== true) {
        return
      }

      const outDir = path.resolve(
        // resolve the out dir from the config
        path.resolve(resolvedConfig.root, resolvedConfig.build.outDir),

        // use the public directory name as the out dir
        path.basename(/*options?.clientDir || resolvedConfig.publicDir ||*/ 'www')
      )

      // get the ssr module
      let ssrInput: unknown = options?.ssr || resolvedConfig.build?.ssr

      // as documented at https://vitejs.dev/config/#build-ssr
      if (ssrInput === true) {
        ssrInput = resolvedConfig.build?.rollupOptions?.input
      }

      if (typeof ssrInput === 'string') {
        ssrInput = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir, `${path.parse(ssrInput).name}.js`)
      }

      if (typeof ssrInput === 'string') {
        const ssrEntryPath = path.resolve(resolvedConfig.root, ssrInput)

        if (fs.existsSync(ssrEntryPath)) {
          const ssr = require(ssrEntryPath)

          const files = await options?.staticRender?.call(undefined, ssr, resolvedConfig)
          if (files) {
            for (const file of files) {
              const id = file.id
              const html = file.code

              fs.writeFileSync(path.join(outDir, id), html, 'utf-8')
            }
          }
        }
      }
    }
  }
}
