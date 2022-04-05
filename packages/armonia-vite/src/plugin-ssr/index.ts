import fs from 'fs'
import path from 'path'
import picocolors from 'picocolors'
import type { Plugin, ResolvedConfig } from 'vite'
import { mergeConfig, send, build, normalizePath } from 'vite'
import type { SSRPluginOptions, Manifest } from '../config'

// from vite
function emptyDir(dir: string, skip?: string[]): void {
  for (const file of fs.readdirSync(dir)) {
    if (skip?.includes(file)) {
      continue
    }

    const abs = path.resolve(dir, file)

    // baseline is Node 12 so can't use rmSync :(
    if (fs.lstatSync(abs).isDirectory()) {
      emptyDir(abs)
      fs.rmdirSync(abs)
    } else {
      fs.unlinkSync(abs)
    }
  }
}

// from vite
function prepareOutDir(outDir: string, emptyOutDir: boolean | null | undefined, config: ResolvedConfig) {
  if (fs.existsSync(outDir)) {
    if (emptyOutDir == null && !normalizePath(outDir).startsWith(config.root + '/')) {
      // warn if outDir is outside of root
      config.logger.warn(
        picocolors.yellow(
          `\n${picocolors.bold(`(!)`)} outDir ${picocolors.gray(outDir)} is not inside project root and will not be emptied.\n` +
            `Use --emptyOutDir to override.\n`
        )
      )
    } else if (emptyOutDir !== false) {
      emptyDir(outDir, ['.git'])
    }
  }
}

function info(logger: { info: (value: string) => void }, name: string, value: string) {
  logger.info(`${picocolors.cyan(name)} ${picocolors.green(value)}`)
}

/**
 * The vite ssr plugin, it apply a middleware to the vite dev server that allow development under ssr without leaving vite.
 */
export default function ssr<TModule = any>(options?: SSRPluginOptions<TModule>): Plugin {
  const SSR_MANIFEST_NAME = /* options?.manifestId || */ 'ssr:manifest'
  const SSR_TEMPLATE_NAME = /* options?.manifestId || */ 'ssr:template'

  let generateSSRBuild = false
  let emptyOutDir: boolean | null | undefined = null
  let resolvedConfig: ResolvedConfig
  let manifestSource: Manifest = {}
  let templateSource = ''

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
      if (options?.config === false) {
        return
      }

      // run only on production build SSR
      if (env.mode !== 'production' || env.command !== 'build' || typeof config.build?.ssr !== 'string') {
        return
      }

      info(console, 'SSR build', `building SSR bundle for ${env.mode}...`)

      generateSSRBuild = true

      // we need to build twice on the same folder, therefore we must do
      // the cleanup process manually
      emptyOutDir = config.build?.emptyOutDir

      // we need to merge twice as publicDir and emptyOutDir *MUST* be set to false
      return mergeConfig(
        mergeConfig(
          {
            // this config will reset some common vite spa config
            // we do not need them in ssr most of the time
            build: {
              // cssCodeSplit: false,
              minify: false,

              // this will preserve the original file name
              rollupOptions: {
                output: {
                  // format: 'esm',
                  entryFileNames: '[name].js'
                }
              }
            }
          },
          options?.config || {}
        ),
        {
          publicDir: false, // the client will do this
          build: {
            emptyOutDir: false // or we delete the client files
          }
        }
      )
    },

    configResolved(config) {
      resolvedConfig = config
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

      // const ssrModule = typeof ssrInput === 'string' ? ssrInput : undefined
      // // no ssr module
      // if (!ssrModule) {
      //   server.config.logger.warn(picocolors.red('ssr module missing'))
      //   return undefined
      // }

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
                const ssr = (await server.ssrLoadModule(ssrModule)) as any

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

      info(console, 'SSR build', `generating the SSR target...`)

      if (resolvedConfig.build.write) {
        prepareOutDir(path.resolve(resolvedConfig.root, resolvedConfig.build.outDir), emptyOutDir, resolvedConfig)
      }

      const outDir = path.resolve(
        // resolve the out dir from the config
        path.resolve(resolvedConfig.root, resolvedConfig.build.outDir),

        // use the public directory name as the out dir
        path.basename(/*options?.clientDir || resolvedConfig.publicDir ||*/ 'www')
      )

      await build({
        configFile: resolvedConfig.configFile || false,
        build: {
          outDir,
          ssr: false,
          ssrManifest: true
        }
      })

      let template: string | undefined
      let ssrManifest: string | undefined

      // get the ssr manifest file name
      const ssrManifestFile = path.resolve(outDir, 'ssr-manifest.json')

      // get the index html file name
      const input: unknown = resolvedConfig.build.rollupOptions?.input || 'index.html'

      // only accept .html files as a template
      const templateFile = typeof input === 'string' && input.endsWith('.html') ? path.resolve(outDir, input) : undefined

      // read the ssr manifest
      if (ssrManifestFile && fs.existsSync(ssrManifestFile)) {
        ssrManifest = fs.readFileSync(ssrManifestFile, 'utf-8')
        fs.unlinkSync(ssrManifestFile)

        manifestSource = JSON.parse(ssrManifest)
        await applyManifestTransformation()

        if (options?.writeManifest !== false) {
          const fn = path.basename(ssrManifestFile)
          fs.writeFileSync(
            path.resolve(resolvedConfig.root, resolvedConfig.build.outDir, fn),
            JSON.stringify(manifestSource, null, 2),
            'utf-8'
          )
        }
      }

      // read the template
      if (templateFile && fs.existsSync(templateFile)) {
        template = fs.readFileSync(templateFile, 'utf-8')
        fs.unlinkSync(templateFile)

        templateSource = template
        await applyTemplateTransformation()

        if (options?.writeManifest !== false) {
          const fn = path.basename(templateFile)
          fs.writeFileSync(path.resolve(resolvedConfig.root, resolvedConfig.build.outDir, fn), templateSource, 'utf-8')
        }
      }
    }
  }
}
