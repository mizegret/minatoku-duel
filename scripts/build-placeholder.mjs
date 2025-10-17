#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist';
if (!existsSync(out)) mkdirSync(out, { recursive: true });

// Copy static assets if present
if (existsSync('public')) {
  cpSync('public', out, { recursive: true });
}

const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Minatoku Duel — Phase 1 Docs</title>
    <style>
      body{font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 2rem; line-height: 1.6}
      code{background:#f2f2f2; padding: .1rem .3rem; border-radius:.25rem}
      .container{max-width: 900px; margin: 0 auto}
      img{max-width:100%; height:auto; border:1px solid #ddd; border-radius:8px}
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Minatoku Duel — Phase 1</h1>
      <p>Docs-first phase. No app build yet. This is a placeholder output for Cloudflare Pages.</p>
      <h2>Key Docs</h2>
      <ul>
        <li><a href="https://github.com/${process.env.GITHUB_REPOSITORY || ''}/blob/main/AGENTS.md">AGENTS.md</a></li>
        <li><a href="https://github.com/${process.env.GITHUB_REPOSITORY || ''}/blob/main/docs/api/events.md">docs/api/events.md</a></li>
        <li><a href="https://github.com/${process.env.GITHUB_REPOSITORY || ''}/blob/main/docs/requirements/technical-requirements.md">docs/requirements/technical-requirements.md</a></li>
      </ul>
      <h2>UI Mock</h2>
      <p>Layout image from docs:</p>
      <img src="docs/ui/images/main-layout.png" alt="Main layout" />
      <p>Build generated at ${new Date().toISOString()}.</p>
    </div>
  </body>
  </html>`;

writeFileSync(join(out, 'index.html'), html, 'utf8');
console.log('Built placeholder to dist/');
