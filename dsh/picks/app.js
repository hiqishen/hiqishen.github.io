import { plugins, editions } from "./data.js?v=3";
import { getScan } from "./scan.js";
import { searchPlugins, loadSubmissions, saveSubmission } from "./flows.js";

const main = document.querySelector("#main");
const nav = document.querySelector(".bottom-nav");
const paths = {
  home: "M3 10 12 3l9 7v10H6V10m3 10v-7h6v7",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  square: "M3 4h18v13H9l-6 4V4m5 5h8m-8 4h5",
  plugin: "m12 3 9 5v9l-9 5-9-5V8l9-5m0 0v19M3 8l9 5 9-5",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
};
let route,
  params,
  searchTimer,
  lastFocusKey = "";
const scrollPositions = new Map();
let searchState = new URLSearchParams();
let activeHash = "";
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = String(text);
  return n;
}
function icon(name) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.5");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(s.namespaceURI, "path");
  p.setAttribute("d", paths[name] || paths.plugin);
  s.append(p);
  return s;
}
function link(text, href, cls = "") {
  const a = el("a", cls, text);
  a.href = href;
  return a;
}
function external(text, url, cls = "detail-link") {
  const a = link(text, safeURL(url), cls);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}
function safeURL(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : "#";
  } catch {
    return "#";
  }
}
function btn(text, cls, fn) {
  const b = el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
}
function url(path, extra = {}) {
  const p = new URLSearchParams();
  if (["search", "plugin"].includes(path.split("/")[0])) {
    const source = ["search", "plugin"].includes(route?.[0])
      ? params
      : searchState;
    for (const key of ["q", "category"]) {
      const value = source.get(key);
      if (value) p.set(key, value);
    }
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const q = p.toString();
  return "#/" + path + (q ? "?" + q : "");
}
function go(path, extra = {}) {
  location.hash = url(path, extra).slice(1);
}
function notify(text) {
  const n = document.querySelector("#toast");
  n.textContent = text;
  clearTimeout(n._timer);
  n._timer = setTimeout(() => {
    n.textContent = "";
  }, 4200);
}
function localRecords() {
  try {
    return loadSubmissions(localStorage);
  } catch (e) {
    notify(e.message);
    return [];
  }
}
function date(value) {
  const d = new Date(value);
  return Number.isNaN(d.valueOf())
    ? String(value)
    : d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
}
function pageHead(title, desc) {
  const n = el("div", "page-head");
  n.append(el("h1", "", title));
  if (desc) n.append(el("p", "", desc));
  main.append(n);
}
function section(title, body) {
  const s = el("section", "detail-section");
  s.append(el("h2", "", title));
  if (typeof body === "string") s.append(el("p", "", body));
  else if (body) s.append(body);
  return s;
}
function back(path = "search", text = "返回插件列表") {
  return link("← " + text, url(path), "back-link");
}
function heading(title, action) {
  const h = el("div", "section-heading");
  h.append(el("h2", "", title));
  if (action) h.append(action);
  return h;
}

const looks = {
  blender: {
    symbol: "B",
    color: "orange",
    title: "DSH × Blender",
    note: "需要 Blender + Bridge",
    description: "用对话建模、修改场景，导出 3D 文件",
  },
  mnemon: {
    symbol: "m",
    color: "green",
    title: "dsh-mnemon",
    note: "本地记忆 · 可查来源",
    description: "换个对话，也记得你的项目约定",
  },
  genui: {
    symbol: "UI",
    color: "violet",
    title: "GenUI",
    note: "DSH Web · 重启后生效",
    description: "把回答变成能排序、能操作的界面",
  },
  design: {
    symbol: "D",
    color: "blue",
    title: "DeepSeek Design",
    note: "独立组件 · deepseek-idesign",
    description: "生成网页原型，选中元素继续改",
  },
  ppt: {
    symbol: "P",
    color: "coral",
    title: "DeepSeek Design · PPT",
    note: "独立组件 · deepseek-ippt",
    description: "逐页修改演示稿，导出 PPTX",
  },
  video: {
    symbol: "V",
    color: "pink",
    title: "DeepSeek Design · Video",
    note: "独立组件 · deepseek-ivideo",
    description: "用模板与时间线制作产品演示",
  },
};
const previews = {
  genui: {
    url: "https://raw.githubusercontent.com/omdsh-dev/dsh-genui/main/assets/showcase-panel.png",
    caption: "作者展示的可排序服务面板",
    page: "https://github.com/omdsh-dev/dsh-genui/blob/main/README.md",
  },
  mnemon: {
    url: "https://raw.githubusercontent.com/omdsh-dev/dsh-mnemon/main/docs/assets/webui-v0.5.32/en/memory-graph.jpg",
    caption: "作者展示的记忆关系图",
    page: "https://github.com/omdsh-dev/dsh-mnemon/blob/main/README.md",
  },
};
function pluginMark(plugin, cls = "") {
  const look = looks[plugin.id];
  const mark = el("span", "plugin-mark " + look.color + " " + cls, look.symbol);
  mark.setAttribute("aria-hidden", "true");
  return mark;
}
function card(p) {
  const look = looks[p.id];
  const a = link("", url("plugin/" + encodeURIComponent(p.id)), "plugin-card");
  a.append(pluginMark(p));
  const content = el("div", "plugin-copy");
  content.append(el("h3", "", look.title), el("p", "", look.description));
  const note = el("div", "plugin-note", look.note);
  content.append(note);
  const arrow = el("span", "row-arrow", "›");
  arrow.setAttribute("aria-hidden", "true");
  a.append(content, arrow);
  return a;
}
function sourcePreview(plugin) {
  const preview = previews[plugin.id];
  if (!preview) return null;
  const figure = el("figure", "source-preview");
  const a = external("", preview.url, "screenshot-link");
  a.setAttribute("aria-label", preview.caption + "，打开原图");
  const img = el("img");
  img.src = preview.url;
  img.alt = preview.caption;
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.addEventListener(
    "error",
    () => {
      a.href = preview.page;
      a.replaceChildren(
        el("span", "preview-unavailable", "到作者文档查看界面 ↗"),
      );
    },
    { once: true },
  );
  a.append(img);
  const caption = el("figcaption", "", preview.caption + " · ");
  caption.append(external("来源 ↗", preview.page, "preview-source"));
  figure.append(a, caption);
  return figure;
}

function renderNav() {
  nav.replaceChildren();
  for (const [id, label] of [
    ["home", "推荐"],
    ["search", "找插件"],
    ["square", "需求广场"],
  ]) {
    const a = link(
      "",
      url(id, { from: "", duplicate: "", requestId: "", title: "" }),
      "nav-item",
    );
    a.append(icon(id), el("span", "", label));
    const selected =
      id === "home"
        ? ["home", "edition"].includes(route[0])
        : id === "search"
          ? ["search", "plugin"].includes(route[0])
          : ["square", "request", "submit", "receipt"].includes(route[0]);
    if (selected) a.setAttribute("aria-current", "page");
    nav.append(a);
  }
}

function homeSearch() {
  const form = el("form", "home-search search-box");
  form.setAttribute("role", "search");
  const input = el("input");
  input.type = "search";
  input.maxLength = 256;
  input.enterKeyHint = "search";
  input.placeholder = "找插件，或说说你想做什么";
  input.setAttribute("aria-label", "搜索插件名称或需求");
  const submit = el("button", "search-submit", "搜索");
  submit.type = "submit";
  submit.setAttribute("aria-label", "搜索");
  form.append(icon("search"), input, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    go("search", { q: input.value, category: "" });
  });
  return form;
}
function home(editionId) {
  if (editionId) {
    const edition = editions.find((item) => item.id === editionId);
    if (!edition) {
      notFound("没有找到这个选题", "回到推荐，看看最新内容。");
      return;
    }
    return editionPage(edition);
  }
  main.append(homeSearch());
  const categories = el("nav", "home-categories");
  categories.setAttribute("aria-label", "按用途探索");
  for (const [title, category] of [
    ["全部", ""],
    ["记忆管理", "记忆管理"],
    ["设计创作", "设计创作"],
    ["三维创作", "三维创作"],
    ["数据展示", "数据展示"],
  ]) {
    categories.append(
      link(title, url("search", { category, q: "" }), "category-link"),
    );
  }
  main.append(categories);
  const edition = editions[0];
  const featured = plugins.find((plugin) => plugin.id === edition.pluginId);
  const feature = link("", url("edition/" + edition.id), "feature-card");
  const featureCopy = el("div", "feature-copy");
  const label = el(
    "span",
    "feature-label",
    "本期精选 · " + looks[featured.id].title,
  );
  featureCopy.append(
    label,
    el("h1", "", edition.coverTitle || edition.title),
    el("p", "", edition.teaser || edition.dek),
  );
  const cta = el("span", "feature-cta", "看看怎么用");
  cta.append(icon("arrow"));
  featureCopy.append(cta);
  const visual = el("div", "feature-visual");
  visual.setAttribute("aria-hidden", "true");
  const window = el("div", "mini-window");
  window.append(el("span", "mini-window-title", looks[featured.id].title));
  if (previews[featured.id]) {
    const image = el("img");
    image.src = previews[featured.id].url;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    image.addEventListener(
      "error",
      () =>
        image.replaceWith(
          el("span", "image-fallback", looks[featured.id].title),
        ),
      { once: true },
    );
    window.append(image);
  } else {
    window.append(pluginMark(featured, "large"));
  }
  visual.append(
    el("span", "visual-orbit"),
    window,
    el(
      "span",
      "visual-label",
      previews[featured.id] ? "作者界面" : featured.category,
    ),
  );
  feature.append(featureCopy, visual);
  main.append(feature);
  main.append(
    heading(
      "值得一试",
      link(
        "全部 " + plugins.length + " 个",
        url("search", { q: "", category: "" }),
        "text-link",
      ),
    ),
  );
  const list = el("div", "plugin-grid");
  ["mnemon", "blender", "ppt"].forEach((id) =>
    list.append(card(plugins.find((p) => p.id === id))),
  );
  main.append(list);
  main.append(heading("按场景探索"));
  const topics = el("div", "topic-grid");
  const topicData = [
    ["project-memory", "mnemon", "少重复交代", "让项目约定跟着对话走"],
    ["editable-slides", "ppt", "交出一份汇报", "从生成到可编辑的 PPTX"],
  ];
  for (const [id, pluginId, title, subtitle] of topicData) {
    const p = plugins.find((item) => item.id === pluginId);
    const item = link(
      "",
      url("edition/" + id),
      "topic-card " + looks[pluginId].color,
    );
    item.append(
      pluginMark(p),
      el("h3", "", title),
      el("p", "", subtitle),
      el("span", "topic-arrow", "↗"),
    );
    topics.append(item);
  }
  main.append(topics);
  const contribute = link("", url("square"), "contribute-link");
  contribute.append(
    icon("square"),
    el("span", "", "找不到合适的？来提需求"),
    el("span", "row-arrow", "›"),
  );
  main.append(contribute);
}
function editionPage(edition) {
  const plugin = plugins.find((p) => p.id === edition.pluginId);
  main.append(back("home", "返回推荐"));
  const article = el("article", "edition-page");
  article.append(
    el("div", "article-meta", date(edition.date) + " · 精选用例"),
    el("h1", "", edition.title),
    el("p", "article-dek", edition.dek),
  );
  const brief = card(plugin);
  brief.href = url("plugin/" + plugin.id, { from: "edition/" + edition.id });
  article.append(brief);
  const preview = sourcePreview(plugin);
  if (preview) article.append(preview);
  article.append(
    section("适合谁用", edition.reason),
    section("可以这样开始", plugin.useCase),
  );
  const tags = el("div", "tags");
  plugin.environment.forEach((text) => tags.append(el("span", "tag", text)));
  article.append(
    section("使用前了解", tags),
    el("p", "muted", plugin.limitation),
  );
  const actions = el("div", "article-actions");
  actions.append(
    link(
      "查看安装与详情",
      url("plugin/" + plugin.id, { from: "edition/" + edition.id }),
      "primary",
    ),
  );
  actions.append(
    btn("复制本期链接", "secondary", () => {
      const share = new URL(location.href);
      share.hash = "/edition/" + edition.id;
      copy(share.href);
    }),
  );
  article.append(
    actions,
    el("p", "evidence-note", "用例根据作者文档整理 · 待实际运行验证"),
  );
  main.append(article);
}

