import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { AngularNodeAppEngine, writeResponseToNodeResponse } from '@angular/ssr/node';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const port = process.env['PORT'] || 3000;

const angularApp = new AngularNodeAppEngine();

// Serve static files from /browser
app.use(express.static(browserDistFolder, {
  maxAge: '1y',
  index: false,
  redirect: false,
}));

// All other routes use the Angular engine (catch-all middleware)
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response: Response | null) => {
      if (response) {
        writeResponseToNodeResponse(response, res);
      } else {
        next();
      }
    })
    .catch(next);
});

app.listen(port, () => {
  console.log(`Node Express server listening on http://localhost:${port}`);
});
