#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

function parseRepo(url) {
  const m = url.match(/github.com[:/](.+?)\.git$/);
  if (!m) throw new Error('Cannot determine repo from remote.origin.url');
  return m[1];
}

const main = async () => {
  const { stdout: url } = await exec('git', ['config', '--get', 'remote.origin.url']);
  const repo = parseRepo(url.trim());
  const ownerRepo = repo;
  const branch = process.env.BRANCH || 'main';

  const payload = {
    required_status_checks: {
      strict: true,
      contexts: [
        'Lint / Format / Unit Test',
        'eslint',
        'markdownlint',
        'check-size',
        'Require PR linked issue',
      ],
    },
    enforce_admins: true,
    required_conversation_resolution: true,
    required_linear_history: true,
    allow_deletions: false,
    allow_force_pushes: false,
    block_creations: false,
    restrictions: null,
  };

  const input = JSON.stringify(payload);
  await exec(
    'gh',
    ['api', '-X', 'PUT', `repos/${ownerRepo}/branches/${branch}/protection`, '--input', '-'],
    { input }
  );
  console.log(`Branch protection updated for ${ownerRepo}@${branch}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
