const maxPageSize = 200;
function parseMinStars(value) {
  if (value === '') return 0;
  if (!/^\d+$/.test(value)) return null;
  const stars = Number(value);
  return Number.isSafeInteger(stars) && stars >= 0 ? stars : null;
}

function parsePageSize(value) {
  if (!/^\d+$/.test(value)) return null;
  const size = Number(value);
  return size >= 1 && size <= maxPageSize ? size : null;
}

const catalogViewDefaults = Object.freeze({
  mode: 'curated', search: '', category: '全部', kind: '全部', availability: 'all', scan: 'all',
  native: false, recommended: false, favoritesOnly: false, minStars: 0, sort: 'auto', page: 0, pageSize: 30
});
const viewParams = {
  mode: 'scope', search: 'q', category: 'category', kind: 'type', availability: 'install', scan: 'scan',
  native: 'native', recommended: 'picked', favoritesOnly: 'saved', minStars: 'minStars', sort: 'sort', page: 'page', pageSize: 'perPage'
};
const viewChoices = {
  mode: ['curated', 'full'],
  availability: ['all', 'copyable', 'manual', 'unverified', 'broken', 'ecosystem'],
  scan: ['all', 'reported', 'review'],
  sort: ['auto', 'priority', 'stars', 'date', 'name']
};

function readCatalogView(href) {
  const params = new URL(href).searchParams;
  const view = {...catalogViewDefaults};
  for (const [key, param] of Object.entries(viewParams)) {
    const value = params.get(param);
    if (!value) continue;
    if (viewChoices[key]) {
      if (viewChoices[key].includes(value)) view[key] = value;
    } else if (typeof view[key] === 'boolean') {
      view[key] = value === '1';
    } else if (key === 'minStars') {
      view.minStars = parseMinStars(value) ?? catalogViewDefaults.minStars;
    } else if (key === 'pageSize') {
      view.pageSize = parsePageSize(value) ?? catalogViewDefaults.pageSize;
    } else if (key === 'page') {
      const page = Number(value);
      if (Number.isSafeInteger(page) && page >= 1) view.page = page - 1;
    } else {
      view[key] = value;
    }
  }
  return view;
}

function catalogViewUrl(href, view) {
  const url = new URL(href);
  for (const [key, param] of Object.entries(viewParams)) {
    const value = view[key];
    if (value === undefined || value === catalogViewDefaults[key]) url.searchParams.delete(param);
    else if (key === 'page') url.searchParams.set(param, String(value + 1));
    else url.searchParams.set(param, value === true ? '1' : value);
  }
  return url;
}
