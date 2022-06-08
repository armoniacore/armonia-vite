import path from 'path'

/**
 * Resolve the node package fully qualified root directory, where the root `package.json` is located.
 * `undefined` when the package is not installed.
 *
 * @note This function does not throw when the package does not exists.
 */
export function getPackageDir(id: string, options?: { paths?: string[] | undefined }): string | undefined {
  try {
    // eslint-disable-next-line unicorn/prefer-module
    return path.dirname(require.resolve(`${id}/package.json`, options))
  } catch {
    //
  }

  return undefined
}

/**
 * Gets if a package is installed. Use `getPackageDir` to resolve the package directory name.
 *
 * @note This function does not throw when the package does not exists.
 */
export function isPackageInstalled(id: string, options?: { paths?: string[] | undefined }): boolean {
  try {
    // eslint-disable-next-line unicorn/prefer-module
    require.resolve(id, options)

    return true
  } catch {
    //
  }

  return false
}
