// Cards loader (Phase 1: behavior-invariant)
// Extracted from public/app.js with identical logic and messages.

import { fetchJson } from '../utils/http.js';
import { setState } from '../state.js';

export async function loadCards() {
  try {
    const data = await fetchJson('/cards.json');
    if (!Array.isArray(data?.cards)) {
      throw new Error('cards.json must have an array property "cards"');
    }
    const humans = [];
    const decorations = [];
    const actions = [];

    for (const c of data.cards) {
      if (!c || typeof c !== 'object') continue;
      const type = String(c.type ?? '');
      const base = {
        id: String(c.id ?? ''),
        name: String(c.name ?? ''),
        type,
      };

      if (type === 'human') {
        const h = {
          ...base,
          age: typeof c.age === 'number' ? c.age : undefined,
          rarity: typeof c.rarity === 'string' ? c.rarity : undefined,
          baseCharm: typeof c.baseCharm === 'number' ? c.baseCharm : undefined,
          baseOji: typeof c.baseOji === 'number' ? c.baseOji : undefined,
          imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl : undefined,
          skills: Array.isArray(c.skills) ? c.skills : undefined,
        };
        // M5: light validation + safe defaults (warn-only; behavior unchanged)
        if (!Number.isFinite(h.baseCharm)) {
          // leave undefined so rules fallback (SCORE_RULES.summon.defaultCharm) applies
          console.warn('[cards][validate] human.baseCharm missing; using rule default (no field write)', h.id);
        }
        const R = String(h.rarity || '').toUpperCase();
        const okR = R === 'UR' || R === 'SR' || R === 'R' || R === 'N';
        if (!okR) {
          h.rarity = 'N';
          if (h.rarity !== undefined) console.warn('[cards][validate] human.rarity invalid; fallback N', h.id, h.rarity);
        } else {
          h.rarity = R;
        }
        if (!Number.isFinite(h.age)) {
          console.warn('[cards][validate] human.age missing', h.id);
        }
        humans.push(h);
      } else if (type === 'decoration') {
        const d = {
          ...base,
          rarity: typeof c.rarity === 'string' ? c.rarity : undefined,
          text: typeof c.text === 'string' ? c.text : undefined,
          imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl : undefined,
          charmBonus: typeof c.charmBonus === 'number' ? c.charmBonus : undefined,
          oji: typeof c.oji === 'number' ? c.oji : undefined, // reserved
          slotsUsed: typeof c.slotsUsed === 'number' ? c.slotsUsed : undefined, // reserved
        };
        // M5: defaults + warnings (v2 only)
        const RD = String(d.rarity || '').toUpperCase();
        const okRD = RD === 'UR' || RD === 'SR' || RD === 'R' || RD === 'N';
        if (!okRD) { d.rarity = 'N'; console.warn('[cards][validate] decoration.rarity missing; fallback N', d.id); } else { d.rarity = RD; }
        if (!Number.isFinite(d.charmBonus)) { d.charmBonus = 1; }
        if (!Number.isFinite(d.slotsUsed)) d.slotsUsed = 1;
        if (!d.text) console.warn('[cards][validate] decoration.text missing', d.id);
        decorations.push(d);
      } else if (type === 'action') {
        const a = {
          ...base,
          rarity: typeof c.rarity === 'string' ? c.rarity : undefined,
          text: typeof c.text === 'string' ? c.text : undefined,
          imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl : undefined,
          effect: Array.isArray(c.effect) ? c.effect : undefined,
        };
        const RA = String(a.rarity || '').toUpperCase();
        const okRA = RA === 'UR' || RA === 'SR' || RA === 'R' || RA === 'N';
        if (!okRA) { a.rarity = 'N'; console.warn('[cards][validate] action.rarity missing; fallback N', a.id); } else { a.rarity = RA; }
        if (!Array.isArray(a.effect)) { a.effect = []; console.warn('[cards][validate] action.effect missing; default []', a.id); }
        if (!a.text) console.warn('[cards][validate] action.text missing', a.id);
        actions.push(a);
      }
      // それ以外の type は無視（MVP）
    }

    // M5: duplicate id check (warn-only)
    const seen = new Set();
    for (const col of [humans, decorations, actions]) {
      for (const it of col) {
        if (!it?.id) continue;
        if (seen.has(it.id)) console.warn('[cards][validate] duplicate id detected', it.id);
        else seen.add(it.id);
      }
    }

    setState({ cardsByType: { humans, decorations, actions } });
    console.info('[cards] loaded (new schema)', { humans: humans.length, decorations: decorations.length, actions: actions.length });
  } catch (e) {
    console.warn('[cards] failed to load (new schema required), using defaults', e);
    setState({ cardsByType: {
      humans: [{ id: 'human-default', name: '港区女子（仮）', type: 'human' }],
      decorations: [{ id: 'deco-default', name: 'シャンパン（仮）', type: 'decoration' }],
      actions: [{ id: 'act-default', name: 'アクション（仮）', type: 'action' }],
    }});
  }
}

