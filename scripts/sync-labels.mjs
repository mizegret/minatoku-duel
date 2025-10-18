#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const normColor = (c) => (c || '').replace(/^#/, '').toLowerCase();

async function listRemoteLabels() {
  const { stdout } = await exec('gh', ['label', 'list', '--json', 'name,color,description']);
  const list = JSON.parse(stdout || '[]');
  return list.map((l) => ({
    name: l.name,
    color: normColor(l.color),
    description: l.description || '',
  }));
}

async function createLabel({ name, color, description }) {
  try {
    await exec('gh', [
      'label',
      'create',
      name,
      '--color',
      normColor(color),
      ...(description != null ? ['--description', description] : []),
    ]);
  } catch (e) {
    console.warn('labels:create failed:', name, e?.message || e);
  }
}

async function editLabel(current, desired) {
  const args = ['label', 'edit', current.name];
  const wantsColor = normColor(desired.color);
  if (wantsColor && wantsColor !== normColor(current.color)) {
    args.push('--color', wantsColor);
  }
  const wantsDesc = desired.description ?? '';
  if ((current.description || '') !== wantsDesc) {
    args.push('--description', wantsDesc);
  }
  if (args.length > 3) {
    try {
      await exec('gh', args);
    } catch (e) {
      console.warn('labels:edit failed:', current.name, e?.message || e);
    }
  }
}

const main = async () => {
  const desired = JSON.parse(await readFile('.github/labels.json', 'utf8'));
  const remote = await listRemoteLabels().catch(() => []);

  const byName = (arr) => Object.fromEntries(arr.map((l) => [l.name.toLowerCase(), l]));

  const remoteMap = byName(remote);
  let created = 0;
  let updated = 0;

  for (const item of desired) {
    const key = item.name.toLowerCase();
    const existing = remoteMap[key];
    if (!existing) {
      try {
        await createLabel(item);
        created += 1;
      } catch (e) {
        console.warn('labels:loop-create failed:', item?.name, e?.message || e);
      }
      continue;
    }
    try {
      await editLabel(existing, item);
      // editLabel only calls gh when something differs;増分は目視ログに統一
      updated += 1;
    } catch (e) {
      console.warn('labels:loop-edit failed:', item?.name, e?.message || e);
    }
  }

  console.log(JSON.stringify({ ok: true, action: 'labels-sync', created, updated }, null, 2));
};

main();
