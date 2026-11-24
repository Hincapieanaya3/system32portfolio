const BASE = import.meta.env.BASE_URL || '/';

export function assetUrl(path) {
  if (typeof path !== 'string') return path;
  if (
    path.startsWith('/media/') ||
    path.startsWith('/fonts/') ||
    path.startsWith('/Sebastian_')
  ) {
    return `${BASE}${path.slice(1)}`;
  }
  return path;
}

export function prefixAssets(value) {
  if (typeof value === 'string') return assetUrl(value);
  if (Array.isArray(value)) return value.map(prefixAssets);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = prefixAssets(v);
    }
    return out;
  }
  return value;
}
