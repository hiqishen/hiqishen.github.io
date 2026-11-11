import { safePath, canonicalLocation, npmSpec, chooseCatalogDescription } from './catalog-sources.js';

export const CATALOG_SOURCE = 'DSH Picks catalog';
const repoPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9._-]+$/;
const nativeKinds = new Set(['DSH 插件', '插件组合', 'DSH 主题']);
const kinds = { plugin: 'DSH 插件', bundle: '插件组合', theme: 'DSH 主题', skill: 'Skill/工具', tool: '开发工具' };
export const categories = ['设计创作', '三维创作', '记忆管理', '数据展示', '开发工具', '模型接入', '效率协作', '桌面体验'];
const tagCategories = {
  memory: '记忆管理', sessions: '记忆管理', knowledge: '数据展示', research: '数据展示', data: '数据展示',
  media: '设计创作', vision: '设计创作', video: '设计创作', image: '设计创作', fun: '设计创作',
  model: '模型接入', models: '模型接入', usage: '模型接入',
  ui: '桌面体验', theme: '桌面体验', desktop: '桌面体验', terminal: '桌面体验', remote: '桌面体验',
  dev: '开发工具', developer: '开发工具', safety: '开发工具', security: '开发工具', interop: '开发工具',
};
const strings = value => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
const text = value => typeof value === 'string' ? value : '';
const packageName = spec => { const valid = npmSpec(spec); const at = valid.indexOf('@', 1); return at < 0 ? valid : valid.slice(0, at); };
const keyOf = plugin => plugin.repo.toLowerCase() + '\n' + plugin.path;
const packedColumns = ['repo', 'path', 'name', 'summary', 'category', 'tags', 'packageName', 'install', 'installStatus', 'kind', 'updated', 'stars', 'sourceLabel', 'keywords', 'source'];
const packedKinds = ['DSH 插件', '插件组合', 'DSH 主题', 'Skill/工具', '开发工具', '其他'];
const packedStatuses = ['copyable', 'unverified', 'broken', 'manual', 'ecosystem'];
const installNotes = {
  copyable: '安装引用来自社区索引，未执行安装实测。', broken: '索引标记失效，请查看作者最新说明。',
  manual: '需按作者说明手动安装。', ecosystem: '此项按项目说明使用，不提供插件安装地址。',
  unverified: '缺少确切安装地址，请查看作者说明。',
};

export function packCatalog(snapshot) {
  const data = validateCatalog(snapshot);
  const rows = data.plugins.map(plugin => {
    const flags = (plugin.sourceLabel.includes('dsh.works') ? 1 : 0) | (plugin.sourceLabel.includes('awesome-dsh-plugin.com') ? 2 : 0);
    const row = [plugin.repo, plugin.path || null, plugin.name === plugin.repo.split('/')[1] ? null : plugin.name,
      plugin.summary || null, categories.indexOf(plugin.category), plugin.tags.length ? plugin.tags : null,
      plugin.packageName || null, plugin.installStatus === 'copyable' && (plugin.install === plugin.packageName || plugin.install.startsWith('github:')) ? null : plugin.install || null,
      packedStatuses.indexOf(plugin.installStatus) || null, packedKinds.indexOf(plugin.kind) || null,
      plugin.updated || null, plugin.stars || null, flags, plugin.keywords.length ? plugin.keywords : null,
      plugin.source === githubSource('', plugin.repo, plugin.path) ? null : plugin.source];
    while (row.at(-1) === null) row.pop();
    return row;
  });
  const { plugins, ...metadata } = data;
  return { ...metadata, schemaVersion: 2, columns: packedColumns, rows };
}

function unpackCatalog(snapshot) {
  if (!Array.isArray(snapshot.rows) || snapshot.rows.length > 100000 || JSON.stringify(snapshot.columns) !== JSON.stringify(packedColumns)) throw new Error('目录压缩格式无效');
  const plugins = snapshot.rows.map(row => {
    if (!Array.isArray(row) || row.length < 13 || row.length > packedColumns.length) throw new Error('目录压缩条目无效');
    const [repo, rawPath, name, summary, category, tags, declaredPackage, declaredInstall, state, kind, updated, stars, flags, keywords, source] = row;
    const path = rawPath ?? '';
    if (typeof repo !== 'string' || typeof path !== 'string' || ![1, 2, 3].includes(flags)) throw new Error('目录压缩身份无效');
    const installStatus = packedStatuses[state ?? 0];
    const pkg = declaredPackage ?? '';
    const install = declaredInstall ?? (installStatus === 'copyable' ? pkg || `github:${repo}${path ? '#path:/' + path : ''}` : '');
    return { id: stableId(repo.toLowerCase() + '\n' + path), repo, path, name: name ?? repo.split('/')[1], summary: summary ?? '',
      category: categories[category], tags: tags ?? [], packageName: pkg, install, installStatus, kind: packedKinds[kind ?? 0],
      updated: updated ?? '', stars: stars ?? 0, sourceLabel: flags === 3 ? 'dsh.works、awesome-dsh-plugin.com' : flags === 1 ? 'dsh.works' : 'awesome-dsh-plugin.com',
      keywords: keywords ?? [], source: source ?? githubSource('', repo, path), environment: [], installSteps: [], useCase: '', limitation: '',
      review: '未实测', reviewed: false, installNote: installNotes[installStatus] };
  });
  const { columns, rows, ...metadata } = snapshot;
  return { ...metadata, schemaVersion: 1, plugins };
}

