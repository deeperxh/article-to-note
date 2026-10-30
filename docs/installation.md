# 安装与首次使用

[返回 README](../README.md)

Article to Note 是遵循 [Agent Skills 标准](https://agentskills.io/specification) 的技能包：`SKILL.md` 提供工作流程，`scripts/` 处理文件和抓取，`references/` 提供按需读取的说明。你在所用智能体的聊天窗口中使用它，无需另外启动应用。

面向 Claude Code、Codex、Cursor 等能加载技能、执行 Node.js 脚本、读写笔记目录的宿主。浏览器与网页工具由宿主提供；安装技能不会自动增加宿主原本没有的工具或文件访问权限。

## 推荐安装：Skills CLI

如果让 Codex 的 `$skill-installer` 安装，请明确提供仓库 `deeperxh/article-to-note`、路径 `.` 和名称 `article-to-note`。该仓库的技能位于根目录，安装脚本参数为 `--repo deeperxh/article-to-note --path . --name article-to-note`。仅提供技能名称时，安装器默认查询其精选列表，不会搜索所有 GitHub 仓库。

### 准备环境

先检查：

```sh
node --version
git --version
```

通过 Skills CLI 安装需要 **Node.js ≥22.20.0** 和 Git。请从 [Node.js 官网](https://nodejs.org/) 安装满足要求的 LTS 版本；升级后重新打开终端，已经运行的智能体也可能需要重启。

版本要求分为两层：

| 组件 | Node.js 要求 | 用途 |
| --- | --- | --- |
| Skills CLI（已核对 1.7.4） | ≥22.20.0 | 从仓库发现、安装和更新技能 |
| 本项目脚本 | ≥20 | 抓取、保存文件与精读问答记录 |

如果保留 Node.js 20，可以使用下方的 ZIP 手动安装；它能运行项目脚本，但不能运行 Skills CLI 1.7.4。

### 选择智能体和安装范围

个人安装，供多个项目使用：

```sh
npx skills add deeperxh/article-to-note -g
```

按提示选择已安装的智能体。也可以直接指定目标，任选一条：

```sh
npx skills add deeperxh/article-to-note -g -a claude-code
npx skills add deeperxh/article-to-note -g -a codex
npx skills add deeperxh/article-to-note -g -a cursor
```

只在当前项目使用时，先进入该项目，再省略 `-g`：

```sh
npx skills add deeperxh/article-to-note
```

Windows PowerShell 使用同样的参数。如果执行策略拦截 `npx.ps1`，使用 `npx.cmd`，无需为此修改系统执行策略。

首次出现 `Need to install ... skills@...` 时，npm 正在下载 Skills CLI 安装器。它随后从 GitHub 获取 `deeperxh/article-to-note`，发现 `SKILL.md`，将完整技能文件复制或链接到所选宿主的目录。本项目无需发布到 npm 或预先登记到某个市场。

安装时可能让你选择符号链接或复制。Windows 若无法建立链接，选择 Copy（复制）或在命令中添加 `--copy`。**以安装器输出的实际路径为准**，不要假定所有智能体都使用 Codex 的目录。

安装器不会运行本项目的 `npm ci`、安装浏览器、配置 Firecrawl 或开始抓取文章。

### 共用目录与应用入口

Skills CLI 默认链接模式下，项目主副本位于 `<项目>/.agents/skills/article-to-note/`；加 `-g` 时主副本位于 `~/.agents/skills/article-to-note/`。它按所选智能体的规则创建必要入口，例如 Claude Code 的 `.claude/skills/article-to-note/` 链接。Windows 上可能显示为 Junction（目录联接）。选择 `--copy` 后则使用独立副本。

`.agents` 是多个工具支持的共享目录约定，不是所有智能体都读取的系统注册表；不要写成单数 `.agent`。以安装器输出和宿主实际技能列表为准。同一台电脑、同一用户、同一文件系统环境中的桌面端与 CLI 可以发现同一份技能，但其浏览器、连接器和文件权限可能不同。WSL、远程和云端环境也不一定读取本机用户目录。

`npx add-skill` 是已弃用的旧入口，当前使用 `npx skills add`。

### 确认安装完整

在安装器输出的技能目录中，应至少包含：

```text
article-to-note/
├── SKILL.md
├── package.json
├── package-lock.json
├── scripts/
│   ├── doctor.mjs
│   ├── article-note.mjs
│   └── learning-note.mjs
└── references/
    ├── capture.md
    ├── cli.md
    └── learning.md
```

进入该目录后，可以运行不访问外部服务的检查：

```sh
node scripts/doctor.mjs
```

检查输出中的 `ok`、`skill.root`、`skill.version`、`missingFiles` 和 `issues`。核心自检不要求浏览器可选依赖全部存在；`hostBrowserImport` 与 `browserBackend` 为 false 时，按需安装即可。自检通过只说明运行环境与包完整，不证明宿主已经加载或网页连接可用。

再在所选智能体中新建会话并发送：

> 请检查你能否发现 article-to-note 技能，读取实际加载的 SKILL.md，并从同一技能目录运行 doctor.mjs，告诉我路径、版本及检查结果。暂时不要抓取文章。

找不到技能时，检查安装范围、所选智能体和目录层级，再重新打开宿主。只把 `SKILL.md` 发到聊天中不等于安装完整技能包。

### 更新

个人安装使用：

```sh
npx skills update article-to-note -g
```

项目安装则在原项目中执行 `npx skills update article-to-note -p`。更新前备份自行修改的技能文件；私人偏好、笔记与凭据应保存在技能目录之外。只有通过 Git 克隆的开发副本才使用 `git pull`。

参数与支持的智能体见 [Skills CLI 官方文档](https://github.com/vercel-labs/skills/blob/main/docs/commands.md)。

## 已有安装与重复副本

先请宿主报告实际加载的 `SKILL.md` 路径，并从该目录运行自检。某些 Codex 安装仍会读取 `~/.codex/skills/`；改用 Skills CLI 后，它和 `.agents/skills/` 可能同时被发现，成为两个同名技能。

源码目录、手动复制、Git 克隆和 Skills CLI 管理的安装是不同副本，不会因修改其中一处而自动全部更新。不要用仓库里的新脚本替旧安装“补齐运行”，这会掩盖版本不一致。

如果要改用 Skills CLI：先将旧技能目录完整备份到所有技能搜索目录之外，保留自定义修改，再安装并确认只加载预期副本。私人笔记、凭据和浏览器配置不应留在待更新目录内。更新或迁移不应覆盖已有文章和学习记录。

## ZIP 手动安装

没有 Git、保留 Node.js 20，或不想使用 Skills CLI 时，可手动下载完整包：

1. 打开 [GitHub 仓库](https://github.com/deeperxh/article-to-note)，选择 **Code → Download ZIP**。
2. 完整解压，将直接包含 `SKILL.md`、`scripts/`、`references/` 和 `package.json` 的文件夹重命名为 `article-to-note`。
3. 将整个文件夹放入所用宿主的技能目录，保持文件之间的相对位置。

以下是本地宿主的手动安装路径；`~` 表示用户主目录，Windows 可用 `%USERPROFILE%` 打开：

| 宿主 | 个人技能目录 | 项目技能目录 |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/article-to-note/` | `<项目>/.claude/skills/article-to-note/` |
| Codex | `~/.agents/skills/article-to-note/` | `<项目>/.agents/skills/article-to-note/` |
| 其他宿主 | 按宿主文档选择，或交给 Skills CLI 管理 | 按宿主文档选择 |

路径来源：[Claude Code 官方文档](https://code.claude.com/docs/en/skills#where-skills-live)、[Codex 官方文档](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)。

例如，Windows 手动安装到 Claude Code 的位置是 `%USERPROFILE%\.claude\skills\article-to-note`。打开后应直接看到 `SKILL.md`，不能再套一层 `article-to-note-main`。如果已有旧版，先移到技能目录之外备份，避免两份同名技能同时加载。

## 知乎浏览器依赖

使用知乎浏览器抓取前，需要在**实际安装的技能目录**执行一次依赖安装。Firecrawl 抓取、Markdown 导入和精读问答本身不需要这些可选依赖。

macOS / Linux：先将占位路径替换为安装器显示的实际路径。

```sh
cd "/实际安装路径/article-to-note"
npm ci
node scripts/doctor.mjs --browser
```

Windows PowerShell：同样替换为实际路径。

```powershell
Set-Location 'D:\实际安装路径\article-to-note'
npm.cmd ci
node scripts/doctor.mjs --browser
```

`npm ci` 根据 `package-lock.json` 下载配套工具，生成 `node_modules`，不会自动开始抓文章。自检 `--browser` 要求 Markdown 转换与 Playwright 模块均可加载，但不打开浏览器或验证登录。电脑上还需要 Chrome/Edge 或兼容浏览器。

Agent 会先检查能否读取已有的已登录浏览器会话；不同宿主的浏览器工具不同。不要提前导出 Cookie 或开启调试端口。连接方式见 [宿主浏览器桥接](../references/host-browser.md) 与 [浏览器后端](../references/browser.md)。

## 保存第一篇文章

在所选智能体的聊天窗口中发送：

> 用 article-to-note 保存这篇文章：<文章 URL>。保留原文，下载配图，保留源副本，保存到 `<笔记库路径>/Reading/第一篇文章/`。暂时不开启精读问答。

替换网址和路径。笔记库路径是你存放 Markdown 笔记的文件夹；目标文章子目录应尚不存在，由工具创建。技能目录与笔记目录是两个不同的位置。

普通网页优先使用宿主已连接的 Firecrawl MCP、连接器或插件；没有可用连接时检查环境变量 `FIRECRAWL_API_KEY`。两者都没有才需要按 [凭据配置](../references/cli.md#credential-setup) 私下设置密钥。已有完整 Markdown/JSON 也可直接导入；知乎浏览器路径不需要 Firecrawl key。

保存完成后，在 Obsidian 或其他 Markdown 工具中打开 `note.md`。想继续精读，可以发送：

> 对刚才保存的文章开启精读问答。一次只问一个问题，等我回答后再反馈，把记录保存在同目录的 learning.md。

问答在宿主聊天窗口中进行。下次继续时，指定原来的文章目录，并一起保留 `learning.md` 和 `learning.json`。

## 常见问题

| 现象 | 处理方式 |
| --- | --- |
| `EBADENGINE`，要求 Node.js ≥22.20.0 | 升级 Node.js，重新打开终端，再执行安装命令；`npm` 版本不能代替 Node.js 版本 |
| `node:zlib` 不提供 `crc32` 导出 | 安装器在旧版 Node.js 下启动失败，尚未开始下载技能；升级 Node.js 后重试 |
| 升级后仍显示 `v20.x` | Windows 用 `where.exe node`，macOS/Linux 用 `command -v node` 检查终端实际使用的版本 |
| `npx.ps1` 或 `npm.ps1` 被执行策略拦截 | 分别使用 `npx.cmd` 或 `npm.cmd` |
| 链接创建失败 | 安装时选择 Copy，或添加 `--copy` |
| 智能体找不到技能 | 检查是否选对宿主、个人或项目范围、目录层级，并新建会话 |
| 缺少脚本或 `package.json` | 检查是否安装了完整包，不能只复制 `SKILL.md` |
| `doctor.mjs` 不存在，或没有精读脚本 | 当前安装可能是旧版；先确认实际加载路径，再完整更新，避免混用多个副本 |
| 自检核心通过，浏览器能力为 false | 可选模块尚未安装或无法加载；需要知乎抓取时，在实际技能目录执行 `npm ci` |
| `npm ci` 找不到 `package.json` | 进入安装器显示的技能目录后再执行 |
| 提示需要 Firecrawl 凭据 | 按凭据配置设置；不要将密钥粘贴到聊天 |
| 输出目录已存在 | 选择新的文章子目录，保留旧笔记 |
| 无法写入本机笔记库 | 检查宿主文件访问权限；云端执行环境需要另行传输文件或映射目录 |

## 验证范围

2026-10-29 的本机检查：

- Windows + Node.js 22.20.0 + Skills CLI 1.7.4：公开 GitHub 源的项目复制安装（Codex/Claude Code）和默认链接安装（Codex/Cursor/Claude Code）成功，配套文件齐全。
- 默认链接安装中，Codex 与 Cursor 使用项目 `.agents/skills/` 主副本，Claude Code 的入口为指向主副本的 Windows 目录联接。
- 本机 Codex CLI 0.159.2 的 `skills/list` 实际发现临时项目副本和原有 `.codex/skills/` 用户副本；当前桌面会话也列出了原有用户副本。原有用户副本缺少精读组件，说明不同安装副本不会自动同步。
- Node.js 20.14.0 下的核心、安装自检与 Chrome 合成页面测试结果见本次项目验证；CI 配置将检查 Windows/Linux 的 Node.js 20/22/24 核心行为，不能将待运行的 CI 当成已经完成的跨系统验证。
- v0.2.2 修复目录链接下的命令入口判断，避免通过 `.claude/skills/` 等链接运行时静默退出。18 项自动测试通过，其中包含无可选依赖、其他工作目录、目录联接下的导入 → 成品 → 校验 → 精读状态恢复流程。

以上不代表已在 Claude Code、Codex、Cursor 等各宿主中完成真实网站的端到端抓取。个人范围安装、其他操作系统和各宿主浏览器集成仍需分别验证；本地安装也不等于将技能上传到 Claude 网页版或其他云端服务。
