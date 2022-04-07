import type { PluginContext, RollupOutput, RollupWatcher } from 'rollup'

export function normalizeBundle(bundle: RollupOutput | RollupOutput[] | RollupWatcher): RollupOutput[] {
  if (Array.isArray(bundle)) {
    return bundle
  }

  if (bundle && Array.isArray((bundle as unknown as RollupOutput).output)) {
    return [bundle as unknown as RollupOutput]
  }

  return []
}

export function emitBundle(ctx: PluginContext, bundle: RollupOutput | RollupOutput[] | RollupWatcher) {
  for (const { output } of normalizeBundle(bundle)) {
    for (const chunk of output) {
      if (chunk.type === 'asset') {
        ctx.emitFile({
          type: 'asset',
          fileName: chunk.fileName,
          source: chunk.source
        })
      }

      if (chunk.type === 'chunk') {
        ctx.emitFile({
          type: 'asset',
          fileName: chunk.fileName,
          source: chunk.code
        })
      }
    }
  }
}
