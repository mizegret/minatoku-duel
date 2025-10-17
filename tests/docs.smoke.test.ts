import { existsSync } from 'node:fs';

describe('ドキュメントの存在確認', () => {
  it('docs 配下の主要ファイルが存在する', () => {
    expect(existsSync('docs/requirements/technical-requirements.md')).toBe(true);
    expect(existsSync('docs/api/events.md')).toBe(true);
    expect(existsSync('AGENTS.md')).toBe(true);
  });
});

