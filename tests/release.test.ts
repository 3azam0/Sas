import {it, expect} from 'vitest';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';

const releaseScript = resolve('scripts/release-manifest.mjs');
function repository(notes = '# v0.1.0\nVerified local inventory release.\n') {
  mkdirSync('.cache', {recursive:true});
  const root = mkdtempSync(resolve('.cache/release-test-'));
  const git = (...args:string[]) => execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd:root, encoding:'utf8'}).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fodo release test');
  git('config', 'user.email', 'fodo-test@example.invalid');
  writeFileSync(join(root, 'package.json'), JSON.stringify({version:'0.1.0'}));
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  mkdirSync(join(root, 'docs/releases'), {recursive:true});
  writeFileSync(join(root, 'docs/releases/v0.1.0.md'), notes);
  git('add', '.'); git('commit', '-m', 'Verified fixture');
  const commit = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', commit);
  git('tag', 'v0.1.0');
  const run = (tag='v0.1.0', sha=commit) => spawnSync(process.execPath, [releaseScript], {
    cwd:root, encoding:'utf8', env:{...process.env, FODO_RELEASE_TAG:tag, FODO_RELEASE_SHA:sha}
  });
  return {root, git, run, commit};
}

it('records the verified source and lockfile without representing a deployment', () => {
  const fixture = repository();
  expect(fixture.run().status).toBe(0);
  const manifest = JSON.parse(readFileSync(join(fixture.root, '.cache/release-manifest.json'), 'utf8'));
  expect(manifest.sourceCommit).toBe(fixture.commit);
  expect(manifest.lockfileSha256).toBe(createHash('sha256').update(readFileSync(join(fixture.root, 'pnpm-lock.yaml'))).digest('hex'));
  expect(manifest.deployment).toBeNull();
});

it('rejects a malformed tag or a tag/version mismatch before writing a manifest', () => {
  const fixture = repository();
  expect(fixture.run('../main').status).not.toBe(0);
  expect(fixture.run('v0.2.0').stderr).toContain('match package.json');
  expect(existsSync(join(fixture.root, '.cache/release-manifest.json'))).toBe(false);
});

it('rejects a release commit outside the reviewed main history', () => {
  const fixture = repository();
  fixture.git('tag', '-d', 'v0.1.0');
  fixture.git('commit', '--allow-empty', '-m', 'Unreviewed change');
  fixture.git('tag', 'v0.1.0');
  expect(fixture.run('v0.1.0', fixture.git('rev-parse', 'HEAD')).status).not.toBe(0);
  expect(existsSync(join(fixture.root, '.cache/release-manifest.json'))).toBe(false);
});

it('rejects incomplete release notes and a mismatched workflow SHA', () => {
  const incomplete = repository('# v0.1.0\nTODO\n');
  expect(incomplete.run().stderr).toContain('complete release notes');
  const fixture = repository();
  expect(fixture.run('v0.1.0', '0'.repeat(40)).stderr).toContain('Workflow source SHA differs');
});

it('rejects a checked-out commit that differs from the immutable tag', () => {
  const fixture = repository();
  fixture.git('commit', '--allow-empty', '-m', 'Later commit');
  expect(fixture.run('v0.1.0', fixture.git('rev-parse', 'HEAD')).stderr).toContain('Check out the release tag');
});
