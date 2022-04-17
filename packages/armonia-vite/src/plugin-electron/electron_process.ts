import type { ChildProcessWithoutNullStreams } from 'child_process'
import proc from 'child_process'
import colors from 'picocolors'

export interface ElectronProcess {
  child: ChildProcessWithoutNullStreams
  close: () => Promise<void>
}

export async function runElectron(root: string, argv?: string[]): Promise<ElectronProcess> {
  argv = argv || []

  // TODO: catch import error
  const electron = await import('electron')

  const child = proc.spawn(electron as unknown as string, [root, ...argv], {
    windowsHide: false
  })

  let exitProcess = true

  // terminate the program
  child.on('close', function (code, signal) {
    if (code == null) {
      if (exitProcess) {
        const msg = `exited with signal: ${signal}`

        console.info(`${colors.cyan('armonia electron')} ${colors.red(msg)}`)

        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1)
      }
    } else {
      console.info(`${colors.cyan('armonia electron')} ${colors.green('exited')}`)

      if (exitProcess) {
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(code)
      }
    }
  })

  function handleTerminationSignal(signal: NodeJS.Signals) {
    process.on(signal, () => {
      if (!child.killed) {
        child.kill(signal)
      }
    })
  }

  handleTerminationSignal('SIGINT')
  handleTerminationSignal('SIGTERM')

  return {
    child,

    async close() {
      exitProcess = false

      return new Promise((resolve) => {
        if (child.killed) {
          resolve()
        } else {
          child.on('close', function () {
            resolve()
          })

          child.kill()
        }
      })
    }
  }
}
