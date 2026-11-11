export const SUBMISSIONS_KEY = "dsh-picks-local-submissions-v1";
export const MAX_QUERY_LENGTH = 256;

const fold = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
const words = (value) =>
  fold(value).replace(/([\p{L}\p{N}])[._-]+(?=[\p{L}\p{N}])/gu, "$1 ");
const synonyms = [
  ["幻灯片", "演示文稿", "做ppt", "制作ppt", "ppt", "slides", "presentation"],
  ["浏览网页", "网页浏览", "浏览器", "browser", "browsing"],
  ["网页抓取", "爬虫", "抓网页", "scraping", "scraper"],
  ["写文档", "文档写作", "写作", "writing", "文档", "documents"],
  ["图片生成", "生成图片", "画图", "生图", "image generation"],
  ["视频制作", "制作视频", "做视频", "video"],
  ["语音转文字", "语音识别", "转录", "transcription"],
  ["文字转语音", "语音合成", "朗读", "tts"],
  ["数据分析", "分析数据", "data analysis"],
  ["表格", "电子表格", "spreadsheet", "excel"],
  ["代码审查", "代码评审", "code review"],
  ["记忆", "memory"],
  ["搜索", "检索", "search"],
  ["新对话", "跨对话", "下次对话", "新会话", "另开对话"],
];
const substitutions = synonyms
  .flatMap((group, index) => group.map((term) => [term, ` synonym${index} `]))
  .sort((a, b) => b[0].length - a[0].length);
