#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

async function main() {
  let login = process.env.GITHUB_USER || '';
  if (!login) {
    try {
      const { stdout } = await exec('gh', ['api', 'user', '-q', '.login']);
      login = stdout.trim();
    } catch {
      /* noop */ void 0;
    }
  }
  if (!login) {
    try {
      const { stdout } = await exec('git', ['config', '--get', 'github.user']);
      login = stdout.trim();
    } catch {
      /* noop */ void 0;
    }
  }
  if (!login) {
    try {
      const { stdout } = await exec('git', ['config', '--get', 'user.name']);
      login = stdout.trim();
    } catch {
      /* noop */ void 0;
    }
  }
  console.log(login || '');
}

main();
