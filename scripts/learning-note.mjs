#!/usr/bin/env node
// Optional reading sessions. No model, browser, or API dependency.
import { readFile, writeFile, appendFile, rename, unlink, lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const hash = text => createHash('sha256').update(text).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const backlink = '\n\n<!-- article-to-note:learning -->\n[精读问答记录](learning.md)\n';
const actions = ['start', 'status', 'ask', 'answer', 'feedback', 'skip', 'pause', 'resume', 'finish', 'sync'];

async function regular(file, required = false) {
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Expected a regular file: ${path.basename(file)}`);
    return true;
  } catch (e) { if (e.code === 'ENOENT' && !required) return false; throw e; }
}

function nonempty(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be nonempty text.`);
  return value;
}

function validate(s) {
  if (s.version !== 1 || !Number.isSafeInteger(s.revision) || s.revision < 1 ||
      !['active', 'paused', 'completed'].includes(s.status) || !Array.isArray(s.turns)) throw new Error('Invalid learning.json session.');
  for (const key of ['title', 'sourceUrl', 'createdAt', 'updatedAt']) nonempty(s[key], key);
  const url = new URL(s.sourceUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid source URL.');
  let pending = false;
  for (let i = 0; i < s.turns.length; i++) {
    const t = s.turns[i];
    if (pending || t.id !== i + 1 || !['awaiting_answer', 'awaiting_feedback', 'reviewed', 'skipped'].includes(t.status)) throw new Error('Invalid learning turn order.');
    nonempty(t.question, 'question'); nonempty(t.evidence, 'evidence');
    if (['awaiting_feedback', 'reviewed'].includes(t.status)) nonempty(t.answer, 'answer');
    if (t.status === 'reviewed') nonempty(t.feedback, 'feedback');
    pending = ['awaiting_answer', 'awaiting_feedback'].includes(t.status);
  }
  return s;
}

function phase(s) {
  const last = s.turns.at(-1);
  return last && ['awaiting_answer', 'awaiting_feedback'].includes(last.status) ? last.status : 'ready';
}

// Indent user/model text literally, so headings and fences cannot impersonate record sections.
const literal = text => String(text).split('\n').map(line => `    ${line}`).join('\n');
export function renderLearning(s) {
  const status = { active: '进行中', paused: '已暂停', completed: '已结束' }[s.status];
  const lines = ['# 精读问答记录', '', '[文章笔记](note.md)', '',
    `原始网页：<${s.sourceUrl}>`, '', '## 会话', '',
    `- 状态：${status}`, `- 修订：${s.revision}`, `- 创建时间：${s.createdAt}`, `- 更新时间：${s.updatedAt}`, '',
    '### 文章标题', '', literal(s.title), '', '### 阅读目标（用户提供）', '', literal(s.goal || '未提供'), '',
    '> 问题、原文依据和反馈由 AI 整理；用户回答按提交文本保存。AI 反馈是解读，可能有误，应对照原文。', ''];
  for (const t of s.turns) {
    lines.push(`## 问题 ${t.id}`, '', `状态：${{ awaiting_answer: '等待用户回答', awaiting_feedback: '等待 AI 反馈', reviewed: '已反馈', skipped: '用户已跳过' }[t.status]}`, '',
      '### AI 提问', '', literal(t.question), '', '### 原文依据（AI 标注，需核对）', '', literal(t.evidence), '',
      '### 用户回答', '', t.answer === undefined ? '（尚未回答）' : literal(t.answer), '',
      '### AI 反馈', '', t.feedback === undefined ? '（尚未反馈）' : literal(t.feedback), '');
  }
  lines.push('## 下次继续', '');
  if (s.status !== 'active') lines.push('请让 Agent 读取本目录的学习会话，执行 resume 后继续；保留尚未回答或尚未反馈的问题。');
  else if (phase(s) === 'awaiting_answer') lines.push(`继续回答问题 ${s.turns.at(-1).id}；不要生成新的问题或替用户作答。`);
  else if (phase(s) === 'awaiting_feedback') lines.push(`先为问题 ${s.turns.at(-1).id} 中已保存的回答提供反馈，再决定下一题。`);
  else lines.push('读取已有记录与文章，根据阅读目标提出下一道问题；一次只问一个。');
  return lines.join('\n') + '\n';
}

async function atomic(file, text) {
  const temp = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temp, text, { flag: 'wx' }); await rename(temp, file); }
  finally { await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
}

async function load(dir) {
  await regular(path.join(dir, 'learning.json'), true);
  return validate(JSON.parse(await readFile(path.join(dir, 'learning.json'), 'utf8')));
}

async function checkView(dir, s) {
  const file = path.join(dir, 'learning.md');
  if (!await regular(file)) return;
  const text = await readFile(file, 'utf8');
  if (text !== renderLearning(s) && hash(text) !== s.previousViewHash) {
    throw new Error('learning.md was edited outside this tool; preserve/reconcile those edits before continuing. learning.json is unchanged.');
  }
}

async function linkNote(dir) {
  const file = path.join(dir, 'note.md');
  await regular(file, true);
  const text = await readFile(file, 'utf8');
  if (!text.includes('[精读问答记录](learning.md)')) await appendFile(file, backlink);
}

function result(dir, s) {
  return { directory: dir, learning: path.join(dir, 'learning.md'), revision: s.revision, status: s.status, phase: phase(s), session: s };
}

