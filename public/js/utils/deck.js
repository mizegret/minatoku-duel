import { nextCard } from './cards.js';
import { shuffle } from './random.js';
import { DECK_COMPOSITION } from '../constants.js';

export function buildDeck(cardsByType, hostGame) {
  const deck = [];
  const { humans, decorations, actions } = DECK_COMPOSITION;
  for (let i = 0; i < humans; i += 1) {
    const c = nextCard(cardsByType, 'humans', hostGame);
    deck.push({ ...c, type: 'human' });
  }
  for (let i = 0; i < decorations; i += 1) {
    const c = nextCard(cardsByType, 'decorations', hostGame);
    deck.push({ ...c, type: 'decoration' });
  }
  for (let i = 0; i < actions; i += 1) {
    const c = nextCard(cardsByType, 'actions', hostGame);
    deck.push({ ...c, type: 'action' });
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
