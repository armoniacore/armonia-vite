import type { ViteDevServer } from 'vite'

export function resolveAddress(server: ViteDevServer): URL {
  const address = server.httpServer?.address()

  if (address) {
    // string address
    if (typeof address === 'string') {
      return new URL(address)
    }

    const host = address.address === '127.0.0.1' ? 'localhost' : address.address

    return new URL(`http://${host}:${address.port}`)
  }

  const port = server.config.server.port || 3000

  return new URL(`http://localhost:${port}`)
}
