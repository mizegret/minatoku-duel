// Navigation helpers (Phase 1: behavior-invariant)

import { state } from '../state.js';
import { setNotice } from './notice.js';
import { prepareRoom } from '../game/setup.js';

const lobbySection = document.getElementById('screen-lobby');
const roomSection = document.getElementById('screen-room');
const roomIdLabel = document.getElementById('room-id');

export function showLobby(withNotice) {
  lobbySection?.removeAttribute('hidden');
  roomSection?.setAttribute('hidden', '');
  state.roomId = null;
  if (withNotice) setNotice(withNotice);
  else setNotice('');
}

export function showRoom(roomId, { UI, connect } = {}) {
  state.roomId = roomId;
  if (roomIdLabel) roomIdLabel.textContent = roomId;
  setNotice('');
  if (UI) prepareRoom(UI);
  setNotice('他のプレイヤーを待機中…');
  if (typeof connect === 'function') connect(roomId);
  lobbySection?.setAttribute('hidden', '');
  roomSection?.removeAttribute('hidden');
  UI?.updateStartUI?.(state.isHost);
}

