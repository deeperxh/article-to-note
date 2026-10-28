import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { capture, finalize, verify, preferences, references, authStatus } from '../scripts/article-note.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');

test('auth status reports presence only, without exposing or validating credentials', () => {
  for (const value of [undefined, '', '  \n ']) assert.deepEqual(authStatus({ FIRECRAWL_API_KEY: value }), { environmentKeyConfigured: false });
  const result = authStatus({ FIRECRAWL_API_KEY: 'test-only-secret' });
  assert.deepEqual(result, { environmentKeyConfigured: true });
  assert.ok(!JSON.stringify(result).includes('test-only-secret'));
});

async function fixture(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'article-note-'));
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push(req.url);
    if (req.url === '/redirect') { res.writeHead(302, { location: '/a.png' }); res.end(); }
    else if (req.url.startsWith('/a.png') || req.url.startsWith('/b(')) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(png); }
    else if (req.url === '/not-image') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>login</html>'); }
    else { res.writeHead(404); res.end('missing'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(temp, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const input = path.join(temp, 'response.json'), out = path.join(temp, '笔记 folder');
  const prepare = async markdown => writeFile(input, JSON.stringify({ success: true, data: { markdown, metadata: { title: 'Fixture article', sourceURL: `${base}/articles/post` } } }));
  return { temp, base, input, out, calls, prepare };
}

test('capture localizes common images and links, preserves code, deduplicates URLs', async t => {
  const f = await fixture(t);
  const md = '# Fixture article\n\n![one](/a.png "caption")\n![dup](/a.png)\n![nested](/b(foo).png)\n![ref][fig]\n\n[fig]: </a.png> "reference title"\n\n[![linked](/a.png)](../next)\n<img src="/a.png" srcset="/a.png 1x, /b(foo).png 2x">\n[relative](../about)\n`![code](/never.png)`\n```md\n![fenced](/never.png)\n```\n';
  await f.prepare(md);
  const result = await capture({ url: `${f.base}/articles/post`, out: f.out, response: f.input, images: 'download' });
  assert.equal(result.warnings.length, 0);
  assert.equal(await readFile(path.join(f.out, 'source.md'), 'utf8'), md);
  const working = await readFile(path.join(f.out, 'working.md'), 'utf8');
  assert.match(working, /\[relative\]\(http:\/\/127\.0\.0\.1:\d+\/about\)/);
  assert.match(working, /\[!\[linked\]\(assets\/[^)]+\)\]\(http:/);
  assert.match(working, /`!\[code\]\(\/never.png\)`/);
  assert.match(working, /```md\n!\[fenced\]\(\/never.png\)/);
  const images = references(working).filter(r => r.image);
  assert.equal(images.length, 8);
  for (const image of images) { assert.match(image.url, /^assets\//); assert.ok((await stat(path.join(f.out, image.url))).size); }
  assert.equal(f.calls.length, 2);
  const done = await finalize({ dir: f.out, title: '自选中文标题', mode: 'original', images: 'download', 'keep-source': 'true' });
  assert.equal(done.ok, true);
  assert.match(await readFile(done.note, 'utf8'), /^# 自选中文标题/);
  assert.equal((await verify(f.out)).ok, true);
  await assert.rejects(finalize({ dir: f.out }), /already exists/);
  await assert.rejects(capture({ url: `${f.base}/post`, out: f.out, response: f.input, images: 'download' }), /already exists/);
});

test('failed/HTML images stay remote, redirects are downloaded, warnings remain visible', async t => {
  const f = await fixture(t);
  await f.prepare('![bad](/missing.png)\n![login](/not-image)\n![redirect](/redirect)');
  const result = await capture({ url: `${f.base}/post`, out: f.out, response: f.input, images: 'download' });
  assert.equal(result.warnings.length, 2);
  const m = JSON.parse(await readFile(path.join(f.out, 'manifest.json'), 'utf8'));
  assert.deepEqual(m.assets.map(a => a.status), ['failed','failed','downloaded']);
  const done = await finalize({ dir: f.out, title: '标题', mode: 'original', images: 'download', 'keep-source': 'false' });
  assert.ok(done.warnings.some(w => w.includes('Remote image remains')));
  assert.doesNotMatch(await readFile(done.note, 'utf8'), /Source copy:/);
  assert.equal(done.sourceRetainedOnDisk, false);
  await assert.rejects(stat(path.join(f.out, 'working.md')), { code: 'ENOENT' });
});

test('remote mode does not fetch images; config resolves paths and rejects secret fields', async t => {
  const f = await fixture(t);
  await f.prepare('![remote](../a.png)');
  await capture({ url: `${f.base}/articles/post`, out: f.out, response: f.input, images: 'remote' });
  assert.equal(f.calls.length, 0);
  const working = await readFile(path.join(f.out, 'working.md'), 'utf8');
  assert.ok(working.includes(`${f.base}/a.png`));
  const config = path.join(f.temp, 'preferences.json');
  await writeFile(config, JSON.stringify({ mode: 'bilingual', images: 'remote', outputDir: './notes', titlePrefix: '' }));
  const p = await preferences(config);
  assert.equal(p.outputDir, path.join(f.temp, 'notes'));
  assert.equal(p.targetLanguage, null);
  assert.equal(p.titlePrefix, '');
  await writeFile(config, '{"apiKey":"do-not-use"}');
  await assert.rejects(preferences(config), /Unknown preference key/);
});

test('finalize requires translation preferences and rejects broken/escaping image paths', async t => {
  const f = await fixture(t);
  await f.prepare('# Original\nText');
  await capture({ url: `${f.base}/post`, out: f.out, response: f.input, images: 'download' });
  const body = path.join(f.temp, 'draft.md');
  const opts = { dir: f.out, title: '中文标题', mode: 'translate', images: 'download', 'keep-source': 'true', body };
  await assert.rejects(finalize(opts), /requires --language/);
  await writeFile(body, '![bad](../private.png)');
  await assert.rejects(finalize({ ...opts, language: 'zh-CN' }), /unsafe image/);
  await writeFile(body, '![bad](assets/missing.png)');
  await assert.rejects(finalize({ ...opts, language: 'zh-CN' }), /Missing/);
  await writeFile(body, '完整中文正文\n\n## 复习总结\n这是额外总结。');
  const done = await finalize({ ...opts, language: 'zh-CN' });
  assert.match(await readFile(done.note, 'utf8'), /Edition: translate \(zh-CN\)/);
});

test('direct API preserves original request contract and makes one paid call', async t => {
  const f = await fixture(t);
  const old = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = 'test-only-not-a-real-key';
  t.after(() => { if (old === undefined) delete process.env.FIRECRAWL_API_KEY; else process.env.FIRECRAWL_API_KEY = old; });
  const requests = [];
  await capture({ url: 'https://example.com/article', out: f.out, images: 'remote' }, { fetchImpl: async (url, init) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ success: true, data: { markdown: '# Example\nArticle', metadata: { title: 'Example' } } }), { headers: { 'content-type': 'application/json' } });
  } });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.firecrawl.dev/v2/scrape');
  assert.deepEqual(JSON.parse(requests[0].init.body), { url: 'https://example.com/article', formats: ['markdown'], onlyMainContent: true });
  assert.ok(!JSON.stringify(JSON.parse(await readFile(path.join(f.out, 'manifest.json'), 'utf8'))).includes('test-only'));
});

test('empty responses fail before output creation', async t => {
  const f = await fixture(t);
  await f.prepare('');
  await assert.rejects(capture({ url: `${f.base}/post`, out: f.out, response: f.input, images: 'download' }), /No complete Markdown/);
  await assert.rejects(stat(f.out), { code: 'ENOENT' });
});

test('cleanup never deletes modified intermediate files', async t => {
  const f = await fixture(t);
  await f.prepare('Original body');
  await capture({ url: `${f.base}/post`, out: f.out, response: f.input, images: 'remote' });
  await writeFile(path.join(f.out, 'source.md'), 'User-edited source');
  const done = await finalize({ dir: f.out, title: 'Title', mode: 'original', images: 'remote', 'keep-source': 'false' });
  assert.equal(done.sourceRetainedOnDisk, true);
  assert.ok(done.warnings.some(w => w.includes('Kept modified')));
  assert.equal(await readFile(path.join(f.out, 'source.md'), 'utf8'), 'User-edited source');
});
