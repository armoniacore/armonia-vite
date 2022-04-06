# SSR

> Read the official vite [documentation](https://vitejs.dev/guide/ssr.html)

## Introduction

When in SSR, Armonia will look for the file `src/entry-server` which can be either `.ts` or `.js` to use as an entry point for rendering the SSR application.

This file does not have to have any special code to work, however, Armonia will automatically use an export named `render` that accept an instance of the node request `http:IncomingMessage` and node response `http:ServerResponse`, the function can return a string containing the html template code.

And example would be:

```ts
// src/entry-server.ts
import manifest from 'ssr:manifest'
import template from 'ssr:template'

export async function render(req: http:IncomingMessage, res: http:ServerResponse) {
  const { app, router } = createApp()

  router.push(url.originalUrl)
  await router.isReady()

  const ctx = {}
  const html = await renderToString(app, ctx)

  const preloadLinks = renderPreloadLinks(ctx.modules, manifest)

  return template
    .replace(`<!--preload-links-->`, preloadLinks)
    .replace(`<!--app-html-->`, appHtml)

  // or write directly in the response
  res.writeHeader(200, {"Content-Type": "text/html"});
  res.write(template.replace(...));
  res.end();
}
```

The function could also accept a manifest and template:

```ts
export async function render(
  req: http:IncomingMessage,
  res: http:ServerResponse,
  template: string,
  manifest: Record<string, string[]>) {
  // ...
}
```

There is also an alternative version used by the plugin in order to render SSG targets `renderVite`, the function should accept just the url and return a string, it can also accept the manifest and template just like the above.

And example would be:

```ts
// src/entry-server.ts
import manifest from 'ssr:manifest'
import template from 'ssr:template'

export async function renderVite(url: string) {
  const { app, router } = createApp()

  router.push(url)
  await router.isReady()

  const ctx = {}
  const html = await renderToString(app, ctx)

  const preloadLinks = renderPreloadLinks(ctx.modules, manifest)

  // return a string
  return template
    .replace(`<!--preload-links-->`, preloadLinks)
    .replace(`<!--app-html-->`, appHtml)
}
```

## With backend code

In case you need a special rendering function or custom logic that match your backend code:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [armonia({
    target: 'ssr',
    ssr: {
      async render({ req, res, template, manifest, ssr }) { // ssr is what you have exported
        const app = await ssr.render(req, template, manifest)

        // no return, the plugin will assume you have handle the rendering
        pipeToNodeWritable(app, {}, res)
      },
      // or
      render({ req, res, template, manifest, ssr }) {
        const html = ssr.customRenderFunction(req, res, template, manifest)

        // the plugin will serve this exact string as text/html
        return html
      }
    }
  })]
})
```

It is important to remember that, Armonia is trying to provide a bare minimum set of functionality to allow you to express yourself however you want, therefore it's up to you to handle your specific case.

An example to use the generated SSR code in express:

```ts
const express = require('express')
const app = express.createServer()
const { render } = require('./dist/entry-server.js')

app.get('*', async function(req, res, next) {
    try {
      // 1. render the app HTML.
      const html = await render(req, res);

      // 2. Send the rendered HTML back.
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      console.error(e);
      res.status(500).end();
    }
})
```

## Building a single file

Following the official Vite documentation, you can generate a single SSR file that is fully embedded, Armonia offer a build in way to extend this even further by allowing you to embed the generated ssr-manifest and html.

Adjust the vite settings, [find out more](https://github.com/vitejs/vite/blob/main/packages/playground/ssr-vue/vite.config.noexternal.js),
note we are overwriting the config using Armonia, thus this settings will be exclusively used only apply when building an ssr target.

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { armonia, minify } from '@armonia/vite'

export default defineConfig({
  plugins: [
    vue(),
    armonia({
      target: 'ssr',
      ssr: {
        transformTemplate: minify(), // optional, this will minify index.html
        writeManifest: false, // if we are using ssr:manifest and ssr:template
        config: {
          ssr: {
            noExternal: /./
          },
          resolve: {
            // necessary because vue.ssrUtils is only exported on cjs modules
            alias: [
              {
                find: '@vue/runtime-dom',
                replacement: '@vue/runtime-dom/dist/runtime-dom.cjs.js'
              },
              {
                find: '@vue/runtime-core',
                replacement: '@vue/runtime-core/dist/runtime-core.cjs.js'
              }
            ]
          }
        }
      }
    })
  ]
})

```

Import `ssr:manifest` and `ssr:template` in your render function

```ts
// src/server-entry.ts
import manifest from 'ssr:manifest';
import template from 'ssr:template';

// manifest is Record<string, string[]>
// template is string

export async function render(req: http:IncomingMessage) {
  // load req.originalUrl

  const preloadLinks = renderPreloadLinks(..., manifest);

  return template
    .replace('</head>', `${preloadLinks}</head>`)
    .replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`);
}
```

Those imports contains the `index.html` source text and the manifest object `{}`.

Note that the ssr manifest does not exists when developing, so be aware that when you reload the page during development you will see a flash of unstyled content.

Importing the manifest can be especially beneficial when you want to export a single file, by embedding the template and manifest in the source code, you do not need to rely on a file to be present in the output directory, you also do not need a special code to load such files, very handy indeed.

It is advisable that you do not perform a minification in the render function, the plugin allow you to minify the html before the render occurs.

### Typings

As right now, you need to add typings yourself in your code:

```ts
// ssr-shims.d.ts
declare module 'ssr:manifest' {
  const manifest: Record<string, string[]>;
  export default manifest;
}

