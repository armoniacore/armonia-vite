import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Armonia',
  description: 'Cross-platform application development for Vite',

  themeConfig: {
    repo: 'armoniacore/armonia-vite',
    docsDir: 'docs',
    docsBranch: 'main',
    editLinks: true,
    editLinkText: 'Improve this page',

    nav: [
      { text: 'Docs', link: '/docs/' },
      { text: 'Config', link: '/config/' },
      { text: 'Examples', link: 'https://github.com/armoniacore/armonia-vite/tree/main/packages/playground' }
    ]
  }
})
