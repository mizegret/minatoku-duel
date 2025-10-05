import { TOTAL_TURNS, ABLY_CHANNEL_PREFIX } from './js/constants.js';
// host/game logic
import { ensureStarted as hostEnsureStarted, handleMoveMessage as hostHandleMoveMessage } from './js/game/host.js';
import * as UI from './js/ui/render.js';
import { bindInputs } from './js/ui/inputs.js';
import * as Net from './js/net/ably.js';

const lobbySection = document.getElementById('screen-lobby');
const roomSection = document.getElementById('screen-room');
const createButton = document.getElementById('create-room');
const copyButton = document.getElementById('copy-room-link');
const roomIdLabel = document.getElementById('room-id');
const scoreCharm = document.getElementById('score-charm');
const scoreOji = document.getElementById('score-oji');
const scoreTotal = document.getElementById('score-total');
const noticeArea = document.getElementById('notice');
const handSelf = document.getElementById('hand-self');
const handOpponent = document.getElementById('hand-opponent');
const fieldSelf = document.getElementById('field-self');
const fieldOpponent = document.getElementById('field-opponent');
const deckSelfCount = document.getElementById('deck-self-count');
const deckOpponentCount = document.getElementById('deck-opponent-count');
const turnLabel = document.getElementById('turn-indicator');
const actionLog = document.getElementById('action-log');
const actionButtons = [
  document.getElementById('action-skip'),
];

const ROOM_ID_PATTERN = /^[a-z0-9-]{8}$/;
const ENV_ENDPOINT = '/env';
const IS_LOCAL = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(location.hostname);
// moved to js/constants.js

// Networking is handled inside Net (see js/net/ably.js)

const state = {
  roomId: null,
  scores: {
    charm: 0,
    oji: 0,
    total: 0,
  },
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
  // move 実装向け（最小）
  members: [], // 参加クライアントIDの簡易一覧
  hostGame: null, // Host のみ保持する権威側のスコア・ターン
  cardsByType: null,
};

function generateRoomId() {
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return raw.toLowerCase();
}

function setNotice(message) {
  if (!noticeArea) return;
  if (!message) {
    noticeArea.textContent = '';
    noticeArea.setAttribute('hidden', '');
    return;
  }
  noticeArea.textContent = message;
  noticeArea.removeAttribute('hidden');
}

async function loadEnvironment() {
  const sources = IS_LOCAL ? ['/env.local.json'] : [ENV_ENDPOINT];

  for (const source of sources) {
    try {
      const env = await fetchJson(source);
      state.env = env;
      console.info('[env] loaded from', source, Object.keys(env));
      return;
    } catch (error) {
      console.warn('[env] failed to load from', source, error);
    }
  }

  state.env = null;
}

