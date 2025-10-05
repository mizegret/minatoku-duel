import { nextCard } from './cards.js';
import { shuffle } from './random.js';

export function buildDeck(cardsByType, hostGame) {
  const deck = [];
  // humans x5
  for (let i = 0; i < 5; i += 1) {
    const c = nextCard(cardsByType, 'humans', hostGame);
    deck.push({ ...c, type: 'human' });
  }
  // decorations x10
  for (let i = 0; i < 10; i += 1) {
    const c = nextCard(cardsByType, 'decorations', hostGame);
    deck.push({ ...c, type: 'decoration' });
  }
  // actions x5
  for (let i = 0; i < 5; i += 1) {
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

