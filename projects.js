const sourceRoot = "https://github.com/hiqishen/c_utils/tree/main/";
const docsRoot = "https://hiqishen.github.io/extension-publishing/";

export const projects = [
  {
    id: "highlighter",
    name: "网页划线高亮",
    category: "browser",
    categoryLabel: "浏览器扩展",
    folder: "web-highlighter",
    icon: "highlight",
    codeName: "WEB HIGHLIGHTER",
    tagline: "让读过的网页，留下线索。",
    description:
      "圈出重要段落，随手记下想法。把分散的网页阅读，积累成自己的 Markdown 资料库。",
    tags: ["8 色高亮", "批注与标签", "WebDAV 同步"],
    features: [
      "8 色高亮与分层标签，按自己的方式整理阅读。",
      "刷新后恢复文本高亮，把批注留在原文旁。",
      "Markdown 资料库与可选 WebDAV 同步，连接后续笔记工作流。",
    ],
    docs: `${docsRoot}web-highlighter/`,
    store:
      "https://chromewebstore.google.com/detail/bcdmofdnbeiikikmcmjbfbcgjjagafbl",
    storeAvailable: false,
    installNote:
      "截至 2026-10-08，公开商店页面显示内容无法访问，暂时不能通过商店安装。商品页恢复后，可从下方商店链接安装。Chrome 内部页面、扩展商店、PDF 和图片不支持高亮。",
    art: '<div class="mini-paper"><strong>把灵感留在这里。</strong><br>好的工具，<mark>让阅读留下痕迹。</mark><div class="line"></div><div class="line"></div></div><span class="art-annotation">↳ 这一句，值得记住。</span>',
  },
  {
    id: "markdown",
    name: "Markdown Plus",
    category: "browser",
    categoryLabel: "浏览器扩展",
    folder: "markdown-plus",
    icon: "markdown",
    codeName: "READ / EDIT / SAVE",
    tagline: "从打开一份 Markdown 开始。",
    description:
      "在 Chrome 里读、写、保存 Markdown。分栏预览、公式与流程图，让文档顺着思路展开。",
    tags: ["分栏预览", "Mermaid / KaTeX", "本地文件编辑"],
    features: [
      "阅读、编辑和分栏模式，写作与预览一起进行。",
      "支持 Mermaid、KaTeX 和代码高亮。",
      "配套本地助手提供目录树与原文件写回能力。",
    ],
    docs: `${docsRoot}markdown-plus/native-host/`,
    store:
      "https://chromewebstore.google.com/detail/markdown-plus/bjndpbmbpbkmlggbijlloplhkjhhfhai",
    storeAvailable: true,
    installNote:
      "先从 Chrome 应用商店安装扩展。如需写回本机原文件，再下载与你的系统及架构匹配的 0.1.1 商店版助手 ZIP；完整解压后，macOS 运行 install.command，Windows 运行 install.cmd，再回到阅读页检测连接。macOS 助手未提供 Apple Developer ID 签名与公证。",
    art: '<div class="editor-window"><div class="window-bar"><i></i><i></i><i></i><span>ideas.md</span></div><div class="editor-content"><div class="editor-code"># 小小想法<br>**慢慢实现**<br>- 写下来</div><div class="editor-result"><strong>小小想法</strong>慢慢实现<br>• 写下来</div></div></div>',
  },
  {
    id: "search",
    name: "Local Markdown Search",
    category: "browser",
    categoryLabel: "浏览器扩展",
    folder: "chrome-local-markdown-search",
    icon: "search",
    codeName: "YOUR NOTES, ONE SEARCH AWAY",
    tagline: "笔记在本机，搜索在眼前。",
    description:
      "不用记住文件放在哪。通过 Chrome 地址栏或弹窗，直接搜索本机的 Markdown 笔记。",
    tags: ["md 地址栏搜索", "正则匹配", "本机索引"],
    features: [
      "地址栏输入 md 后按空格，快速搜索本机笔记。",
      "普通与正则匹配，支持弹窗结果浏览。",
      "本机 SQLite 索引与使用频次排序，数据保留在本地。",
    ],
    docs: `${docsRoot}local-markdown-search/`,
    store:
      "https://chromewebstore.google.com/detail/local-markdown-search/fdemmbhnpelbmlijaogfngjbfchhhnpa",
    storeAvailable: true,
    installNote:
      "先从 Chrome 应用商店安装扩展，再下载并完整解压本机助手 ZIP。按包内 README 运行对应系统的安装文件，再添加需要索引的 Markdown 目录。安装器会按需准备 uv 与 Python 3.12；安装扩展不会自动安装本机助手。",
    art: '<div class="search-window"><div class="search-input"><kbd>md</kbd><span>今天的灵感</span><svg class="icon"><use href="#icon-search"/></svg></div><div class="search-hit"><span>灵感笔记.md</span><span>notes /</span></div><div class="search-hit"><span>阅读摘录.md</span><span>reading /</span></div><div class="search-hit"><span>项目想法.md</span><span>ideas /</span></div></div>',
  },
  {
    id: "gan",
    name: "gan",
    category: "desktop",
    categoryLabel: "桌面工具",
    folder: "gan",
    icon: "gan",
    codeName: "A LITTLE COFFEE FOR YOUR MAC",
    tagline: "任务继续跑，Mac 先别睡。",
    description:
      "菜单栏里的防休眠开关。倒计时、重复时间规则和状态提示，让长任务安心运行。",
    tags: ["macOS 菜单栏", "快捷倒计时", "重复时间规则"],
    features: [
      "菜单栏管理空闲、系统与合盖防休眠。",
      "快捷倒计时，按需启用并自动结束。",
      "按星期重复的时间规则，支持跨午夜。",
    ],
    docs: null,
    installNote:
      "预发布测试版：macOS 13+、Apple Silicon。打开 DMG，将 gan 拖入 Applications。应用未签名、未公证；如系统阻止打开，请按 macOS 的“隐私与安全性”提示确认来源。",
    art: '<div class="awake-widget"><svg class="icon"><use href="#icon-gan"/></svg><div><strong>02:00</strong><small>剩余防休眠时间</small></div><span class="awake-toggle"></span></div>',
  },
  {
    id: "dream",
    name: "codex-dream-skill",
    category: "ai",
    categoryLabel: "AI 工作流",
    folder: "codex-dream-skill",
    icon: "dream",
    codeName: "MAKE YOUR WORKSPACE YOURS",
    tagline: "让工作界面，有一点你的样子。",
    description:
      "为 Codex DreamSkin 主题准备设计、安装、调试与验证流程，让喜欢的界面真正好用。",
    tags: ["主题设计", "分层背景", "验证与回滚"],
    features: [
      "分开设计背景与文字，兼顾氛围和可读性。",
      "围绕安全 CSS、主题资源与运行副本定位进行调试。",
      "包含验证与回滚流程，帮助检查主题效果。",
    ],
    docs: null,
    installNote:
      "这是 Codex Skill 资源包，不是桌面应用安装器，也不包含成品主题。解压后检查 ~/.agents/skills/codex-dream-skill 是否已存在；确认不会覆盖已有内容后，将完整目录复制到 ~/.agents/skills/，重新打开 Codex 会话并调用 $codex-dream-skill。现有运行探测脚本面向 macOS。",
    art: '<div class="dream-window"><div class="dream-header"><span>CODEX / DREAMSKIN</span><span>✦</span></div><div class="dream-body"><svg class="icon"><use href="#icon-dream"/></svg><span>把界面，调成喜欢的样子。</span></div><div class="dream-swatches"><i></i><i></i><i></i><i></i></div></div>',
  },
].map((project) => ({ ...project, source: sourceRoot + project.folder }));
