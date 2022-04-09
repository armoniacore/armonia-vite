import type { Configuration as ElectronBuilderConfig } from 'electron-builder'
import type { Options as ElectronPackagerConfig } from 'electron-packager'
import type { UserConfig } from 'vite'

export type PackageJson = Record<string, any>

export type ElectronPackagerOptions = Omit<ElectronPackagerConfig, 'dir' | 'out'>
export type ElectronBuilderOptions = ElectronBuilderConfig

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
  bundler?: 'packager' | 'builder' | false

  /**
   * Defines the configuration for `electron-packager`.
   */
  packager?: ElectronPackagerOptions

  /**
   * Defines the configuration for `electron-builder`.
   */
  builder?: ElectronBuilderOptions

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
