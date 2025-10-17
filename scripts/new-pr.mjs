#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const issue = process.argv[2];
if (!issue) {
  console.error('usage: node scripts/new-pr.mjs <issue-number>');
  process.exit(2);
}

const repo = exec('git', ['config', '--get', 'remote.origin.url'])
  .toString()
  .trim()
  .replace(/.*github.com[:/](.*)\.git$/, '$1');

function exec(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' });
}

const title = JSON.parse(exec('gh', ['issue', 'view', issue, '-R', repo, '--json', 'title'])).title;
const parent = 6; // Epic
const head = exec('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const prTitle = `${title}（docs）`;
const bodyStr = `Closes #${issue}\n\nRefs #${parent}\n`;

// Preflight checks (fail-fast)
const cmds = [
  ['npm', ['run', '-s', 'format:check']],
  ['npm', ['run', '-s', 'lint:md']],
  ['npm', ['run', '-s', 'lint:md:links']],
  ['npm', ['run', '-s', 'lint:mermaid']],
  ['npm', ['test', '--silent']],
  ['node', ['scripts/repo-doctor.mjs', '--strict']],
];
for (const [cmd, args] of cmds) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`Preflight failed: ${cmd} ${args.join(' ')}`);
    process.exit(r.status || 1);
  }
}

// Use body-file to ensure markdown newlines render correctly
const dir = mkdtempSync(join(tmpdir(), 'pr-'));
const bodyFile = join(dir, 'BODY.md');
writeFileSync(bodyFile, bodyStr, 'utf8');

const url = exec('gh', [
  'pr',
  'create',
  '--title',
  prTitle,
  '--body-file',
  bodyFile,
  '--base',
  'main',
  '--head',
  head,
  '--repo',
  repo,
]).trim();
console.log(url);
