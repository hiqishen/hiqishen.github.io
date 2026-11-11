import { filterCatalog } from "./library.js";
let plugins = [];
self.onmessage = ({ data }) => {
  if (data.plugins) {
    plugins = data.plugins;
    return;
  }
  try {
    self.postMessage({
      id: data.id,
      result: filterCatalog(plugins, data.query, data.options).map((p) => p.id),
    });
  } catch {
    self.postMessage({ id: data.id, result: null });
  }
};
