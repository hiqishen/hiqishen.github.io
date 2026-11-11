import { plugins as curated, editions } from "./data.js?v=4";
import { loadCatalog } from "./catalog.js?v=5";
import { filterCatalog, readPreference, writePreference } from "./library.js";
let plugins = curated;
const curatedIds = new Set(curated.map((p) => p.id));
let catalogState = { loading: true, warnings: [], fetchedAt: "" };
let scanStatuses,
  scanFailure = false;
let searchWorker;
let catalogReady = () => {};
let loadingCatalog = false;
const searches = new Map();
let searchSequence = 0;
try {
  searchWorker = new Worker(new URL("./search-worker.js", import.meta.url), {
    type: "module",
  });
  searchWorker.onmessage = ({ data }) => {
    searches.get(data.id)?.(data.result);
    searches.delete(data.id);
  };
  searchWorker.onerror = () => {
    searchWorker?.terminate();
    searchWorker = undefined;
    for (const resolve of searches.values()) resolve(null);
    searches.clear();
  };
} catch {}
function favoriteIds() {
  const ids = new Set();
  try {
    for (const p of plugins)
      if (readPreference(localStorage, p.id, "favorite")) ids.add(p.id);
  } catch {
    notify("部分本机收藏无法读取");
  }
  return ids;
}
async function findPlugins(query, options) {
  if (!searchWorker) return filterCatalog(plugins, query, options);
  const id = ++searchSequence;
  const result = await new Promise((resolve) => {
    searches.set(id, resolve);
    searchWorker.postMessage({ id, query, options });
  });
  if (result === null) return filterCatalog(plugins, query, options);
  const byId = new Map(plugins.map((p) => [p.id, p]));
  return result.map((id) => byId.get(id)).filter(Boolean);
}
import { getScan, getScanStatuses } from "./scan.js?v=5";
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
  if (!extra.reset && ["search", "plugin"].includes(path.split("/")[0])) {
    const source = ["search", "plugin"].includes(route?.[0])
      ? params
      : searchState;
    for (const key of [
      "q",
      "category",
      "mode",
      "kind",
      "install",
      "scan",
      "sort",
      "favorites",
      "limit",
    ]) {
      const value = source.get(key);
      if (value) p.set(key, value);
    }
  }
  for (const [k, v] of Object.entries(extra)) {
    if (k === "reset") continue;
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
function appearance(p) {
  return (
    looks[p.id] || {
      color: ["blue", "violet", "coral", "mint"][p.name.length % 4],
      symbol: p.name
        .replace(/^dsh[-_ ]*/i, "")
        .slice(0, 2)
        .toUpperCase(),
      title: p.name,
      description: p.summary,
      note: [
        p.category,
        p.install
          ? "有安装地址"
          : {
              manual: "需手动安装",
              broken: "索引标记失效",
              ecosystem: "按项目说明使用",
            }[p.installStatus] || "安装待核实",
      ].join(" · "),
    }
  );
}
function pluginMark(plugin, cls = "") {
  const look = appearance(plugin);
  const mark = el("span", "plugin-mark " + look.color + " " + cls, look.symbol);
  mark.setAttribute("aria-hidden", "true");
  return mark;
}
function card(p) {
  const look = appearance(p);
  const a = link("", url("plugin/" + encodeURIComponent(p.id)), "plugin-card");
  a.dataset.pluginId = p.id;
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
    go("search", { q: input.value, reset: true });
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
      link(title, url("search", { category, reset: true }), "category-link"),
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
      link("全部插件", url("search", { reset: true }), "text-link"),
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
  pageHead("找插件", "说说你要做什么，或直接查找插件名称。");
  const box = el("div", "search-box");
  box.append(icon("search"));
  const input = el("input");
  input.type = "search";
  input.maxLength = 256;
  input.placeholder = "用途、名称、npm 包名";
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
  const mode = el("div", "search-modes");
  for (const [value, label] of [
    ["", "场景搜索"],
    ["exact", "精确名称 / 包名"],
  ]) {
    const button = btn(label, "chip", () => {
      setParam("mode", value);
      apply();
      for (const item of mode.children)
        item.setAttribute("aria-pressed", String(item === button));
    });
    button.setAttribute(
      "aria-pressed",
      String((params.get("mode") || "") === value),
    );
    mode.append(button);
  }
  main.append(
    mode,
    el(
      "p",
      "search-help",
      "场景搜索支持关键词、中文同义词与需求短句。精确查找匹配完整名称、包名或仓库地址。",
    ),
  );
  const filters = el("details", "catalog-filters");
  filters.open = [
    "category",
    "kind",
    "install",
    "scan",
    "favorites",
    "sort",
  ].some((k) => params.get(k));
  filters.append(el("summary", "", "筛选与排序"));
  const grid = el("div", "filter-grid");
  for (const [name, title, values] of [
    [
      "category",
      "用途",
      [
        ["", "全部用途"],
        ...[...new Set(plugins.map((p) => p.category))]
          .sort()
          .map((x) => [x, x]),
      ],
    ],
    [
      "kind",
      "类型",
      [
        ["", "全部类型"],
        ...[...new Set(plugins.map((p) => p.kind || "DSH 插件"))]
          .sort()
          .map((x) => [x, x]),
      ],
    ],
    [
      "install",
      "安装",
      [
        ["", "不限安装状态"],
        ["available", "有安装地址"],
      ],
    ],
    [
      "scan",
      "扫描报告",
      [
        ["", "不限扫描状态"],
        ["reported", "有匹配报告"],
        ["review", "需复核 / 未通过"],
      ],
    ],
    [
      "sort",
      "排序",
      [
        ["", "默认 / 搜索相关"],
        ["updated", "最近更新"],
        ["name", "名称 A–Z"],
      ],
    ],
    [
      "favorites",
      "收藏",
      [
        ["", "全部插件"],
        ["1", "我的本机收藏"],
      ],
    ],
  ]) {
    const field = el("label", "filter-field");
    field.append(el("span", "", title));
    const select = el("select");
    select.name = name;
    for (const [value, label] of values) {
      const o = el("option", "", label);
      o.value = value;
      select.append(o);
    }
    select.value = params.get(name) || "";
    select.addEventListener("change", () => {
      setParam(name, select.value);
      apply();
    });
    field.append(select);
    grid.append(field);
  }
  filters.append(
    grid,
    btn("重置筛选", "text-link", () => {
      for (const key of [
        "category",
        "kind",
        "install",
        "scan",
        "sort",
        "favorites",
        "limit",
      ])
        params.delete(key);
      history.replaceState(null, "", url("search"));
      activeHash = location.hash;
      render();
    }),
  );
  main.append(filters);
  const dataNote = el("div", "catalog-note");
  function updateCatalogNote() {
    dataNote.replaceChildren();
    if (catalogState.loading) {
      const progress = catalogState.total
        ? "正在载入目录 · " +
          catalogState.loaded.toLocaleString("zh-CN") +
          " / " +
          catalogState.total.toLocaleString("zh-CN") +
          "，可先搜索已载入条目。"
        : "正在读取目录，先浏览已整理的推荐…";
      dataNote.append(el("p", "", progress));
    } else if (catalogState.warnings.length) {
      dataNote.append(
        el("p", "", catalogState.warnings.join(" ")),
        btn("重新读取", "text-link", refreshCatalog),
      );
    } else
      dataNote.append(
        el(
          "p",
          "",
          plugins.length.toLocaleString("zh-CN") +
            " 个收录条目 · 目录更新 " +
            date(catalogState.fetchedAt),
        ),
      );
    for (const name of ["category", "kind"]) {
      const select = grid.querySelector("select[name=" + name + "]");
      const values = [
        ...new Set(
          plugins.map(
            (p) => p[name] || (name === "kind" ? "DSH 插件" : "其他"),
          ),
        ),
      ].sort();
      const current = params.get(name) || "";
      select.replaceChildren();
      const blank = el("option", "", name === "kind" ? "全部类型" : "全部用途");
      blank.value = "";
      select.append(blank);
      for (const value of values) {
        const o = el("option", "", value);
        o.value = value;
        select.append(o);
      }
      select.value = current;
    }
  }
  updateCatalogNote();
  main.append(dataNote);
  const results = el("section");
  results.setAttribute("aria-live", "polite");
  main.append(results);
  let requestNumber = 0;
  function setParam(key, value) {
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("limit");
  }
  async function renderResults() {
    const thisRequest = ++requestNumber;
    results.replaceChildren(el("p", "result-meta", "正在查找…"));
    if (params.get("scan") && !scanStatuses) {
      results.replaceChildren(
        el(
          "p",
          "form-hint",
          scanFailure
            ? "扫描摘要暂不可用，请取消扫描筛选或重试。"
            : "正在读取扫描摘要…",
        ),
      );
      if (scanFailure)
        results.append(btn("重试扫描摘要", "secondary", refreshScans));
      return;
    }
    const options = Object.fromEntries(params);
    if (options.favorites) options.favorites = favoriteIds();
    else delete options.favorites;
    if (options.scan) options.scanStatuses = scanStatuses;
    const list = await findPlugins(input.value, options);
    if (!results.isConnected || thisRequest !== requestNumber) return;
    results.replaceChildren();
    results.append(
      el("div", "result-meta", list.length.toLocaleString("zh-CN") + " 个结果"),
    );
    if (list.length) {
      let limit = Math.min(
        list.length,
        Math.max(
          24,
          Math.min(plugins.length, Number(params.get("limit")) || 24),
        ),
      );
      const listNode = el("div", "plugin-grid");
      list.slice(0, limit).forEach((p) => listNode.append(card(p)));
      results.append(listNode);
      const more = btn("", "secondary load-more", () => {
        const next = Math.min(list.length, limit + 24);
        list.slice(limit, next).forEach((p) => listNode.append(card(p)));
        limit = next;
        params.set("limit", String(limit));
        history.replaceState(null, "", url("search"));
        activeHash = location.hash;
        searchState = new URLSearchParams(params);
        updateMore();
      });
      function updateMore() {
        for (const item of listNode.children)
          item.href = url(
            "plugin/" + encodeURIComponent(item.dataset.pluginId),
          );
        more.hidden = limit >= list.length;
        more.textContent = "继续浏览 · 已显示 " + limit + " / " + list.length;
      }
      updateMore();
      results.append(more);
    } else {
      const empty = el("div", "empty");
      empty.append(
        el("h2", "", "暂时没有符合条件的插件"),
        el("p", "", "试试减少筛选条件、切换场景搜索，或提出你的开发需求。"),
        link(
          "带着需求，求开发 →",
          url("submit/request", { title: input.value }),
          "primary",
        ),
      );
      results.append(empty);
    }
  }
  function apply() {
    if (input.value) params.set("q", input.value);
    else params.delete("q");
    params.delete("limit");
    history.replaceState(null, "", url("search"));
    activeHash = location.hash;
    searchState = new URLSearchParams(params);
    renderNav();
    renderResults();
  }
  let composing = false;
  input.addEventListener("compositionstart", () => {
    composing = true;
    clearTimeout(searchTimer);
    requestNumber++;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    apply();
  });
  input.addEventListener("input", () => {
    if (!composing) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(apply, 180);
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !composing) {
      clearTimeout(searchTimer);
      apply();
    }
    if (e.key === "Escape" && !composing) {
      input.value = "";
      apply();
    }
  });
  input.addEventListener("change", () => {
    if (!composing) apply();
  });
  catalogReady = () => {
    updateCatalogNote();
    if (!composing) renderResults();
  };
  renderResults();
}