function stableId(key) {
  let hash = 14695981039346656037n;
  for (const char of key) { hash ^= BigInt(char.codePointAt(0)); hash = BigInt.asUintN(64, hash * 1099511628211n); }
  return 'entry-' + hash.toString(16).padStart(16, '0');
}

function githubSource(value, repo, path) {
  const location = canonicalLocation(value);
  return location && location.repo.toLowerCase() === repo.toLowerCase() && location.path === path
    ? location.url : `https://github.com/${repo}${path ? '/tree/HEAD/' + path.split('/').map(encodeURIComponent).join('/') : ''}`;
}

function installation(raw, repo, path, kind) {
  if (raw.status === 'broken') return { install: '', installStatus: 'broken', installNote: '索引标记失效，请查看作者最新说明。' };
  if (!nativeKinds.has(kind)) return { install: '', installStatus: 'ecosystem', installNote: '此项按项目说明使用，不提供插件安装地址。' };
  const manual = Array.isArray(raw.install) ? raw.install.length > 0 : Boolean(raw.install);
  if (manual) return { install: '', installStatus: 'manual', installNote: '需按作者说明手动安装。' };
  if (raw.status === 'unverified') return { install: '', installStatus: 'unverified', installNote: '索引尚未核实安装地址。' };
  let spec = '';
  const primary = raw.catalogLinks?.some(link => link.label === 'dsh.works');
  if (primary && /package\.json#dsh\.bundle(?:[;\s]|$)/.test(text(raw.evidence))) {
    const prefix = text(raw.evidence).split('package.json#dsh.bundle')[0].replace(/\/$/, '');
    if (prefix === path) spec = raw.npm ? npmSpec(raw.npm)
      : !path || /^[\w.@-]+(?:\/[\w.@-]+)*$/.test(path) ? `github:${repo}${path ? '#path:/' + path : ''}` : '';
  } else if (!primary && raw.awesomeInstallSpec) {
    const declared = raw.awesomeInstallSpec;
    spec = npmSpec(declared) || (declared === `github:${repo}${path ? '#path:/' + path : ''}` ? declared : '');
  }
  return spec ? { install: spec, installStatus: 'copyable', installNote: '安装引用来自社区索引，未执行安装实测。' }
    : { install: '', installStatus: 'unverified', installNote: '缺少确切安装地址，请查看作者说明。' };
}

export function normalizeCatalogRecord(raw) {
  if (!raw || !repoPattern.test(raw.repo) || ['.', '..'].includes(raw.repo.split('/')[1])) throw new Error('目录仓库标识无效');
  const path = safePath(raw.path ?? '');
  if (path === null) throw new Error('目录组件路径无效');
  const repo = raw.repo;
  const tags = strings(raw.tags);
  const kind = kinds[raw.category] || '其他';
  const source = githubSource(raw.url, repo, path);
  const summary = chooseCatalogDescription(raw.description, raw.awesomeDescription, raw.summary, raw.desc);
  const aliases = [raw.description, raw.awesomeDescription].filter(value => typeof value === 'string' && value !== summary);
  const links = (raw.catalogLinks || []).filter(link => ['dsh.works', 'awesome-dsh-plugin.com'].includes(link.label));
  const updated = [raw.pushedAt, raw.pushed_at].find(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) && Number.isFinite(Date.parse(value))) || '';
  return {
    id: stableId(repo.toLowerCase() + '\n' + path), name: text(raw.name) || repo.split('/')[1], summary,
    category: tags.map(tag => tagCategories[tag]).find(Boolean) || '效率协作', tags, keywords: aliases,
    repo, path, packageName: packageName(raw.npm) || packageName(raw.awesomeInstallSpec),
    ...installation(raw, repo, path, kind), kind,
    environment: [], installSteps: [], useCase: '', limitation: '', source, review: '未实测', reviewed: false,
    updated, sourceLabel: [...new Set(links.map(link => link.label))].join('、'),
    stars: Number.isFinite(raw.stars) && raw.stars >= 0 ? raw.stars : 0,
  };
}

function curatedRecord(plugin) {
  return { kind: 'DSH 插件', installStatus: plugin.install ? 'copyable' : 'unverified', installNote: '', updated: '',
    sourceLabel: '编辑精选', reviewed: false, stars: 0, environment: [], installSteps: [], useCase: '', limitation: '',
    review: '未实测', ...plugin, reviewed: plugin.reviewed === true };
}

