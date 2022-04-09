# SSG Static Site Generator

> Static Site Generator relays on [SSR, so read the documentation](ssr.md)

Static Site Generator allows to deploy a website that consists of only pre-rendered static files.

The SSG target will overwrite the configuration of the SSR target, it will use its configuration by default.

```ts
armonia({
  target: 'ssg',
  ssg: {
    async staticRender({ render }) {
      const code = await render('/')

      // return a list file and text
      return [
        {
          id: '/index.html',
          code
        }
      ]
    }
  }
})
```
