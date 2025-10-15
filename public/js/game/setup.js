// Room setup helpers (Phase 1: behavior-invariant)

import { state, setState } from '../state.js';
import { lockActions } from '../ui/actions.js';

export function prepareRoom(UI) {
  resetScores();
  resetPlayers();
  resetTurn();
  resetLog();
  setState({ started: false, hostId: null });
  UI.renderGame(state);
  // 開始前はロックしておき、state受信で解放
  lockActions(UI);
  UI.updateScores(state.scores);
  UI.updateStartUI(state.isHost);
}

function resetScores() { setState({ scores: { charm: 0, oji: 0, total: 0 } }); }
function resetPlayers() { setState({ self: { hand: [], field: { humans: [] } }, opponent: { hand: [], field: { humans: [] } } }); }
function resetTurn() { setState({ turn: 1 }); }
function resetLog() { setState({ log: [] }); }

