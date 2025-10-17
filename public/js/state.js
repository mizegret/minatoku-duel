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

// --- simple subscription mechanism (B1 minimal): shallow-key notifications ---
const watchers = new Map(); // key -> Set<fn>
let pendingKeys = new Set();
let scheduled = false;

// Integrate a minimal store for future reducer/dispatch path
import { createStore } from './state/store.js';
import { rootReducer } from './state/root-reducer.js';
const store = createStore(state, rootReducer);
// Bridge store subscription to per-key watchers batching
store.subscribe((changedKeys) => {
  if (!Array.isArray(changedKeys) || !changedKeys.length) return;
  changedKeys.forEach((k) => pendingKeys.add(k));
  scheduleNotify();
});

export function subscribe(key, fn) {
  if (!watchers.has(key)) watchers.set(key, new Set());
  watchers.get(key).add(fn);
  return () => unsubscribe(key, fn);
}

export function unsubscribe(key, fn) {
  const set = watchers.get(key);
  if (set) set.delete(fn);
}

function scheduleNotify() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    const keys = Array.from(pendingKeys);
    pendingKeys = new Set();
    keys.forEach((k) => {
      const set = watchers.get(k);
      if (!set || set.size === 0) return;
      const value = state[k];
      set.forEach((fn) => {
        try { fn(value); } catch {}
      });
    });
  });
}

export function setState(patch = {}) {
  if (!patch || typeof patch !== 'object') return state;
  store.dispatch({ type: 'PATCH', patch });
  return state;
}

export function dispatch(action) {
  return store.dispatch(action);
}

export function addMember(clientId) {
  if (!clientId) return;
  if (!Array.isArray(state.members)) state.members = [];
  if (!state.members.includes(clientId)) state.members.push(clientId);
}
