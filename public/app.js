import { TOTAL_TURNS, ABLY_CHANNEL_PREFIX } from './js/constants.js';
import { initRouter, navigateToRoom } from './js/router.js';
import { loadEnvironment } from './js/data/env.js';
import { loadCards } from './js/data/cards.js';
import { applyStateSnapshot } from './js/game/state-sync.js';
import { ensureSingleAction, logAction } from './js/ui/actions.js';
// host/game logic
import { ensureStarted as hostEnsureStarted, handleMoveMessage as hostHandleMoveMessage } from './js/game/host.js';
// UI renderer is selected at runtime to keep default DOM UI intact.
// When `?renderer=pixi` is present, we load Pixi adapter; otherwise DOM renderer.
let UI = null;
import { bindInputs } from './js/ui/inputs.js';
import { setNotice } from './js/ui/notice.js';
import { generateRoomId } from './js/utils/id.js';
import { prepareRoom } from './js/game/setup.js';
import * as Net from './js/net/ably.js';
import { state, setState, addMember, subscribe } from './js/state.js';

const lobbySection = document.getElementById('screen-lobby');
const roomSection = document.getElementById('screen-room');
const roomIdLabel = document.getElementById('room-id');

function showLobby(withNotice) {
  lobbySection?.removeAttribute('hidden');
  roomSection?.setAttribute('hidden', '');
  state.roomId = null;
  if (withNotice) {
    setNotice(withNotice);
  } else {
    setNotice('');
  }
}

function showRoom(roomId) {
  state.roomId = roomId;
  if (roomIdLabel) {
    roomIdLabel.textContent = roomId;
  }
  setNotice('');
  prepareRoom();
  setNotice('他のプレイヤーを待機中…');
  connectRealtime(roomId);
  lobbySection?.setAttribute('hidden', '');
  roomSection?.removeAttribute('hidden');
  UI.updateStartUI(state.isHost);
}

function handleJoinMessage(message) {
  const data = message?.data ?? {};
  if (data.clientId) addMember(data.clientId);
  ensureStarted();
}

function handleStartMessage(message) {
  const data = message?.data ?? {};
  setState({ hostId: data.hostId ?? null });
  setState({ isHost: !!(data.hostId ?? null) && (data.hostId === getClientId()), started: true });
  // Host 側では、既に ensureStarted() で配布済みの hands/decks を保持する。
  // ここでの再初期化は行わない（上書きすると手札が消える）。
  if (state.isHost && !state.hostGame) {
    state.hostGame = {
      round: 1,
      turnOwner: getClientId(),
      roundStarter: getClientId(),
      half: 0,
      scoresById: {},
      fieldById: {},
      decksById: {},
      handsById: {},
    };
  }
  UI.updateStartUI(state.isHost);
  setNotice('');
}

function handleMoveMessage(message) {
  return hostHandleMoveMessage(message, {
    state,
    publishState,
    getMembers,
    getClientId,
    logAction,
  });
}

function handleStateMessage(message) {
  const snapshot = message?.data ?? {};
  applyStateSnapshot(snapshot, { UI, getClientId, setNotice });
}

// applyStateSnapshot moved to js/game/state-sync.js

let netHandle = null;

function connectRealtime(roomId) {
  if (!roomId) return;
  if (!state.env?.ABLY_API_KEY) {
    logAction('network', 'Ablyキー未設定のため接続をスキップ');
    return;
  }
  netHandle = Net.createConnection({
    apiKey: state.env.ABLY_API_KEY,
    channelPrefix: ABLY_CHANNEL_PREFIX,
    roomId,
    logAction,
    onConnectionStateChange: () => UI.updateStartUI(state.isHost),
    onConnected: () => {
      const id = getClientId();
      if (id) addMember(id);
      ensureStarted();
    },
    onAttach: () => {
      ensureStarted();
      void publishJoin(roomId);
    },
    onJoin: handleJoinMessage,
    onStart: handleStartMessage,
    onMove: handleMoveMessage,
    onState: handleStateMessage,
  });
}

