// Turn-related helpers (Phase 1: behavior-invariant)
// Extracted from public/app.js with identical logic.

import { ACTIONS } from '../constants.js';
import { state } from '../state.js';

export function computeDisplayRound({ phase, round, myTurn, roundHalf }) {
  // Rule: 通常は現在ラウンドを表示。前半かつ自分のターンでない時だけ1つ前を表示。
  const base = (Number.isFinite(round) ? round : state.turn) || 1;
  if (phase === 'ended') return base;
  const showCurrent = myTurn || roundHalf === 1;
  return showCurrent ? base : Math.max(1, base - 1);
}

// Map action → fixed label (ログ文言は挙動不変)
const ACTION_LABEL = {
  [ACTIONS.summon]: '召喚',
  [ACTIONS.decorate]: '装飾',
  [ACTIONS.play]: 'ムーブ',
};

function buildTail(la) {
  const parts = [];
  if (Number.isFinite(la?.charm) && la.charm) parts.push(`魅力+${la.charm}`);
  if (Number.isFinite(la?.oji) && la.oji) parts.push(`好感度+${la.oji}`);
  return parts.length ? `（${parts.join(' / ')}）` : '';
}

export function formatLastAction(la, actorLabel) {
  if (!la || !la.type) return '';
  if (la.type === ACTIONS.skip) return `${actorLabel}：このターンは様子見`;
  const label = ACTION_LABEL[la.type];
  if (!label) return '';
  const tail = buildTail(la);
  // 末尾のスペースは従来の文面と合わせて保持
  return `${actorLabel}：${label} → ${la.cardName ?? ''} ${tail}`;
}

export function formatDeltaParts({ charm, oji } = {}) {
  const parts = [];
  if (Number.isFinite(charm) && charm) parts.push(`魅力+${charm}`);
  if (Number.isFinite(oji) && oji) parts.push(`好感度+${oji}`);
  return parts;
}
