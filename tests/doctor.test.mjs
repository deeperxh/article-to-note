import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, readFile, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { doctor } from '../scripts/doctor.mjs';

const source = fileURLToPath(new URL('..', import.meta.url));

async function installedFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'article-note-doctor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of ['SKILL.md', 'package.json', 'package-lock.json', 'preferences.example.json', 'scripts', 'references']) {
    await cp(path.join(source, file), path.join(root, file), { recursive: true });
  }
  return root;
}

test('an installed bundle works without optional dependencies and from another cwd', async t => {
  const root = await installedFixture(t);
  const report = await doctor({ root });
  assert.equal(report.ok, true);
  assert.equal(report.capabilities.core, true);
  assert.equal(report.capabilities.hostBrowserImport, false);
  assert.equal(report.capabilities.browserBackend, false);
  assert.ok(report.optionalDependencies.every(item => !item.available));
  assert.equal((await doctor({ root, browser: true })).ok, false);
  assert.equal(spawnSync(process.execPath, [path.join(root, 'scripts/doctor.mjs'), '--browser']).status, 1);
  const fromElsewhere = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts/doctor.mjs')], { cwd: os.tmpdir(), encoding: 'utf8' }));
  assert.equal(fromElsewhere.ok, true);
  assert.equal(fromElsewhere.skill.root, report.skill.root);
  assert.equal((await doctor({ root, nodeVersion: '18.20.0' })).ok, false);
});

test('detects outdated/incomplete bundles and mismatched package metadata', async t => {
  const root = await installedFixture(t);
  await rm(path.join(root, 'scripts/learning-note.mjs'));
  let report = await doctor({ root });
  assert.equal(report.ok, false);
  assert.deepEqual(report.missingFiles, ['scripts/learning-note.mjs']);
  assert.equal(spawnSync(process.execPath, [path.join(root, 'scripts/doctor.mjs')]).status, 1);
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  metadata.version = '0.0.0';
  await writeFile(path.join(root, 'package.json'), JSON.stringify(metadata));
  report = await doctor({ root });
  assert.ok(report.issues.includes('Package and lockfile versions differ.'));
});

test('linked installed CLIs capture, finalize, verify and resume reading without npm dependencies', async t => {
  const root = await installedFixture(t);
  const link = root + '-agent-link';
  await symlink(root, link, process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => rm(link, { recursive: true, force: true }));
  const article = path.join(root, '临时笔记 folder');
  const input = path.join(root, 'source-input.md');
  await writeFile(input, '# Portable article\n\n## Evidence\nA complete synthetic article for offline testing.\n');
  const run = (script, ...args) => JSON.parse(execFileSync(process.execPath, [path.join(link, 'scripts', script), ...args], { cwd: os.tmpdir(), encoding: 'utf8' }));
  assert.equal(run('doctor.mjs').ok, true);
  run('article-note.mjs', 'capture', '--url', 'https://example.com/offline-fixture', '--markdown', input, '--out', article, '--images', 'remote');
  assert.equal(run('article-note.mjs', 'finalize', '--dir', article, '--title', 'Portable article', '--mode', 'original', '--images', 'remote', '--keep-source', 'true').ok, true);
  assert.equal(run('article-note.mjs', 'verify', '--dir', article).ok, true);
  const session = run('learning-note.mjs', 'start', '--dir', article);
  const question = path.join(root, 'question.txt');
  await writeFile(question, 'What does the evidence establish?');
  run('learning-note.mjs', 'ask', '--dir', article, '--revision', String(session.revision), '--file', question, '--evidence', 'source.md / Evidence');
  const resumed = run('learning-note.mjs', 'status', '--dir', article);
  assert.equal(resumed.phase, 'awaiting_answer');
  assert.equal(resumed.session.turns[0].question, 'What does the evidence establish?');
  assert.equal(resumed.session.turns[0].answer, undefined);
  assert.equal(run('article-note.mjs', 'verify', '--dir', article).ok, true);
});
