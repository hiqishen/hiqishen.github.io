const catalogViewDefaults = Object.freeze({
  mode: 'curated', search: '', category: '全部', kind: '全部', availability: 'all',
  native: false, recommended: false, favoritesOnly: false, sort: 'auto', page: 0
});
const viewParams = {
  mode: 'scope', search: 'q', category: 'category', kind: 'type', availability: 'install',
  native: 'native', recommended: 'picked', favoritesOnly: 'saved', sort: 'sort', page: 'page'
};
const viewChoices = {
  mode: ['curated', 'full'],
  availability: ['all', 'copyable', 'manual', 'unverified', 'broken', 'ecosystem'],
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
    if (value === catalogViewDefaults[key]) url.searchParams.delete(param);
    else if (key === 'page') url.searchParams.set(param, String(value + 1));
    else url.searchParams.set(param, value === true ? '1' : value);
  }
  return url;
}
