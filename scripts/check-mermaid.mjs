#!/usr/bin/env node
// Mermaid 構文検証（Playwright + mermaid を用いてブラウザ上で parse だけ実施）
// 使い方: node scripts/check-mermaid.mjs [glob...]
// 例: node scripts/check-mermaid.mjs "docs/**/*.md" AGENTS.md

import { readFile } from 'node:fs/promises';
import fg from 'fast-glob';
import { chromium } from 'playwright';
import path from 'node:path';

const patterns = process.argv.slice(2);
const globs = patterns.length ? patterns : ['docs/**/*.md', 'AGENTS.md', 'README.md'];
const files = await fg(globs, { dot: false, ignore: ['**/node_modules/**', '**/dist/**'] });

function* extractMermaidBlocks(md) {
  const fence = '```';
  const lines = md.split(/\r?\n/);
  let inBlock = false;
  let lang = '';
  let buf = [];
  let startLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock && line.startsWith(fence)) {
      const info = line.slice(3).trim();
      lang = info.split(/\s+/)[0].toLowerCase();
      if (lang === 'mermaid') {
        inBlock = true;
        startLine = i + 1; // 1-based
        buf = [];
      }
      continue;
    }
    if (inBlock) {
      if (line.startsWith(fence)) {
        yield { code: buf.join('\n'), line: startLine };
        inBlock = false;
        lang = '';
        buf = [];
      } else {
        buf.push(line);
      }
    }
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Inject mermaid from node_modules
const mermaidPath = path.join(process.cwd(), 'node_modules/mermaid/dist/mermaid.min.js');
await page.addScriptTag({ path: mermaidPath });
await page.addScriptTag({ content: `mermaid.initialize({ startOnLoad: false });` });

let errorCount = 0;
for (const file of files) {
  const md = await readFile(file, 'utf8');
  for (const block of extractMermaidBlocks(md)) {
    try {
      // eslint-disable-next-line no-undef
      await page.evaluate((code) => mermaid.parse(code), block.code);
    } catch (e) {
      errorCount++;
      console.error(`Mermaid 構文エラー: ${file}:${block.line}`);
      console.error(String(e));
    }
  }
}

await browser.close();

if (errorCount > 0) {
  console.error(`Mermaid チェックで ${errorCount} 件のエラー`);
  process.exit(1);
} else {
  console.log('Mermaid 構文OK');
}
