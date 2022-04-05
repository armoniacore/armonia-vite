import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Armonia Vite',
  description: '',

  themeConfig: {
    repo: 'armoniacore/armonia-vite',
    docsDir: 'docs',
    docsBranch: 'main',
    editLinks: true,
    editLinkText: 'Improve this page',

    nav: [{ text: 'Examples', link: 'https://github.com/armoniacore/armonia-vite/tree/main/packages/playground' }]
  }
})