export async function learning(action, options) {
  if (!actions.includes(action)) throw new Error('Unknown learning command. Use --help.');
  const dir = path.resolve(nonempty(options.dir, '--dir'));
  if (action === 'status') {
    const s = await load(dir);
    const warnings = [];
    try { await checkView(dir, s); } catch (e) { warnings.push(e.message); }
    if (!await regular(path.join(dir, 'learning.md'))) warnings.push('learning.md is missing; run sync.');
    else if (await readFile(path.join(dir, 'learning.md'), 'utf8') !== renderLearning(s)) warnings.push('learning.md needs sync.');
    await regular(path.join(dir, 'note.md'), true);
    if (!(await readFile(path.join(dir, 'note.md'), 'utf8')).includes('[精读问答记录](learning.md)')) warnings.push('Article backlink missing; run sync.');
    return { ...result(dir, s), warnings };
  }
  // Exclusive per-directory lock plus revision prevents interleaved/stale conversation writes.
  const lockPath = path.join(dir, '.learning.lock');
  let lock;
  try { lock = await open(lockPath, 'wx'); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('Learning session is locked. If a process crashed, confirm it stopped before removing .learning.lock.'); throw e; }
  try {
    await regular(path.join(dir, 'note.md'), true);
    let s;
    if (action === 'start') {
      for (const name of ['learning.json', 'learning.md']) if (await regular(path.join(dir, name))) throw new Error('Learning session already exists; use status/resume.');
      await regular(path.join(dir, 'manifest.json'), true);
      const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
      if (!manifest.note || !manifest.sourceUrl) throw new Error('Finalize the article before starting a learning session.');
      const now = new Date().toISOString();
      s = validate({ version: 1, revision: 1, status: 'active', title: manifest.note.title,
        sourceUrl: manifest.sourceUrl, goal: options.goal || '', createdAt: now, updatedAt: now, turns: [] });
    } else {
      s = await load(dir);
      if (String(s.revision) !== String(options.revision)) throw new Error('Stale/missing --revision. Read status before writing.');
      await checkView(dir, s);
      if (action !== 'sync') {
        if (!await regular(path.join(dir, 'learning.md')) || await readFile(path.join(dir, 'learning.md'), 'utf8') !== renderLearning(s)) {
          throw new Error('Run sync before writing: learning.md needs repair.');
        }
        const previous = renderLearning(s);
        const p = phase(s), turn = s.turns.at(-1);
        if (['ask', 'answer', 'feedback', 'skip'].includes(action) && s.status !== 'active') throw new Error('Session is not active; resume first.');
        const body = ['ask', 'answer', 'feedback'].includes(action) ? nonempty(await readFile(nonempty(options.file, '--file'), 'utf8'), action) : undefined;
        if (action === 'ask') {
          if (p !== 'ready') throw new Error('Resolve the current question before asking another.');
          s.turns.push({ id: s.turns.length + 1, status: 'awaiting_answer', question: body,
            evidence: nonempty(options.evidence, '--evidence'), askedAt: new Date().toISOString() });
        } else if (action === 'answer') {
          if (p !== 'awaiting_answer') throw new Error('No question is waiting for an answer.');
          turn.answer = body; turn.status = 'awaiting_feedback'; turn.answeredAt = new Date().toISOString();
        } else if (action === 'feedback') {
          if (p !== 'awaiting_feedback') throw new Error('Save the real user answer before feedback.');
          turn.feedback = body; turn.status = 'reviewed'; turn.reviewedAt = new Date().toISOString();
        } else if (action === 'skip') {
          if (p !== 'awaiting_answer') throw new Error('Only an unanswered question can be skipped.');
          turn.status = 'skipped'; turn.skippedAt = new Date().toISOString();
        } else if (action === 'pause') s.status = 'paused';
        else if (action === 'resume') s.status = 'active';
        else if (action === 'finish') s.status = 'completed';
        s.previousViewHash = hash(previous); s.revision++; s.updatedAt = new Date().toISOString();
        validate(s);
      }
    }
    // State is authoritative. If rendering/linking fails, sync can recover without replaying a turn.
    if (action !== 'sync') await atomic(path.join(dir, 'learning.json'), json(s));
    try { await atomic(path.join(dir, 'learning.md'), renderLearning(s)); await linkNote(dir); }
    catch (e) { throw new Error(`Session saved at revision ${s.revision}, but output needs repair: ${e.message} Run status then sync; do not replay the answer.`); }
    return result(dir, s);
  } finally { await lock.close(); await unlink(lockPath); }
}

const HELP = `Optional close-reading sessions (Node.js 20+)
  start --dir ARTICLE_DIR [--goal USER_GOAL]
  status --dir ARTICLE_DIR
  ask --dir ARTICLE_DIR --revision N --file QUESTION.txt --evidence "source.md: heading/short excerpt"
  answer --dir ARTICLE_DIR --revision N --file USER_ANSWER.txt
  feedback --dir ARTICLE_DIR --revision N --file AI_FEEDBACK.txt
  skip|pause|resume|finish|sync --dir ARTICLE_DIR --revision N
One pending question at a time. status is read-only. Text files are UTF-8.
learning.json stores durable state; learning.md is its readable projection.
`;

export async function main(argv) {
  if (!argv.length || argv.includes('--help')) { console.log(HELP); return; }
  const [action, ...args] = argv;
  const allowed = { start: ['dir', 'goal'], status: ['dir'], ask: ['dir', 'revision', 'file', 'evidence'],
    answer: ['dir', 'revision', 'file'], feedback: ['dir', 'revision', 'file'] };
  const keys = allowed[action] || (actions.includes(action) ? ['dir', 'revision'] : []);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].slice(2);
    if (!args[i].startsWith('--') || !keys.includes(key) || key in options || args[i + 1] === undefined) throw new Error(`Invalid/duplicate option: ${args[i]}`);
    options[key] = args[i + 1];
  }
  console.log(json(await learning(action, options)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(e => { console.error(`Error: ${e.message}`); process.exitCode = 1; });
}
