import os from 'os'
import fs from 'fs'
import path from 'path'
import { defineConfig } from 'rollup'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { apiExtractor } from 'rollup-plugin-api-extractor'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import packageJsonPlugin from 'rollup-plugin-generate-package-json'
import copy from 'rollup-plugin-copy'
import packageJson from './package.json'

function apiExtractor2(outputDir, types) {
  function normalizePath(value) {
    const normalizedPath = path.normalize(path.join(outputDir, value))

    if (os.platform() === 'win32') {
      return normalizedPath.replace(/\\/g, '/')
    }

    return `./${normalizedPath}`
  }

  const plugins = []

  for (const type of types) {
    plugins.push(
      apiExtractor({
        cleanUpRollup: false,
        configuration: {
          projectFolder: '.',
          compiler: {
            tsconfigFilePath: '<projectFolder>/tsconfig.json'
          },
          mainEntryPointFilePath: normalizePath(type),
          dtsRollup: {
            enabled: true,
            untrimmedFilePath: normalizePath(type)
          },
          apiReport: {
            // HACK: this fix api-extractor errors
            reportFileName: 'types.api.md',
            enabled: false
          },
          docModel: {
            enabled: false
          },
          tsdocMetadata: {
            enabled: false
          },
          messages: {
            compilerMessageReporting: {
              default: {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                logLevel: 'warning'
              }
            },
            extractorMessageReporting: {
              default: {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                logLevel: 'warning',
                addToApiReportFile: true
              },
              'ae-missing-release-tag': {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                logLevel: 'none'
              }
            },
            tsdocMessageReporting: {
              default: {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                logLevel: 'warning'
              },
              'tsdoc-undefined-tag': {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                logLevel: 'none'
              }
            }
          }
        }
      })
    )
  }

  if (plugins.length > 0) {
    plugins.push({
      name: 'api-extractor-cleanup',

      writeBundle(options, bundle) {
        // from: https://gist.github.com/jakub-g/5903dc7e4028133704a4
        function cleanEmptyFoldersRecursively(folder) {
          const isDir = fs.statSync(folder).isDirectory()
          if (!isDir) {
            return
          }

          let files = fs.readdirSync(folder)
          if (files.length > 0) {
            files.forEach(function (file) {
              const fullPath = path.join(folder, file)
              cleanEmptyFoldersRecursively(fullPath)
            })

            files = fs.readdirSync(folder)
          }

          if (files.length === 0) {
            fs.rmdirSync(folder)
          }
        }

        const outDir = path.resolve(options.dir || './')

        for (const key of Object.keys(bundle).filter((key) => key.match(/\.d\.ts/))) {
          const output = bundle[key]

          if (!output || types.includes(key)) {
            continue
          }

          const fileName = path.resolve(outDir, output.fileName)
          fs.unlinkSync(fileName)
        }

        cleanEmptyFoldersRecursively(outDir)
      }
    })
  }

  return plugins
}

export default defineConfig({
  input: {
    'bin/cli': 'src/cli.ts',
    index: 'src/index.ts'
    // minify: 'src/minify.ts'
  },

  output: {
    dir: './dist',
    format: 'cjs',
    exports: 'named',
    interop: false,
    preferConst: true,
    preserveModules: false,
    externalLiveBindings: false,
    sourcemap: false,
    esModule: false,
    indent: false,
    freeze: false,
    strict: true
  },

  plugins: [
    copy({
      targets: [
        // {
        //   src: 'src/**/*',
        //   dest: 'dist/src'
        // },
        {
          src: 'bin/**/*',
          dest: 'dist/bin'
        },
        {
          src: ['LICENSE', 'README.md'],
          dest: 'dist'
        }
      ]
    }),
    typescript({
      // well some hacky stuff right here
      exclude: ['rollup.config.ts'],
      sourceMap: false,
      sourceRoot: undefined
    }),
    commonjs(),
    nodeResolve(),
    ...apiExtractor2('./dist', ['index.d.ts']),
    packageJsonPlugin({
      outputFolder: './dist',
      baseContents: {
        name: packageJson.name,
        description: packageJson.description,
        version: packageJson.version,
        license: packageJson.license,
        bin: {
          'armonia-vite': 'bin/armonia-vite.js'
        },
        main: 'index.js',
        types: 'index.d.ts',
        files: ['bin', 'index.d.ts'],
        keywords: packageJson.keywords,
        engines: packageJson.engines,
        repository: packageJson.repository,
        homepage: packageJson.homepage,
        // dependencies: {
        //   cac: packageJson.devDependencies.cac,
        //   picocolors: packageJson.devDependencies.picocolors
        // },
        peerDependencies: packageJson.peerDependencies,
        peerDependenciesMeta: packageJson.peerDependenciesMeta
      }
    })
  ],

  external: ['fs', 'path', 'http', 'child_process'].concat(Object.keys(packageJson.peerDependencies))
})
