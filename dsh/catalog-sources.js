const AWESOME = 'https://awesome-dsh-plugin.com';
const PRIMARY_LINK = Object.freeze({url:'https://dsh.works/awesome-dsh-plugins/', label:'dsh.works'});
const repoPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9._-]+$/;

function safePath(value) {
  if (typeof value !== 'string') return null;
  const path = value.replace(/^\/+|\/+$/g, '');
  if (!path) return '';
  return !/[\\?#\u0000-\u001f\u007f]/.test(path) && !path.split('/').some(part => part === '.' || part === '..' || !part) ? path : null;
}

function canonicalLocation(value) {
  if (typeof value !== 'string') return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!value.startsWith('https://github.com/') || url.origin !== 'https://github.com' || url.search || url.hash || url.username || url.password) return null;
  const parts = value.slice('https://github.com/'.length).replace(/\/$/, '').split('/');
  const repo = parts.slice(0, 2).join('/');
  if (!repoPattern.test(repo) || ['.', '..'].includes(parts[1]) || (parts.length !== 2 && (parts.length < 5 || parts[2] !== 'tree' || ['.', '..'].includes(parts[3]) || !/^[\w.-]+$/.test(parts[3])))) return null;
  const path = parts.length === 2 ? '' : safePath(parts.slice(4).join('/'));
  if (path === null || (parts.length > 2 && !path)) return null;
  let decodedPath;
  try {
    const decodedParts = path.split('/').map(part => decodeURIComponent(part));
    if (decodedParts.some(part => part.includes('/'))) return null;
    decodedPath = decodedParts.join('/');
  } catch { return null; }
  if (safePath(decodedPath) === null) return null;
  return {repo, path:decodedPath, url:url.href, slug:repo + (path ? '--' + path.replaceAll('/', '-') : '')};
}

function npmSpec(value) {
  if (typeof value !== 'string' || value.length > 300) return '';
  const at = value.indexOf('@', 1);
  const name = at < 0 ? value : value.slice(0, at);
  const version = at < 0 ? '' : value.slice(at + 1);
  return name.length <= 214 && /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(name)
    && (at < 0 || /^[a-zA-Z0-9*~^][a-zA-Z0-9.*+~^_-]*$/.test(version)) ? value : '';
}

