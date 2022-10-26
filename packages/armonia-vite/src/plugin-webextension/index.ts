import fs from 'node:fs'
import { resolve } from 'node:path'
import type { ConfigEnv, Plugin, ResolvedConfig } from 'vite'

export type Browser = 'firefox' | 'chromium'

export interface WebExtensionOptions {
  background?: string
}

function parseMode(mode: string): Browser {
  if (mode.toLowerCase().startsWith('firefox')) {
    return 'firefox'
  }

  // const isChromium = mode.toLowerCase() === 'chromium'
  return 'chromium'
}

interface Emitter {
  readonly browser: 'chromium' | 'firefox'
}

/**
 * The vite ssr plugin, it apply a middleware to the vite dev server that allow development under ssr without leaving vite.
 */
export default function wex(_options: WebExtensionOptions = {}): Plugin {
  let _env: ConfigEnv // command: build | serve // mode: 'chromium', firefox, firefox-desktop, firefox-android
  let _config: ResolvedConfig
  let _browser: Browser
  let _emitter: Emitter | undefined
  let multiExtensionRunner: { exit(): Promise<void> } | undefined

  return {
    name: 'armonia:vite-plugin-webextension',
    config(config, { mode, command }) {
      _env = { mode, command }

      if (command !== 'build') {
        throw new TypeError("Use 'vite build' in web extensions.")
      }

      _browser = parseMode(mode)

      if (config.build?.watch) {
        _emitter = {
          browser: _browser
        }
      }
    },
    configResolved(config) {
      _config = config
    },
    buildStart() {
      // watch the public folder also
      if (_emitter) {
        this.addWatchFile('public')
      }

      let manifestFile: string | undefined
      const manifestFileLocations: string[] = []

      const isChromium = _env.mode.toLowerCase() === 'chromium'
      const isFirefox = _env.mode.toLowerCase().startsWith('firefox')

      if (isFirefox) {
        manifestFileLocations.push(
          resolve(_config.root, 'manifest_firefox.json'),
          resolve(_config.root, 'public/manifest_firefox.json'),
          resolve(_config.root, 'manifest.json'),
          resolve(_config.root, 'public/manifest.json')
        )
      }

      if (isChromium) {
        manifestFileLocations.push(
          resolve(_config.root, 'manifest_chromium.json'),
          resolve(_config.root, 'public/manifest_chromium.json'),
          resolve(_config.root, 'manifest.json'),
          resolve(_config.root, 'public/manifest.json')
        )
      }

      for (const manifestFileLocation of manifestFileLocations) {
        if (fs.existsSync(manifestFileLocation)) {
          manifestFile = manifestFileLocation
          break
        }
      }

      if (manifestFile) {
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: fs.readFileSync(manifestFile, 'utf8')
        })
      }
    },
    async writeBundle() {
      if (_emitter && !multiExtensionRunner) {
        const outDir = resolve(_config.root, _config.build.outDir)

        process.once('SIGINT', function () {
          multiExtensionRunner?.exit()
        })
        process.once('SIGTERM', function () {
          multiExtensionRunner?.exit()
        })

        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const webExt = await import('web-ext')
          multiExtensionRunner = await webExt.cmd.run(
            {
              noInput: true,
              sourceDir: outDir,
              target: _emitter.browser === 'chromium' ? 'chromium' : 'firefox-desktop',
              startUrl: _emitter.browser === 'chromium' ? 'chrome://extensions/' : 'about:debugging#/runtime/this-firefox'
            },
            {
              shouldExitProgram: true
            }
          )
        } catch (error) {
          console.error(error)
          // eslint-disable-next-line unicorn/no-process-exit
          process.exit(1)
        }
      }
    }
  }
}