function detail(id) {
  const p = plugins.find((item) => item.id === id);
  if (!p) {
    if (catalogState.loading)
      pageHead("正在读取插件详情", "正在加载本项目的完整目录…");
    else {
      notFound(
        "没有找到这个插件",
        catalogState.warnings.join(" ") || "请返回全部插件重新查找。",
      );
      if (catalogState.warnings.length)
        main.append(btn("重新读取目录", "secondary", refreshCatalog));
    }
    return;
  }
  const look = appearance(p);
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
    el("h1", "", look.title),
    el("p", "", p.category + " · " + (p.kind || "DSH 插件")),
  );
  head.append(pluginMark(p, "large"), identity);
  main.append(head, el("p", "detail-summary", look.description));
  const facts = el("div", "detail-facts");
  facts.append(
    el("span", "", look.note),
    el(
      "span",
      "",
      curatedIds.has(p.id) ? "文档已核对 · 待实测" : "社区收录 · 待核验",
    ),
  );
  main.append(facts);
  const install = el("section", "install-panel");
  const installHeading = el("div", "install-heading");
  installHeading.append(
    el("h2", "", "安装地址"),
    p.install
      ? btn("复制", "copy-chip", () => copy(p.install))
      : el("span", "muted", "暂不提供复制"),
  );
  install.append(
    installHeading,
    el(
      p.install ? "code" : "p",
      "install-code",
      p.install || p.installNote || "安装方式待核实，请查阅作者说明。",
    ),
  );
  main.append(install);
  const actions = el("div", "detail-actions");
  actions.append(
    btn("复制使用清单", "primary", () =>
      copy(
        [
          p.name,
          p.install
            ? "安装引用 " + p.install
            : "安装方式 " + (p.installNote || "待核实"),
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
      share.hash = "/plugin/" + encodeURIComponent(p.id);
      copy(share.href);
    }),
  );
  const favorite = btn("", "secondary", () => {
    try {
      const value = readPreference(localStorage, p.id, "favorite") ? 0 : 1;
      writePreference(localStorage, p.id, "favorite", value);
      updateFavorite();
      notify(value ? "已收藏到本机" : "已取消收藏");
    } catch (e) {
      notify(e.message || "本机收藏暂不可用");
    }
  });
  function updateFavorite() {
    try {
      const saved = Boolean(readPreference(localStorage, p.id, "favorite"));
      favorite.textContent = saved ? "已收藏" : "收藏";
      favorite.setAttribute("aria-pressed", String(saved));
    } catch {
      favorite.textContent = "收藏";
    }
  }
  updateFavorite();
  actions.append(favorite);
  main.append(actions);
  const preview = sourcePreview(p);
  if (preview) main.append(preview);
  const useCase = el("div", "use-case");
  useCase.append(
    icon("check"),
    el(
      "p",
      "",
      (p.useCase || p.summary || "作者尚未提供功能说明。").replace(
        /^用例参考[：:]\s*/,
        "",
      ),
    ),
  );
  main.append(section("用它做什么", useCase));
  const environment = el("ul");
  (p.environment.length
    ? p.environment
    : ["作者未在目录中注明环境要求，请先查看使用说明。"]
  ).forEach((text) => environment.append(el("li", "", text)));
  main.append(section("准备与安装", environment));
  const steps = el("ol", "install-steps");
  (p.installSteps.length
    ? p.installSteps
    : [
        p.install
          ? "将安装地址复制到 DSH 的插件安装入口，其他准备步骤以作者说明为准。"
          : "查看下方作者使用说明，按其中步骤安装或使用。",
      ]
  ).forEach((text) => steps.append(el("li", "", text)));
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
  const rating = el("section", "personal-rating");
  rating.append(
    el("h2", "", "我的评分"),
    el("p", "form-hint", "体验后给个分数 · 仅保存在本机，不计入社区评分"),
  );
  const stars = el("div", "rating-options");
  for (let value = 1; value <= 5; value++) {
    const b = btn(value + " 分", "chip", () => {
      try {
        writePreference(localStorage, p.id, "rating", value);
        updateRating();
        notify("已保存本机评分");
      } catch (e) {
        notify(e.message || "本机评分暂不可用");
      }
    });
    b.dataset.value = String(value);
    stars.append(b);
  }
  function updateRating() {
    let selected = 0;
    try {
      selected = readPreference(localStorage, p.id, "rating");
    } catch {}
    for (const b of stars.children)
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.value) === selected),
      );
  }
  updateRating();
  rating.append(
    stars,
    btn("撤回评分", "text-link", () => {
      try {
        writePreference(localStorage, p.id, "rating", 0);
        updateRating();
        notify("已撤回评分");
      } catch (e) {
        notify(e.message);
      }
    }),
  );
  main.append(rating);
  const sources = el("div", "source-links");
  sources.append(
    external("作者仓库 ↗", "https://github.com/" + p.repo),
    external("使用说明 ↗", p.source),
  );
  if (p.sourceLabel)
    sources.append(el("p", "evidence-note", "目录来源：" + p.sourceLabel));
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
    const lookup = field(
      "查找已收录插件",
      "search",
      "lookup",
      "",
      "输入名称或包名后选择插件；未收录的可直接填写仓库。",
    );
    let lookupRequest = 0;
    const lookupHint = el("p", "form-hint");
    async function updateKnown() {
      const number = ++lookupRequest;
      const list = lookup.input.value
        ? await findPlugins(lookup.input.value, {})
        : curated;
      if (number !== lookupRequest || !known.input.isConnected) return;
      const old = known.input.value;
      known.input.replaceChildren(blank);
      list.slice(0, 40).forEach((p) => {
        const o = el("option", "", p.name + " · " + (p.packageName || p.repo));
        o.value = p.id;
        known.input.append(o);
      });
      known.input.value = list.slice(0, 40).some((p) => p.id === old)
        ? old
        : "";
      if (repo) repo.input.disabled = Boolean(known.input.value);
      lookupHint.textContent =
        list.length > 40
          ? "找到 " + list.length + " 个，显示前 40 个；可继续补充关键词。"
          : "";
    }
    lookup.input.addEventListener("input", updateKnown);
    form.append(lookup.wrap, lookupHint);
    queueMicrotask(updateKnown);
    catalogReady = updateKnown;
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
  catalogReady = () => {};
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
async function refreshScans() {
  scanFailure = false;
  try {
    scanStatuses = await getScanStatuses(plugins);
  } catch {
    scanFailure = true;
    scanStatuses = undefined;
  }
  if (route?.[0] === "search" && params.get("scan")) catalogReady();
}
async function refreshCatalog() {
  if (loadingCatalog) return;
  loadingCatalog = true;
  catalogState.loading = true;
  catalogReady();
  function applyCatalog(result, loading) {
    plugins = [
      ...curated
        .map((item) => result.plugins.find((p) => p.id === item.id))
        .filter(Boolean),
      ...result.plugins.filter((p) => !curatedIds.has(p.id)),
    ];
    catalogState = { ...result, loading };
    searchWorker?.postMessage({ plugins });
    if (["plugin", "receipt"].includes(route?.[0])) {
      if (
        (route[0] === "receipt" && !loading) ||
        (route[0] === "plugin" && !main.querySelector(".detail-header"))
      )
        render();
    } else catalogReady();
  }
  let pendingProgress, progressTimer;
  try {
    const result = await loadCatalog(curated, {
      onProgress: (result) => {
        pendingProgress = result;
        if (!progressTimer) progressTimer = setTimeout(() => {
          progressTimer = undefined;
          applyCatalog(pendingProgress, true);
        }, 200);
      },
    });
    clearTimeout(progressTimer);
    applyCatalog(result, false);
    refreshScans();
  } finally {
    clearTimeout(progressTimer);
    loadingCatalog = false;
  }
}

searchWorker?.postMessage({ plugins });
window.addEventListener("hashchange", render);
render();
refreshCatalog();