function search() {
  pageHead("找插件", "从具体问题，找到合适的工具。");
  const box = el("div", "search-box");
  box.append(icon("search"));
  const input = el("input");
  input.type = "search";
  input.maxLength = 256;
  input.placeholder = "试试：3D 建模、记忆、做 PPT";
  input.value = params.get("q") || "";
  input.setAttribute("aria-label", "搜索插件名称或需求");
  box.append(input);
  const clear = btn("×", "clear-search", () => {
    input.value = "";
    apply();
    input.focus();
  });
  clear.setAttribute("aria-label", "清空搜索");
  box.append(clear);
  main.append(box);
  const chips = el("div", "chips");
  const cats = ["", ...new Set(plugins.map((p) => p.category))];
  cats.forEach((c) => {
    const b = btn(c || "全部", "chip", () => {
      params.set("category", c);
      if (!c) params.delete("category");
      history.replaceState(null, "", url("search"));
      searchState = new URLSearchParams(params);
      renderNav();
      renderResults();
      for (const n of chips.children)
        n.setAttribute("aria-pressed", String(n === b));
    });
    b.setAttribute(
      "aria-pressed",
      String((params.get("category") || "") === c),
    );
    chips.append(b);
  });
  main.append(chips);
  const results = el("section");
  results.setAttribute("aria-live", "polite");
  main.append(results);
  function renderResults() {
    results.replaceChildren();
    const list = searchPlugins(
      plugins,
      input.value,
      params.get("category") || "",
    );
    const meta = el("div", "result-meta");
    meta.append(
      el("span", "", list.length + " 个精选插件"),
      el("span", "", "说明已核对 · 使用待实测"),
    );
    results.append(meta);
    if (list.length) {
      const grid = el("div", "plugin-grid");
      list.forEach((p) => grid.append(card(p)));
      results.append(grid);
    } else {
      const empty = el("div", "empty");
      empty.append(
        el("h2", "", "这个需求，暂时还没找到"),
        el("p", "", "换一个关键词，或把你想实现的功能记到需求广场。"),
        link(
          "带着需求，求开发 →",
          url("submit/request", { title: input.value }),
          "primary",
        ),
      );
      results.append(empty);
    }
    const tail = el("div", "community-note");
    tail.append(
      el("p", "", "已有插件不合适？把场景说清楚，让下一件工具从这里开始。"),
      link(
        "求开发 ↗",
        url("submit/request", { title: input.value }),
        "text-link",
      ),
    );
    results.append(tail);
  }
  function apply() {
    if (input.value) params.set("q", input.value);
    else params.delete("q");
    history.replaceState(null, "", url("search"));
    searchState = new URLSearchParams(params);
    renderNav();
    renderResults();
  }
  let composing = false;
  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    apply();
  });
  input.addEventListener("input", () => {
    if (!composing) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(apply, 120);
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !composing) {
      clearTimeout(searchTimer);
      apply();
    }
    if (e.key === "Escape") {
      input.value = "";
      apply();
    }
  });
  input.addEventListener("change", () => {
    if (!composing) apply();
  });
  renderResults();
}

