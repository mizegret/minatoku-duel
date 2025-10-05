export const TOTAL_TURNS = 5;
export const ABLY_CHANNEL_PREFIX = 'room:';
export const MAX_DECORATIONS_PER_HUMAN = 2;
// DEBUG/CARD_TYPES は現状未使用のため削除（必要になったら最小範囲で追加）

// Deck/hand composition (MVP): keep all counts in one place
export const HAND_SIZE = 5;
export const DECK_COMPOSITION = {
  humans: 5,
  decorations: 10,
  actions: 5,
};

// Messaging event names (for Ably publish/subscribe)
export const EVENTS = {
  join: 'join',
  start: 'start',
  move: 'move',
  state: 'state',
};

// In-game action identifiers
export const ACTIONS = {
  summon: 'summon',
  decorate: 'decorate',
  play: 'play',
  skip: 'skip',
};

// SCORE_RULES (M4): externalized scoring table
// Initial table matches current behavior exactly (no behavior change)
export const SCORE_RULES = {
  // summon: use baseCharm when available; fallback to 1
  summon: { useBaseCharm: true, defaultCharm: 1 },
  decorate: {
    useCardCharm: true,      // if true, prefer card.charm; else fallback to defaultCharm
    defaultCharm: 1,
    defaultOji: 0,
  },
  play: {
    baseCharm: 1,
    baseOji: 1,
    effects: 'add',          // apply Effect(op:'add') as-is
  },
};