function declaredSpec(item, location) {
  if (typeof item.cmd !== 'string') return '';
  const match = /^dsh plugin --profile web add ([^\s"'`;$&|<>\\]+)$/.exec(item.cmd);
  if (!match) return '';
  const spec = match[1];
  if (item.npm === 1) return npmSpec(spec);
  const expected = 'github:' + location.repo + (location.path ? '#path:/' + location.path : '');
  return item.npm === 0 && /^[\w.@/-]*$/.test(location.path) && spec === expected ? spec : '';
}

function descriptionText(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || !/[\p{L}\p{N}]/u.test(text) || /^(?:n\/?a|none|null|undefined|unknown|no description(?: provided| available)?\.?|暂无(?:简介|描述)|未提供(?:简介|描述)|项目未提供简介，请打开仓库查看 README。)$/i.test(text)) return '';
  return text;
}

function chineseDescriptionScore(text) {
  const han = (text.match(/\p{Script=Han}/gu) || []).length;
  const kana = (text.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length;
  const latin = (text.match(/[a-z]/gi) || []).length;
  if (han < 2 || kana > han * 0.15) return 0;
  return han + Math.min(latin / 8, han);
}

function chooseCatalogDescription(...texts) {
  const descriptions = texts.map(descriptionText).filter(Boolean);
  let chosen = descriptions[0] || '';
  let best = chineseDescriptionScore(chosen);
  for (const text of descriptions.slice(1)) {
    const score = chineseDescriptionScore(text);
    if (score > best) { chosen = text; best = score; }
  }
  return chosen;
}

function readAwesomeCatalog(catalogJson, canonicalItemList, locale = 'en') {
  if (!['en', 'zh'].includes(locale) || !Array.isArray(catalogJson?.items) || canonicalItemList?.['@type'] !== 'ItemList' || !Array.isArray(canonicalItemList.itemListElement)) return [];
  const canonical = new Map();
  for (const entry of canonicalItemList.itemListElement) {
    const location = canonicalLocation(entry?.url);
    if (!location) continue;
    const key = location.slug.toLowerCase();
    // 路径压平后可能重名；有歧义时不推断组件归属。
    canonical.set(key, canonical.has(key) ? null : location);
  }
  const result = [];
  const seen = new Set();
  for (const item of catalogJson.items) {
    if (!item || typeof item.slug !== 'string' || typeof item.owner !== 'string') continue;
    const location = canonical.get(item.slug.toLowerCase());
    if (!location || item.owner.toLowerCase() !== location.repo.split('/')[0].toLowerCase() || item.slug.toLowerCase() !== location.slug.toLowerCase()) continue;
    const href = (locale === 'zh' ? '/zh/p/' : '/p/') + item.slug + '/';
    if (item.href !== href || seen.has(item.slug.toLowerCase())) continue;
    seen.add(item.slug.toLowerCase());
    const category = item.cat === 'skill' ? 'skill' : item.cat === 'theme' ? 'theme' : 'plugin';
    const tag = {session:'sessions',workflow:'agents',agi:'agents',voice:'media',docs:'knowledge',git:'dev',wsl:'desktop',identity:'ui',theme:'ui'}[item.cat] || item.cat;
    const record = {
      repo:location.repo, path:location.path, name:typeof item.name === 'string' ? item.name : location.repo.split('/')[1],
      description:typeof item.desc === 'string' ? item.desc : '', category, tags:typeof tag === 'string' ? [tag] : [],
      stars:Number.isFinite(item.stars) && item.stars >= 0 ? item.stars : 0,
      added:typeof item.added === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.added) ? item.added : '',
      url:location.url, catalogLinks:[{url:AWESOME + href,label:'awesome-dsh-plugin.com'}],
    };
    const spec = declaredSpec(item, location);
    if (category !== 'skill' && spec) record.awesomeInstallSpec = spec;
    const description = descriptionText(item.desc);
    if (description) {
      record.awesomeDescription = description;
      record.awesomeDescriptionLocale = locale;
      record.awesomeDescriptionSource = AWESOME + href;
    }
    result.push(record);
  }
  return result;
}

function records(value) { return Array.isArray(value) ? value : Array.isArray(value?.plugins) ? value.plugins : []; }
function identity(record) {
  const repo = typeof record?.repo === 'string' && repoPattern.test(record.repo) && !['.', '..'].includes(record.repo.split('/')[1]) ? record.repo.toLowerCase() : '';
  const path = safePath(record?.path ?? '');
  return repo && path !== null ? {repo, path, key:repo + '\n' + path} : null;
}
function installReference(record) { return npmSpec(record.npm) || npmSpec(record.awesomeInstallSpec); }
function awesomeLinks(record) {
  const location = identity(record);
  if (!location) return [];
  const expectedSlug = record.repo.split('/')[1] + (location.path ? '--' + location.path.replaceAll('/', '-') : '');
  return (Array.isArray(record.catalogLinks) ? record.catalogLinks : []).filter(link => {
    try {
      if (typeof link?.url !== 'string' || !link.url.startsWith(AWESOME + '/')) return false;
      const url = new URL(link.url);
      const match = /^https:\/\/awesome-dsh-plugin\.com\/(?:zh\/)?p\/([^/]+)\/([^/]+)\/$/.exec(link.url);
      if (!match || url.origin !== AWESOME || url.username || url.password || url.search || url.hash) return false;
      const segments = match.slice(1).map(part => decodeURIComponent(part));
      if (segments.some(part => /[\\/?#\u0000-\u001f\u007f]/.test(part) || /%[a-f0-9]{2}/i.test(part) || ['.', '..'].includes(part))) return false;
      return segments[0].toLowerCase() === record.repo.split('/')[0].toLowerCase() && segments[1] === expectedSlug;
    } catch { return false; }
  }).map(link => ({url:link.url,label:'awesome-dsh-plugin.com'}));
}

function keepAwesomeDescription(target, record, links) {
  const description = descriptionText(record.description);
  const selected = chooseCatalogDescription(target.awesomeDescription, description);
  if (description && selected === description) {
    target.awesomeDescription = description;
    const source = links.find(link => link.url === record.awesomeDescriptionSource) || links[0];
    target.awesomeDescriptionLocale = source.url.startsWith(AWESOME + '/zh/p/') ? 'zh' : 'en';
    target.awesomeDescriptionSource = source.url;
  }
}

function mergeCommunityCatalogs(dshRaw, awesomeRaw) {
  const primary = records(dshRaw).filter(record => record && typeof record === 'object').map(record => {
    const {awesomeInstallSpec, awesomeDescription, awesomeDescriptionLocale, awesomeDescriptionSource, catalogLinks, ...rest} = record;
    return {...rest,catalogLinks:[{...PRIMARY_LINK}]};
  });
  const secondary = records(awesomeRaw);
  const secondaryReferences = new Map();
  for (const record of secondary) {
    const id = identity(record), spec = record && installReference(record);
    if (id && spec && awesomeLinks(record).length) {
      const key = id.repo + '\n' + spec;
      secondaryReferences.set(key, (secondaryReferences.get(key) || 0) + 1);
    }
  }
  const exact = new Map();
  const byRepo = new Map();
  for (const record of primary) {
    const id = identity(record);
    if (!id) continue;
    exact.set(id.key, exact.has(id.key) ? null : record);
    if (!byRepo.has(id.repo)) byRepo.set(id.repo, []);
    byRepo.get(id.repo).push(record);
  }
  for (const record of secondary) {
    const id = identity(record);
    const links = awesomeLinks(record);
    if (!id || !links.length) continue;
    let match = exact.get(id.key);
    if (!match && !exact.has(id.key)) {
      const candidates = byRepo.get(id.repo) || [];
      const spec = installReference(record);
      const sameReference = candidates.filter(candidate => spec && spec === installReference(candidate));
      const compatible = sameReference.filter(candidate => {
        const other = identity(candidate);
        return !id.path || !other.path;
      });
      if (sameReference.length === 1 && compatible.length === 1 && secondaryReferences.get(id.repo + '\n' + spec) === 1) match = compatible[0];
    }
    if (match) {
      match.catalogLinks.push(...links.filter(link => !match.catalogLinks.some(existing => existing.url === link.url)));
      keepAwesomeDescription(match, record, links);
    } else if (!exact.has(id.key)) {
      const {awesomeDescription, awesomeDescriptionLocale, awesomeDescriptionSource, ...rest} = record;
      const addition = {...rest,catalogLinks:links};
      keepAwesomeDescription(addition, record, links);
      primary.push(addition);
      exact.set(id.key, addition);
      if (!byRepo.has(id.repo)) byRepo.set(id.repo, []);
      byRepo.get(id.repo).push(addition);
    }
  }
  return primary;
}
