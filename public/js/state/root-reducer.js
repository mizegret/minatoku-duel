import { reduceStateApplied } from './reducer.js';

export function rootReducer(state, action) {
  if (!action || !action.type) return null;
  switch (action.type) {
    case 'STATE_APPLIED': {
      try {
        const { patch } = reduceStateApplied({ state, snapshot: action.snapshot, getClientId: action.getClientId });
        return patch;
      } catch {
        return null;
      }
    }
    case 'PATCH':
      return action.patch || null;
    default:
      return null;
  }
}