const synonymTerms = new Map(substitutions);
const synonymPattern = new RegExp(
  substitutions
    .map(([term]) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "gu",
);

function canonical(value) {
  return fold(value).replace(synonymPattern, (term) => synonymTerms.get(term));
}

function containsTerm(haystack, term) {
  const normalized = words(term);
  if (haystack.includes(normalized)) return true;
  if (!/^[\p{Script=Han}]+$/u.test(normalized)) return false;
  // 连续中文须由字段中至少双字的片段完整覆盖，不使用单字模糊召回。
  const covered = new Set([0]);
  for (let start = 0; start < normalized.length; start++) {
    if (!covered.has(start)) continue;
    for (let end = start + 2; end <= normalized.length; end++) {
      if (haystack.includes(normalized.slice(start, end))) covered.add(end);
    }
  }
  return covered.has(normalized.length);
}

function locator(value) {
  try {
    return parseLocator(value);
  } catch (error) {
    if (error instanceof URIError || error instanceof TypeError)
      throw new Error("仓库或组件路径格式不正确。");
    throw error;
  }
}

function parseLocator(value) {
  const text = String(value).trim();
  let repo,
    path = "",
    sourceSuffix = "";
  if (/^https:\/\/github\.com\//i.test(text)) {
    const url = new URL(text);
    if (url.username || url.password || url.port || url.search)
      throw new Error("请填写公开 GitHub 仓库或组件地址。");
    const parts = decodeURIComponent(url.pathname)
      .replace(/\/$/, "")
      .split("/")
      .slice(1);
    repo = parts.slice(0, 2).join("/");
    if (parts.length > 2) {
      if (parts[2] !== "tree" || parts.length < 5)
        throw new Error("组件地址请使用 GitHub 目录链接或 #path:/组件路径。");
      if (!parts[3] || /[\s?#\\\x00-\x1f]/.test(parts[3]))
        throw new Error("组件版本格式不正确。");
      path = parts.slice(4).join("/");
      sourceSuffix = "/" + parts.slice(2).map(encodeURIComponent).join("/");
    }
    if (url.hash) {
      if (path || !url.hash.startsWith("#path:"))
        throw new Error("组件地址中的路径不明确。");
      path = decodeURIComponent(url.hash.slice(6))
        .replace(/^\//, "")
        .replace(/\/$/, "");
    }
  } else {
    const match = /^(?:github:)?([\w.-]+\/[\w.-]+)(?:#path:\/?(.+))?$/.exec(
      text,
    );
    if (!match)
      throw new Error("请填写 https://github.com/作者/仓库 或组件目录链接。");
    [, repo, path = ""] = match;
    path = path.replace(/\/$/, "");
  }
  repo = repo.replace(/\.git$/i, "").toLowerCase();
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repo) ||
    repo.split("/").some((part) => part === "." || part === "..") ||
    (path &&
      path
        .split("/")
        .some(
          (part) =>
            !part ||
            part === "." ||
            part === ".." ||
            /[\s?#\\\x00-\x1f]/.test(part),
        ))
  ) {
    throw new Error("仓库或组件路径格式不正确。");
  }
  return {
    repo,
    path,
    url: `https://github.com/${repo}${path ? `#path:/${path}` : ""}`,
    sourceUrl: `https://github.com/${repo}${sourceSuffix}`,
  };
}

const searchRecords = new WeakMap();
function searchRecord(plugin) {
  let record = searchRecords.get(plugin);
  if (record) return record;
  const identities = [
    plugin.name,
    plugin.packageName,
    plugin.repo,
    plugin.path,
    plugin.path ? `${plugin.repo}#path:/${plugin.path.replace(/^\//, "")}` : "",
    plugin.install,
  ]
    .filter(Boolean)
    .map(fold);
  const fields = [
    ...identities,
    plugin.summary,
    plugin.category,
    ...(plugin.tags || []),
    ...(plugin.keywords || []),
    ...(plugin.environment || []),
    ...(plugin.installSteps || []),
    plugin.useCase,
  ].filter(Boolean);
  record = {
    identities,
    haystack: fields
      .map((value) => `${words(value)}\0${words(canonical(value))}`)
      .join("\0"),
    title: words(canonical(plugin.name)),
  };
  searchRecords.set(plugin, record);
  return record;
}

export function searchPlugins(plugins, query, category = "") {
  if (String(query ?? "").length > MAX_QUERY_LENGTH) return [];
  const phrase = fold(query).replace(/\s+/gu, " ");
  if (phrase.length > MAX_QUERY_LENGTH) return [];
  const categories = new Set(plugins.map((plugin) => plugin.category));
  if (category && !categories.has(category)) return [];
  if (!phrase)
    return plugins.filter(
      (plugin) => !category || plugin.category === category,
    );
  const constraints = [],
    plainTerms = [];
  for (const term of phrase.split(" ").filter(Boolean)) {
    if (plugins.some((plugin) => fold(plugin.path).replace(/^\//, "") === term))
      constraints.push({ path: term });
    else if (
      /^(?:https:\/\/github\.com\/|github:|[\w.-]+\/[\w.-]+(?:#|$))/.test(term)
    ) {
      try {
        constraints.push(locator(term));
      } catch {
        return [];
      }
    } else plainTerms.push(term);
  }
  const natural = canonical(plainTerms.join(" ")).replace(
    /我想要|我想|请帮我|帮我|怎么让|如何让|怎样让|能不能|能否|请问|一个|一份|做个|可以|需要|想要|怎么|如何|怎样|帮忙|一下|的|了|在|里|让|做/gu,
    " ",
  );
  const terms = [
    ...new Set(natural.split(/[\s，。！？、；：]+/u).filter(Boolean)),
  ];
  if (phrase && !terms.length && !constraints.length) return [];
  return plugins
    .map((plugin, index) => {
      if (category && plugin.category !== category) return null;
      const { identities, haystack, title: titleWords } = searchRecord(plugin);
      if (
        !constraints.every(
          (address) =>
            (!address.repo || fold(plugin.repo) === address.repo) &&
            (!address.path ||
              fold(plugin.path).replace(/^\//, "") === fold(address.path)),
        )
      )
        return null;
      if (!terms.every((term) => containsTerm(haystack, term))) return null;
      const exact = phrase && identities.includes(phrase);
      const title =
        terms.length && terms.every((term) => titleWords.includes(words(term)));
      return {
        plugin,
        index,
        rank: exact ? 3 : constraints.length ? 2 : title ? 1 : 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((item) => item.plugin);
}

function textField(value, label, min, max) {
  if (typeof value !== "string") throw new Error(`请填写${label}。`);
  const text = value.normalize("NFKC").trim().replace(/\r\n?/g, "\n");
  if (text.length < min || text.length > max)
    throw new Error(`${label}需要 ${min}–${max} 个字符。`);
  return text;
}

function identifier(value, label) {
  if (typeof value !== "string" || !/^[\w.-]{1,120}$/.test(value))
    throw new Error(`${label}无效。`);
  return value;
}

function storageError() {
  return new Error("本机存储不可用，未保存。请允许浏览器存储后重试。");
}
function corruptError() {
  return new Error(
    "本机提交记录已损坏，未覆盖原记录。请先备份或清理本机记录。",
  );
}

function sourceFor(value, identity) {
  if (typeof value !== "string" || !/^https:\/\/github\.com\//i.test(value))
    throw new Error("来源需要使用公开 GitHub 地址。");
  const source = locator(value);
  if (
    source.repo !== identity.repo ||
    (source.path && source.path !== identity.path)
  )
    throw new Error("来源地址与仓库组件不一致。");
  if (new URL(value).hash)
    throw new Error("来源链接请使用可直接访问的仓库或组件目录地址。");
  return source.sourceUrl;
}

export function loadSubmissions(storage) {
  let raw;
  try {
    raw = storage.getItem(SUBMISSIONS_KEY);
  } catch {
    throw storageError();
  }
  if (raw === null) return [];
  let records;
  try {
    records = JSON.parse(raw);
    if (!Array.isArray(records) || records.length > 500) throw new Error();
    const ids = new Set();
    for (const record of records) {
      if (
        !record ||
        !["request", "nomination"].includes(record.kind) ||
        record.status !== "local-pending" ||
        typeof record.createdAt !== "string" ||
        !Number.isFinite(Date.parse(record.createdAt)) ||
        ids.has(record.id)
      )
        throw new Error();
      identifier(record.id, "回执编号");
      ids.add(record.id);
      textField(record.title, "标题", 2, 100);
      textField(record.description, "说明", 8, 2000);
      if (record.repo && locator(record.repo).url !== record.repo)
        throw new Error();
      if (
        record.sourceUrl !== undefined &&
        (!record.repo ||
          sourceFor(record.sourceUrl, locator(record.repo)) !==
            record.sourceUrl)
      )
        throw new Error();
      if (record.pluginId) identifier(record.pluginId, "插件编号");
      if (record.kind === "nomination" && !record.repo && !record.pluginId)
        throw new Error();
      if (
        record.kind === "nomination" &&
        (!Array.isArray(record.requestIds) ||
          new Set(record.requestIds).size !== record.requestIds.length)
      )
        throw new Error();
    }
    for (const record of records) {
      if (
        record.kind === "nomination" &&
        (record.requestIds.some(
          (id) =>
            !records.some((item) => item.id === id && item.kind === "request"),
        ) ||
          record.requestId !== record.requestIds[0])
      )
        throw new Error();
    }
  } catch {
    throw corruptError();
  }
  return records;
}

export function saveSubmission(storage, input) {
  if (!input || !["request", "nomination"].includes(input.kind))
    throw new Error("请选择求开发或自荐。");
  const title = textField(input.title, "标题", 2, 100).replace(/\s+/gu, " ");
  const description = textField(input.description, "说明", 8, 2000);
  const identity = input.repo
    ? locator(textField(input.repo, "仓库地址", 1, 500))
    : undefined;
  const repo = identity?.url;
  let sourceUrl = identity?.sourceUrl;
  if (input.sourceUrl !== undefined) {
    if (!identity) throw new Error("来源链接需要对应的仓库地址。");
    sourceUrl = sourceFor(input.sourceUrl, identity);
  }
  const pluginId = input.pluginId
    ? identifier(input.pluginId, "插件编号")
    : undefined;
  const requestId = input.requestId
    ? identifier(input.requestId, "需求编号")
    : undefined;
  if (input.kind === "nomination" && !repo && !pluginId)
    throw new Error("自荐需要提供 GitHub 仓库组件地址或目录插件编号。");
  if (input.kind === "request" && requestId)
    throw new Error("只有自荐可以关联已有需求。");
  const records = loadSubmissions(storage);
  if (
    requestId &&
    !records.some((item) => item.id === requestId && item.kind === "request")
  )
    throw new Error("关联的需求不存在于本机，请重新选择。");
  const existing = records.find(
    (record) =>
      record.kind === input.kind &&
      (input.kind === "request"
        ? fold(record.title).replace(/\s+/gu, " ") === fold(title) &&
          fold(record.description).replace(/\s+/gu, " ") === fold(description)
        : repo
          ? record.repo === repo
          : record.pluginId === pluginId && !record.repo),
  );
  const sourceChanged =
    existing &&
    sourceUrl &&
    (!existing.sourceUrl ||
      (sourceUrl.includes("/tree/") && sourceUrl !== existing.sourceUrl));
  if (
    existing &&
    (!requestId || existing.requestIds.includes(requestId)) &&
    !sourceChanged
  )
    return { record: existing, duplicate: true };
  if (existing) {
    if (requestId && !existing.requestIds.includes(requestId)) {
      existing.requestIds.push(requestId);
      existing.requestId = existing.requestIds[0];
    }
    if (sourceChanged) existing.sourceUrl = sourceUrl;
  }
  if (!existing && records.length >= 500)
    throw new Error("本机记录已达 500 条，请先备份整理后重试。");
  const record = existing || {
    kind: input.kind,
    title,
    description,
    ...(repo ? { repo, sourceUrl } : {}),
    ...(pluginId ? { pluginId } : {}),
    ...(input.kind === "nomination"
      ? {
          requestIds: requestId ? [requestId] : [],
          ...(requestId ? { requestId } : {}),
        }
      : {}),
    id: `local-${globalThis.crypto.randomUUID()}`,
    status: "local-pending",
    createdAt: new Date().toISOString(),
  };
  if (!existing) records.push(record);
  try {
    storage.setItem(SUBMISSIONS_KEY, JSON.stringify(records));
  } catch {
    throw storageError();
  }
  return { record, duplicate: Boolean(existing) };
}
