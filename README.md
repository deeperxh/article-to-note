# Article to Note — 把网页阅读变成 Obsidian 笔记

**在 AI 智能体中保存文章、全文翻译、双语精读，再把你的理解和问答记录留在自己的知识库里。**

An agent skill for saving web articles as Obsidian-ready Markdown, with local images, full translation, bilingual editions, and resumable close-reading Q&A. Includes a browser adapter for individual Zhihu answers and articles.

适合使用 Codex 等支持 Agent Skills 的智能体、希望积累中英文阅读笔记的用户。输出是普通 Markdown 和本地附件，可以保存到 Obsidian 库，也可以使用其他 Markdown 工具阅读。

## 能做什么

| 场景 | 你会得到什么 |
| --- | --- |
| 收藏一篇文章 | 保留来源的 Markdown 笔记，可选下载配图 |
| 阅读外文长文 | 全文翻译或段落对齐的双语版本，保留代码和图片位置 |
| 保存知乎内容 | 面向单个回答、专栏文章的本地浏览器适配与抓取检查 |
| 精读并检验理解 | 一次一个问题、你的原始回答、AI 反馈和原文依据 |
| 中断后接着读 | 从文章目录恢复问题与回答，不必依赖旧聊天记录 |

由宿主 Agent 理解、翻译和提问，脚本负责抓取、图片下载、文件保存与检查。无需为翻译或问答额外接入模型 API；宿主模型和 Firecrawl 服务可能各自产生费用。

