import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { zhihuTarget, extractZhihuDocument, expandZhihuBody, scrollZhihuBody } from './zhihu.mjs';

export function localCDP(value) {
  const u = new URL(value);
  if (!['http:','ws:'].includes(u.protocol) || !['127.0.0.1','localhost','[::1]'].includes(u.hostname) || u.username || u.password) throw new Error('CDP endpoint must be a loopback http/ws URL without credentials.');
  return u.href;
}

export async function markdownLibraries() {
  try {
    const [{ default: Turndown }, gfm] = await Promise.all([import('turndown'), import('turndown-plugin-gfm')]);
    return { Turndown, gfm: gfm.gfm || gfm.default.gfm };
  } catch { throw new Error('Markdown conversion dependencies are missing. Run npm ci in the skill directory.'); }
}

export async function browserLibraries() {
  const markdown = await markdownLibraries();
  try { const { chromium } = await import('playwright'); return { chromium, ...markdown }; }
  catch { throw new Error('Playwright is missing. Run npm ci in the skill directory, then see references/browser.md.'); }
}

export function snapshotData(snapshot, target, libs, transport = 'playwright') {
  const issues = [...new Set(snapshot.issues)];
  if (!snapshot.settled && snapshot.access === 'readable') issues.push('load_not_confirmed_stable');
  const report = {
    adapter: `zhihu-${target.kind}`, transport, access: snapshot.access,
    body: { status: snapshot.access !== 'readable' ? 'blocked' : issues.length ? 'needs_review' : 'apparently_complete', issues, textCharacters: snapshot.text.length, paragraphCount: snapshot.paragraphCount, codeBlocks: snapshot.codeBlocks, headings: snapshot.headings, settled: snapshot.settled },
    images: snapshot.images, checkedAt: new Date().toISOString(),
    limitation: 'Heuristic assessment of the rendered page; does not prove the server has no omitted content.'
  };
  return { markdown: snapshot.html ? toMarkdown(snapshot, libs) : '', metadata: { title: snapshot.title, author: snapshot.author, sourceURL: target.url }, captureReport: report };
}

export function hostScript(url, action = 'inspect') {
  const target = zhihuTarget(url);
  const operations = { inspect: extractZhihuDocument, expand: expandZhihuBody, scroll: scrollZhihuBody };
  if (!Object.hasOwn(operations, action)) throw new Error('Host browser action must be inspect, expand or scroll.');
  const fn = operations[action];
  // This is a function literal for the host's documented DOM evaluation API, not a Node eval.
  return `() => (${fn.toString()})(${JSON.stringify(target)})`;
}

export async function importHostSnapshots(envelope, url) {
  const target = zhihuTarget(url);
  if (!envelope || !Array.isArray(envelope.snapshots) || !envelope.snapshots.length) throw new Error('Host snapshot JSON must contain a nonempty snapshots array.');
  for (const s of envelope.snapshots) {
    if (!s || typeof s.html !== 'string' || typeof s.text !== 'string' || typeof s.title !== 'string' || !Array.isArray(s.issues) || !s.issues.every(x => typeof x === 'string') || !Array.isArray(s.images) || !Array.isArray(s.headings) || !Number.isInteger(s.paragraphCount) || !Number.isInteger(s.codeBlocks)) throw new Error('Invalid host DOM snapshot. Use browser-script inspect output.');
    if (!['readable','verification_required','paywall','login_required','content_not_found','ambiguous_answer','unexpected_redirect'].includes(s.access)) throw new Error('Invalid host access status.');
    for (const image of s.images) if (!image || !(image.url === null || typeof image.url === 'string') || typeof image.loaded !== 'boolean') throw new Error('Invalid host image evidence.');
    let same = false;
    try { same = zhihuTarget(s.pageUrl).url === target.url; } catch {}
    if (!same && s.access === 'readable') throw new Error('Host snapshot belongs to a different article.');
  }
  const snapshot = { ...envelope.snapshots.at(-1), issues: [...envelope.snapshots.at(-1).issues] };
  const signature = s => JSON.stringify([s.access,s.text,s.images.map(i => [i.url,i.loaded]),s.scrollPosition,s.atBodyEnd,s.expandable,s.issues]);
  const last = envelope.snapshots.slice(-3);
  snapshot.settled = last.length === 3 && last.every(s => signature(s) === signature(snapshot) && s.atBodyEnd === true) && !snapshot.expandable;
  return snapshotData(snapshot, target, await markdownLibraries(), 'host-browser');
}

