#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

async function hasLabel(name) {
  try {
    const { stdout } = await exec('gh', ['label', 'list', '--json', 'name']);
    const list = JSON.parse(stdout);
    return list.some((l) => l.name.toLowerCase() === name.toLowerCase());
  } catch (_e) {
    return false;
  }
}

async function ensureLabel({ name, color, description }) {
  const exists = await hasLabel(name);
  if (exists) return;
  await exec('gh', [
    'label',
    'create',
    name,
    '--color',
    color,
    ...(description ? ['--description', description] : []),
  ]).catch(() => {});
}

const main = async () => {
  const data = JSON.parse(await readFile('.github/labels.json', 'utf8'));
  for (const item of data) {
    await ensureLabel(item);
  }
  console.log('labels synced');
};

main();
