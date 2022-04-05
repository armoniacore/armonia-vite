import { cac } from 'cac'

const cli = cac('armonia-vite')

cli.help()
cli.version(require('../package.json').version)

cli.parse()