export function mergeCurated(community, curated) {
  const result = community.map(plugin => ({ ...plugin }));
  const used = new Set();
  for (const item of curated) {
    const selected = curatedRecord(item);
    const exact = result.findIndex(plugin => keyOf(plugin) === keyOf(selected));
    const samePackage = selected.packageName ? result.map((plugin, index) => ({ plugin, index }))
      .filter(({ plugin }) => plugin.packageName === selected.packageName && (!plugin.path || !selected.path || plugin.path === selected.path)) : [];
    const index = exact >= 0 ? exact : samePackage.length === 1 ? samePackage[0].index : -1;
    if (index < 0) result.push(selected);
    else {
      const live = result[index];
      if (used.has(index)) throw new Error('精选条目组件身份冲突');
      used.add(index);
      result[index] = { ...live, ...selected, stars: live.stars, updated: live.updated,
        sourceLabel: live.sourceLabel || selected.sourceLabel,
        ...(live.installStatus === 'broken' ? { install: '', installStatus: 'broken', installNote: live.installNote } : {}) };
    }
  }
  return result;
}

export function validateCatalog(snapshot) {
  if (snapshot?.schemaVersion === 2) snapshot = unpackCatalog(snapshot);
  if (snapshot?.source !== CATALOG_SOURCE || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.plugins) || !snapshot.plugins.length ||
      !Array.isArray(snapshot.sources) || !snapshot.sources.length || !Array.isArray(snapshot.warnings) || !snapshot.warnings.every(item => typeof item === 'string') ||
      typeof snapshot.fetchedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.fetchedAt))) throw new Error('目录快照格式无效');
  const ids = new Set(), identities = new Set();
  for (const plugin of snapshot.plugins) {
    if (!plugin || typeof plugin.repo !== 'string' || !/^[\w.-]{1,120}$/.test(plugin.id) || ids.has(plugin.id) || identities.has(keyOf(plugin)) ||
        !repoPattern.test(plugin.repo) || typeof plugin.path !== 'string' || safePath(plugin.path) !== plugin.path ||
        !['copyable', 'manual', 'unverified', 'broken', 'ecosystem'].includes(plugin.installStatus) || !Number.isFinite(plugin.stars) || plugin.stars < 0 ||
        (plugin.installStatus !== 'copyable' && plugin.install) || plugin.reviewed !== false ||
        !['name', 'summary', 'category', 'packageName', 'install', 'installNote', 'kind', 'useCase', 'limitation', 'source', 'review', 'sourceLabel', 'updated'].every(key => typeof plugin[key] === 'string') ||
        !['tags', 'keywords', 'environment', 'installSteps'].every(key => Array.isArray(plugin[key]) && plugin[key].every(value => typeof value === 'string'))) throw new Error('目录条目无效');
    const location = canonicalLocation(plugin.source);
    if (!location || location.repo.toLowerCase() !== plugin.repo.toLowerCase() || location.path !== plugin.path) throw new Error('目录来源地址无效');
    const expectedGit = `github:${plugin.repo}${plugin.path ? '#path:/' + plugin.path : ''}`;
    if (plugin.install && !npmSpec(plugin.install) && (plugin.install !== expectedGit || (plugin.path && !/^[\w.@-]+(?:\/[\w.@-]+)*$/.test(plugin.path)))) throw new Error('目录安装地址无效');
    ids.add(plugin.id); identities.add(keyOf(plugin));
  }
  const expected = new Set(['dsh.works', 'awesome-dsh-plugin.com']);
  for (const item of snapshot.sources) {
    if (!expected.delete(item.label) || !['ok', 'unavailable'].includes(item.status) || !Number.isSafeInteger(item.count) || item.count < 0 || (item.status === 'ok' && !item.count)) throw new Error('目录来源状态无效');
    if (item.status !== 'ok' && !snapshot.warnings.length) throw new Error('目录来源缺失说明');
  }
  if (expected.size || !snapshot.sources.some(item => item.status === 'ok')) throw new Error('目录来源不完整');
  return snapshot;
}

export async function loadCatalog(curated, { fetcher = fetch } = {}) {
  try {
    const response = await fetcher(new URL('./catalog.json', import.meta.url), { credentials: 'omit', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('目录快照读取失败');
    const snapshot = validateCatalog(await response.json());
    return { plugins: mergeCurated(snapshot.plugins, curated), fetchedAt: snapshot.fetchedAt, sources: snapshot.sources, warnings: [...snapshot.warnings] };
  } catch {
    return { plugins: curated.map(curatedRecord), fetchedAt: '', sources: [], warnings: ['完整目录暂不可用，当前仅显示编辑精选。请重试加载目录快照。'] };
  }
}
