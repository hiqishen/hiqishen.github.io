import { recommendations } from "./recommendations.js?v=6";
const designRepo = "Devin-AXIS/deepseek-design";
const designSource = "https://github.com/" + designRepo + "/blob/main/README.md";
const designEnvironment = ["DSH", "Node.js ^22.19.0 或 ≥24.0.0（同时满足 DSH 宿主要求）", "pnpm"];
const review = "待实测 · 用例依据作者文档整理";

function designComponent({ id, name, packageName, summary, tags, keywords, useCase, limitation }) {
  return {
    id, name, packageName, summary, tags, keywords, useCase, limitation,
    repo: designRepo, path: "packages/" + packageName, category: "设计创作",
    install: packageName, environment: designEnvironment, source: designSource, review,
    installSteps: [
      "在电脑的 DSH 插件管理器中粘贴 " + packageName + "，安装对应组件。",
      "按作者的 Quick Start 打开工作区，先用一个测试项目验证生成与预览。",
    ],
  };
}

export const plugins = [
  {
    id: "blender", name: "DSH × Blender", category: "三维创作",
    summary: "在 DSH 对话里修改 Blender 场景，检查模型并导出 3D 文件。",
    tags: ["3D 建模", "场景编辑", "GLB"], keywords: ["三维模型", "建模", "渲染", "修改模型", "三维场景", "模型导出", "瓶身", "3D"],
    repo: "sixtysevenlf/dsh-blender-plugin", path: "", packageName: "dsh-blender-plugin",
    install: "dsh-blender-plugin@3.0.6",
    installSteps: [
      "在 v3.0.6 的 Release 下载同版本 dsh_blender_bridge.zip，在 Blender 中安装、启用并连接。",
      "在 DSH Desktop 插件管理器粘贴 dsh-blender-plugin@3.0.6；使用 Web 或 TUI 时装入实际使用的 profile 并重启 DSH。",
      "图形界面模式按作者文档运行 doctor，确认返回 kind=ok。",
    ],
    environment: ["电脑已安装 DSH 和 Blender", "作者验证 Blender 4.2 LTS", "交互建模需要同版 Bridge 扩展"],
    useCase: "用例参考：让 DSH 按几个截面生成瓶身，检查曲面是否相交，再导出 GLB 供其他工具预览。",
    limitation: "本期引用稳定版 3.0.6。3.1 alpha 使用不同的连接方式；旧版和预发布版的桥接扩展不能混用。作者尚未验证 Blender 5.x。",
    source: "https://github.com/sixtysevenlf/dsh-blender-plugin/blob/v3.0.6/README.md", review,
  },
  {
    id: "mnemon", name: "dsh-mnemon", category: "记忆管理",
    summary: "保存跨会话的项目约定，下次对话可以召回并查看读写依据。",
    tags: ["长期记忆", "上下文", "本地存储"], keywords: ["记住项目", "记忆", "找回历史", "恢复上下文", "记住上次的约定", "跨对话", "上次的对话", "memory"],
    repo: "omdsh-dev/dsh-mnemon", path: "", packageName: "dsh-mnemon", install: "dsh-mnemon",
    installSteps: ["在 DSH 插件管理器中安装 dsh-mnemon。", "从一个测试项目写入约定，在新对话里召回并检查引用。"],
    environment: ["DSH；作者列出 0.2.2-rc.1 等版本", "默认使用本地记忆"],
    useCase: "用例参考：保存“项目的测试用 Bun 运行”，另开对话询问测试命令，并查看引用的记忆条目。",
    limitation: "可选的 Mnemon Native 记忆空间需要额外 CLI 或其他 Provider。默认的本地记忆不会自动跨设备同步。",
    source: "https://github.com/omdsh-dev/dsh-mnemon/blob/main/README.md", review,
  },
  {
    id: "genui", name: "GenUI", category: "数据展示",
    summary: "在 DSH 回复中生成可交互的仪表盘、排序表格和 Mermaid 图。",
    tags: ["图表", "交互表格", "Mermaid"], keywords: ["可视化", "仪表盘", "画图", "数据看板", "流程图", "dashboard", "图表"],
    repo: "omdsh-dev/dsh-genui", path: "", packageName: "@changfenhuang/dsh-genui", install: "@changfenhuang/dsh-genui",
    installSteps: ["在 DSH 中安装完整包名 @changfenhuang/dsh-genui。", "重启 DSH Web，强制刷新页面并新开对话。", "请 DSH 用 dsh-ui 生成一张可以排序的服务状态表。"],
    environment: ["DSH Web", "按作者支持的 DSH 与 Node.js 版本安装"],
    useCase: "用例参考：把服务名、状态和延迟整理成仪表盘，点击表头切换服务的排列顺序。",
    limitation: "请保留包名前的 scope。无 scope 的同名包与本条目不同，安装后需要重新打开对话。",
    source: "https://github.com/omdsh-dev/dsh-genui/blob/main/README.md", review,
  },
  designComponent({
    id: "design", name: "DeepSeek Design · Design", packageName: "deepseek-idesign",
    summary: "生成网页和 App 原型，在可视化画布上选中元素继续调整。",
    tags: ["网页原型", "海报", "可视化编辑"], keywords: ["界面", "设计稿", "报名页", "做网页", "网页设计", "画布", "原型"],
    useCase: "用例参考：生成活动报名页，选中页头，用 Ask AI 把标题放大。",
    limitation: "Ask AI 会把修改请求填进对话草稿，需要手动发送。",
  }),
  designComponent({
    id: "ppt", name: "DeepSeek Design · PPT", packageName: "deepseek-ippt",
    summary: "制作和逐页修改演示稿，可导出 PPTX 或 PDF。",
    tags: ["幻灯片", "演示文稿", "PPTX"], keywords: ["做PPT", "幻灯片", "做汇报", "演示稿", "周报", "导出PPT"],
    useCase: "用例参考：生成一份项目汇报，调整其中一页的标题，再导出 PPTX。",
    limitation: "PPT 是单独的组件，需使用对应的包名安装。",
  }),
  designComponent({
    id: "video", name: "DeepSeek Design · Video", packageName: "deepseek-ivideo",
    summary: "用 HyperFrames 模板和时间线制作动态视觉和产品演示。",
    tags: ["视频", "时间线", "产品演示"], keywords: ["做视频", "制作短片", "动态海报", "动画", "时间轴", "视频模板"],
    useCase: "用例参考：选一个产品演示模板，替换画面文字和主题，在时间线上预览后导出。",
    limitation: "视频使用独立工作目录。导出前请按作者说明完成项目校验。",
  }),
  ...recommendations,
];

