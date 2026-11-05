const catalogFields = new WeakMap();
let previousSearch;

function foldSearch(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase();
}

// 仅在标识符内部等价处理分隔符，保留 C++、C#、.env 等名称的符号。
function identifierWords(text) {
  return text.replace(/([\p{L}\p{N}])[._-]+(?=[\p{L}\p{N}])/gu, '$1 ');
}
function identifierField(value) {
  const raw = foldSearch(value);
  const words = identifierWords(raw);
  return words === raw ? raw : raw + '\0' + words;
}
function projectFields(project) {
  let fields = catalogFields.get(project);
  if (!fields) {
    const repo = foldSearch(project.repo);
    const slash = repo.indexOf('/');
    const path = foldSearch(project.componentPath);
    fields = {
      name: identifierField(project.name),
      repo, path, owner: slash < 0 ? '' : repo.slice(0, slash),
      ids: [repo.slice(slash + 1), path, project.installRecord?.npm].filter(Boolean).map(identifierField),
      labels: [project.category, project.kind, ...(project.tags || [])].map(foldSearch),
      desc: [project.desc, ...(project.descAliases || [])].map(foldSearch).join('\0')
    };
    catalogFields.set(project, fields);
  }
  return fields;
}
function catalogQuery(input) {
  const phrase = foldSearch(input).trim().replace(/\s+/gu, ' ');
  if (previousSearch?.phrase === phrase) return previousSearch;
  const terms = [...new Set(phrase.split(' ').filter(Boolean))];
  const forms = terms.map(term => {
    const words = identifierWords(term);
    return words === term ? [term] : [term, words];
  });
  const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ordered = [...terms].sort((a, b) => b.length - a.length);
  const pattern = terms.length ? new RegExp('(' + [phrase, ...ordered].map(escapeRegex).join('|') + ')', 'iu') : null;
  const addresses = forms.map(([term]) => {
    const locator = /^(?:github:|https?:\/\/github\.com\/)?([\w.-]+\/[\w.-]+)\/?(?:#(?:path:)?\/?([^\s#]+))?$/.exec(term);
    return locator ? {repo:locator[1].replace(/\.git$/,''), path:(locator[2] || '').replace(/\/$/,'')} : null;
  });
  previousSearch = {phrase, terms, forms, addresses, pattern};
  return previousSearch;
}

const matchTier = Object.freeze({none:0, owner:1, body:2, titleAndBody:3, labels:4, identifier:5, address:6, title:7});
function fieldContains(field, forms) {
  return forms.some(form => field.includes(form));
}
function catalogRank(project, query) {
  if (!query.terms.length) return matchTier.none;
  const fields = projectFields(project);
  // 标题只判断是否覆盖全部不同搜索词；命中后不再读取其它字段来加分。
  if (query.forms.every(forms => fieldContains(fields.name, forms))) return matchTier.title;
  let weakest = matchTier.title, titleHit = false;
  for (let index = 0; index < query.forms.length; index++) {
    const forms = query.forms[index], address = query.addresses[index];
    let tier;
    if (fieldContains(fields.name, forms)) { tier = matchTier.title; titleHit = true; }
    else if (address && address.repo === fields.repo && address.path === fields.path) tier = matchTier.address;
    else if (fields.path.includes('/') && fields.path === forms[0]) tier = matchTier.address;
    else if ((address && address.repo === fields.repo && !address.path) ||
             (forms[0].includes('/') && fields.repo.includes(forms[0])) ||
             fields.ids.some(id => fieldContains(id, forms))) tier = matchTier.identifier;
    else if (fields.labels.some(label => label.includes(forms[0]))) tier = matchTier.labels;
    else if (fields.desc.includes(forms[0])) tier = matchTier.body;
    else if (fields.owner.includes(forms[0])) tier = matchTier.owner;
    else return matchTier.none;
    weakest = Math.min(weakest, tier);
  }
  return weakest === matchTier.body && titleHit ? matchTier.titleAndBody : weakest;
}

// 一分相当于 Stars + 1 翻一倍。只在同一文本档内使用，不让父仓库热度跨档。
function projectUtility(stars, native, installState, picked) {
  const starPoints = Math.log2(1 + Math.min(1000, Math.max(0, stars)));
  return starPoints + (native ? 2 : 0) + (installState === 'copyable' ? 1 : 0) + (picked ? 0.5 : 0);
}