function detail(id) {
  const p = plugins.find((item) => item.id === id);
  if (!p) {
    notFound();
    return;
  }
  const origin = params.get("from");
  main.append(
    back(
      origin?.startsWith("edition/") ? origin : "search",
      origin?.startsWith("edition/") ? "返回推荐" : "返回插件列表",
    ),
  );
  const head = el("header", "detail-header");
  const identity = el("div", "detail-identity");
  identity.append(
    el("h1", "", looks[p.id].title),
    el("p", "", p.category + " · DSH 插件"),
  );
  head.append(pluginMark(p, "large"), identity);
  main.append(head, el("p", "detail-summary", looks[p.id].description));
  const facts = el("div", "detail-facts");
  facts.append(
    el("span", "", looks[p.id].note),
    el("span", "", "文档已核对 · 待实测"),
  );
  main.append(facts);
  const install = el("section", "install-panel");
  const installHeading = el("div", "install-heading");
  installHeading.append(
    el("h2", "", "安装地址"),
    btn("复制", "copy-chip", () => copy(p.install)),
  );
  install.append(installHeading, el("code", "install-code", p.install));
  main.append(install);
  const actions = el("div", "detail-actions");
  actions.append(
    btn("复制安装清单", "primary", () =>
      copy(
        [
          p.name,
          "安装引用 " + p.install,
          "",
          "使用环境",
          ...p.environment.map((text) => "• " + text),
          "",
          "安装步骤",
          ...p.installSteps.map((step, index) => index + 1 + ". " + step),
          "",
          "作者说明 " + p.source,
          "",
          p.review,
        ].join("\n"),
      ),
    ),
    btn("分享", "secondary share-button", () => {
      const share = new URL(location.href);
      share.hash = "/plugin/" + p.id;
      copy(share.href);
    }),
  );
  main.append(actions);
  const preview = sourcePreview(p);
  if (preview) main.append(preview);
  const useCase = el("div", "use-case");
  useCase.append(
    icon("check"),
    el("p", "", p.useCase.replace(/^用例参考[：:]\s*/, "")),
  );
  main.append(section("用它做什么", useCase));
  const environment = el("ul");
  p.environment.forEach((text) => environment.append(el("li", "", text)));
  main.append(section("准备与安装", environment));
  const steps = el("ol", "install-steps");
  p.installSteps.forEach((text) => steps.append(el("li", "", text)));
  main.append(steps, el("p", "limitation", p.limitation));
  const scan = el("div", "scan-status");
  scan.append(el("strong", "", "正在读取扫描记录…"));
  main.append(section("安全与验证", scan));
  getScan(p).then((result) => {
    if (!scan.isConnected) return;
    scan.replaceChildren(
      el("strong", "", result.label),
      el("p", "", result.detail),
    );
    if (result.url) scan.append(external("查看原报告 ↗", result.url));
  });
  const review = el("details", "review-section");
  const summary = el("summary");
  summary.append(el("span", "", "编辑评测"), el("span", "muted", "待实测"));
  const dimensions = el("ul", "review-dimensions");
  ["功能完成度", "安装上手", "运行稳定性"].forEach((text) => {
    const row = el("li");
    row.append(
      el("span", "", text + " · 5 分制"),
      el("span", "muted", "待实测"),
    );
    dimensions.append(row);
  });
  review.append(summary, dimensions, el("p", "evidence-note", p.review));
  main.append(review);
  const sources = el("div", "source-links");
  sources.append(
    external("作者仓库 ↗", "https://github.com/" + p.repo),
    external("使用说明 ↗", p.source),
  );
  main.append(sources);
}