declare module 'ssr:template' {
  const template: string;
  export default template;
}
```

### Configure Vite to export a single file

```ts
armonia({
  target: 'ssr',
  ssr: {
    writeManifest: false, // disable the generation of index.html and ssr-manifest.json
    config: {
      // refer to: https://vitejs.dev/config/#ssr-options
      ssr: {
        noExternal: /./
      },

      resolve: {
        // necessary because vue.ssrUtils is only exported on cjs modules
        alias: [
          {
            find: '@vue/runtime-dom',
            replacement: '@vue/runtime-dom/dist/runtime-dom.cjs.js'
          },
          {
            find: '@vue/runtime-core',
            replacement: '@vue/runtime-core/dist/runtime-core.cjs.js'
          }
        ]
      }
    }
  }
})
```

The output will be a single `.js` file containing the manifest and the html template.

## Preview the output

As right now, this plugin does not provide a way to preview the output.

The following is an example code that you can use:

Save the text in a file named `preview.js`, at the root of your vite project.

Use `node preview` to run the file thus running the preview server.

Note that you need to build the project first.

```js
// @ts-check
const path = require("path");
const express = require("express");
const compression = require("compression");
const serveStatic = require("serve-static");
const { render } = require("./dist/entry-server.js");

async function createServer() {
  const app = express();
  app.disable("x-powered-by");

  app.use(compression());

  // serve the public dir, by default is www for this plugin
  app.use(
    serveStatic("./dist/www", {
      index: false,
      maxAge: "365d",
      lastModified: false,
    })
  );

  app.use("*", async (req, res) => {
    try {
      // 1. render the app HTML.
      const html = await render(req, res);

      // 2. Send the rendered HTML back.
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      console.error(e);
      res.status(500).end();
    }
  });

  return { app };
}

const PORT = process.env.PORT || 3000;

createServer().then(({ app }) =>
  app.listen(PORT, () => console.log(`Server ready: http://localhost:${PORT}`))
);
```

## Minified in production

The plugin disable minification of the ssr output as the code is running on your server, the minification makes much harder to debug the code, however, if you want to minify the code regardless, you are free to overwrite this settings.

```js
armonia({
  target: 'ssr',
  ssr: {
    config: {
      build: {
        minify: 'esbuild',
      },
    }
  }
})
```

## Disable building

If you do not want this plugin to build automatically, opt out with:

```js
armonia({
  target: 'ssr',
  ssr: {
    config: false
  }
})
```

The plugin will continue to work in dev.

## Caveats

The goal of Armonia is to provide bare minimum set of functionality that just works without too much abstraction, however there are some caveats to be aware of.

### SSR build directory structure

When building an ssr target, the plugin will run the build event twice, the first time, on `buildStart` it will build the client in an `outDir` subdirectory named `www`.

It will then build the ssr target as normal, moving the `index.html` and `ssr-manifest.json` to the root build directory.

This is done in order to have a clean static folder that can be served without accidentally expose the manifest or the raw html template.

As a result of this, the static files resides in the folder `dist/www` by default, while the ssr code is on `dist/server-entry.js`.

### Reset options

The plugin will reset the `entryFileNames` when building in production but only for the server side code, your client side code is untouched.

`rollupOptions.output.entryFileNames = '[name].js'`

You need to explicitly set this option again in the ssr plugin if you want a custom entry name.

```js
armonia({
  target: 'ssr',
  ssr: {
    config: {
      build: {
        rollupOptions: {
          output: {
            entryFileNames: 'custom_name_server_render.js',
          }
        }
      },
    }
  }
})
```

The plugin might fail if you use `[hash]` or a function to generate the file name.

### Minified template may be different

Be aware that the strategy you choose to inject the content during the ssr need to take into account the fact that the `index.html` file may be minified, especially if you use an option such as `removeAttributeQuotes: true`.

The default minifier included in this plugin is quite aggressive without asking for trouble, it will work out of the box for most projects.

```js
import { minify } from '@armonia/vite'

armonia({
  target: 'ssr',
  ssr: {
    transformTemplate: minify()
  }
})
```

The following is an example illustrating a problem you may encounter:

```js
// template is minified with removeAttributeQuotes: true,
// it contains: <div id=app>...

// this will not work
template.replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`);

// you need this instead
template.replace('<div id=app></div>', `<div id=app>${appHtml}</div>`);
```

### Flash of unstyled content (FOUC)

This plugin will not resolve the ssr manifest during development, when reloading the page you will likely see a flash of unstyled content.

If you find that unbearable to see, well that's exactly what your users will see when the server fail to serve the static assets, when they have a bad connection, or in the rare case they have one of those pesky browsers...

As right now, this is the only major issue you might encounter, but remember that with vite, you will likely do not need to reload the page frequently, and ssr in vite is still experimental.

Do a reload test with the bundled output to see how final result looks like.

Refer to the section [Preview the output](#preview-the-output) on how to start a production ready preview server.
