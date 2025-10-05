// Centralized game state store (Step6)
// - Keep a single exported object reference to avoid breaking existing references
// - Provide init/set helpers so write sites become explicit

export const state = {
  roomId: null,
  scores: { charm: 0, oji: 0, total: 0 },
  self: { hand: [], field: { humans: [] } },
  opponent: { hand: [], field: { humans: [] } },
  actionLocked: false,
  env: null,
  turn: 1,
  log: [],
  hostId: null,
  isHost: false,
  started: false,
  isMyTurn: false,
  members: [],
  hostGame: null,
  cardsByType: null,
};

export function initState(seed = {}) {
  Object.assign(state, seed);
  return state;
}

export function setState(patch = {}) {
  if (!patch || typeof patch !== 'object') return state;
  Object.assign(state, patch);
  return state;
}

export function addMember(clientId) {
  if (!clientId) return;
  if (!Array.isArray(state.members)) state.members = [];
  if (!state.members.includes(clientId)) state.members.push(clientId);
}

