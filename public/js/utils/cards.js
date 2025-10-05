// Card helpers: pick next card from by-type pools with hostGame sequence
export function nextCard(cardsByType, type, hostGame) {
  const empty = { id: `${type}-none`, name: 'カード' };
  const col = cardsByType?.[type];
  if (!Array.isArray(col) || col.length === 0) return empty;
  if (!hostGame) return col[0];
  if (!hostGame._seq) hostGame._seq = { humans: 0, decorations: 0, actions: 0 };
  const idx = hostGame._seq[type] % col.length;
  hostGame._seq[type] = hostGame._seq[type] + 1;
  return col[idx];
}

