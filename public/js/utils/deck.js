import { nextCard } from './cards.js';
import { shuffle } from './random.js';
import { DECK_COMPOSITION } from '../constants.js';

export function buildDeck(cardsByType, hostGame) {
  const deck = [];
  const SPEC = [
    ['humans', 'human'],
    ['decorations', 'decoration'],
    ['actions', 'action'],
  ];
  for (const [poolKey, type] of SPEC) {
    const count = Number(DECK_COMPOSITION?.[poolKey]) || 0;
    for (let i = 0; i < count; i += 1) {
      const c = nextCard(cardsByType, poolKey, hostGame);
      deck.push({ ...c, type });
    }
  }
  return shuffle(deck);
}

export function drawCard(playerId, game) {
  if (!game || !playerId) return null;
  const deck = game.decksById?.[playerId];
  if (!Array.isArray(deck) || deck.length === 0) return null;
  const card = deck.shift();
  if (!Array.isArray(game.handsById?.[playerId])) game.handsById[playerId] = [];
  game.handsById[playerId].push(card);
  return card;
}

// A4: helper to take a card from a hand by id first, then by type (no-op if not found)
export function popFirstByIdOrType(hand, { cardId, type } = {}) {
  if (!Array.isArray(hand) || hand.length === 0) return { card: null, index: -1 };
  let idx = -1;
  if (cardId) idx = hand.findIndex((c) => c?.id === cardId);
  if (idx < 0 && type) idx = hand.findIndex((c) => c?.type === type);
  if (idx < 0) return { card: null, index: -1 };
  const card = hand.splice(idx, 1)[0];
  return { card, index: idx };
}
