# 详细安装与首次使用指南

[返回 README](../README.md) · 已安装 Git 和 Node.js？可以直接使用 [快速安装](../README.md#安装)。

本页提供不使用 Git 的 ZIP 安装步骤、目录解释、环境准备和常见问题排查。

下面以**在自己电脑上运行的 Codex** 为例，从下载开始安装。只需要按照自己系统对应的步骤操作，不需要同时执行 Windows 和 macOS/Linux 两套步骤。

### 第一步：先弄清楚要安装什么

Article to Note 是一个 **Skill（技能包）**：它给 Codex 提供处理文章的指令和配套脚本。你仍然在 Codex 的聊天窗口里使用它，无需另外启动一个 Article to Note 应用。

本文提到的文件分别是：

| 名称 | 是什么 | 你需要做什么 |
| --- | --- | --- |
| Codex | 实际与你对话、执行任务的 AI 应用，也就是有些文档说的“宿主” | 在电脑上安装并能够正常使用 |
| `article-to-note` 文件夹 | 本项目完整的技能包 | 把整个文件夹放到下面指定的位置 |
| `article-to-note/SKILL.md` | **本项目已经自带的入口说明文件**，供 Codex 读取 | 随项目一起复制即可，不用新建，也不用修改 |
| `.agents/skills` 文件夹 | Codex 会查找个人技能的一个固定位置 | 如果没有这个文件夹，按下面步骤创建 |
| Obsidian 库（vault） | 你平时存放 Markdown 笔记的文件夹 | 之后把它的实际位置告诉 Codex |

**`SKILL.md` 指的就是本仓库根目录里那个文件**，不是 Codex 自己的文件，也不是让你在 Obsidian 里写一份新的说明。文件名按项目原样保留为大写 `SKILL.md`。

技能安装目录和笔记保存目录是两回事：技能放在 `.agents/skills/article-to-note`，文章放在你选择的 Obsidian 库或普通笔记文件夹里。

### 第二步：准备 Node.js

本项目的文件保存、图片处理和问答记录脚本需要 **Node.js 20 或更高版本**。Node.js 是运行这些脚本的工具，不是另一个 AI 模型。

先打开终端检查：

- Windows：在开始菜单搜索并打开 **PowerShell**。
- macOS：打开“应用程序 → 实用工具 → 终端”。
- Linux：打开系统终端。

输入以下命令并按回车：

```sh
node --version
```

如果显示 `v20.x.x` 或更高主版本，可以继续。如果提示找不到 `node`，或主版本低于 20，请先从 [Node.js 官网](https://nodejs.org/) 安装满足要求的 LTS 版本。安装完成后，关闭并重新打开终端，再检查一次。若 Codex 此前已经打开，也请退出后重新启动，使它能找到新安装的工具。

### 第三步：下载本项目

不需要 Git，也不需要先运行 `git clone`：

1. 打开 [article-to-note 的 GitHub 页面](https://github.com/deeperxh/article-to-note)。
2. 在文件列表上方点击 **Code**，再点击 **Download ZIP**。
3. 找到下载的 ZIP 文件，将它完整解压。Windows 可以右键选择“全部解压缩”；macOS 可以双击解压。
4. 打开解压后的文件夹。能直接看到 `SKILL.md`、`package.json`、`scripts` 和 `references` 的这一层，就是要安装的项目文件夹。
5. ZIP 解压后的文件夹通常名为 `article-to-note-main`，将这个文件夹重命名为 **`article-to-note`**。

接下来移动的是这整个文件夹，不是单独的 `SKILL.md`。脚本和说明文件需要待在一起。

### 第四步：把项目放到 Codex 的个人技能目录

这里使用 Codex 的**个人技能目录**，安装后可供当前电脑上的该用户使用，不必为每个 Obsidian 库重复安装。路径依据 [OpenAI 官方技能文档](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)。

#### Windows：用文件资源管理器操作

1. 打开“文件资源管理器”。
2. 点击上方地址栏，输入 `%USERPROFILE%`，按回车。这会进入你自己的 Windows 用户文件夹。
3. 在这里打开或新建 `.agents` 文件夹，注意开头有一个英文句点。
4. 在 `.agents` 内打开或新建 `skills` 文件夹。
5. 将第三步准备好的整个 `article-to-note` 文件夹移入 `skills`。

完成后，可以直接把下面这行粘贴到文件资源管理器的地址栏，按回车检查：

```text
%USERPROFILE%\.agents\skills\article-to-note
```

打开后应直接看到本项目的 `SKILL.md`。如果需要再打开一层 `article-to-note` 或 `article-to-note-main` 才能看到它，说明多套了一层文件夹。

#### macOS / Linux：放到自己的用户文件夹下

目标目录是 `~/.agents/skills/`。这里的 `~` 代表你自己的用户主目录。

先在终端运行下面这一行，创建目标目录；如果已经存在，不会清空其中的内容：

```sh
mkdir -p "$HOME/.agents/skills"
```

macOS 可以在 Finder 中按 `Command + Shift + G`，输入 `~/.agents/skills/`，然后将第三步准备好的 `article-to-note` 文件夹移进去。

Linux 可以在文件管理器地址栏输入自己的用户主目录，再进入 `.agents/skills/`；以句点开头的文件夹通常是隐藏的，需要开启“显示隐藏文件”。将 `article-to-note` 文件夹放在这里。

#### 检查最后的目录结构

无论什么系统，关键是 `SKILL.md` 与脚本之间的相对位置保持如下结构：

```text
你的用户主目录/
└── .agents/
    └── skills/
        └── article-to-note/
            ├── SKILL.md           ← 本项目自带的入口文件
            ├── README.md
            ├── package.json
            ├── package-lock.json
            ├── scripts/          ← 保存、抓取与问答脚本
            └── references/       ← 配套使用说明
```

如果目标位置已经有旧版 `article-to-note`，先将旧文件夹移动到技能目录之外备份，再放入新版，避免两份同名技能同时被发现。不要把文章或私人配置保存在技能目录里。

### 第五步：需要保存知乎文章时，安装浏览器依赖

**准备使用知乎抓取的用户需要做这一步。** 如果只使用 Firecrawl 抓取或导入已有 Markdown，可以先跳过；精读问答本身也不需要这些依赖。

以下命令是在刚才安装的 **`article-to-note` 项目目录**里执行，不是在 Obsidian 库里。`npm ci` 会根据项目自带的 `package-lock.json` 下载配套工具，生成 `node_modules` 文件夹，不会自动开始抓文章。

Windows 在 PowerShell 中逐行执行：

```powershell
Set-Location "$env:USERPROFILE\.agents\skills\article-to-note"
npm.cmd ci
```

macOS / Linux 在终端中逐行执行：

```sh
cd "$HOME/.agents/skills/article-to-note"
npm ci
```

命令完成且没有报错后即可继续。如果提示找不到 `npm` 或 `npm.cmd`，先检查第二步的 Node.js 安装。

电脑上还需要 Chrome/Edge 或兼容浏览器。实际保存知乎页面时，Agent 会先检查能否读取你已有的浏览器会话；不要提前导出 Cookie 或开启调试端口。具体访问情况由宿主提供的浏览器工具决定。

### 第六步：让 Codex 确认技能可以使用

回到 Codex，新建一个聊天，发送：

> 请检查你能否发现 article-to-note 技能。如果可以，请读取它自带的 SKILL.md，确认能找到配套脚本和 Node.js，然后告诉我是否可以开始。暂时不要抓取文章。

Codex 通常会自动发现新技能；如果没有发现，先退出并重新打开 Codex，再检查。Codex CLI / IDE 扩展也可以使用 `/skills` 或输入 `$` 选择技能。[官方说明](https://learn.chatgpt.com/docs/build-skills#how-chatgpt-and-codex-use-skills)

如果仍找不到，优先检查第四步的目录结构，尤其是是否多套了一层文件夹、是否只复制了一个文件。只把 `SKILL.md` 发给聊天，也不等同于安装整个技能包。

### 第七步：保存第一篇文章

先找到你自己的 Obsidian 库位置。**库路径就是存放现有笔记的文件夹路径**：可以在 Obsidian 中找到一篇已有笔记，通过文件菜单或右键菜单在系统文件管理器中显示它，再确认所属的库根文件夹。没有使用 Obsidian，也可以选择一个普通笔记文件夹。

例如，你的库位于 `D:\Obsidian\MyVault`，想把一篇文章存入其中的 `Reading\第一篇文章` 新目录，就在 Codex 发送：

> 用 article-to-note 保存这篇文章：这里替换成文章的完整网址。保留原文，下载配图，保留源副本，保存到 `D:\Obsidian\MyVault\Reading\第一篇文章`。暂时不开启精读问答。

发送前，请把“这里替换成文章的完整网址”换成真实链接，并将示例路径换成自己电脑上的真实位置。macOS/Linux 使用本机的完整路径即可，保存要求不变。

你不用事先创建“第一篇文章”这个目录，工具会创建它。如果该目录已经存在，请换一个新的文章目录名称。

第一次抓取普通网页时，还可能需要配置 **Firecrawl（网页抓取服务）**：

- 如果 Codex 已连接可用的 Firecrawl 插件，Agent 会优先复用该连接。
- 如果没有连接，Agent 会检查电脑是否配置了 `FIRECRAWL_API_KEY`。这是 Firecrawl 的访问密钥，不是模型 API key。
- 如果两者都没有，请按 Agent 的提示连接服务，或按 [凭据配置步骤](../references/cli.md#credential-setup) 在本机设置密钥。密钥不要发到聊天，也不要写进本项目文件。工具不会自动读取 `.env`。
- 知乎浏览器路径不需要 Firecrawl key，但需要能正常读取对应页面的浏览器访问能力。

等待 Agent 完成后，它会返回 `note.md` 的保存位置和图片处理结果。若保存位置在你的 Obsidian 库内，回到 Obsidian 即可打开这份笔记；看到图片下载失败的提示时，部分图片仍可能使用远程链接。

**保存成功后，再试精读：**

> 对刚才保存的文章开启精读问答。一次只问一个问题，等我回答后再给反馈，并把记录保存到同一文章目录的 learning.md。

之后的提问、回答与反馈都在 Codex 聊天窗口里进行，不需要你手动运行问答脚本。`learning.md` 用来在 Obsidian 中查看记录，下次继续时请一起保留同目录的 `learning.json`。

### 安装遇到问题时

| 现象 | 先检查什么 |
| --- | --- |
| Codex 找不到 article-to-note | 检查个人技能目录和文件夹层级，然后重新打开 Codex |
| 提示找不到 `SKILL.md` 或脚本 | 确认复制了整个项目，而不是只复制一个文件；入口文件位于 `article-to-note/SKILL.md` |
| 提示找不到 `node` | 安装 Node.js 20+，重新打开终端与 Codex |
| `npm ci` 提示找不到 `package.json` | 先进入安装好的 `article-to-note` 目录，再执行安装命令 |
| PowerShell 提示不允许运行 `npm.ps1` | 使用上面给出的 `npm.cmd ci` |
| 提示需要 Firecrawl 凭据 | 按前面的抓取服务说明配置；不要将密钥粘贴到聊天 |
| 提示输出目录已存在 | 换一个尚不存在的文章子目录，不要删除旧笔记来重试 |
| Agent 无法写入 Obsidian 库 | 核对库路径，并按所用应用的权限提示允许访问；云端运行的 Agent 不一定能访问本机文件 |

以上安装路径针对本机 Codex。其他智能体应用有自己的技能加载规则，不能直接套用 Codex 路径；本项目不要求 Obsidian 插件，但需要所用 Agent 能读取技能、运行 Node.js 并访问目标笔记目录。
