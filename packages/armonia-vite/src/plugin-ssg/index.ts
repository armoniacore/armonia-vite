import type { Plugin } from 'vite'

import type { SSGOptions, SSRPluginOptions } from '../plugin-ssr'
import { ssrInternal } from '../plugin-ssr'

export default function ssr(options: SSRPluginOptions = {}, ssgOptions: SSGOptions | undefined = {}): Plugin {
  return ssrInternal(options, ssgOptions)
}

export type { SSGOptions, SSRPluginOptions } from '../plugin-ssr'
