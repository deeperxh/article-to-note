import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { capture, finalize, verify } from '../scripts/article-note.mjs';
import { browserLibraries, inspectZhihu, toMarkdown, localCDP, hostScript, importHostSnapshots } from '../scripts/browser-capture.mjs';
import { zhihuTarget, extractZhihuDocument } from '../scripts/zhihu.mjs';

const target = zhihuTarget('https://www.zhihu.com/question/123/answer/456');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');
const answer = body => `<h1 class="QuestionHeader-title">测试问题</h1><div class="AnswerItem" data-zop='{"itemId":456}'><div class="AuthorInfo-name">测试作者</div><div class="RichContent-inner"><div class="RichText">${body}</div></div></div>`;

test('URL routing accepts only individual answers/articles; CDP stays on loopback', () => {
  assert.equal(zhihuTarget('https://zhuanlan.zhihu.com/p/987?x=1').kind, 'article');
  assert.throws(() => zhihuTarget('https://www.zhihu.com/question/123'));
  assert.throws(() => zhihuTarget('https://evil.example/p/123'));
  assert.throws(() => localCDP('http://remote.example:9222'));
  assert.throws(() => localCDP('http://secret@127.0.0.1:9222'));
});

// A real, isolated Chromium exercises DOM rendering and session reuse. No live Zhihu or credentials.
test('browser fixtures: expansion, formula/table/code conversion, restrictions, and persistent CDP capture', async t => {
  const libs = await browserLibraries();
  const temp = await mkdtemp(path.join(os.tmpdir(), 'article-browser-'));
  const server = http.createServer((req, res) => { if (req.url === '/bad') { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': 'image/png' }); res.end(png); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const imageURL = `http://127.0.0.1:${server.address().port}/image`;
  const reserve = http.createServer();
  await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  const channel = process.env.ARTICLE_NOTE_TEST_CHANNEL || 'chrome';
  const context = await libs.chromium.launchPersistentContext(path.join(temp, 'profile'), { channel, headless: true, args: [`--remote-debugging-port=${port}`] });
  t.after(async () => { await context.close(); await new Promise(resolve => server.close(resolve)); await rm(temp, { recursive: true, force: true }); });
  const page = context.pages()[0];
  await page.setContent(answer(`<p>短文</p><button onclick="this.outerHTML='<p>展开后的正文</p>'">展开阅读全文</button><img data-original="${imageURL}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="><img eeimg="1" alt="E=mc^2"><pre><code>const x = 1;</code></pre><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>`));
  const snapshot = await inspectZhihu(page, target);
  assert.equal(snapshot.access, 'readable');
  assert.equal(snapshot.issues.length, 0);
  assert.ok(snapshot.text.includes('展开后的正文'));
  assert.equal(snapshot.images.length, 1);
  assert.equal(snapshot.images[0].url, imageURL);
  const markdown = toMarkdown(snapshot, libs);
  assert.match(markdown, /E=mc/);
  assert.match(markdown, /```/);
  assert.match(markdown, /\| A \| B \|/);

  await page.setContent(answer(`<p>正文讨论开通会员的问题，不应被误判</p><div style="display:none">未呈现内容<img src="${imageURL}"></div>`));
  const visible = await page.evaluate(extractZhihuDocument, target);
  assert.equal(visible.access, 'readable');
  assert.equal(visible.images.length, 0);
  assert.ok(!visible.html.includes('未呈现内容'));
  await page.setContent(answer('<p>错误回答</p>').replace('"itemId":456', '"itemId":999'));
  assert.equal((await page.evaluate(extractZhihuDocument, target)).access, 'content_not_found');
  await page.setContent(answer('<img>'));
  assert.ok((await page.evaluate(extractZhihuDocument, target)).issues.includes('image_url_missing'));

  await page.setContent('<div class="Modal">登录后查看</div>');
  assert.equal((await inspectZhihu(page, target)).access, 'login_required');
  await page.setContent(answer('<p>试读</p><div class="PurchaseButton">开通会员阅读</div>'));
  assert.equal((await inspectZhihu(page, target)).access, 'paywall');
  await page.setContent('<div class="Modal">请完成安全验证</div>');
  assert.equal((await inspectZhihu(page, target)).access, 'verification_required');
  await page.setContent(answer('<p>剪裁内容</p>').replace('class="RichContent-inner"', 'class="RichContent-inner" style="height:1px;overflow:hidden"'));
  assert.ok((await inspectZhihu(page, target)).issues.includes('css_clipped_content'));
  await page.setContent('<article class="Post-Main"><h1 class="Post-Title">专栏文章</h1><div class="AuthorInfo-name">作者</div><div class="Post-RichTextContainer"><div class="RichText"><h2>章节</h2><p>文章正文</p></div></div></article>');
  const article = await inspectZhihu(page, zhihuTarget('https://zhuanlan.zhihu.com/p/987'));
  assert.equal(article.title, '专栏文章');
  assert.deepEqual(article.headings, ['章节']);

  const html = answer(`<h2>源章节</h2><p>这是完整的测试正文。</p><img src="${imageURL}">`);
  await context.route('https://www.zhihu.com/**', route => route.fulfill({ body: html, contentType: 'text/html; charset=utf-8' }));
  await page.goto(target.url);
  await context.addCookies([{ name: 'fixture_session', value: 'private-test-value', domain: 'www.zhihu.com', path: '/' }]);
  const dir = path.join(temp, 'capture');
  const result = await capture({ url: target.url, out: dir, backend: 'browser', cdp: `http://127.0.0.1:${port}`, images: 'download' });
  assert.equal(result.images, 1);
  assert.equal(page.isClosed(), false);
  assert.equal(await page.title(), ''); // CDP disconnect did not kill the user's browser/tab.
  const report = JSON.parse(await readFile(path.join(dir, 'capture-report.json'), 'utf8'));
  assert.equal(report.body.status, 'apparently_complete');
  assert.equal(report.imageCheck.downloaded, 1);
  const observed = await page.evaluate(`(${hostScript(target.url)})()`);
  assert.equal(observed.pageUrl, target.url);
  assert.equal(observed.atBodyEnd, true);
  const envelope = { snapshots: [observed, observed, observed] };
  const imported = await importHostSnapshots(envelope, target.url);
  assert.equal(imported.captureReport.transport, 'host-browser');
  assert.equal(imported.captureReport.body.status, 'apparently_complete');
  assert.equal((await importHostSnapshots({ snapshots: [observed] }, target.url)).captureReport.body.status, 'needs_review');
  await assert.rejects(importHostSnapshots({ snapshots: [{ ...observed, pageUrl: 'https://zhuanlan.zhihu.com/p/987' }] }, target.url), /different article/);
  const snapshotFile = path.join(temp, 'host-snapshots.json');
  await writeFile(snapshotFile, JSON.stringify(envelope));
  const hostDir = path.join(temp, 'host-import');
  const hostResult = await capture({ url: target.url, out: hostDir, images: 'download', snapshot: snapshotFile });
  assert.equal(hostResult.images, 1);
  const hostManifest = JSON.parse(await readFile(path.join(hostDir, 'manifest.json'), 'utf8'));
  assert.equal(hostManifest.backend, 'host-browser');
  assert.equal(hostManifest.sourceTitle, '测试问题');
  assert.equal(hostManifest.captureReport.imageCheck.downloaded, 1);
  assert.equal((await finalize({ dir: hostDir, title: '宿主抓取', mode: 'original', images: 'download', 'keep-source': 'true' })).ok, true);
  const manifest = await readFile(path.join(dir, 'manifest.json'), 'utf8');
  assert.ok(!manifest.includes('private-test-value'));
  const final = await finalize({ dir, title: '笔记', mode: 'original', images: 'download', 'keep-source': 'true' });
  assert.equal(final.ok, true);
  const draft = path.join(temp, 'draft.md');
  await writeFile(draft, '删掉了图片的正文');
  const missing = await verify(dir, await readFile(draft, 'utf8'));
  assert.equal(missing.ok, false);
  assert.ok(missing.missing.some(x => x.includes('Omitted source image')));
  await stat(path.join(dir, 'note.md'));
});

test('blocked captures save diagnostic report only and cannot be finalized', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'blocked-note-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const dir = path.join(temp, 'blocked');
  const data = { markdown: '', metadata: {}, captureReport: { access: 'paywall', body: { status: 'blocked' }, images: [] } };
  const result = await capture({ url: target.url, out: dir, images: 'remote' }, { inputData: data });
  assert.equal(result.ok, false);
  await assert.rejects(stat(path.join(dir, 'source.md')), { code: 'ENOENT' });
  await assert.rejects(finalize({ dir, title: 'No', mode: 'original', images: 'remote', 'keep-source': 'true' }), /blocked/);
  const uncertain = path.join(temp, 'uncertain');
  await capture({ url: target.url, out: uncertain, images: 'remote' }, { inputData: { markdown: '可见预览', metadata: {}, captureReport: { access: 'readable', body: { status: 'needs_review', issues: ['css_clipped_content'] }, images: [] } } });
  await assert.rejects(finalize({ dir: uncertain, title: 'No', mode: 'original', images: 'remote', 'keep-source': 'true' }), /needs review/);
});
