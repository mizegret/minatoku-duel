export const TOTAL_TURNS = 5;
export const ABLY_CHANNEL_PREFIX = 'room:';
export const MAX_DECORATIONS_PER_HUMAN = 2;
export const DEBUG = true; // set false in production
export const CARD_TYPES = { HUMAN: 'human', DECORATION: 'decoration', ACTION: 'action' };

// Deck/hand composition (MVP): keep all counts in one place
export const HAND_SIZE = 5;
export const DECK_COMPOSITION = {
  humans: 5,
  decorations: 10,
  actions: 5,
};
