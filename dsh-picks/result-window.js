export function resultWindow(current, matches, limit, preserve = false) {
  const ids = matches.map((item) => item.id);
  const wanted = Math.max(0, Math.trunc(limit));
  if (!preserve) return ids.slice(0, wanted);
  const eligible = new Set(ids);
  const next = current.filter((id) => eligible.has(id));
  const present = new Set(next);
  for (const id of ids) {
    if (next.length >= wanted) break;
    if (!present.has(id)) {
      next.push(id);
      present.add(id);
    }
  }
  return next;
}