async function publishJoin(roomId) {
  if (netHandle) await netHandle.publishJoin({ roomId });
}

function getClientId() {
  return netHandle?.getClientId?.() ?? Net.getClientId?.() ?? null;
}

async function publishStart(members = []) {
  if (!state.roomId) return;
  const payload = {
    roomId: state.roomId,
    hostId: getClientId(),
    members: members.length ? members : [{ clientId: getClientId() }],
    startedAt: Date.now(),
  };
  if (!netHandle?.publishStart) return;
  await netHandle.publishStart(payload);
}

async function publishMove(move = {}) {
  if (!netHandle?.publishMove) return;
  await netHandle.publishMove({ ...move, round: state.turn });
}

async function publishState(snapshot = {}) {
  // Merge defaults with provided snapshot; allow caller (host) to override and add extra fields
  const enriched = {
    phase: 'in-round',
    round: state.turn,
    turnOwner: getClientId(),
    players: [
      {
        clientId: getClientId(),
        hand: state.self?.hand ?? [],
        field: state.self?.field ?? { humans: [] },
        scores: state.scores ?? { charm: 0, oji: 0, total: 0 },
      },
    ],
    log: state.log,
    updatedAt: Date.now(),
    ...snapshot,
  };
  if (!netHandle?.publishState) return;
  await netHandle.publishState(enriched);
}

function logButtonAction(_type, _message, callback) {
  return ensureSingleAction(UI, () => { callback(); });
}

// --- minimal member helpers ---

import { getMembers as getMembersFromState } from './js/utils/players.js';
function getMembers() { return getMembersFromState(state, getClientId); }

async function init() {
  // Select UI renderer (default: DOM)
  try {
    const params = new URLSearchParams(location.search);
    const renderer = params.get('renderer');
    // Default to Pixi. Opt-out with ?renderer=dom
    UI = renderer === 'dom'
      ? await import('./js/ui/render.js')
      : await import('./js/ui/pixi/renderer.js');
  } catch (e) {
    // Fallback to Pixi first, then DOM
    try { UI = await import('./js/ui/pixi/renderer.js'); }
    catch { UI = await import('./js/ui/render.js'); }
  }

  await loadEnvironment();
  await loadCards();

  // Provide context to UI (used by Pixi adapter for click→move)
  try { UI.init?.({ state, publishMove, logButtonAction }); } catch {}

  // B1: subscribe minimal keys to UI updates
  subscribe('turn', (v) => UI.updateTurnIndicator(v ?? state.turn, TOTAL_TURNS));
  subscribe('scores', (v) => UI.updateScores(v ?? state.scores));
  subscribe('log', (v) => UI.renderLog(Array.isArray(v) ? v : state.log));

  initRouter({
    onLobby: () => showLobby(),
    onRoom: (id) => showRoom(id),
    onInvalid: (msg) => showLobby(msg),
  });

  bindInputs({
    onCreateRoom: () => {
      const id = generateRoomId();
      // この端末が部屋を作成した＝Host として扱う（セッション内）
      setState({ isHost: true, hostId: null }); // 接続後の clientId で確定
      UI.updateStartUI(state.isHost);
      navigateToRoom(id);
    },
    getRoomId: () => state.roomId,
    state,
    logButtonAction,
    publishMove,
  });

  // Startボタンは廃止（自動開始）
  // 下部の装飾ボタンは廃止（手札クリックで装飾）
  // 下部のアクション/スキップボタンは Mock のため削除（手札クリック運用）

}

// updateStartUI moved to UI.updateStartUI

function ensureStarted() {
  if (!(netHandle?.isConnected?.() ?? Net.isConnected?.())) return;
  return hostEnsureStarted({
    state,
    publishStart,
    publishState,
    getMembers,
    getClientId,
    logAction,
  });
}

init();
