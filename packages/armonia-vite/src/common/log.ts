import type { Logger } from 'vite'
import picocolors from 'picocolors'

export function ok(logger: Logger, message: string) {
  logger.info(`${picocolors.cyan('armonia')} ${picocolors.green(message)}`)
}

export function warn(logger: Logger, message: string) {
  logger.warn(`${picocolors.cyan('armonia')} ${picocolors.yellow(message)}`)
}

export function error(logger: Logger, message: string) {
  logger.error(`${picocolors.cyan('armonia')} ${picocolors.red(message)}`)
}
