// Score utilities (M3: aggregation for verification only)
// - buildCardIndex(cardsByType): map id -> card (for decorations lookup)
// - scoreField(field, cardsById): recompute charm/oji from field only (current behavior parity)
//   - humans: +1 charm each (baseCharm is ignored until SWITCH)
//   - decorations: +charmBonus or +charm (fallback 1), oji not counted (current behavior)

export function buildCardIndex(cardsByType) {
  const byId = new Map();
  if (cardsByType && typeof cardsByType === 'object') {
    for (const key of Object.keys(cardsByType)) {
      const col = cardsByType[key];
      if (Array.isArray(col)) {
        for (const c of col) {
          if (c && typeof c === 'object' && c.id) byId.set(c.id, c);
        }
      }
    }
  }
  return byId;
}

export function scoreField(field, cardsById) {
  const result = { charm: 0, oji: 0, total: 0 };
  const humans = Array.isArray(field?.humans) ? field.humans : [];
  // humans: +1 charm each (current behavior)
  result.charm += humans.length;

  for (const h of humans) {
    const decos = Array.isArray(h?.decorations) ? h.decorations : [];
    for (const d of decos) {
      const card = d?.id ? cardsById?.get?.(d.id) : null;
      const dCharm = Number.isFinite(card?.charmBonus)
        ? Number(card.charmBonus)
        : (Number.isFinite(card?.charm) ? Number(card.charm) : 1);
      result.charm += dCharm;
      // current runtime does not add oji for decorations
    }
  }

  result.total = result.charm + result.oji;
  return result;
}

