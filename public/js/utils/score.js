// Score utilities (aggregate-as-truth)
// - buildCardIndex(cardsByType): map id -> card (for decorations lookup)
// - scoreField(field, cardsById): recompute charm/oji from field only（場＋装飾のみを集計）
//   - humans: SCORE_RULES.summon: baseCharm>0 を優先、未指定は defaultCharm
//   - decorations: v2 の charmBonus を使用（未指定は defaultCharm）、oji は未集計

import { SCORE_RULES } from '../constants.js';

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
  // humans: base per rules (default +1; use baseCharm when enabled)
  for (const h of humans) {
    const useBase = !!SCORE_RULES?.summon?.useBaseCharm;
    const bc = Number(h?.baseCharm);
    const base = (useBase && Number.isFinite(bc) && bc > 0)
      ? bc
      : Number(SCORE_RULES?.summon?.defaultCharm ?? 1);
    result.charm += base;
  }

  for (const h of humans) {
    const decos = Array.isArray(h?.decorations) ? h.decorations : [];
    for (const d of decos) {
      const card = d?.id ? cardsById?.get?.(d.id) : null;
      const dCharm = Number.isFinite(card?.charmBonus)
        ? Number(card.charmBonus)
        : Number(SCORE_RULES?.decorate?.defaultCharm ?? 1);
      result.charm += dCharm;
      // current runtime does not add oji for decorations
    }
  }

  result.total = result.charm + result.oji;
  return result;
}
