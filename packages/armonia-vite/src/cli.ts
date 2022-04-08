import { cac } from 'cac'

const cli = cac('armonia-vite')

cli.help()
// eslint-disable-next-line unicorn/prefer-module
cli.version(require('../package.json').version)

cli.parse()
