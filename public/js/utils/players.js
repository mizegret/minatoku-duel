export function buildPlayers(game, members) {
  return members.map((id) => ({
    clientId: id,
    hand: Array.isArray(game.handsById?.[id]) ? game.handsById[id] : [],
    field: game.fieldById?.[id] ?? { humans: [] },
    scores: game.scoresById?.[id] ?? { charm: 0, oji: 0, total: 0 },
    deckCount: Array.isArray(game.decksById?.[id]) ? game.decksById[id].length : 0,
  }));
}

// Return current members with host first (if present)
export function getMembers(state, getClientId) {
  if (!Array.isArray(state?.members)) return [];
  const host = state.hostId || (typeof getClientId === 'function' ? getClientId() : null);
  const uniq = state.members.filter((id, i, arr) => id && arr.indexOf(id) === i);
  if (host && uniq.includes(host)) {
    return [host, ...uniq.filter((id) => id !== host)];
  }
  return uniq;
}
