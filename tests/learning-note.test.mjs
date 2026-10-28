import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { learning, renderLearning } from '../scripts/learning-note.mjs';
import { capture, finalize, verify } from '../scripts/article-note.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reading-session-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = path.join(root, '文章 folder');
  const input = path.join(root, 'source.md');
  await writeFile(input, '# 原文\n\n## 关键概念\n\nA claim to discuss.\n');
  await capture({ url: 'https://example.com/article', out: dir, markdown: input, images: 'remote' });
  await finalize({ dir, title: '原文', mode: 'original', images: 'remote', 'keep-source': 'true' });
  const file = path.join(root, 'turn.txt');
  const run = async (action, body, extra = {}) => {
    const revision = (await learning('status', { dir })).revision;
    if (body !== undefined) await writeFile(file, body);
    return learning(action, { dir, revision, file, ...extra });
  };
  return { root, dir, file, run, text: name => readFile(path.join(dir, name), 'utf8') };
}

test('optional session preserves article and source, links both ways, and resumes across processes', async t => {
  const f = await fixture(t);
  const original = await f.text('note.md'), source = await f.text('source.md');
  await assert.rejects(f.text('learning.md'), { code: 'ENOENT' });
  await learning('start', { dir: f.dir, goal: '理解边界与反例' });
  assert.ok((await f.text('note.md')).startsWith(original));
  assert.equal(await f.text('source.md'), source);
  assert.ok((await f.text('learning.md')).includes('[文章笔记](note.md)'));
  await f.run('ask', '这个观点在哪些条件下失效？', { evidence: 'source.md / 关键概念 / A claim to discuss.' });
  const script = path.resolve('scripts/learning-note.mjs');
  const child = spawnSync(process.execPath, [script, 'status', '--dir', f.dir], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).phase, 'awaiting_answer');
  const answer = '我认为需要上下文。\n\n## 用户自己的标题\n```js\nconst x = 1;\n```\n';
  await f.run('answer', answer);
  await f.run('pause');
  let status = await learning('status', { dir: f.dir });
  assert.equal(status.phase, 'awaiting_feedback');
  assert.equal(status.session.turns[0].answer, answer);
  await f.run('resume');
  await f.run('feedback', '你的回答指出了上下文。请对照“关键概念”区分事实与假设。');
  await f.run('ask', '你会如何验证？', { evidence: 'note.md / 关键概念' });
  await f.run('finish');
  status = await learning('status', { dir: f.dir });
  assert.equal(status.status, 'completed');
  assert.equal(status.session.turns[1].answer, undefined);
  await f.run('resume');
  assert.equal((await learning('status', { dir: f.dir })).phase, 'awaiting_answer');
  assert.equal((await f.text('note.md')).split('[精读问答记录](learning.md)').length - 1, 1);
  assert.equal((await verify(f.dir)).ok, true);
});

test('enforces sequential questions, real-answer-first feedback, skip, stale revisions and pause', async t => {
  const f = await fixture(t);
  await learning('start', { dir: f.dir });
  await assert.rejects(f.run('answer', 'invented'), /No question/);
  await assert.rejects(f.run('ask', 'Q'), /evidence/);
  await f.run('ask', 'Q1', { evidence: 'source.md: claim' });
  const before = await f.text('learning.json');
  await assert.rejects(f.run('ask', 'Q2', { evidence: 'source.md' }), /Resolve/);
  await assert.rejects(f.run('feedback', 'premature'), /real user answer/);
  await assert.rejects(learning('pause', { dir: f.dir, revision: 1 }), /Stale/);
  assert.equal(await f.text('learning.json'), before);
  await f.run('skip');
  await f.run('pause');
  await assert.rejects(f.run('ask', 'Q2', { evidence: 'source.md' }), /not active/);
  await f.run('resume');
  await f.run('ask', 'Q2', { evidence: 'source.md' });
  await assert.rejects(f.run('answer', ' \n '), /nonempty/);
  await f.run('answer', 'real response');
  await assert.rejects(f.run('answer', 'duplicate'), /No question/);
  const s = (await learning('status', { dir: f.dir })).session;
  assert.equal(s.turns[0].status, 'skipped');
  assert.equal(s.turns[0].answer, undefined);
  assert.equal(s.turns[1].answer, 'real response');
});

test('protects edited Markdown and existing notes; sync repairs missing/stale generated output', async t => {
  const f = await fixture(t);
  await learning('start', { dir: f.dir });
  await assert.rejects(learning('start', { dir: f.dir }), /already exists/);
  const originalView = await f.text('learning.md');
  await writeFile(path.join(f.dir, 'learning.md'), originalView + '\nMy manual note\n');
  const before = await f.text('learning.json');
  await assert.rejects(f.run('pause'), /edited outside/);
  await assert.rejects(f.run('sync'), /edited outside/);
  assert.equal(await f.text('learning.json'), before);
  await writeFile(path.join(f.dir, 'learning.md'), originalView);
  await f.run('ask', 'Q', { evidence: 'source.md' });
  // Model a crash after state commit but before the Markdown projection was replaced.
  await writeFile(path.join(f.dir, 'learning.md'), originalView);
  assert.ok((await learning('status', { dir: f.dir })).warnings.length);
  await assert.rejects(f.run('pause'), /Run sync/);
  await f.run('sync');
  let s = (await learning('status', { dir: f.dir })).session;
  assert.equal(await f.text('learning.md'), renderLearning(s));
  await unlink(path.join(f.dir, 'learning.md'));
  await f.run('sync');
  assert.equal(await f.text('learning.md'), renderLearning(s));
  await writeFile(path.join(f.dir, '.learning.lock'), 'another writer');
  await assert.rejects(f.run('pause'), /locked/);
});

test('concurrent writers cannot both consume a revision; missing projection retains the saved answer', async t => {
  const f = await fixture(t);
  await learning('start', { dir: f.dir });
  await f.run('ask', 'Q', { evidence: 'source.md' });
  const revision = (await learning('status', { dir: f.dir })).revision;
  await writeFile(f.file, 'persist me');
  const outcomes = await Promise.allSettled([1, 2].map(() => learning('answer', { dir: f.dir, revision, file: f.file })));
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  await unlink(path.join(f.dir, 'learning.md'));
  await f.run('sync');
  assert.equal((await learning('status', { dir: f.dir })).session.turns[0].answer, 'persist me');
});
