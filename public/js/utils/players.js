export function buildPlayers(game, members) {
  return members.map((id) => ({
    clientId: id,
    hand: Array.isArray(game.handsById?.[id]) ? game.handsById[id] : [],
    field: game.fieldById?.[id] ?? { humans: [] },
    scores: game.scoresById?.[id] ?? { charm: 0, oji: 0, total: 0 },
    deckCount: Array.isArray(game.decksById?.[id]) ? game.decksById[id].length : 0,
  }));
}

