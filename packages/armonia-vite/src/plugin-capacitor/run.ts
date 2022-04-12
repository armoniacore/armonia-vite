import proc from 'child_process'
import path from 'path'
import type { ResolvedConfig } from 'vite'

function resolveCapacitorBin() {
  // @capacitor/cli/package.json give us the exact file location
  // when node resolve a package, it will point to "main", which is not what we want

  // eslint-disable-next-line unicorn/prefer-module
  const dir = path.dirname(require.resolve('@capacitor/cli/package.json'))

  // NOTE: this is hardcoded and may break on future capacitor releases
  // we assume the bin is always located in bin/capacitor, capacitor API is fairly stable
  // and also it would be nice to have direct access to capacitor instead of run the cli but hey
  return path.resolve(dir, 'bin/capacitor')
}

interface CapacitorInit {
  root: string
  webDir: string
  appName?: string
  appId?: string
}

export async function init(init: CapacitorInit): Promise<void> {
  const { root, webDir, appName = 'app', appId = 'com.app' } = init

  const bin = resolveCapacitorBin()

  // TODO: use a promise
  proc.spawnSync(bin, ['init', '--web-dir', webDir, appName, appId], {
    cwd: root
  })

  // future proof this api, it will use async
  await Promise.resolve()
}

// export async function add(platform: 'android' | 'ios') {
//   // TODO: make sure `@capacitor/${platform}` is installed

//   const bin = resolveCapacitorBin()

//   // TODO: use a promise
//   proc.spawnSync(bin, ['add', platform], {
//     cwd: root
//   })

//   // future proof this api, it will use async
//   await Promise.resolve()
// }
