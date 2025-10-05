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
