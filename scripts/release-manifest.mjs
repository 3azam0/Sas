import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const root = resolve('.');
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {encoding:'utf8'}).trim();
const tag = process.env.FODO_RELEASE_TAG;
if (!tag || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(tag)) {
  throw new Error('Release tag must be vX.Y.Z, optionally with a prerelease suffix.');
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (tag !== `v${pkg.version}`) throw new Error('Release tag must match package.json version.');
const commit = git('rev-parse', 'HEAD');
if (git('rev-parse', `${tag}^{commit}`) !== commit) throw new Error('Check out the release tag before generating its manifest.');
if (process.env.FODO_RELEASE_SHA && process.env.FODO_RELEASE_SHA !== commit) throw new Error('Workflow source SHA differs from the checked-out release.');
git('merge-base', '--is-ancestor', commit, 'origin/main');
const notes = readFileSync(`docs/releases/${tag}.md`, 'utf8');
if (!notes.trim() || /\b(TODO|TBD)\b/.test(notes)) throw new Error('Commit complete release notes before creating the tag.');
mkdirSync('.cache', {recursive:true});
writeFileSync('.cache/release-manifest.json', JSON.stringify({
  version:pkg.version, tag, sourceCommit:commit,
  lockfileSha256:createHash('sha256').update(readFileSync('pnpm-lock.yaml')).digest('hex'),
  verificationRun:process.env.FODO_RELEASE_RUN_URL || null,
  createdAt:new Date().toISOString(),
  scope:'Local restaurant inventory prototype; hosted production is not enabled.',
  deployment:null
}, null, 2) + '\n');
console.log(`Validated ${tag} at ${commit}; source manifest written to .cache/release-manifest.json.`);