export function toMarkdown(snapshot, { Turndown, gfm }) {
  const converter = new Turndown({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  converter.use(gfm);
  converter.addRule('safe-images', { filter: 'img', replacement: (_content, node) => {
    const src = node.getAttribute('src');
    const alt = (node.getAttribute('alt') || '').replace(/[\[\]\\\r\n]/g, ' ');
    return src ? `![${alt}](<${src.replace(/>/g, '%3E')}>)` : '[Image URL unavailable]';
  } });
  return converter.turndown(snapshot.html);
}

export async function withBrowser(options, action) {
  if (!!options.cdp === !!options.profile) throw new Error('Choose exactly one: --cdp LOOPBACK_ENDPOINT or --profile EXTERNAL_DIRECTORY.');
  const libs = await browserLibraries();
  let browser, context, page, ownedPage = false;
  try {
    if (options.cdp) {
      browser = await libs.chromium.connectOverCDP(localCDP(options.cdp), { timeout: 15000 });
      context = browser.contexts()[0];
      if (!context) throw new Error('Connected browser has no default context.');
      const wanted = zhihuTarget(options.url);
      page = context.pages().find(p => { try { return zhihuTarget(p.url()).url === wanted.url; } catch { return false; } });
      if (!page) { page = await context.newPage(); ownedPage = true; }
    } else {
      const profile = path.resolve(options.profile);
      const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
      const relative = path.relative(repository, profile);
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) throw new Error('Browser profile must be outside the skill repository.');
      // Dedicated persistent profile: never copy cookies from the user's default browser.
      context = await libs.chromium.launchPersistentContext(profile, { channel: options.channel || 'chrome', headless: false, viewport: null });
      page = context.pages()[0] || await context.newPage();
    }
    page.setDefaultTimeout(10000);
    return await action({ page, context, libs });
  } finally {
    if (browser) {
      if (ownedPage) await page?.close().catch(() => {});
      // For connectOverCDP, close disconnects the Playwright client; no user context.close().
      await browser.close();
    } else await context?.close();
  }
}

export async function inspectZhihu(page, target, { rounds = 32 } = {}) {
  let snapshot, previous = '', stable = 0, settled = false;
  await page.waitForLoadState('domcontentloaded');
  for (let round = 0; round < rounds; round++) {
    snapshot = await page.evaluate(extractZhihuDocument, target);
    if (snapshot.access !== 'readable') {
      // Allow a short render grace period, but never interact with a login/paywall/CAPTCHA.
      if (snapshot.access === 'content_not_found' && round < 4) { await page.waitForTimeout(500); continue; }
      break;
    }
    if (snapshot.expandable) await page.evaluate(expandZhihuBody, target);
    await page.evaluate(scrollZhihuBody, target);
    await page.waitForTimeout(250);
    const signature = JSON.stringify([snapshot.text.length, snapshot.images.map(i => [i.url, i.loaded]), await page.evaluate(() => scrollY)]);
    stable = signature === previous ? stable + 1 : 0; previous = signature;
    if (stable >= 3 && !snapshot.expandable) { settled = true; break; }
  }
  snapshot = await page.evaluate(extractZhihuDocument, target);
  if (!settled && snapshot.access === 'readable') snapshot.issues.push('load_budget_exhausted');
  return { ...snapshot, settled };
}

export async function captureBrowser(options, consume) {
  const target = zhihuTarget(options.url);
  return withBrowser(options, async ({ page, context, libs }) => {
    const before = page.url();
    const position = await page.evaluate(() => ({ x: scrollX, y: scrollY })).catch(() => null);
    try {
      if (before !== target.url && !before.startsWith(`${target.url}?`)) await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const snapshot = await inspectZhihu(page, target);
      let sameTarget = false;
      try { sameTarget = zhihuTarget(page.url()).url === target.url; } catch {}
      if (!sameTarget && snapshot.access === 'readable') { snapshot.access = 'unexpected_redirect'; snapshot.issues.push('unexpected_redirect'); }
      const data = snapshotData(snapshot, target, libs);
      // Reuse local session for image GETs without exporting cookies. Restrict credentialed requests to Zhihu/CDN.
      const imageFetch = async (url, init) => {
        const host = new URL(url).hostname;
        if (!/(^|\.)zhimg\.com$|(^|\.)zhihu\.com$/.test(host)) return fetch(url, init);
        const response = await context.request.get(url, { headers: { referer: target.url }, timeout: 30000, maxRedirects: 0 });
        if (response.status() >= 300 && response.status() < 400) { await response.dispose(); throw new Error('Image redirect requires review.'); }
        if (Number(response.headers()['content-length']) > 20 * 1024 * 1024) { await response.dispose(); throw new Error('Image exceeds 20 MiB.'); }
        const bytes = await response.body();
        const result = new Response(bytes, { status: response.status(), headers: response.headers() });
        await response.dispose(); return result;
      };
      return await consume(data, imageFetch);
    } finally {
      if (position && before === page.url()) await page.evaluate(p => scrollTo(p.x, p.y), position).catch(() => {});
    }
  });
}

export const defaultProfile = () => path.join(os.homedir(), '.local', 'share', 'article-to-note', 'browser-profile');