async function loadCards() {
  try {
    const data = await fetchJson('/cards.json');
    if (!Array.isArray(data?.cards)) {
      throw new Error('cards.json must have an array property "cards"');
    }
    const humans = [];
    const decorations = [];
    const actions = [];
    for (const c of data.cards) {
      if (!c || typeof c !== 'object') continue;
      const item = {
        id: String(c.id ?? ''),
        name: String(c.name ?? ''),
        type: String(c.type ?? ''),
        charm: typeof c.charm === 'number' ? c.charm : undefined,
        oji: typeof c.oji === 'number' ? c.oji : undefined,
        effect: Array.isArray(c.effect) ? c.effect : undefined,
      };
      if (item.type === 'human') humans.push(item);
      else if (item.type === 'decoration') decorations.push(item);
      else if (item.type === 'action') actions.push(item);
      // それ以外の type は無視（MVP）
    }
    state.cardsByType = { humans, decorations, actions };
    console.info('[cards] loaded (new schema)', { humans: humans.length, decorations: decorations.length, actions: actions.length });
  } catch (e) {
    console.warn('[cards] failed to load (new schema required), using defaults', e);
    state.cardsByType = {
      humans: [{ id: 'human-default', name: '港区女子（仮）', type: 'human' }],
      decorations: [{ id: 'deco-default', name: 'シャンパン（仮）', type: 'decoration' }],
      actions: [{ id: 'act-default', name: 'アクション（仮）', type: 'action' }],
    };
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`request failed: ${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`unexpected content-type: ${contentType}`);
  }
  return res.json();
}

// hasRealtimeSupport is provided by Net

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
  // 開始前はアクションをロック
  lockActions();
  connectRealtime(roomId);
  lobbySection?.setAttribute('hidden', '');
  roomSection?.removeAttribute('hidden');
  UI.updateStartUI(state.isHost);
}

function resetScores() {
  state.scores = { charm: 0, oji: 0, total: 0 };
}

function resetPlayers() {
  state.self = { hand: [], field: { humans: [] } };
  state.opponent = { hand: [], field: { humans: [] } };
}

function resetTurn() {
  state.turn = 1;
  UI.updateTurnIndicator(state.turn, TOTAL_TURNS);
}

function resetLog() {
  state.log = [];
  UI.renderLog(state.log);
}

// moved to UI: updateScores/updateTurnIndicator/updateDeckCounts

function pushLog(entry) {
  state.log.unshift(entry);
  if (state.log.length > 12) {
    state.log.length = 12;
  }
  UI.renderLog(state.log);
}

// moved to UI: renderLog

// connection watcher lives in Net.init/connect

// channel-level verbose watchersは削除（最小ログ運用）

// channel subscriptions are wired in Net.connect

function handleJoinMessage(message) {
  const data = message?.data ?? {};
  logAction('event', `join 受信: ${data.clientId ?? 'unknown'}`);
  if (data.clientId) addMember(data.clientId);
  ensureStarted();
}

function handleStartMessage(message) {
  const data = message?.data ?? {};
  logAction('event', `start 受信: host=${data.hostId ?? 'unknown'} members=${Array.isArray(data.members) ? data.members.length : 0}`);
  state.hostId = data.hostId ?? null;
  state.isHost = !!state.hostId && state.hostId === getClientId();
  state.started = true;
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
  logAction('state', `state 受信: round=${snapshot.round ?? '?'} phase=${snapshot.phase ?? 'unknown'}`);
  applyStateSnapshot(snapshot);
}

function applyStateSnapshot(snapshot) {
  // スナップショット（ホスト権威）を UI/状態へ反映
  try {
    const phase = snapshot?.phase ?? 'in-round';
    const round = Number.isFinite(snapshot?.round) ? snapshot.round : state.turn;
    const turnOwner = snapshot?.turnOwner ?? null;
    const players = Array.isArray(snapshot?.players) ? snapshot.players : [];

    // 自身/相手のプレイヤーを決定
    const myId = getClientId();
    const me = players.find((p) => p?.clientId === myId) ?? players[0] ?? null;
    const opp = players.find((p) => p?.clientId && p.clientId !== myId) ?? players[1] ?? null;

  // ターン・フェーズ反映（表示仕様）
  // - ended 時は両者とも round を表示
  // - それ以外: roundHalf=0（前半）は 自分のターン=round / 相手=round-1。roundHalf=1（後半）は両者=round
  const myTurn = turnOwner && myId && turnOwner === myId;
  const roundHalf = Number.isFinite(snapshot?.roundHalf) ? snapshot.roundHalf : 0;
  const displayRound = (phase === 'ended')
    ? (round || 1)
    : ((myTurn || roundHalf === 1) ? (round || 1) : Math.max(1, (round || 1) - 1));
  state.turn = displayRound;
  UI.updateTurnIndicator(state.turn, TOTAL_TURNS);
  state.isMyTurn = !!myTurn;

    // 山札枚数（あれば表示）
    const selfDeck = Number.isFinite(me?.deckCount) ? me.deckCount : 0;
    const oppDeck = Number.isFinite(opp?.deckCount) ? opp.deckCount : 0;
    UI.updateDeckCounts(selfDeck, oppDeck);

    // スコアは自分のものを優先して表示（なければ 0 ）
    const myScores = me?.scores ?? { charm: 0, oji: 0, total: undefined };
    state.scores = {
      charm: Number.isFinite(myScores.charm) ? myScores.charm : 0,
      oji: Number.isFinite(myScores.oji) ? myScores.oji : 0,
      total: Number.isFinite(myScores.total) ? myScores.total : undefined,
    };
    UI.updateScores(state.scores);

    // 盤面・手札
    if (me) {
      state.self = {
        hand: Array.isArray(me.hand) ? me.hand : [],
        field: me.field && Array.isArray(me.field?.humans)
          ? { humans: me.field.humans }
          : { humans: [] },
      };
    }
    if (opp) {
      state.opponent = {
        hand: Array.isArray(opp.hand) ? opp.hand : [],
        field: opp.field && Array.isArray(opp.field?.humans)
          ? { humans: opp.field.humans }
          : { humans: [] },
      };
    }
    UI.renderGame(state);

    // ログ強化: 直近アクションのカード名を明示
    const la = snapshot?.lastAction;
    if (la && la.type) {
      const actorLabel = la.actorId && la.actorId === myId ? 'あなた' : '相手';
      let msg = '';
      if (la.type === 'summon') msg = `${actorLabel}：召喚 → ${la.cardName ?? ''}`;
      else if (la.type === 'decorate') {
        const delta = [];
        if (Number.isFinite(la.charm) && la.charm) delta.push(`魅力+${la.charm}`);
        if (Number.isFinite(la.oji) && la.oji) delta.push(`好感度+${la.oji}`);
        const tail = delta.length ? `（${delta.join(' / ')}）` : '';
        msg = `${actorLabel}：装飾 → ${la.cardName ?? ''} ${tail}`;
      } else if (la.type === 'play') {
        const delta = [];
        if (Number.isFinite(la.charm) && la.charm) delta.push(`魅力+${la.charm}`);
        if (Number.isFinite(la.oji) && la.oji) delta.push(`好感度+${la.oji}`);
        const tail = delta.length ? `（${delta.join(' / ')}）` : '';
        msg = `${actorLabel}：ムーブ → ${la.cardName ?? ''} ${tail}`;
      } else if (la.type === 'skip') {
        msg = `${actorLabel}：このターンは様子見`;
      }
      else if (la.type === 'play') msg = `${actorLabel}：アクション`;
      else if (la.type === 'skip') msg = `${actorLabel}：スキップ`;
      if (msg) logAction('move', msg);
    } else {
      // 最小実装: 受信確認
      logAction('state', `state 受信: round=${round} phase=${phase}`);
    }

    // 通知とアクション制御
    setNotice('');
    if (phase === 'ended' || phase === 'game-over' || round > TOTAL_TURNS) {
      lockActions();
      setNotice('ゲーム終了');
    } else if (myTurn) {
      unlockActions();
      logAction('state', `あなたのターン（ラウンド ${displayRound}）`);
    } else {
      lockActions();
      if (turnOwner) {
        setNotice('相手のターンです…');
      }
    }

    logAction('state', '盤面を同期しました');
  } catch (e) {
    console.warn('[state] failed to apply snapshot', e);
    logAction('state', 'スナップショット適用に失敗しました');
  }
}

function connectRealtime(roomId) {
  if (!roomId) return;
  if (!state.env?.ABLY_API_KEY) {
    logAction('network', 'Ablyキー未設定のため接続をスキップ');
    return;
  }
  const c = Net.init({
    apiKey: state.env.ABLY_API_KEY,
    logAction,
    onConnectionStateChange: () => UI.updateStartUI(state.isHost),
  });
  if (!c) return;
  Net.connect({
    roomId,
    channelPrefix: ABLY_CHANNEL_PREFIX,
    logAction,
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
  await Net.publishJoin({ roomId, logAction });
}

function getClientId() {
  return Net.getClientId();
}

async function publishStart(members = []) {
  if (!state.roomId) return;
  const payload = {
    roomId: state.roomId,
    hostId: getClientId(),
    members: members.length ? members : [{ clientId: getClientId() }],
    startedAt: Date.now(),
  };
  await Net.publishStart(payload, { logAction });
}

async function publishMove(move = {}) {
  await Net.publishMove({ ...move, round: state.turn }, { logAction });
}

async function publishState(snapshot = {}) {
  const enriched = {
    phase: snapshot.phase ?? 'in-round',
    round: snapshot.round ?? state.turn,
    turnOwner: snapshot.turnOwner ?? getClientId(),
    players: snapshot.players ?? [
      {
        clientId: getClientId(),
        hand: state.self?.hand ?? [],
        field: state.self?.field ?? { humans: [] },
        scores: state.scores ?? { charm: 0, oji: 0, total: 0 },
      },
    ],
    log: snapshot.log ?? state.log.slice(-5),
    updatedAt: Date.now(),
  };
  await Net.publishState(enriched, { logAction });
}

// detachRealtime was unused; removed

// dev-only advanceTurn removed

// adjustScores は move のホスト処理に置き換わったため削除

// moved to UI: render helpers

function prepareRoom() {
  resetScores();
  resetPlayers();
  resetTurn();
  resetLog();
  state.started = false;
  state.hostId = null;
  UI.renderGame(state);
  // 開始前はロックしておき、state受信で解放
  lockActions();
  UI.updateScores(state.scores);
  UI.updateStartUI(state.isHost);
}

function lockActions() {
  state.actionLocked = true;
  UI.setActionButtonsDisabled(true);
  UI.updateHandInteractivity(state.isMyTurn, state.actionLocked);
}

function unlockActions() {
  state.actionLocked = false;
  UI.setActionButtonsDisabled(false);
  UI.updateHandInteractivity(state.isMyTurn, state.actionLocked);
}

// copyRoomLink moved to ui/inputs.js

function handleInitialRoute(stateOverride) {
  const roomIdFromState = stateOverride?.roomId;
  if (roomIdFromState && ROOM_ID_PATTERN.test(roomIdFromState)) {
    showRoom(roomIdFromState);
    return;
  }

  const roomMatch = location.pathname.match(/^\/room\/([a-z0-9-]{1,32})\/?$/);
  if (!roomMatch) {
    showLobby();
    return;
  }
  const requestedId = roomMatch[1];
  if (!ROOM_ID_PATTERN.test(requestedId)) {
    showLobby('無効な Room ID です。もう一度作成し直してください。');
    return;
  }
  showRoom(requestedId);
}

function ensureSingleAction(callback) {
  return () => {
    if (state.actionLocked) {
      console.log('1ターンにつき1アクションのみ（モック）');
      return;
    }
    callback();
    lockActions();
  };
}

function logAction(type, message) {
  pushLog({ type, message, at: Date.now() });
}

function logButtonAction(type, message, callback) {
  return ensureSingleAction(() => {
    callback();
    logAction(type, message);
  });
}

// --- minimal member helpers ---
function addMember(clientId) {
  if (!clientId) return;
  if (!Array.isArray(state.members)) state.members = [];
  if (!state.members.includes(clientId)) state.members.push(clientId);
}

function getMembers() {
  if (!Array.isArray(state.members)) return [];
  // 先頭に Host を寄せる（ある場合）
  const host = state.hostId || getClientId();
  const uniq = state.members.filter((id, i, arr) => id && arr.indexOf(id) === i);
  if (host && uniq.includes(host)) {
    return [host, ...uniq.filter((id) => id !== host)];
  }
  return uniq;
}

// utils moved to js/utils/*

function navigateToRoom(roomId) {
  history.pushState({ roomId }, '', `/room/${roomId}`);
  showRoom(roomId);
}

// navigateToLobby was unused; removed

async function init() {
  await loadEnvironment();
  await loadCards();

  handleInitialRoute(history.state);

  window.addEventListener('popstate', (event) => {
    handleInitialRoute(event.state);
  });

  bindInputs({
    onCreateRoom: () => {
      const id = generateRoomId();
      // この端末が部屋を作成した＝Host として扱う（セッション内）
      state.isHost = true;
      state.hostId = null; // 接続後の clientId で確定
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
  if (!Net.isConnected()) return;
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
// ---- Constants / Flags ----------------------------------------------------
// constants moved to js/constants.js
