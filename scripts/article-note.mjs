#!/usr/bin/env node
import { readFile, writeFile, mkdir, stat, unlink } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const json = x => JSON.stringify(x, null, 2) + '\n';
const cleanLine = x => String(x).replace(/[\r\n]+/g, ' ').trim();
const digest = text => createHash('sha256').update(text).digest('hex');
const exists = async p => { try { await stat(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
const saveNew = (p, data) => writeFile(p, data, { flag: 'wx' });

function webURL(value, base) {
  const u = new URL(value, base);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http(s) URLs are supported.');
  return u.href;
}

// Ignore code examples. Offsets are preserved so replacement ranges refer to the original text.
function maskCode(text) {
  let fence = null;
  const lines = text.split(/(?<=\n)/);
  let masked = lines.map(line => {
    const m = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(line.trimEnd())) fence = null;
      return line.replace(/[^\r\n]/g, ' ');
    }
    if (m) { fence = m[1]; return line.replace(/[^\r\n]/g, ' '); }
    if (/^( {4}|\t)/.test(line)) return line.replace(/[^\r\n]/g, ' ');
    return line;
  }).join('');
  masked = masked.replace(/(`+)([^]*?)\1/g, s => s.replace(/[^\r\n]/g, ' '));
  return masked;
}

function unescapeURL(s) { return s.replace(/\\([()<>\[\] ])/g, '$1').replace(/&amp;/g, '&'); }
function destination(text, offset, endChar) {
  let i = offset;
  while (/\s/.test(text[i] ?? '') && i < text.length) i++;
  if (text[i] === '<') {
    const end = text.indexOf('>', i + 1);
    if (end < 0) return null;
    return { start: i + 1, end, url: unescapeURL(text.slice(i + 1, end)) };
  }
  const start = i;
  let depth = 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') { i++; continue; }
    if (c === '(') depth++;
    else if (c === ')') { if (!depth) break; depth--; }
    if (!depth && /\s/.test(c)) break;
  }
  if (i === start) return null;
  return { start, end: i, url: unescapeURL(text.slice(start, i)) };
}

export function references(text) {
  const masked = maskCode(text), refs = [], definitions = new Map();
  for (const m of masked.matchAll(/^ {0,3}\[([^\]\n]+)\]:[ \t]*/gm)) {
    const d = destination(text, m.index + m[0].length, '\n');
    if (d) definitions.set(m[1].trim().replace(/\s+/g, ' ').toLowerCase(), d);
  }
  for (let i = 0; i < masked.length; i++) {
    const image = masked[i] === '!' && masked[i + 1] === '[';
    if (!image && masked[i] !== '[') continue;
    if (i > 0 && masked[i - 1] === '\\') continue;
    const bracket = i + (image ? 1 : 0);
    // Balanced labels allow images inside ordinary links.
    let depth = 1, end = bracket + 1;
    for (; end < masked.length; end++) {
      if (masked[end] === '\\') { end++; continue; }
      if (masked[end] === '[') depth++;
      if (masked[end] === ']' && --depth === 0) break;
    }
    if (end >= masked.length) continue;
    if (masked[end + 1] === '(') {
      const d = destination(text, end + 2, ')');
      if (d) refs.push({ ...d, image });
    } else if (image) {
      const ref = masked.slice(end + 1).match(/^\[([^\]\n]*)\]/);
      const label = (ref ? ref[1] || text.slice(bracket + 1, end) : text.slice(bracket + 1, end)).trim().replace(/\s+/g, ' ').toLowerCase();
      const d = definitions.get(label);
      if (d) refs.push({ ...d, image: true });
    }
    if (image) i = end;
  }
  for (const m of masked.matchAll(/<img\b[^>]*>/gi)) {
    const originalTag = text.slice(m.index, m.index + m[0].length);
    for (const a of originalTag.matchAll(/\s(src|data-src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const attr = a[1].toLowerCase(), value = a[2] ?? a[3] ?? a[4];
      if (attr === 'data-src' && /\ssrc\s*=/i.test(originalTag) && !/\ssrc\s*=\s*["'](?:data:|["'])/i.test(originalTag)) continue;
      const start = m.index + a.index + a[0].indexOf('=') + 1 + (a[0].slice(a[0].indexOf('=') + 1).match(/^\s*/)[0].length) + (a[2] !== undefined || a[3] !== undefined ? 1 : 0);
      if (attr === 'srcset') {
        for (const candidate of value.matchAll(/(?:^|,\s*)(\S+)(?:\s+[^,]+)?/g)) {
          const p = start + candidate.index + candidate[0].indexOf(candidate[1]);
          refs.push({ start: p, end: p + candidate[1].length, url: unescapeURL(candidate[1]), image: true, html: true });
        }
      } else if (value) refs.push({ start, end: start + value.length, url: unescapeURL(value), image: true, html: true });
    }
  }
  // Resolve ordinary reference links too, except definitions already used for images.
  const imageStarts = new Set(refs.filter(r => r.image).map(r => r.start));
  for (const d of definitions.values()) if (!imageStarts.has(d.start)) refs.push({ ...d, image: false });
  const unique = new Map();
  for (const r of refs) { const old = unique.get(r.start); if (!old || r.image) unique.set(r.start, r); }
  return [...unique.values()].sort((a, b) => a.start - b.start);
}

function imageType(b) {
  if (b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'jpg';
  if (/^GIF8[79]a/.test(b.subarray(0, 6).toString())) return 'gif';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (b.subarray(4, 8).toString() === 'ftyp' && /avif|avis/.test(b.subarray(8, 40).toString())) return 'avif';
  if (b.subarray(0, 2).toString() === 'BM') return 'bmp';
  if (b.subarray(0, 4).equals(Buffer.from([0,0,1,0]))) return 'ico';
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(b.subarray(0, 4096).toString('utf8'))) return 'svg';
  throw new Error('Response is not a recognized image.');
}

async function fetchImage(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Image HTTP ${response.status}.`);
  if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) { await response.body?.cancel(); throw new Error('Image exceeds 20 MiB.'); }
  const parts = []; let size = 0;
  for await (const part of response.body ?? []) {
    size += part.length;
    if (size > MAX_IMAGE_BYTES) throw new Error('Image exceeds 20 MiB.');
    parts.push(Buffer.from(part));
  }
  const bytes = Buffer.concat(parts);
  return { bytes, ext: imageType(bytes) };
}

export async function capture(options, { fetchImpl = fetch, inputData } = {}) {
  const url = webURL(options.url), out = path.resolve(options.out);
  const policy = options.images;
  if (!['download', 'remote'].includes(policy)) throw new Error('--images must be download or remote.');
  if (await exists(out)) throw new Error('Output directory already exists. Choose a new directory.');
  if (!['firecrawl','browser'].includes(options.backend || 'firecrawl')) throw new Error('--backend must be firecrawl or browser.');
  if (options.backend === 'browser' && !inputData && !options.snapshot) {
    if (options.response || options.markdown) throw new Error('Browser capture cannot also import a file.');
    const { captureBrowser } = await import('./browser-capture.mjs');
    return captureBrowser(options, (data, imageFetch) => capture(options, { inputData: data, fetchImpl: imageFetch }));
  }
  if (options.backend !== 'browser' && (options.cdp || options.profile || options.channel)) throw new Error('Browser options require --backend browser.');
  if ([options.response,options.markdown,options.snapshot].filter(Boolean).length > 1) throw new Error('Choose only one import source.');
  let data;
  if (inputData) data = inputData;
  else if (options.snapshot) {
    if (options.cdp || options.profile || options.channel) throw new Error('Host snapshot import does not use CDP or a separate browser profile.');
    const { importHostSnapshots } = await import('./browser-capture.mjs');
    data = await importHostSnapshots(JSON.parse(await readFile(options.snapshot, 'utf8')), url);
  }
  else if (options.markdown) data = { markdown: await readFile(options.markdown, 'utf8'), metadata: {} };
  else if (options.response) {
    let imported = JSON.parse(await readFile(options.response, 'utf8'));
    imported = imported.structuredContent ?? imported;
    if (imported.success === false) throw new Error('Imported scrape response reports failure.');
    data = imported.data ?? imported;
  } else {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key?.trim()) throw new Error('Set FIRECRAWL_API_KEY in the host environment or import a connector response.');
    const response = await fetchImpl('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }), signal: AbortSignal.timeout(180000)
    });
    if (!response.ok) throw new Error(`Firecrawl HTTP ${response.status}; response body omitted to avoid exposing credentials.`);
    const result = await response.json();
    if (!result.success) throw new Error('Firecrawl reported failure; inspect the provider dashboard.');
    data = result.data;
  }
  const blocked = data?.captureReport && data.captureReport.access !== 'readable';
  if (!blocked && (typeof data?.markdown !== 'string' || !data.markdown.trim())) throw new Error('No complete Markdown content returned.');
  const metadata = data.metadata ?? {};
  const base = metadata.sourceURL ? webURL(metadata.sourceURL, url) : url;
  const title = cleanLine(metadata.title || data.markdown?.match(/^#\s+(.+)$/m)?.[1] || new URL(url).hostname);
  const manifest = { version: 2, backend: options.snapshot ? 'host-browser' : options.backend || (options.response || options.markdown ? 'import' : 'firecrawl'), sourceUrl: url, resolvedUrl: base, sourceTitle: title, author: metadata.author || null, capturedAt: new Date().toISOString(), imagesPolicy: policy, assets: [], warnings: [], captureReport: data.captureReport || null };
  await mkdir(path.dirname(out), { recursive: true });
  await mkdir(out); // Exclusive ownership; never merge with an existing capture.
  if (blocked) {
    manifest.warnings.push(`Capture stopped: ${data.captureReport.access}. No full article was saved.`);
    await saveNew(path.join(out, 'capture-report.json'), json(data.captureReport));
    await saveNew(path.join(out, 'manifest.json'), json(manifest));
    return { ok: false, directory: out, access: data.captureReport.access, warnings: manifest.warnings };
  }
  if (manifest.captureReport?.body.status === 'needs_review') manifest.warnings.push('Rendered article may be incomplete; inspect capture-report.json before translating.');
  await saveNew(path.join(out, 'source.md'), data.markdown);
  await mkdir(path.join(out, 'assets'));
  const replacements = [], assets = new Map();
  for (const ref of references(data.markdown)) {
    if (!ref.image && (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(ref.url))) continue;
    if (ref.image && /^data:/i.test(ref.url)) { manifest.warnings.push('An embedded data image was retained.'); continue; }
    let absolute;
    try { absolute = webURL(ref.url, base); }
    catch { if (ref.image) manifest.warnings.push('Unsupported image URL scheme retained.'); continue; }
    let target = absolute;
    if (ref.image) {
      if (!assets.has(absolute)) {
        const asset = { url: absolute, status: policy === 'remote' ? 'remote' : 'failed' };
        if (policy === 'download') {
          try {
            const { bytes, ext } = await fetchImage(absolute, fetchImpl);
            asset.path = `assets/${createHash('sha256').update(absolute).digest('hex').slice(0, 16)}.${ext}`;
            await saveNew(path.join(out, asset.path), bytes);
            asset.status = 'downloaded'; asset.bytes = bytes.length;
          } catch (e) { asset.error = e.message.includes('HTTP') || /recogniz|MiB/.test(e.message) ? e.message : 'Image download failed (network/timeout/write error).'; }
        }
        assets.set(absolute, asset); manifest.assets.push(asset);
      }
      const asset = assets.get(absolute);
      target = asset.path || absolute;
    }
    replacements.push({ ...ref, target: ref.html ? target.replace(/&/g, '&amp;') : target.replace(/ /g, '%20') });
  }
  for (const asset of manifest.assets) if (asset.status === 'failed') manifest.warnings.push(`Image unavailable: ${asset.url} (${asset.error})`);
  let working = data.markdown;
  for (const r of replacements.sort((a, b) => b.start - a.start)) working = working.slice(0, r.start) + r.target + working.slice(r.end);
  manifest.sourceInventory = { images: [...new Set(references(working).filter(r => r.image).map(r => r.url))], headings: (data.markdown.match(/^#{1,6}\s+.+$/gm) || []), codeFences: (data.markdown.match(/^```|^~~~/gm) || []).length };
  if (manifest.captureReport) {
    const expected = manifest.captureReport.images.filter(i => i.url).map(i => i.url);
    const saved = new Set(manifest.assets.map(a => a.url));
    const missingFromMarkdown = [...new Set(expected)].filter(u => !saved.has(u));
    manifest.captureReport.imageCheck = { expected: expected.length, uniqueExpected: new Set(expected).size, downloaded: manifest.assets.filter(a => a.status === 'downloaded').length, failed: manifest.assets.filter(a => a.status === 'failed').length, missingUrls: manifest.captureReport.images.filter(i => !i.url).length, missingFromMarkdown, policy };
    if (missingFromMarkdown.length || manifest.captureReport.imageCheck.missingUrls) manifest.warnings.push('Some rendered images were not captured; inspect capture-report.json.');
    await saveNew(path.join(out, 'capture-report.json'), json(manifest.captureReport));
  }
  manifest.intermediates = { 'source.md': digest(data.markdown), 'working.md': digest(working) };
  await saveNew(path.join(out, 'working.md'), working);
  await saveNew(path.join(out, 'manifest.json'), json(manifest));
  return { directory: out, title, images: manifest.assets.length, warnings: manifest.warnings };
}

export async function verify(dir, textOverride, policyOverride) {
  dir = path.resolve(dir);
  const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
  const text = textOverride ?? await readFile(path.join(dir, 'note.md'), 'utf8');
  const policy = policyOverride ?? manifest.note?.images ?? manifest.imagesPolicy;
  const warnings = [...manifest.warnings], missing = [], images = references(text).filter(r => r.image);
  const actualImages = new Set(images.map(r => r.url));
  for (const expected of manifest.sourceInventory?.images || []) if (!actualImages.has(expected)) missing.push(`Omitted source image: ${expected}`);
  for (const ref of images) {
    if (/^(?:https?:)?\/\//i.test(ref.url)) { if (policy === 'download') warnings.push(`Remote image remains: ${ref.url}`); continue; }
    if (/^data:/i.test(ref.url)) { warnings.push('Embedded data image remains.'); continue; }
    if (/^[a-z][a-z\d+.-]*:/i.test(ref.url)) { missing.push('Unsupported image scheme'); continue; }
    let decoded;
    try { decoded = decodeURIComponent(ref.url.split(/[?#]/)[0]); } catch { missing.push(ref.url); continue; }
    const full = path.resolve(dir, decoded), relative = path.relative(dir, full);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) { missing.push(ref.url); continue; }
    try { const file = await stat(full); if (!file.isFile() || !file.size) missing.push(ref.url); }
    catch (e) { if (e.code === 'ENOENT') missing.push(ref.url); else throw e; }
  }
  return { ok: !missing.length, images: images.length, missing, warnings: [...new Set(warnings)], bodyAssessment: manifest.captureReport?.body || { status: 'not_assessed', limitation: 'No rendered-page assessment was supplied.' } };
}

export async function finalize(options) {
  const dir = path.resolve(options.dir), file = path.join(dir, 'note.md');
  if (await exists(file)) throw new Error('note.md already exists; it will not be overwritten.');
  if (!['original', 'translate', 'bilingual'].includes(options.mode)) throw new Error('Choose original, translate, or bilingual.');
  if (!['download', 'remote'].includes(options.images)) throw new Error('Choose --images download or remote.');
  if (!['true', 'false'].includes(String(options['keep-source']))) throw new Error('Choose --keep-source true or false.');
  if (options.mode !== 'original' && !options.language?.trim()) throw new Error('Translation/bilingual mode requires --language.');
  if (!options.title?.trim()) throw new Error('A chosen --title is required.');
  if (options.mode !== 'original' && !options.body) throw new Error('Provide the agent-prepared --body file.');
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.captureReport && (manifest.captureReport.access !== 'readable' || manifest.captureReport.body.status !== 'apparently_complete')) throw new Error('Browser capture is blocked or needs review. Resolve the source and capture again before finalizing.');
  if (options.images !== manifest.imagesPolicy) throw new Error('Image policy differs from capture. Create a new capture with the selected policy.');
  let body = await readFile(options.body || path.join(dir, 'working.md'), 'utf8');
  if (!body.trim()) throw new Error('The note body is empty.');
  const title = cleanLine(options.title);
  // Avoid duplicate H1 only when it exactly matches the selected title.
  if (body.startsWith(`# ${title}\n`) || body.startsWith(`# ${title}\r\n`)) body = body.slice(body.indexOf('\n') + 1).trimStart();
  const header = [`# ${title}`, '', `> Source: <${manifest.sourceUrl}>`, `> Original title: ${cleanLine(manifest.sourceTitle)}`, `> Captured: ${manifest.capturedAt}`, `> Edition: ${options.mode}${options.language ? ` (${cleanLine(options.language)})` : ''}`];
  if (manifest.author) header.push(`> Author: ${cleanLine(manifest.author)}`);
  if (manifest.captureReport) header.push('> Capture check: no obvious truncation detected in the rendered page (heuristic).');
  if (String(options['keep-source']) === 'true') header.push('> Source copy: [source.md](source.md)');
  const note = header.join('\n') + '\n\n' + body.trimEnd() + '\n';
  const check = await verify(dir, note, options.images);
  if (!check.ok) throw new Error(`Missing or unsafe image references: ${check.missing.join(', ')}`);
  await saveNew(file, note);
  manifest.note = { title, mode: options.mode, language: options.language ?? null, images: options.images, keepSource: String(options['keep-source']) === 'true', finalizedAt: new Date().toISOString() };
  if (!manifest.note.keepSource) {
    // Only remove our own unchanged generated intermediates, after a validated note exists.
    for (const name of ['source.md', 'working.md']) {
      try {
        const intermediate = path.join(dir, name);
        if (manifest.intermediates?.[name] !== digest(await readFile(intermediate))) {
          const warning = `Kept modified intermediate: ${name}`;
          manifest.warnings.push(warning); check.warnings.push(warning);
        } else await unlink(intermediate);
      } catch (e) {
        if (e.code !== 'ENOENT') { const warning = `Could not remove intermediate: ${name}`; manifest.warnings.push(warning); check.warnings.push(warning); }
      }
    }
  }
  await writeFile(manifestPath, json(manifest));
  return { note: file, ...check, sourceRetainedOnDisk: await exists(path.join(dir, 'source.md')) };
}

export async function preferences(config) {
  const data = JSON.parse(await readFile(config, 'utf8'));
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Preferences must be a JSON object.');
  const fields = ['mode','targetLanguage','titleStyle','titlePrefix','customTitle','images','studyAids','keepSource','outputDir','backend','cdpEndpoint','browserProfile','browserChannel'];
  for (const key of Object.keys(data)) if (!fields.includes(key)) throw new Error(`Unknown preference key: ${key}`);
  const p = Object.fromEntries(fields.map(k => [k, data[k] ?? null]));
  for (const [key, values] of Object.entries({ mode: ['original','translate','bilingual'], titleStyle: ['original','translated','custom'], images: ['download','remote'], backend: ['auto','firecrawl','browser'], browserChannel: ['chrome','msedge','chromium'] })) if (p[key] !== null && !values.includes(p[key])) throw new Error(`Invalid preference: ${key}`);
  for (const key of ['targetLanguage','titlePrefix','customTitle','outputDir','cdpEndpoint','browserProfile']) if (p[key] !== null && typeof p[key] !== 'string') throw new Error(`Expected string: ${key}`);
  if (p.keepSource !== null && typeof p.keepSource !== 'boolean') throw new Error('keepSource must be boolean.');
  if (p.studyAids !== null && (!Array.isArray(p.studyAids) || p.studyAids.some(x => !['summary','terminology','questions'].includes(x)))) throw new Error('Invalid studyAids.');
  if (p.outputDir !== null) { if (!p.outputDir.trim()) throw new Error('outputDir cannot be empty.'); p.outputDir = path.resolve(path.dirname(path.resolve(config)), p.outputDir); }
  if (p.browserProfile !== null) { if (!p.browserProfile.trim()) throw new Error('browserProfile cannot be empty.'); p.browserProfile = path.resolve(path.dirname(path.resolve(config)), p.browserProfile); }
  if (p.cdpEndpoint !== null) { const { localCDP } = await import('./browser-capture.mjs'); p.cdpEndpoint = localCDP(p.cdpEndpoint); }
  if (p.cdpEndpoint && p.browserProfile) throw new Error('Choose cdpEndpoint or browserProfile, not both.');
  return p;
}

export function authStatus(env = process.env) {
  return { environmentKeyConfigured: Boolean(env.FIRECRAWL_API_KEY?.trim()) };
}

const HELP = `Article to Note (Node.js 20+)\nCommands:\n  auth-status\n  browser-script --url ZHIHU_URL [--action inspect|expand|scroll]\n  capture --url URL --out NEW_DIR --images download|remote [--backend firecrawl|browser] [--snapshot JSON | --response JSON | --markdown MD]\n    Browser: --cdp http://127.0.0.1:9222 OR --profile EXTERNAL_DIR [--channel chrome|msedge|chromium]\n  finalize --dir DIR --title TITLE --mode original|translate|bilingual --images download|remote --keep-source true|false [--language LANG] [--body MD]\n  verify --dir DIR\n  preferences --config JSON\nDirect Firecrawl capture reads FIRECRAWL_API_KEY. Browser capture reuses local login state without exporting cookies.\n`;
export async function main(argv) {
  if (!argv.length || argv.includes('--help')) { console.log(HELP); return; }
  const [cmd, ...args] = argv;
  const allowed = { 'auth-status': [], 'browser-script': ['url','action'], capture: ['url','out','images','response','markdown','snapshot','backend','cdp','profile','channel'], finalize: ['dir','title','mode','images','keep-source','language','body'], verify: ['dir'], preferences: ['config'] };
  if (!allowed[cmd]) throw new Error('Unknown command. Use --help.');
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !allowed[cmd].includes(key) || args[i + 1] === undefined || args[i + 1].startsWith('--') || key in options) throw new Error(`Invalid/duplicate option: ${args[i]}`);
    options[key] = args[i + 1];
  }
  for (const k of ({ 'auth-status': [], 'browser-script': ['url'], capture: ['url','out','images'], finalize: ['dir','title','mode','images','keep-source'], verify: ['dir'], preferences: ['config'] })[cmd]) if (!options[k]) throw new Error(`Missing --${k}`);
  if (cmd === 'browser-script') { const { hostScript } = await import('./browser-capture.mjs'); console.log(hostScript(options.url, options.action)); return; }
  const result = cmd === 'auth-status' ? authStatus() : cmd === 'capture' ? await capture(options) : cmd === 'finalize' ? await finalize(options) : cmd === 'verify' ? await verify(options.dir) : await preferences(options.config);
  console.log(json(result));
  if (result.ok === false) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(e => { console.error(`Error: ${e.message}`); process.exitCode = 1; });
}