export const editions = [
  {
    id: "interactive-answers", date: "2026-11-11", title: "让 AI 的回答，变得可以操作",
    coverTitle: "让 AI 的回答，\n变得可以操作",
    teaser: "图表、表格，直接在对话里用",
    dek: "用 GenUI 把服务数据变成能排序的表格和仪表盘，在对话里继续探索。",
    pluginId: "genui", reason: "适合需要直观看数据、调整排序和交互探索的人。作者文档展示了表格、图表和组合界面的用法。",
  },
  {
    id: "blender-studio", date: "2026-11-10", title: "用对话，捏出一个 3D 模型",
    dek: "让 DSH 连上 Blender，从几条截面线开始，做出一个可以导出的瓶身。",
    pluginId: "blender", reason: "适合已经用 Blender 的人。对话修改之后，还能回到同一个场景检查曲面和导出结果。",
  },
  {
    id: "project-memory", date: "2026-11-10", title: "让新对话记住项目约定",
    dek: "用 dsh-mnemon 保存项目规则，在下一次对话中查回它的依据。",
    pluginId: "mnemon", reason: "适合反复向助手交代同一套项目规则的人。召回结果带有来源，便于查清哪条记忆生效。",
  },
  {
    id: "editable-slides", date: "2026-11-10", title: "把项目汇报做成可编辑的幻灯片",
    dek: "从逐页调整，到导出 PPTX，看看 DeepSeek Design 的独立演示组件。",
    pluginId: "ppt", reason: "适合需要继续编辑或交付演示文稿的人，安装时可以只选择 PPT 组件。",
  },
];