async function copy(value, code) {
  try {
    await navigator.clipboard.writeText(value);
    notify("已复制");
  } catch {
    if (code) {
      const r = document.createRange();
      r.selectNodeContents(code);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      notify("自动复制不可用，已选中地址，请长按或手动复制");
    } else showCopyFallback(value);
  }
}
function showCopyFallback(value) {
  const dialog = el("dialog", "copy-dialog");
  const title = el("h2", "", "手动复制");
  title.id = "copy-dialog-title";
  dialog.setAttribute("aria-labelledby", title.id);
  const text = el("textarea", "install-code");
  text.value = value;
  text.readOnly = true;
  text.setAttribute("aria-label", "需要复制的内容");
  dialog.append(
    title,
    el("p", "form-hint", "自动复制不可用。内容已选中，可长按或使用系统复制。"),
    text,
    btn("完成", "primary", () => dialog.close()),
  );
  dialog.addEventListener("close", () => dialog.remove());
  main.append(dialog);
  dialog.showModal();
  text.focus();
  text.select();
  text.setSelectionRange(0, value.length);
}
function square() {
  pageHead("需求广场", "需要什么工具，或做了什么好插件？");
  const actions = el("div", "form-actions");
  for (const [title, note, path, tone, glyph] of [
    [
      "我需要一个插件",
      "说说你的使用场景",
      "submit/request",
      "primary",
      "square",
    ],
    [
      "推荐 / 自荐插件",
      "分享你发现的好工具",
      "submit/nomination",
      "secondary",
      "plugin",
    ],
  ]) {
    const action = link("", url(path), tone + " contribution-action");
    action.setAttribute("aria-label", title);
    action.append(icon(glyph), el("strong", "", title), el("span", "", note));
    actions.append(action);
  }
  main.append(
    actions,
    el("p", "form-note", "原型体验 · 提交记录保存在当前浏览器"),
  );
  const records = localRecords();
  if (!records.length) {
    const empty = el("div", "empty");
    empty.append(
      el("h2", "", "还没有本机记录"),
      el(
        "p",
        "",
        "从上面选一个入口开始。保存后，可以在这里查看需求、自荐和关联方案。",
      ),
    );
    main.append(empty);
    return;
  }
  main.append(heading("本机记录", el("small", "", records.length + " 条")));
  const list = el("div", "submission-list");
  [...records].reverse().forEach((r) => {
    const a = link(
      "",
      url(r.kind === "request" ? "request/" + r.id : "receipt/" + r.id),
      "submission-card",
    );
    const meta = el("div", "submission-meta");
    meta.append(
      el("span", "", r.kind === "request" ? "求开发" : "插件自荐"),
      el("span", "status", "本机待核验"),
    );
    a.append(
      meta,
      el("h3", "", r.title),
      el("p", "", r.description),
      el("p", "", r.id + " · " + date(r.createdAt)),
    );
    list.append(a);
  });
  main.append(list);
}
function field(label, type, name, value = "", hint = "") {
  const wrap = el("label", "field");
  wrap.append(el("span", "", label));
  const input = el(
    type === "textarea" ? "textarea" : type === "select" ? "select" : "input",
  );
  input.name = name;
  if (type !== "textarea" && type !== "select") input.type = type;
  input.value = value;
  wrap.append(input);
  if (hint) wrap.append(el("small", "", hint));
  return { wrap, input };
}
function submit(kind) {
  kind = kind === "nomination" ? "nomination" : "request";
  main.append(back("square", "返回需求广场"));
  pageHead(
    kind === "request" ? "我需要一个插件" : "推荐 / 自荐插件",
    kind === "request"
      ? "从具体场景开始，比一个功能名更有帮助。"
      : "已有方案或你做的插件，都可以留下本机记录。",
  );
  const form = el("form", "form-wrap");
  form.append(
    el(
      "p",
      "form-note",
      "原型体验 · 仅保存到当前浏览器，请勿填写个人信息或密钥。",
    ),
  );
  const requestId = params.get("requestId");
  const target = localRecords().find(
    (r) => r.id === requestId && r.kind === "request",
  );
  if (kind === "nomination" && requestId && !target) {
    main.append(
      el(
        "p",
        "form-error",
        "当前浏览器找不到要关联的需求。请从需求广场重新打开需求后自荐。",
      ),
    );
    return;
  }
  if (target) form.append(el("p", "form-hint", "关联需求：" + target.title));
  const title = field(
    kind === "request" ? "需求标题" : "插件 / 方案名称",
    "text",
    "title",
    params.get("title") || "",
  );
  title.input.required = true;
  title.input.minLength = 2;
  title.input.maxLength = 100;
  const description = field(
    kind === "request" ? "你想解决什么问题？" : "它如何解决问题？",
    "textarea",
    "description",
    "",
    "说明使用场景、当前做法、期望结果。8–2000 字。",
  );
  description.input.required = true;
  description.input.minLength = 8;
  description.input.maxLength = 2000;
  form.append(title.wrap, description.wrap);
  let repo, known;
  if (kind === "nomination") {
    known = field("选择已收录插件（可选）", "select", "pluginId");
    const blank = el("option", "", "未收录，我填写仓库");
    blank.value = "";
    known.input.append(blank);
    plugins.forEach((p) => {
      const option = el("option", "", p.name);
      option.value = p.id;
      known.input.append(option);
    });
    repo = field(
      "GitHub 仓库地址",
      "url",
      "repo",
      "",
      "选择已收录插件后可留空；未收录方案请填写公开 GitHub 仓库。",
    );
    repo.input.placeholder = "https://github.com/owner/repo";
    known.input.addEventListener("change", () => {
      repo.input.disabled = Boolean(known.input.value);
      if (known.input.value) repo.input.value = "";
    });
    form.append(known.wrap, repo.wrap);
  }
  const error = el("p", "form-error");
  error.setAttribute("role", "alert");
  const save = el("button", "primary", "保存到本机并获取回执");
  save.type = "submit";
  form.append(error, save);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";
    save.disabled = true;
    try {
      const input = {
        kind,
        title: title.input.value,
        description: description.input.value,
      };
      if (kind === "nomination") {
        if (known.input.value) input.pluginId = known.input.value;
        if (!known.input.value && repo.input.value.trim())
          input.repo = repo.input.value.trim();
        if (target) input.requestId = target.id;
      }
      const persist = () => saveSubmission(localStorage, input);
      const result = navigator.locks?.request
        ? await navigator.locks.request("dsh-picks-submissions", persist)
        : persist();
      go("receipt/" + encodeURIComponent(result.record.id), {
        duplicate: result.duplicate ? "1" : "",
        requestId: "",
        title: "",
      });
    } catch (err) {
      error.textContent = err.message || "保存失败，请重试";
    } finally {
      save.disabled = false;
    }
  });
  main.append(form);
}
function receipt(id) {
  main.append(back("square", "返回需求广场"));
  const records = localRecords(),
    r = records.find((x) => x.id === id);
  if (!r) {
    notFound(
      "当前浏览器找不到这条回执",
      "本机回执仅保存在创建它的浏览器中，清除站点数据后也会丢失。",
    );
    return;
  }
  pageHead(
    params.get("duplicate") ? "这条记录已经在本机" : "已保存到你的本机",
    params.get("duplicate")
      ? "已找回已有回执；关联需求已保留。"
      : "你可以随时到需求广场找回这条回执。",
  );
  const box = el("section", "receipt");
  box.append(
    el("span", "status", "本机待核验"),
    el("h2", "", r.title),
    el("div", "receipt-id", r.id),
    el("p", "", r.description),
    el("p", "", "保存时间：" + new Date(r.createdAt).toLocaleString("zh-CN")),
    el("p", "", "原型记录保存在当前浏览器，状态待核验。"),
  );
  if (r.repo)
    box.append(
      external(
        "查看方案仓库 ↗",
        r.sourceUrl ||
          (r.repo.startsWith("http")
            ? r.repo.split("#")[0]
            : "https://github.com/" + r.repo.split("#")[0]),
      ),
    );
  if (r.pluginId) {
    const p = plugins.find((x) => x.id === r.pluginId);
    if (p)
      box.append(
        link("查看插件：" + p.name, url("plugin/" + p.id), "detail-link"),
      );
  }
  for (const requestId of r.requestIds || (r.requestId ? [r.requestId] : [])) {
    const request = records.find((x) => x.id === requestId);
    if (request)
      box.append(
        link(
          "关联需求：" + request.title,
          url("request/" + request.id),
          "detail-link",
        ),
      );
  }
  main.append(box);
  if (r.kind === "request")
    main.append(
      link("查看需求与关联方案 →", url("request/" + r.id), "primary"),
    );
  else main.append(link("回到需求广场", url("square"), "primary"));
}
function request(id) {
  const records = localRecords(),
    r = records.find((x) => x.id === id && x.kind === "request");
  main.append(back("square", "返回需求广场"));
  if (!r) {
    notFound();
    return;
  }
  pageHead(r.title, "需求回执 " + r.id);
  const box = el("section", "receipt");
  box.append(
    el("span", "status", "本机待核验"),
    el("p", "", r.description),
    el("p", "", "保存于 " + date(r.createdAt) + "；仅当前浏览器可见。"),
  );
  main.append(
    box,
    link(
      "我有方案，关联自荐 →",
      url("submit/nomination", { requestId: r.id, title: "" }),
      "primary",
    ),
  );
  main.append(heading("关联方案"));
  const related = records.filter(
    (x) =>
      x.kind === "nomination" && (x.requestIds || [x.requestId]).includes(id),
  );
  if (!related.length)
    main.append(
      el(
        "p",
        "form-hint",
        "还没有关联方案。可以选择已收录插件，也可以填写新的 GitHub 仓库。",
      ),
    );
  for (const item of related) {
    const a = link("", url("receipt/" + item.id), "submission-card");
    a.append(
      el("h3", "", item.title),
      el("p", "", item.description),
      el("span", "status", "本机待核验"),
    );
    main.append(a);
  }
}
function notFound(
  title = "没有找到这个条目",
  desc = "链接可能有误，或当前浏览器中没有这条本机记录。",
) {
  pageHead(title, desc);
  main.append(link("去找插件", url("search"), "primary"));
}
function render() {
  clearTimeout(searchTimer);
  if (activeHash) scrollPositions.set(activeHash, window.scrollY);
  activeHash = location.hash || "#/home";
  const raw = activeHash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  try {
    route = (path || "home").split("/").map(decodeURIComponent);
  } catch {
    route = ["missing"];
  }
  params = new URLSearchParams(query);
  if (["search", "plugin"].includes(route[0])) {
    searchState = new URLSearchParams(params);
  }
  main.replaceChildren();
  main.dataset.view = route[0];
  document.querySelector(".footer").hidden = [
    "square",
    "submit",
    "receipt",
    "request",
  ].includes(route[0]);
  renderNav();
  switch (route[0]) {
    case "home":
      home();
      break;
    case "edition":
      home(route[1]);
      break;
    case "search":
      search();
      break;
    case "plugin":
      detail(route[1]);
      break;
    case "square":
      square();
      break;
    case "submit":
      submit(route[1]);
      break;
    case "receipt":
      receipt(route[1]);
      break;
    case "request":
      request(route[1]);
      break;
    default:
      notFound();
  }
  document.title =
    (main.querySelector("h1")?.textContent || "插件精选") + " · DSH PICKS";
  requestAnimationFrame(() => {
    window.scrollTo(0, scrollPositions.get(activeHash) || 0);
    if (lastFocusKey) main.focus({ preventScroll: true });
    lastFocusKey = activeHash;
  });
}
document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView();
});
window.addEventListener("hashchange", render);
render();
