import type { IncomingMessage, ServerResponse } from 'http'
import type { Configuration as ElectronBuilderConfig } from 'electron-builder'
import type { Options as ElectronPackagerConfig } from 'electron-packager'
import type { UserConfig, SSROptions, ResolvedConfig } from 'vite'

export type Manifest = Record<string, string[]>
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
   * 'electron/preload'
   * 'src-electron/preload'
   * 'src-electron/electron-preload'
   * ```
   */
  preload?: string

  /**
   * Defines the electron bundler, either `electron-packager` or `electron-builder`.
   *
   * @note Resolved automatically from the package dependencies
   */
  bundler?: 'packager' | 'builder'

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
  transformPackageJson?: (pkg: PackageJson) => void | Promise<void>

  /**
   * Overwrite the vite config.
   */
  config?: UserConfig
}

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
  ssg?: boolean

  /** Set the default ssr input, will have no effect when build.ssr is used. */
  ssr?: boolean | string

  // /** Defaults to `ssr:manifest` */
  // manifestId?: string

  // /** Defaults to `ssr:template` */
  // templateId?: string

  /**
   * Overwrite vite config when building for production
   */
  config?: UserConfig & {
    ssr?: SSROptions
  }

  /** false to disable the output of ssr-manifest.json and index.html file */
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

export type Target =
  | 'spa'
  | 'pwa'
  | 'ssr'
  | 'ssr-pwa'
  | 'ssg'
  | 'electron'
  | 'capacitor-ios'
  | 'capacitor-android'
  | 'bex-chromium'
  | 'bex-firefox'
  | 'bex-edge'

export interface Options {
  target?: Target
  electron?: ElectronOptions
  ssr?: SSRPluginOptions
}
