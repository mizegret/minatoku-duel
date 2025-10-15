// Action and logging helpers (Phase 1: behavior-invariant)
// Extracted from app.js with identical wording, order, and gating.

import { state, setState } from '../state.js';

// Logging: show only authoritative, user-meaningful entries
const LOG_FILTER = { network: false, state: false, event: true, move: true };
const LOG_KEYS = { action: null, turnStart: null, turnMsg: null, turnEnd: null };

export function shouldLog(keyName, key) {
  if (!key) return true;
  if (LOG_KEYS[keyName] === key) return false;
  LOG_KEYS[keyName] = key;
  return true;
}

function pushLog(entry) {
  const next = [entry, ...state.log];
  setState({ log: next });
}

export function logAction(type, message) {
  if (LOG_FILTER[type] === false) return;
  pushLog({ type, message, at: Date.now() });
}

export function lockActions(UI) {
  setState({ actionLocked: true });
  UI?.setActionButtonsDisabled?.(true);
  UI?.updateHandInteractivity?.(state.isMyTurn, state.actionLocked);
}

export function unlockActions(UI) {
  setState({ actionLocked: false });
  UI?.setActionButtonsDisabled?.(false);
  UI?.updateHandInteractivity?.(state.isMyTurn, state.actionLocked);
}

export function ensureSingleAction(UI, callback) {
  return () => {
    if (state.actionLocked) {
      console.log('1ターンにつき1アクションのみ（モック）');
      return;
    }
    callback();
    lockActions(UI);
  };
}

