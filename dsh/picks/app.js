import { plugins, editions } from "./data.js";
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
  artCleanup,
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
function card(p) {
  const a = link(
    "",
    url("plugin/" + encodeURIComponent(p.id), {
      from: route[0] === "search" ? "search" : "",
    }),
    "plugin-card",
  );
  const top = el("div", "card-top");
  const mark = el("span", "plugin-icon");
  mark.append(icon("plugin"));
  top.append(mark);
  a.append(top, el("h3", "", p.name), el("p", "", p.summary));
  const bottom = el("div", "card-bottom");
  bottom.append(el("span", "", p.category), el("span", "", "了解插件 ↗"));
  a.append(bottom);
  return a;
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
function viewport() {
  const outer = el("div");
  const art = el("div", "hero-art");
  const bar = el("div", "viewport-bar");
  bar.append(
    el("span", "", "3D STUDY / BOTTLE SECTIONS"),
    el("span", "viewport-dots", "● ● ●"),
  );
  const area = el("div", "viewport-area");
  const canvas = el("canvas");
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "交互式瓶身截面线框示意。拖动、左右方向键或下方滑杆可旋转。此图由网页绘制，不是插件实测截图。",
  );
  area.append(
    canvas,
    el("span", "axis", "Z ↑ / Y ↗ / X →"),
    el("span", "viewport-caption", "网页交互示意 · 非实测画面"),
  );
  const control = el("label", "viewport-control");
  control.append(el("span", "", "旋转视角"));
  const range = el("input");
  range.type = "range";
  range.min = "0";
  range.max = "360";
  range.value = "28";
  range.setAttribute("aria-label", "旋转三维模型视角");
  control.append(range);
  art.append(bar, area, control);
  outer.append(art);
  const note = el("div", "art-note");
  note.append(
    el("span", "", "BLENDER × DSH"),
    el("span", "", "拖动模型，换个角度看"),
  );
  outer.append(note);
  queueMicrotask(() => drawArt(canvas, range));
  return outer;
}
function drawArt(canvas, range) {
  if (!canvas.isConnected) return;
  let angle = (Number(range.value) * Math.PI) / 180;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  function draw() {
    const box = canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    ctx.scale(dpr, dpr);
    const w = box.width,
      h = box.height;
    ctx.clearRect(0, 0, w, h);
    const scale = Math.min(w * 0.28, h * 0.31);
    function project(x, y, z) {
      const c = Math.cos(angle),
        s = Math.sin(angle),
        xx = x * c - z * s,
        zz = x * s + z * c;
      const yy = y * 0.83 - zz * 0.56,
        depth = y * 0.56 + zz * 0.83;
      return [w / 2 + xx * scale, h * 0.5 + yy * scale, depth];
    }
    function line(points, color, width = 0.6) {
      ctx.beginPath();
      points.forEach((p, i) => {
        const q = project(...p);
        if (i) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    for (let j = -6; j <= 6; j++) {
      line(
        [
          [-6, 1.13, j],
          [6, 1.13, j],
        ],
        "#91b9d01a",
      );
      line(
        [
          [j, 1.13, -6],
          [j, 1.13, 6],
        ],
        "#91b9d01a",
      );
    }
    line(
      [
        [-6, 1.13, 0],
        [6, 1.13, 0],
      ],
      "#b0d4f04a",
    );
    line(
      [
        [0, 1.13, -6],
        [0, 1.13, 6],
      ],
      "#81b7d849",
    );
    const meshes = [];
    const bottle = (u, v) => {
      const t = v / (Math.PI * 2);
      const profile = [
        [0, 0.3],
        [0.13, 0.3],
        [0.2, 0.26],
        [0.34, 0.72],
        [0.5, 0.78],
        [0.9, 0.78],
        [1, 0.69],
      ];
      const next = profile.findIndex(([height]) => height >= t);
      const [end, radius] = profile[Math.max(0, next)];
      const [start, previous] = profile[Math.max(0, next - 1)];
      const progress = end === start ? 0 : (t - start) / (end - start);
      const smooth = progress * progress * (3 - 2 * progress);
      const r = previous + (radius - previous) * smooth;
      return [r * Math.cos(u), -1.55 + t * 2.8, r * Math.sin(u)];
    };
    for (let i = 0; i < 40; i++) {
      const u = (i / 40) * Math.PI * 2;
      const pts = [];
      for (let j = 0; j <= 24; j++) pts.push(bottle(u, (j / 24) * Math.PI * 2));
      meshes.push({
        pts,
        z: project(...bottle(u, Math.PI / 2))[2],
        kind: "cross",
      });
    }
    for (let j = 0; j <= 24; j++) {
      const pts = [];
      for (let i = 0; i <= 80; i++)
        pts.push(bottle((i / 80) * Math.PI * 2, (j / 24) * Math.PI * 2));
      meshes.push({
        pts,
        z: project(...bottle(0, (j / 24) * Math.PI * 2))[2],
        kind: "ring",
      });
    }
    meshes.sort((a, b) => b.z - a.z);
    for (const m of meshes)
      line(
        m.pts,
        m.kind === "cross" ? "#83cbf7b0" : "#a9dcff87",
        m.kind === "cross" ? 0.65 : 0.8,
      );
    ctx.strokeStyle = "#87cfff";
    ctx.lineWidth = 1;
    const corners = [
      [-0.9, -1.65, -0.9],
      [0.9, -1.65, -0.9],
      [0.9, 1.3, -0.9],
      [-0.9, 1.3, -0.9],
      [-0.9, -1.65, 0.9],
      [0.9, -1.65, 0.9],
      [0.9, 1.3, 0.9],
      [-0.9, 1.3, 0.9],
    ];
    ctx.setLineDash([3, 5]);
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ])
      line([corners[a], corners[b]], "#76b4df55");
    ctx.setLineDash([]);
    const center = project(0, 0, 0);
    ctx.beginPath();
    ctx.arc(center[0], center[1], 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffa96d";
    ctx.fill();
  }
  const update = () => {
    angle = (Number(range.value) * Math.PI) / 180;
    draw();
  };
  range.addEventListener("input", update);
  let start;
  canvas.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, angle };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!start) return;
    angle = start.angle + (e.clientX - start.x) * 0.013;
    range.value = String(((((angle * 180) / Math.PI) % 360) + 360) % 360);
    draw();
  });
  for (const event of ["pointerup", "pointercancel"])
    canvas.addEventListener(event, () => {
      start = null;
    });
  canvas.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      range.value = String(
        (Number(range.value) + (e.key === "ArrowRight" ? 10 : 350)) % 360,
      );
      update();
    }
  });
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  artCleanup = () => observer.disconnect();
  draw();
}
function topicArt(plugin) {
  const figure = el("figure", "topic-art");
  const isMemory = plugin.id === "mnemon";
  figure.append(
    el(
      "p",
      "topic-art-label",
      isMemory ? "PROJECT / MEMORY" : "OUTLINE / SLIDES",
    ),
  );
  const steps = isMemory
    ? ["项目约定", "本地记忆", "新对话召回"]
    : ["汇报大纲", "逐页调整", "导出 PPTX"];
  steps.forEach((text, index) => {
    const row = el("div", "topic-step");
    row.append(
      el("span", "", String(index + 1).padStart(2, "0")),
      el("strong", "", text),
    );
    figure.append(row);
  });
  figure.append(
    el("figcaption", "", "依据作者说明绘制的工作流示意 · 非实测画面"),
  );
  return figure;
}
function home(editionId) {
  if (editionId && !editions.some((e) => e.id === editionId)) {
    notFound("没有找到这个选题", "返回推荐首页，查看当前精选。");
    return;
  }
  const ed = editions.find((e) => e.id === editionId) || editions[0];
  if (!ed) {
    pageHead("精选内容准备中", "先到插件目录，按你的需要探索。");
    main.append(link("找插件", url("search"), "primary"));
    return;
  }
  const p = plugins.find((p) => p.id === ed.pluginId) || plugins[0];
  const meta = el("div", "edition-meta");
  meta.append(
    el("strong", "", "本期推荐 / THE EDIT"),
    el("span", "", date(ed.date)),
  );
  main.append(meta);
  const hero = el("section", "hero");
  const heroCopy = el("div", "hero-copy");
  heroCopy.append(
    el("p", "eyebrow", p.name + " / " + p.category),
    el("h1", "", ed.title),
    el("p", "hero-dek", ed.dek),
  );
  const read = link(
    "读懂这个插件",
    url("plugin/" + encodeURIComponent(p.id), { from: "edition/" + ed.id }),
    "primary",
  );
  read.append(icon("arrow"));
  const actions = el("div", "hero-actions");
  actions.append(
    read,
    btn("复制本期链接", "text-link share-link", () => {
      const shareURL = new URL(location.href);
      shareURL.hash = "/edition/" + encodeURIComponent(ed.id);
      copy(shareURL.href);
    }),
  );
  heroCopy.append(actions);
  hero.append(heroCopy, p.id === "blender" ? viewport() : topicArt(p));
  main.append(hero);
  const why = el("section", "reason");
  why.append(
    el("div", "reason-label", "为什么推荐 / WHY"),
    el("p", "", ed.reason),
  );
  main.append(why);
  main.append(
    heading("继续探索", link("找全部插件 ↗", url("search"), "text-link")),
  );
  const grid = el("div", "plugin-grid");
  plugins
    .filter((x) => x.id !== p.id)
    .slice(0, 3)
    .forEach((x) => grid.append(card(x)));
  main.append(grid);
  if (editions.length > 1) {
    main.append(heading("更多选题", el("small", "", "从不同用例出发")));
    for (const other of editions.filter((x) => x.id !== ed.id)) {
      const a = link(
        "",
        url("edition/" + encodeURIComponent(other.id)),
        "archive-row",
      );
      a.append(
        el("time", "", date(other.date)),
        el("span", "", other.title),
        el("span", "", "↗"),
      );
      main.append(a);
    }
  }
  const note = el("aside", "community-note");
  const text = el("div");
  text.append(
    el("h3", "", "还没找到趁手的工具？"),
    el("p", "", "记下需求，或推荐你做的插件。"),
  );
  note.append(text, link("去需求广场 ↗", url("square"), "text-link"));
  main.append(note);
}
function search() {
  pageHead("按用途找插件", "搜名字，也可以直接说你想做什么。");
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
  const p = plugins.find((p) => p.id === id);
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
  head.append(
    el("p", "eyebrow", p.category),
    el("h1", "", p.name),
    el("p", "", p.summary),
  );
  const tags = el("div", "tags");
  (p.tags || []).forEach((t) => tags.append(el("span", "tag", t)));
  head.append(tags);
  main.append(head);
  const layout = el("div", "detail-layout");
  const body = el("div");
  body.append(section("拿它来做什么", p.useCase));
  const env = el("ul");
  (p.environment || []).forEach((e) => env.append(el("li", "", e)));
  const review = el("div");
  review.append(el("p", "", p.review || "待实测"));
  const dimensions = el("ul", "review-dimensions");
  for (const dimension of ["功能完成度", "安装上手", "运行稳定性"]) {
    const row = el("li");
    row.append(
      el("span", "", dimension + " · 5 分制"),
      el("strong", "", "待实测"),
    );
    dimensions.append(row);
  }
  review.append(
    dimensions,
    el("p", "", "编辑完成安装和用例验证后，会在此记录测试版本和给分依据。"),
  );
  body.append(
    section("开始前，你需要", env),
    section("使用边界与风险", p.limitation),
    section("评测记录", review),
  );
  const sources = el("div");
  sources.append(
    external("作者仓库 ↗", "https://github.com/" + p.repo),
    external("安装与使用说明 ↗", p.source),
  );
  body.append(section("作者与来源", sources));
  const scan = el("div", "scan-status");
  scan.append(el("strong", "", "正在读取第三方扫描…"));
  body.append(section("第三方静态扫描", scan));
  getScan(p)
    .then((result) => {
      if (!scan.isConnected) return;
      scan.replaceChildren(
        el("strong", "", result.label),
        el("p", "", result.detail),
      );
      if (result.url) scan.append(external("查看扫描报告 ↗", result.url));
    })
    .catch(() => {
      if (scan.isConnected)
        scan.replaceChildren(
          el("strong", "", "扫描暂不可用"),
          el("p", "", "稍后重新打开详情查看。静态扫描不能代替运行验证。"),
        );
    });
  const side = el("aside", "detail-side");
  const install = el("div");
  if (p.install) {
    const code = el("code", "install-code", p.install);
    install.append(
      code,
      btn("复制安装地址", "primary full", () => copy(p.install, code)),
    );
  } else install.append(el("p", "", "请按作者说明手动安装。"));
  if (p.installSteps?.length) {
    const steps = el("ol");
    p.installSteps.forEach((step) => steps.append(el("li", "", step)));
    install.append(
      steps,
      btn("复制安装清单", "secondary full", () =>
        copy(
          [
            p.name,
            "安装引用：" + (p.install || "按作者说明手动安装"),
            "",
            "使用环境：",
            ...(p.environment || []).map((s) => "- " + s),
            "",
            "安装步骤：",
            ...p.installSteps.map((s, i) => `${i + 1}. ${s}`),
            "",
            "作者说明：" + p.source,
            "说明：未执行安装或兼容性实测，请按作者文档核对。",
          ].join("\n"),
        ),
      ),
    );
  }
  install.append(external("打开作者安装说明 ↗", p.source));
  side.append(section("安装这个插件", install));
  const note = el(
    "p",
    "form-hint",
    "复制后在 DSH 中按作者说明安装；本页未执行安装或兼容性实测。",
  );
  side.append(note);
  side.append(
    btn("复制插件分享链接 ↗", "text-link share-link", () => {
      const shareURL = new URL(location.href);
      shareURL.hash = "/plugin/" + encodeURIComponent(p.id);
      copy(shareURL.href);
    }),
  );
  layout.append(body, side);
  main.append(layout);
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
  document.body.append(dialog);
  dialog.showModal();
  text.focus();
  text.select();
  text.setSelectionRange(0, value.length);
}
function square() {
  pageHead("需求广场", "把缺的那一块工具，说清楚。");
  const actions = el("div", "form-actions");
  actions.append(
    link("我需要一个插件", url("submit/request"), "primary"),
    link("推荐 / 自荐插件", url("submit/nomination"), "secondary"),
  );
  main.append(
    actions,
    el(
      "p",
      "form-note",
      "这里是本机需求箱。需求、自荐和回执仅保存在当前浏览器，不会发送到社区；请勿填写个人信息或凭据。",
    ),
  );
  const records = localRecords();
  if (!records.length) {
    const empty = el("div", "empty");
    empty.append(
      el("h2", "", "好工具，也可以从你的需求开始"),
      el(
        "p",
        "",
        "记录要解决的问题、使用环境和期待结果。保存后，你会拿到一个可找回的本机回执。",
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
    kind === "request" ? "我需要一个插件" : "让好工具，被看见。",
    kind === "request"
      ? "从具体场景开始，比一个功能名更有帮助。"
      : "已有方案或你做的插件，都可以留下本机记录。",
  );
  const form = el("form", "form-wrap");
  form.append(
    el(
      "p",
      "form-note",
      "仅保存到当前浏览器，不会公开发布或通知开发者。请勿填写姓名、账号、联系方式或密钥。",
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
    el("p", "", "记录保留在当前浏览器，尚未提交社区，也不代表开发者已接单。"),
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
  artCleanup?.();
  artCleanup = null;
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
