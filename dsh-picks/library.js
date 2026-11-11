import { searchPlugins } from "./flows.js";

const normalize = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
export function filterCatalog(plugins, query = "", options = {}) {
  const {
    category = "",
    kind = "",
    install = "",
    scan = "",
    mode = "",
    sort = "",
    favorites,
    scanStatuses,
  } = options;
  let list = plugins.filter(
    (p) =>
      (!category || p.category === category) &&
      (!kind || (p.kind || "DSH 插件") === kind) &&
      (!install || Boolean(p.install)) &&
      (!favorites || favorites.has(p.id)) &&
      (!scan ||
        (scan === "reported"
          ? scanStatuses?.has(p.id)
          : ["REVIEW", "FAILED"].includes(scanStatuses?.get(p.id)))),
  );
  const term = normalize(query);
  if (mode === "exact" && term) {
    list = list.filter((p) =>
      [
        p.name,
        p.repo,
        p.packageName,
        p.install,
        p.path,
        `https://github.com/${p.repo}${p.path ? "#path:/" + p.path.replace(/^\//, "") : ""}`,
        `${p.repo}${p.path ? "#path:/" + p.path.replace(/^\//, "") : ""}`,
      ].some((value) => normalize(value) === term),
    );
  } else list = searchPlugins(list, query);
  if (sort === "name")
    list.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  if (sort === "updated")
    list.sort(
      (a, b) => (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0),
    );
  return list;
}

function key(id, type) {
  if (!/^[\w.-]{1,120}$/.test(id) || !["favorite", "rating"].includes(type))
    throw new Error("插件记录无效");
  return `dsh-picks-${type}-v1:${id}`;
}
export function readPreference(storage, id, type) {
  const value = storage.getItem(key(id, type));
  if (value === null) return 0;
  if (!/^[1-5]$/.test(value) || (type === "favorite" && value !== "1"))
    throw new Error("本机记录无法读取，原记录已保留。");
  return Number(value);
}
export function writePreference(storage, id, type, value) {
  readPreference(storage, id, type);
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > (type === "favorite" ? 1 : 5)
  )
    throw new Error("评分需要 1–5 分");
  if (value) storage.setItem(key(id, type), String(value));
  else storage.removeItem(key(id, type));
}