## 安装与首次使用

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
- 如果两者都没有，请按 Agent 的提示连接服务，或按 [凭据配置步骤](references/cli.md#credential-setup) 在本机设置密钥。密钥不要发到聊天，也不要写进本项目文件。工具不会自动读取 `.env`。
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

## 文章保存与翻译示例

### 保留原文与配图

> 用 article-to-note 保存这篇文章：<URL>。不要改写原文，下载图片，保留来源和作者信息；保存到 `<库路径>/Reading/文章主题/`。

### 全文翻译成中文

> 把这篇英文文章完整翻译成中文：<URL>。标题也翻译，保留代码、公式和图片位置，下载配图，保留原文，再加一段单独标注的学习总结。保存到 `<库路径>/Reading/文章主题/`。

### 中英双语对照

> 用 article-to-note 把这篇文章做成段落对齐的中英双语笔记：<URL>。图片只保留一份，代码保持原样，解释重要术语，保存到 `<库路径>/Reading/文章主题/`。

### 保存知乎回答或专栏文章

> 用 article-to-note 保存这个知乎单个回答：<回答 URL>。先检查能否复用我已经登录的浏览器，保留正文、作者、原链接和配图；如果内容被截断或图片下载失败，明确告诉我。

Agent 会集中询问尚未确定的语言、标题、配图和保存偏好；已经在请求中说明的选项无需重复回答。如需复用个人偏好，可将 [preferences.example.json](preferences.example.json) 复制到技能仓库外，填写后告诉 Agent 使用哪个文件。当前请求优先，不会静默保存永久偏好。

## 精读问答：从“存下来”到“说得清”

精读是**可选模式**，普通保存和翻译不会自动开启。你可以随文章一起启用，也可以对已经保存的文章开始问答。

Agent 会结合文章和你的阅读目标，每次保存并提出一个问题，等你回答后再继续。你的回答先原样落盘，随后保存 AI 反馈；每个问题都带有可核对的原文位置或片段。问题数量不固定，可以按你的节奏暂停、跳过或结束。

### 玩法一：第一次读懂一个概念

> 用 article-to-note 保存这篇文章：<URL>，然后开启精读问答。我是第一次接触这个主题，请从关键概念开始，一次只问一个问题，等我回答后指出理解中的缺口。把问答保存在文章目录的 learning.md 中。

### 玩法二：用自己的话复述

> 对 `<文章目录>` 开启精读问答。先让我用自己的话解释作者的核心观点，再根据我的回答追问。不要先给标准答案；反馈时区分作者的原意和你的补充解释。

### 玩法三：把技术文章联系到项目

> 精读 `<文章目录>` 中的文章。我的目标是判断这个方案是否适合自己的项目，请围绕适用条件、代价和失败场景逐个提问。每次等我回答后再反馈，最后保留完整问答记录。

### 玩法四：检查论证与反例

> 对这篇已保存的文章开启精读问答：`<文章目录>`。围绕“作者的结论由什么证据支持”“有哪些前提”“什么情况可能不成立”来问我。允许我不同意作者，但请检查我的理由是否充分。

这些玩法使用同一套会话记录，由宿主 Agent 根据请求调整提问；不需要额外的模板、模型服务或 Obsidian 插件。

### 一轮问答是什么样

以下为虚构的交互示意，不是真实文章摘录或测试结果。实际问题与反馈以所读文章为依据：

> **Agent：** 文中把缓存作为降低重复计算的方法。你认为缓存可能在什么情况下返回不合适的结果？
>
> **你：** 数据更新了，但缓存还没有失效，可能会读到旧数据。
>
> **Agent：** 你指出了数据新鲜度问题。接下来可以结合文章讨论的失效条件，检查这个解释是否覆盖所有情况。这是对你回答的反馈，补充推断会与原文观点分开标注。
>
> **Agent：** 如果业务允许短时间读到旧数据，你会怎样权衡缓存时间？
>
> *Agent 在这里等待你的下一次回答。*

`learning.md` 会区分 **AI 提问、原文依据、用户回答、AI 反馈**。回答保留你提交的措辞和换行，AI 不会替你编写答案。AI 反馈仍可能有误，需要对照原文判断。

### 暂停、跳过与下次继续

| 你可以这样说 | 会话如何处理 |
| --- | --- |
| “先暂停，保存当前进度。” | 保留当前问题、已保存回答和反馈 |
| “跳过这个问题，换下一个。” | 将尚未回答的问题标记为跳过，不生成虚构回答 |
| “这个问题我没理解，先解释一下。” | 先澄清问题，保留待回答状态 |
| “今天先结束。” | 结束本次会话，未完成的问题仍保留 |
| “继续 `<文章目录>` 中的精读问答。” | 读取已有状态，接着等待回答、补反馈或提出下一题 |

换一个聊天也可以继续：

> 用 article-to-note 继续 `<文章目录>` 里的精读问答。先读取学习记录和文章，从上次停下的地方接着来，不要重新抓取文章，也不要重问已完成的问题。

继续需要宿主能够访问同一文章目录，并且已加载包含精读模式的 Skill 版本。如果中断发生在回答已保存、反馈尚未生成时，恢复后会先处理该回答的反馈。

## 笔记如何保存在 Obsidian 中

将目标目录指定在你的库内即可。选择保留原文、下载图片并启用精读时，典型结果为：

```text
Reading/文章主题/
├── note.md                 # 文章成品：原文 / 翻译 / 双语
├── source.md               # 抓取来源文本
├── working.md              # 图片引用处理后的中间文本
├── learning.md             # 可阅读的精读问答与继续提示
├── learning.json           # 可恢复的学习会话状态
├── manifest.json           # 来源、图片清单与警告
├── capture-report.json     # 仅浏览器抓取时生成
└── assets/                 # 成功下载的配图
```

`note.md` 链接到 `learning.md`；学习记录链接回文章笔记和原网页。启用问答只在文章末尾追加学习记录链接，不改写文章正文或 `source.md`。不启用精读时，不会创建 `learning.*`；选择不保留源副本时，验证后才清理未改动的 `source.md` 和 `working.md`。

**继续学习时，请一起保留文章目录和 `learning.json`。** `learning.md` 是生成的阅读视图，手工编辑后脚本会停止更新以保护改动；个人追加想法建议另存笔记。缺失视图的重建、写入中断等恢复方式见 [精读问答流程](references/learning.md)。

当前通过普通文件与相对图片链接兼容 Obsidian，没有专用插件、自动知识双链、Properties/frontmatter、重复文章识别或增量同步功能。

## 知乎抓取与内容检查

目前适配知乎单个回答（`zhihu.com/question/.../answer/...`）和专栏文章（`zhuanlan.zhihu.com/p/...`）。Agent 先检查宿主是否可以读取已登录的浏览器标签页，能力不可用时才回退到用户提供的本机 CDP 或独立浏览器配置目录。

浏览器抓取记录正文折叠、CSS 截断、加载稳定性和配图情况；遇到登录、验证码、付费限制或疑似不完整正文时，不直接生成正常成品。不会导出 Cookie、自动登录、操作验证码或解锁付费内容，也不会默认将登录态页面内容发送给 Firecrawl。

“未发现明显截断”是启发式检查，不是服务端全文保证。Firecrawl/普通导入没有渲染页面评估时，会标记为 `not_assessed`。完整翻译的语义审核仍由宿主 Agent 负责，图片验证也不能证明全文完整。

配置与诊断详见 [宿主浏览器桥接](references/host-browser.md) 和 [浏览器后端](references/browser.md)。

## 常见问题

**需要 Obsidian 插件吗？**

不需要。脚本写入普通 Markdown 文件与附件，Obsidian 可以直接读取。保存到其他 Markdown 目录同样可用。

**需要另外购买翻译或问答模型 API 吗？**

不需要额外接入翻译模型，语言工作使用宿主 Agent 的模型。宿主自身的订阅或调用费用，以及所选抓取服务的费用仍按对应服务计算。

**所有智能体都能使用吗？**

需要宿主支持 Skill 加载、脚本执行和目标文件访问；知乎路径还需要合适的浏览器工具。不同宿主的工具与权限不同，兼容性应分别验证。

**图片会全部下载吗？**

支持常见 Markdown 图片、引用式图片和 HTML `img/srcset`。下载失败会保留远程链接并报告；复杂 `picture/source`、CSS 背景图等可能需要额外处理。图片里的文字不会自动重绘或翻译。

**能修改学习记录吗？**

可以用 Obsidian 阅读，但 `learning.md` 是脚本管理的视图。直接编辑后脚本会拒绝覆盖，需先保留并处理改动再继续。不要手工修改 `learning.json` 来调整进度；通过对话暂停、跳过或继续即可。

## 开发与验证

在项目目录安装可选依赖并运行测试：

```sh
npm ci
npm test
```

不运行浏览器测试时，可以只检查抓取工具和学习会话：

```sh
node --test tests/article-note.test.mjs tests/learning-note.test.mjs
```

浏览器测试使用真实 Chrome、合成页面和隔离的临时配置目录，不读取用户的实际登录态，不调用收费 API。当前已完成 Windows/Chrome 测试，尚未完成真实知乎登录页面及 macOS/Linux 验证。

脚本入口：

```sh
node scripts/article-note.mjs --help
node scripts/learning-note.mjs --help
```

完整抓取命令见 [CLI 文档](references/cli.md)，精读会话指令见 [学习流程](references/learning.md)，Agent 入口见 [SKILL.md](SKILL.md)。Markdown 正文不进行 HTML 消毒，预览时应禁用活动 HTML。

## 反馈与贡献

欢迎反馈抓取不完整、图片遗漏、翻译结构或精读恢复问题。报告时请提供宿主、操作系统、浏览器版本、复现步骤和不含隐私的错误信息；如可公开，可附原始 URL。涉及登录态、个人回答或非公开文章时，请使用合成示例复现，不上传 Cookie、密钥或私人笔记。
