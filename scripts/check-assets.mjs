#!/usr/bin/env node
import { statSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const MAX_PNG_MB = Number(process.env.ASSET_MAX_PNG_MB || 2); // MB
const MAX_VRM_MB = Number(process.env.ASSET_MAX_VRM_MB || 20);
const MAX_VRMA_MB = Number(process.env.ASSET_MAX_VRMA_MB || 5);

let errors = 0;

function checkFileSize(file, maxMB) {
  if (!existsSync(file)) return true; // not an error: caller decides
  const bytes = statSync(file).size;
  const mb = bytes / (1024 * 1024);
  if (mb > maxMB) {
    console.error(`NG  サイズ超過: ${file} (${mb.toFixed(2)}MB > ${maxMB}MB)`);
    errors++;
    return false;
  }
  console.log(`OK  サイズ: ${file} (${mb.toFixed(2)}MB)`);
  return true;
}

// UI mock image
const mock = 'docs/ui/images/main-layout.png';
if (!existsSync(mock)) {
  console.warn(`WARN  スクリーンショットがありません: ${mock}`);
} else {
  checkFileSize(mock, MAX_PNG_MB);
}

// VRM/VRMA under any docs/assets or public/assets
const roots = ['docs', 'public', 'assets'];
for (const root of roots) {
  if (!existsSync(root)) continue;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) {
        if (p.endsWith('.vrm')) checkFileSize(p, MAX_VRM_MB);
        if (p.endsWith('.vrma')) checkFileSize(p, MAX_VRMA_MB);
        if (p.endsWith('.png')) {
          if (p !== mock) checkFileSize(p, MAX_PNG_MB);
        }
      }
    }
  }
}

if (errors > 0) process.exit(1);
