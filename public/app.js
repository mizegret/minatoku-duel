import { TOTAL_TURNS, ABLY_CHANNEL_PREFIX, ACTIONS } from './js/constants.js';
// host/game logic
import { ensureStarted as hostEnsureStarted, handleMoveMessage as hostHandleMoveMessage } from './js/game/host.js';
import * as UI from './js/ui/render.js';
import { bindInputs } from './js/ui/inputs.js';
import * as Net from './js/net/ably.js';
import { state, setState, addMember, subscribe } from './js/state.js';

const lobbySection = document.getElementById('screen-lobby');
const roomSection = document.getElementById('screen-room');
const roomIdLabel = document.getElementById('room-id');
const noticeArea = document.getElementById('notice');

const ROOM_ID_PATTERN = /^[a-z0-9-]{8}$/;
const ENV_ENDPOINT = '/env';
const IS_LOCAL = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(location.hostname);
// moved to js/constants.js

// Networking is handled inside Net (see js/net/ably.js)

// Logging: show only authoritative, user-meaningful entries
const LOG_FILTER = { network: false, state: false, event: true, move: true };
const LOG_KEYS = { action: null, turnStart: null, turnMsg: null, turnEnd: null };
function shouldLog(keyName, key) {
  if (!key) return true;
  if (LOG_KEYS[keyName] === key) return false;
  LOG_KEYS[keyName] = key;
  return true;
}

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
      setState({ env });
      console.info('[env] loaded from', source, Object.keys(env));
      return;
    } catch (error) {
      console.warn('[env] failed to load from', source, error);
    }
  }

  setState({ env: null });
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
      const type = String(c.type ?? '');
      const base = {
        id: String(c.id ?? ''),
        name: String(c.name ?? ''),
        type,
      };

      if (type === 'human') {
        const h = {
          ...base,
          age: typeof c.age === 'number' ? c.age : undefined,
          rarity: typeof c.rarity === 'string' ? c.rarity : undefined,
          baseCharm: typeof c.baseCharm === 'number' ? c.baseCharm : undefined,
          baseOji: typeof c.baseOji === 'number' ? c.baseOji : undefined,
          imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl : undefined,
          skills: Array.isArray(c.skills) ? c.skills : undefined,
        };
        // M5: light validation + safe defaults (warn-only; behavior unchanged)
        if (!Number.isFinite(h.baseCharm)) {
          // leave undefined so rules fallback (SCORE_RULES.summon.defaultCharm) applies
          console.warn('[cards][validate] human.baseCharm missing; using rule default (no field write)', h.id);
        }
        const R = String(h.rarity || '').toUpperCase();
        const okR = R === 'UR' || R === 'SR' || R === 'R' || R === 'N';
        if (!okR) {
          h.rarity = 'N';
          if (h.rarity !== undefined) console.warn('[cards][validate] human.rarity invalid; fallback N', h.id, h.rarity);
        } else {
          h.rarity = R;
        }
        if (!Number.isFinite(h.age)) {
          console.warn('[cards][validate] human.age missing', h.id);
        }
        humans.push(h);
      } else if (type === 'decoration') {
        const d = {
          ...base,
          rarity: typeof c.rarity === 'string' ? c.rarity : undefined,
          text: typeof c.text === 'string' ? c.text : undefined,
          imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl : undefined,
          charmBonus: typeof c.charmBonus === 'number' ? c.charmBonus : undefined,
          oji: typeof c.oji === 'number' ? c.oji : undefined, // reserved
          slotsUsed: typeof c.slotsUsed === 'number' ? c.slotsUsed : undefined, // reserved
        };
        // M5: defaults + warnings (v2 only)
        const RD = String(d.rarity || '').toUpperCase();
        const okRD = RD === 'UR' || RD === 'SR' || RD === 'R' || RD === 'N';
        if (!okRD) { d.rarity = 'N'; console.warn('[cards][validate] decoration.rarity missing; fallback N', d.id); } else { d.rarity = RD; }
        if (!Number.isFinite(d.charmBonus)) { d.charmBonus = 1; }
        if (!Number.isFinite(d.slotsUsed)) d.slotsUsed = 1;
        if (!d.text) console.warn('[cards][validate] decoration.text missing', d.id);
        decorations.push(d);
      } else if (type === 'action') {
        const a = {
          ...base,
          rarity: typeof c.rarity === 'string' ? c.rarity : undefined,
          text: typeof c.text === 'string' ? c.text : undefined,
          imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl : undefined,
          effect: Array.isArray(c.effect) ? c.effect : undefined,
        };
        const RA = String(a.rarity || '').toUpperCase();
        const okRA = RA === 'UR' || RA === 'SR' || RA === 'R' || RA === 'N';
        if (!okRA) { a.rarity = 'N'; console.warn('[cards][validate] action.rarity missing; fallback N', a.id); } else { a.rarity = RA; }
        if (!Array.isArray(a.effect)) { a.effect = []; console.warn('[cards][validate] action.effect missing; default []', a.id); }
        if (!a.text) console.warn('[cards][validate] action.text missing', a.id);
        actions.push(a);
      }
      // それ以外の type は無視（MVP）
    }

    // M5: duplicate id check (warn-only)
    const seen = new Set();
    for (const col of [humans, decorations, actions]) {
      for (const it of col) {
        if (!it?.id) continue;
        if (seen.has(it.id)) console.warn('[cards][validate] duplicate id detected', it.id);
        else seen.add(it.id);
      }
    }

    setState({ cardsByType: { humans, decorations, actions } });
    console.info('[cards] loaded (new schema)', { humans: humans.length, decorations: decorations.length, actions: actions.length });
  } catch (e) {
    console.warn('[cards] failed to load (new schema required), using defaults', e);
    setState({ cardsByType: {
      humans: [{ id: 'human-default', name: '港区女子（仮）', type: 'human' }],
      decorations: [{ id: 'deco-default', name: 'シャンパン（仮）', type: 'decoration' }],
      actions: [{ id: 'act-default', name: 'アクション（仮）', type: 'action' }],
    }});
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

function resetScores() { setState({ scores: { charm: 0, oji: 0, total: 0 } }); }

function resetPlayers() { setState({ self: { hand: [], field: { humans: [] } }, opponent: { hand: [], field: { humans: [] } } }); }

function resetTurn() { setState({ turn: 1 }); }

function resetLog() { setState({ log: [] }); }

// moved to UI: updateScores/updateTurnIndicator/updateDeckCounts

function pushLog(entry) {
  const next = [entry, ...state.log];
  if (next.length > 12) next.length = 12;
  setState({ log: next });
}

function replaceTopLog(entry) {
  const next = Array.isArray(state.log) ? state.log.slice() : [];
  if (next.length === 0) { pushLog(entry); return; }
  next[0] = entry;
  setState({ log: next });
}

// Compute displayed round number based on phase/half/turn owner (A3)
function computeDisplayRound({ phase, round, myTurn, roundHalf }) {
  const r = Number.isFinite(round) ? round : state.turn;
  if (phase === 'ended') return r || 1;
  return (myTurn || roundHalf === 1) ? (r || 1) : Math.max(1, (r || 1) - 1);
}

// Format lastAction message (A2: extracted helper)
function formatLastAction(la, actorLabel) {
  if (!la || !la.type) return '';
  if (la.type === ACTIONS.summon) {
    const delta = [];
    if (Number.isFinite(la.charm) && la.charm) delta.push(`魅力+${la.charm}`);
    if (Number.isFinite(la.oji) && la.oji) delta.push(`好感度+${la.oji}`);
    const tail = delta.length ? `（${delta.join(' / ')}）` : '';
    return `${actorLabel}：召喚 → ${la.cardName ?? ''} ${tail}`;
  }
  if (la.type === ACTIONS.decorate) {
    const delta = [];
    if (Number.isFinite(la.charm) && la.charm) delta.push(`魅力+${la.charm}`);
    if (Number.isFinite(la.oji) && la.oji) delta.push(`好感度+${la.oji}`);
    const tail = delta.length ? `（${delta.join(' / ')}）` : '';
    return `${actorLabel}：装飾 → ${la.cardName ?? ''} ${tail}`;
  }
  if (la.type === ACTIONS.play) {
    const delta = [];
    if (Number.isFinite(la.charm) && la.charm) delta.push(`魅力+${la.charm}`);
    if (Number.isFinite(la.oji) && la.oji) delta.push(`好感度+${la.oji}`);
    const tail = delta.length ? `（${delta.join(' / ')}）` : '';
    return `${actorLabel}：ムーブ → ${la.cardName ?? ''} ${tail}`;
  }
  if (la.type === ACTIONS.skip) {
    return `${actorLabel}：このターンは様子見`;
  }
  return '';
}

// moved to UI: renderLog

// connection watcher lives in Net.init/connect

// channel-level verbose watchersは削除（最小ログ運用）

// channel subscriptions are wired in Net.connect

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
  const myTurn = !!(turnOwner && myId && turnOwner === myId);
  const roundHalf = Number.isFinite(snapshot?.roundHalf) ? snapshot.roundHalf : 0;
  const displayRound = computeDisplayRound({ phase, round, myTurn, roundHalf });
  setState({ turn: displayRound });
  UI.updateTurnIndicator(state.turn, TOTAL_TURNS);
  setState({ isMyTurn: !!myTurn });

    // 山札枚数（あれば表示）
    const selfDeck = Number.isFinite(me?.deckCount) ? me.deckCount : 0;
    const oppDeck = Number.isFinite(opp?.deckCount) ? opp.deckCount : 0;
    UI.updateDeckCounts(selfDeck, oppDeck);

    // スコアは自分のものを優先して表示（なければ 0 ）
    const myScores = me?.scores ?? { charm: 0, oji: 0, total: undefined };
    setState({
      scores: {
        charm: Number.isFinite(myScores.charm) ? myScores.charm : 0,
        oji: Number.isFinite(myScores.oji) ? myScores.oji : 0,
        total: Number.isFinite(myScores.total) ? myScores.total : undefined,
      },
    });
    UI.updateScores(state.scores);

    // 盤面・手札
    if (me) {
      setState({ self: {
        hand: Array.isArray(me.hand) ? me.hand : [],
        field: me.field && Array.isArray(me.field?.humans)
          ? { humans: me.field.humans }
          : { humans: [] },
      }});
    }
    if (opp) {
      setState({ opponent: {
        hand: Array.isArray(opp.hand) ? opp.hand : [],
        field: opp.field && Array.isArray(opp.field?.humans)
          ? { humans: opp.field.humans }
          : { humans: [] },
      }});
    }
    UI.renderGame(state);

    // 通知とアクション制御
    setNotice('');
    if (phase === 'ended' || phase === 'game-over' || round > TOTAL_TURNS) {
      lockActions();
      setNotice('ゲーム終了');
    } else if (myTurn) {
      unlockActions();
      const turnKey = `turn:${round}:${turnOwner || ''}`;
      if (shouldLog('turnMsg', turnKey)) logAction('state', `あなたのターン（ラウンド ${displayRound}）`);
      // skills: show start-of-turn deltas right after the turn message
      const ts = snapshot?.turnStart;
      if (ts && (Number.isFinite(ts.charm) || Number.isFinite(ts.oji))) {
        const startKey = `start:${round}:${turnOwner || ''}:${ts.charm||0}:${ts.oji||0}`;
        if (shouldLog('turnStart', startKey)) {
          const parts = [];
          if (Number.isFinite(ts.charm) && ts.charm) parts.push(`魅力+${ts.charm}`);
          if (Number.isFinite(ts.oji) && ts.oji) parts.push(`好感度+${ts.oji}`);
          if (parts.length) logAction('event', `あなた：スキル発動（開始時） ${parts.join(' / ')}`);
        }
      }
    } else {
      lockActions();
      if (turnOwner) {
        setNotice('相手のターンです…');
        // optionally log opponent start-of-turn skills as well
        const ts = snapshot?.turnStart;
        if (ts && (Number.isFinite(ts.charm) || Number.isFinite(ts.oji))) {
          const startKey = `start:${round}:${turnOwner || ''}:${ts.charm||0}:${ts.oji||0}`;
          if (shouldLog('turnStart', startKey)) {
            const parts = [];
            if (Number.isFinite(ts.charm) && ts.charm) parts.push(`魅力+${ts.charm}`);
            if (Number.isFinite(ts.oji) && ts.oji) parts.push(`好感度+${ts.oji}`);
            if (parts.length) logAction('event', `相手：スキル発動（開始時） ${parts.join(' / ')}`);
          }
        }
      }
    }

    // 行動ログ（権威のみ、重複防止）
    const la = snapshot?.lastAction;
    if (la && la.type) {
      const actorIsMe = !!(la.actorId && la.actorId === myId);
      const actorLabel = actorIsMe ? 'あなた' : '相手';
      const msg = formatLastAction(la, actorLabel);
      const aKey = `act:${round}:${Number.isFinite(snapshot?.roundHalf)?snapshot.roundHalf:0}:${la.type}:${la.actorId || ''}:${la.cardName || ''}:${la.charm||0}:${la.oji||0}`;
      if (msg && shouldLog('action', aKey)) logAction('move', msg);
    }

    // ターン終了時スキル（直近行動の後ろに出す、重複防止）
    const te = snapshot?.turnEnd;
    if (te && (Number.isFinite(te.charm) || Number.isFinite(te.oji))) {
      const mine = !!(te.actorId && te.actorId === myId);
      const eKey = `end:${round}:${te.actorId || ''}:${te.charm||0}:${te.oji||0}`;
      if (shouldLog('turnEnd', eKey)) {
        const parts = [];
        if (Number.isFinite(te.charm) && te.charm) parts.push(`魅力+${te.charm}`);
        if (Number.isFinite(te.oji) && te.oji) parts.push(`好感度+${te.oji}`);
        if (parts.length) logAction('event', `${mine ? 'あなた' : '相手'}：スキル発動（終了時） ${parts.join(' / ')}`);
      }
    }

    logAction('state', '盤面を同期しました');
  } catch (e) {
    console.warn('[state] failed to apply snapshot', e);
    logAction('state', 'スナップショット適用に失敗しました');
  }
}

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
    log: state.log.slice(-5),
    updatedAt: Date.now(),
    ...snapshot,
  };
  if (!netHandle?.publishState) return;
  await netHandle.publishState(enriched);
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
  setState({ started: false, hostId: null });
  UI.renderGame(state);
  // 開始前はロックしておき、state受信で解放
  lockActions();
  UI.updateScores(state.scores);
  UI.updateStartUI(state.isHost);
}

function lockActions() {
  setState({ actionLocked: true });
  UI.setActionButtonsDisabled(true);
  UI.updateHandInteractivity(state.isMyTurn, state.actionLocked);
}

function unlockActions() {
  setState({ actionLocked: false });
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
  if (LOG_FILTER[type] === false) return;
  pushLog({ type, message, at: Date.now() });
}

function logButtonAction(_type, _message, callback) {
  return ensureSingleAction(() => { callback(); });
}

// --- minimal member helpers ---
// addMember moved to js/state.js

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

  // B1: subscribe minimal keys to UI updates
  subscribe('turn', (v) => UI.updateTurnIndicator(v ?? state.turn, TOTAL_TURNS));
  subscribe('scores', (v) => UI.updateScores(v ?? state.scores));
  subscribe('log', (v) => UI.renderLog(Array.isArray(v) ? v : state.log));

  handleInitialRoute(history.state);

  window.addEventListener('popstate', (event) => {
    handleInitialRoute(event.state);
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
// ---- Constants / Flags ----------------------------------------------------
// constants moved to js/constants.js
