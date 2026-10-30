# Article to Note Skill

把网页文章保存为带来源和配图的 Markdown，在 Claude Code、Codex、Cursor 等智能体中完成全文翻译、双语阅读和可恢复的精读问答。

A portable Agent Skill for web articles → Markdown notes, with local images, full translation, bilingual editions, and resumable reading Q&A.

**Repository:** [deeperxh/article-to-note](https://github.com/deeperxh/article-to-note) · **Skill name:** `article-to-note` · Alternative name: `article-to-note-skill`.

Article to Note is an AI agent skill and web clipper for saving articles as Obsidian-compatible Markdown. It can translate complete articles, create bilingual notes, download images, and continue a close-reading conversation. It supports compatible agents including Codex, Claude Code, and Cursor; see the verified scope below.

## Find and install this skill

**Article to Note** (`article-to-note`) is an AI agent skill for turning a web page or article URL into a local Markdown note. It is useful for article clipping, Obsidian notes, English-to-Chinese translation, bilingual reading, image downloads, and studying articles with questions. It also supports individual Zhihu answers and articles. 网页转 Markdown、文章翻译、双语笔记、知乎文章保存和精读问答都可以使用它。

Give your coding agent the repository URL when asking it to install the skill. A name-only search may miss it: Codex's `skill-installer` searches its curated list by default, while other discovery directories have their own indexes. A missing search result does not prevent installation directly from the public repository.

[skills.sh](https://skills.sh/) lists skills using installation telemetry; appearance and search ranking are controlled by that service and are not guaranteed by this repository.

### 让 AI 帮你安装 / Ask an AI to install

将以下内容发给支持安装本地技能的 AI 编程助手：

> 请安装 GitHub 仓库 https://github.com/deeperxh/article-to-note 中的 `article-to-note` skill。`SKILL.md` 位于仓库根目录，请安装完整目录，包括 `scripts/`、`references/`、`package.json` 和 `package-lock.json`，不要只复制 `SKILL.md`。安装后从安装目录运行 `node scripts/doctor.mjs`，并告知我如何在新会话中使用。

For an English prompt: “Install the `article-to-note` skill from https://github.com/deeperxh/article-to-note. The skill is at the repository root; install the complete directory, run `node scripts/doctor.mjs` from the installed directory, and tell me how to use it in a new session.”

Codex 的 `$skill-installer` 默认按名称查找精选列表，不会按名称搜索所有 GitHub 仓库。指定上述仓库，并告诉它根目录路径为 `.`、安装名称为 `article-to-note`；其安装脚本对应参数为 `--repo deeperxh/article-to-note --path . --name article-to-note`。也可使用下面的 Skills CLI 安装方式。

## 安装

```sh
npx skills add deeperxh/article-to-note -g
```

需要 **Git** 和 **Node.js ≥22.20.0** 来运行 [Skills CLI](https://github.com/vercel-labs/skills)。按提示选择智能体；也可以直接指定，任选一条：

```sh
npx skills add deeperxh/article-to-note -g -a claude-code
npx skills add deeperxh/article-to-note -g -a codex
npx skills add deeperxh/article-to-note -g -a cursor
```

`-g` 安装到用户目录，供多个项目使用；只在当前项目使用时，先进入项目，再省略 `-g`。安装器默认将主副本放到 `~/.agents/skills/article-to-note/`，按所选智能体创建必要的目录链接；`--copy` 改为独立复制。共用目录不意味着所有智能体都会自动读取它。

Windows PowerShell 若拦截 `npx.ps1`，使用 `npx.cmd`。安装器要求 Node.js ≥22.20.0，本项目脚本仍支持 20+；遇到 `EBADENGINE` 或缺少 `zlib.crc32` 时，升级 Node.js 后重试。安装命令只获取技能，不自动配置抓取服务或浏览器依赖。

在安装器显示的技能目录运行：

```sh
node scripts/doctor.mjs
```

自检会显示实际路径、版本、缺失文件和可选依赖，不联网、不读取凭据。再新建智能体会话，确认能发现 `article-to-note`。ZIP 安装、旧副本迁移和排障见 [安装指南](docs/installation.md)。

## 开始使用

在智能体聊天中发送，替换网址和笔记库路径：

> 用 article-to-note 保存这篇文章：https://example.com/article。保留原文，下载配图，保留源副本，保存到 `<笔记库路径>/Reading/文章主题/`。

目标文章目录应尚不存在，由工具创建。笔记库就是存放 Markdown 笔记的文件夹，可直接选择 Obsidian vault。完成后打开 `note.md`，无需 Obsidian 插件。

| 想做什么 | 可以这样说 |
| --- | --- |
| 全文翻译 | 把这篇文章完整翻译成中文，标题也翻译，保留代码、公式、配图和源副本 |
| 双语阅读 | 做成段落对齐的中英双语笔记，图片保留一份，解释重要术语 |
| 保存知乎 | 保存这个单个回答或专栏文章，先尝试复用已登录浏览器，报告正文截断或配图失败 |
| 开始精读 | 对刚保存的文章开启精读问答，一次问一个问题，等我回答后再反馈 |
| 接着精读 | 继续 `<文章目录>` 的精读问答，从已保存的记录恢复，不要重新抓取 |

翻译和问答使用宿主智能体的模型，无需另接模型 API；宿主和抓取服务各自的费用仍按对应服务计算。语言、标题、配图、源副本和保存位置由你选择。可选个人偏好模板见 [preferences.example.json](preferences.example.json)，填写后保存在技能目录之外，并告诉 Agent 使用哪个文件。

## 抓取配置

**普通网页：**优先复用宿主已连接的 Firecrawl MCP、连接器或插件。没有可用连接时使用环境变量 `FIRECRAWL_API_KEY`；也可直接导入已有完整 Markdown/JSON。配置方法见 [凭据说明](references/cli.md#credential-setup)，密钥在本机私下设置，不发到聊天。

**知乎：**目前支持 `zhihu.com/question/.../answer/...` 的单个回答和 `zhuanlan.zhihu.com/p/...` 的专栏文章。在实际技能目录执行 `npm ci`（PowerShell 可用 `npm.cmd ci`），再运行 `node scripts/doctor.mjs --browser` 检查可选模块。

Agent 先检查宿主能否读取已有浏览器会话；具备完整 DOM 观察能力时使用 [宿主浏览器桥接](references/host-browser.md)，否则按需使用 [本机浏览器后端](references/browser.md)。浏览器抓取不需要 Firecrawl key，也不会默认将登录态内容发送给 Firecrawl。

遇到登录、验证码、付费限制或疑似正文截断时，会报告问题。渲染页面“未发现明显截断”只是启发式检查；普通导入没有这些证据时标为 `not_assessed`。图片下载失败会保留远程链接并报告；全文翻译的完整性仍由 Agent 对照来源检查。

## 精读问答

精读是可选模式，普通保存不会自动开启。你可以要求解释关键概念、用自己的话复述、联系项目评估方案，或检查论据与反例。Agent 每次保存并提出一个问题，等你的真实回答落盘后，再保存反馈和原文依据。

`learning.json` 保存可恢复状态，`learning.md` 方便阅读。下次继续时保留整个文章目录；即使回答已保存而反馈中断，也能先补反馈。暂停、跳过、澄清和结束均不会编造你的回答。

学习记录由工具维护；手动修改 `learning.md` 后会暂停更新以保护编辑。个人补充建议另存笔记。详细流程见 [精读说明](references/learning.md)。

## 输出文件

```text
Reading/文章主题/
├── note.md              # 原文 / 翻译 / 双语成品
├── source.md            # 来源文本（可选保留）
├── working.md           # 处理图片链接后的中间文本
├── manifest.json        # 来源、配图与警告
├── assets/              # 成功下载的配图
├── capture-report.json  # 浏览器抓取时的检查报告
├── learning.json        # 启用精读时的恢复状态
└── learning.md          # 精读问答阅读视图
```

文章和学习记录相互链接。已有文章目录与成品不会被覆盖；选择不保留源副本时，只清理本次生成且未被修改的中间文件。当前提供普通 Markdown 和相对附件链接，不包含重复文章识别、自动双链或增量同步。

## 兼容性与更新

技能遵循 [Agent Skills 标准](https://agentskills.io/specification)，指令与脚本不绑定模型厂商。完整工作流要求宿主能加载技能、运行 Node.js 并访问目标笔记目录；网页连接器与浏览器能力由宿主提供。

| 已验证 | 范围 |
| --- | --- |
| Codex | 本机桌面会话与 CLI 能发现现有用户副本；CLI 能发现临时项目的 `.agents/skills/` 副本 |
| Skills CLI 1.7.4 | Windows 项目安装：Codex、Cursor 共用主副本，Claude Code 通过目录链接读取；另验证 Codex/Claude Code 复制安装 |
| 脚本 | Windows/Chrome 合成页面、Markdown 导入、图片处理、学习恢复与安装自检 |
| 尚未验证 | 各宿主真实站点的完整交互、macOS/Linux 本机运行、个人范围安装的完整验证 |

安装成功不等于所有宿主都能读取已登录浏览器；桌面端、CLI、WSL 和云端环境也可能使用不同目录与工具。详细验证记录见 [安装指南](docs/installation.md#验证范围)。

通过 Skills CLI 个人安装的副本更新：

```sh
npx skills update article-to-note -g
```

先备份自行修改的技能文件。源码仓库、Git 克隆副本、桌面端已有独立副本不会自动同步；不要同时保留多份同名旧技能。旧版迁移见 [已有安装](docs/installation.md#已有安装与重复副本)。

## 开发与验证

仅验证核心功能，无需安装依赖或打开浏览器：

```sh
npm run check
npm run test:core
```

完整测试需要可选依赖和已安装的 Chrome：

```sh
npm ci
npm test
```

浏览器测试用合成页面和隔离临时配置，不读取用户登录态，也不调用收费服务。可用 `ARTICLE_NOTE_TEST_CHANNEL=msedge` 或 `chromium` 选择其他浏览器，见 [浏览器测试](references/browser.md#tests)。CI 配置覆盖 Windows/Linux 和 Node.js 20/22/24 的核心测试，运行结果以仓库 Actions 为准。

Agent 入口：[SKILL.md](SKILL.md)；命令参考：[CLI](references/cli.md)。预览外部 Markdown 时使用禁用活动 HTML 的查看器。

## 反馈

欢迎报告抓取、翻译覆盖、配图或学习恢复问题。请提供版本、自检结果、宿主、操作系统和复现步骤，移除私人路径、凭据与非公开正文后再提交。
