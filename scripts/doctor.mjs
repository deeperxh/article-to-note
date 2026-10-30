#!/usr/bin/env node
// Offline installation check. Resolves everything from this skill, not the shell's cwd.
import { readFile, realpath, stat } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skillRoot = fileURLToPath(new URL('..', import.meta.url));
const requiredFiles = [
  'SKILL.md', 'package.json', 'package-lock.json', 'preferences.example.json',
  'scripts/doctor.mjs', 'scripts/article-note.mjs', 'scripts/learning-note.mjs',
  'scripts/browser-capture.mjs', 'scripts/zhihu.mjs',
  'references/cli.md', 'references/learning.md', 'references/capture.md',
  'references/host-browser.md', 'references/browser.md'
];

export async function doctor({ root = skillRoot, browser = false, nodeVersion = process.versions.node } = {}) {
  root = await realpath(root);
  const missingFiles = [];
  for (const file of requiredFiles) {
    try {
      const info = await stat(path.join(root, file));
      if (!info.isFile() || !info.size) missingFiles.push(file);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      missingFiles.push(file);
    }
  }
  const issues = [];
  let metadata;
  try {
    metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
    if (metadata.name !== 'article-to-note' || typeof metadata.version !== 'string') issues.push('Invalid skill package metadata.');
    if (lock.version !== metadata.version || lock.packages?.['']?.version !== metadata.version) issues.push('Package and lockfile versions differ.');
  } catch { issues.push('Package metadata or lockfile is missing or invalid JSON.'); }

  const runtimeSupported = /^\d+\.\d+\.\d+/.test(nodeVersion) && Number(nodeVersion.split('.')[0]) >= 20;
  const requireFromSkill = createRequire(path.join(root, 'package.json'));
  const optionalDependencies = [];
  for (const name of ['turndown', 'turndown-plugin-gfm', 'playwright']) {
    try {
      await import(pathToFileURL(requireFromSkill.resolve(name)).href);
      optionalDependencies.push({ name, available: true });
    } catch { optionalDependencies.push({ name, available: false }); }
  }
  const available = name => optionalDependencies.find(item => item.name === name).available;
  const core = runtimeSupported && !missingFiles.length && !issues.length;
  const hostBrowserImport = core && available('turndown') && available('turndown-plugin-gfm');
  const browserBackend = hostBrowserImport && available('playwright');
  return {
    ok: core && (!browser || browserBackend),
    skill: { name: metadata?.name ?? null, version: metadata?.version ?? null, root },
    runtime: { node: nodeVersion, minimum: '20.0.0', supported: runtimeSupported },
    missingFiles, issues, optionalDependencies,
    capabilities: { core, hostBrowserImport, browserBackend },
    nextSteps: !hostBrowserImport || !browserBackend ? ['For Zhihu capture, run npm ci in the reported skill root (npm.cmd ci in Windows PowerShell).'] : [],
    limitations: [
      'Checks files and module loading only; does not open a browser, contact services, or read credentials.',
      'Does not prove agent activation, browser access, Firecrawl authentication, or article completeness.',
      'Skills CLI installation needs Node.js >=22.20.0; this checks the skill runtime only.'
    ]
  };
}

export async function main(argv) {
  if (argv.length === 1 && argv[0] === '--help') {
    console.log('Offline installation check: node scripts/doctor.mjs [--browser]\n--browser also requires the optional Markdown and Playwright modules. No browser is launched.');
    return;
  }
  if (argv.length && (argv.length !== 1 || argv[0] !== '--browser')) throw new Error('Use doctor.mjs [--browser] or --help.');
  const result = await doctor({ browser: argv.includes('--browser') });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
}
