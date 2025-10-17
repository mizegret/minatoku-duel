#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

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
const body = `Closes #${issue}\n\nRefs #${parent}\n`;
const url = exec('gh', [
  'pr',
  'create',
  '-t',
  prTitle,
  '-b',
  body,
  '-B',
  'main',
  '-H',
  head,
  '--repo',
  repo,
]).trim();
console.log(url);
