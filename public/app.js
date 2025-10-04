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
const turnLabel = document.getElementById('turn-indicator');
const actionLog = document.getElementById('action-log');
const actionButtons = [
  document.getElementById('action-summon'),
  document.getElementById('action-decorate'),
  document.getElementById('action-play'),
  document.getElementById('action-skip'),
];
const startButton = document.getElementById('action-start');

const ROOM_ID_PATTERN = /^[a-z0-9-]{8}$/;
const ENV_ENDPOINT = '/env';
const IS_LOCAL = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(location.hostname);
const TOTAL_TURNS = 5;
const ABLY_CHANNEL_PREFIX = 'room:';
const MAX_DECORATIONS_PER_HUMAN = 2;

let ablyClient = null;
let ablyChannel = null;
let lastJoinedRoomId = null;
let hasConnectionWatcher = false;
const watchedChannels = new Set();
const subscribedMessageChannels = new Set();
const MOCK_SELF = {
  hand: [
    { id: 'card-001', name: '南青山みなみ', type: 'human' },
    { id: 'card-002', name: '三田シャンパン', type: 'decoration' },
    { id: 'card-003', name: '裏原ストーリー', type: 'action' },
  ],
  field: {
    humans: [
      {
        id: 'field-human-1',
        name: '表参道りな',
        decorations: [{ id: 'dec-01', name: 'ヴィトンバッグ' }],
      },
    ],
  },
};

const MOCK_OPPONENT = {
  hand: [{ id: 'opp-card-001', name: '西麻布サワー', type: 'action' }],
  field: {
    humans: [
      {
        id: 'opp-human-1',
        name: '赤坂まりこ',
        decorations: [
          { id: 'opp-dec-01', name: 'ドンペリピンク' },
          { id: 'opp-dec-02', name: 'ロエベトート' },
        ],
      },
    ],
  },
};

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
  // move 実装向け（最小）
  members: [], // 参加クライアントIDの簡易一覧
  hostGame: null, // Host のみ保持する権威側のスコア・ターン
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

function hasRealtimeSupport() {
  return typeof Ably !== 'undefined' && typeof Ably.Realtime === 'function';
}

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
  updateStartUI();
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
  updateTurnIndicator();
}

function resetLog() {
  state.log = [];
  renderLog();
}

function updateScores({ charm, oji, total }) {
  if (scoreCharm) scoreCharm.textContent = String(charm ?? 0);
  if (scoreOji) scoreOji.textContent = String(oji ?? 0);
  const fallbackTotal = (charm ?? 0) + (oji ?? 0);
  if (scoreTotal) scoreTotal.textContent = String(total ?? fallbackTotal);
}

function updateTurnIndicator() {
  if (!turnLabel) return;
  turnLabel.textContent = `ターン ${state.turn} / ${TOTAL_TURNS}`;
}

function pushLog(entry) {
  state.log.unshift(entry);
  if (state.log.length > 12) {
    state.log.length = 12;
  }
  renderLog();
}

function renderLog() {
  if (!actionLog) return;
  if (state.log.length === 0) {
    actionLog.innerHTML = '<div class="log-entry">まだ行動がありません</div>';
    return;
  }

  actionLog.innerHTML = state.log
    .map(({ type, message, at }) => {
      const time = new Date(at).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `<div class="log-entry action-${type}"><span>${message}</span><time>${time}</time></div>`;
    })
    .join('');
}

function watchConnection() {
  if (!ablyClient || hasConnectionWatcher) return;
  hasConnectionWatcher = true;
  ablyClient.connection.on('statechange', (change) => {
    const reason = change.reason
      ? ` (reason: ${change.reason.code ?? ''} ${change.reason.message ?? ''})`
      : '';
    logAction('network', `接続状態: ${change.previous} → ${change.current}${reason}`);
    updateStartUI();
  });
  // 自端末の clientId をメンバーに追加（connected 時）
  ablyClient.connection.once('connected', () => {
    const id = getClientId();
    if (id) addMember(id);
    ensureStarted();
  });
}

function watchChannel(channel) {
  if (!channel || watchedChannels.has(channel.name)) return;
  watchedChannels.add(channel.name);
  channel.on('attached', () => logAction('network', 'チャンネル attached (イベント)'));
  channel.on('detached', () => logAction('network', 'チャンネル detached (イベント)'));
  channel.on('failed', (err) => {
    const reason = err ? ` (code: ${err.code ?? ''} message: ${err.message ?? ''})` : '';
    logAction('network', `チャンネル failed (イベント)${reason}`);
  });
  channel.on('update', () => logAction('network', 'チャンネル update (イベント)'));
  // UI 更新
  channel.on('attached', updateStartUI);
  channel.on('detached', updateStartUI);
}

function unwatchChannel(channel) {
  if (!channel || !watchedChannels.has(channel.name)) return;
  channel.off();
  watchedChannels.delete(channel.name);
}

function subscribeChannelMessages(channel) {
  if (!channel || subscribedMessageChannels.has(channel.name)) return;
  channel.subscribe('join', handleJoinMessage);
  channel.subscribe('start', handleStartMessage);
  channel.subscribe('move', handleMoveMessage);
  channel.subscribe('state', handleStateMessage);
  subscribedMessageChannels.add(channel.name);
}

function unsubscribeChannelMessages(channel) {
  if (!channel || !subscribedMessageChannels.has(channel.name)) return;
  channel.unsubscribe();
  subscribedMessageChannels.delete(channel.name);
}

function handleJoinMessage(message) {
  const data = message?.data ?? {};
  logAction('event', `join 受信: ${data.clientId ?? 'unknown'}`);
  if (data.clientId) addMember(data.clientId);
}

function handleStartMessage(message) {
  const data = message?.data ?? {};
  logAction('event', `start 受信: host=${data.hostId ?? 'unknown'} members=${Array.isArray(data.members) ? data.members.length : 0}`);
  state.hostId = data.hostId ?? null;
  state.isHost = !!state.hostId && state.hostId === getClientId();
  state.started = true;
  // Host 側の最小ゲーム状態を初期化
  if (state.isHost) {
    state.hostGame = {
      round: 1,
      turnOwner: getClientId(),
      roundStarter: getClientId(),
      half: 0,
      scoresById: {},
    };
  }
  updateStartUI();
  setNotice('');
}

function handleMoveMessage(message) {
  const data = message?.data ?? {};
  logAction('event', `move 受信: ${data.clientId ?? 'unknown'} → ${data.action ?? 'unknown'}`);
  // Host のみ処理して authoritative state を再配信
  if (!state.isHost || !state.started) return;
  const actorId = data.clientId;
  if (!actorId) return;

  // 最小のゲーム状態（Host 内部）
  if (!state.hostGame) {
    state.hostGame = { round: state.turn || 1, turnOwner: actorId, scoresById: {}, half: 0 };
  }
  const game = state.hostGame;

  // 手番チェック（厳密化は後続）
  if (game.turnOwner && actorId !== game.turnOwner) {
    // 手番外は無視（最小実装）
    logAction('event', '手番ではない move を無視');
    return;
  }

  // スコア更新
  const scores = game.scoresById[actorId] ?? { charm: 0, oji: 0, total: 0 };
  switch (data.action) {
    case 'summon':
      scores.charm += 1; break;
    case 'decorate':
      scores.oji += 1; break;
    case 'play':
      scores.charm += 1; scores.oji += 1; break;
    case 'skip':
    default:
      // 変化なし
      break;
  }
  scores.total = scores.charm + scores.oji;
  game.scoresById[actorId] = scores;

  // 次の手番・ラウンド（2人想定）
  const members = getMembers();
  const opponent = members.find((id) => id && id !== actorId) || actorId;
  let round = game.round || 1;
  let phase = 'in-round';
  const half = typeof game.half === 'number' ? game.half : 0; // 0:前半, 1:後半

  if (half === 0) {
    // 前半手が終了 → 手番を相手へ、ラウンド据え置き
    game.half = 1;
    game.turnOwner = opponent;
    game.roundStarter = actorId;
  } else {
    // 後半手が終了 → ラウンド+1、手番を相手へ、半手リセット
    if (round >= TOTAL_TURNS) {
      // 最終ラウンドではインクリメントしない（デクリメント見えを避ける）
      phase = 'ended';
      round = TOTAL_TURNS;
    } else {
      round += 1;
    }
    game.half = 0;
    game.turnOwner = opponent;
    game.roundStarter = opponent; // 次ラウンドのスターター
  }

  game.round = round;

  // players をメンバーから生成（存在しないIDはゼロスコア）
  const players = members.map((id) => ({
    clientId: id,
    hand: [],
    field: { humans: [] },
    scores: game.scoresById[id] ?? { charm: 0, oji: 0, total: 0 },
  }));

  void publishState({ round, turnOwner: game.turnOwner, players, phase, roundHalf: game.half });
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
  updateTurnIndicator();

    // スコアは自分のものを優先して表示（なければ 0 ）
    const myScores = me?.scores ?? { charm: 0, oji: 0, total: undefined };
    state.scores = {
      charm: Number.isFinite(myScores.charm) ? myScores.charm : 0,
      oji: Number.isFinite(myScores.oji) ? myScores.oji : 0,
      total: Number.isFinite(myScores.total) ? myScores.total : undefined,
    };
    updateScores(state.scores);

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
    renderGame();

    // 最小実装: 受信確認のための簡易ログのみ
    logAction('state', `state 受信: round=${round} phase=${phase}`);

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
  if (!hasRealtimeSupport()) {
    console.warn('[ably] library not loaded');
    logAction('network', 'Ablyライブラリが読み込まれていません');
    return;
  }

  if (!ablyClient) {
    try {
      ablyClient = new Ably.Realtime({
        key: state.env.ABLY_API_KEY,
        clientId: `web-${crypto.randomUUID().slice(0, 8)}`,
        transports: ['web_socket', 'xhr_streaming', 'xhr_polling'],
      });
      watchConnection();
      logAction('network', 'Ably接続中…');
      ablyClient.connection.on('failed', (err) => {
        console.warn('[ably] connection failed', err);
        logAction('network', 'Ably接続に失敗しました');
      });
      ablyClient.connection.once('connected', () => {
        logAction('network', 'Ably接続完了');
        if (state.roomId) {
        void publishJoin(state.roomId);
        }
      });
    } catch (error) {
      console.warn('[ably] initialization error', error);
      logAction('network', 'Ably初期化に失敗しました');
      return;
    }
  }

  const channelName = `${ABLY_CHANNEL_PREFIX}${roomId}`;
  if (ablyChannel && ablyChannel.name !== channelName) {
    unwatchChannel(ablyChannel);
    unsubscribeChannelMessages(ablyChannel);
    ablyChannel.detach();
    ablyChannel = null;
    lastJoinedRoomId = null;
  }

  if (!ablyChannel) {
    ablyChannel = ablyClient.channels.get(channelName);
    watchChannel(ablyChannel);
    subscribeChannelMessages(ablyChannel);
    logAction('network', `チャンネル接続要求: ${channelName}`);
    ablyChannel.attach((err) => {
      if (err) {
        console.warn('[ably] channel attach failed', err);
        const message = err.code === 40160
          ? 'チャンネルの権限がありません（Cloudflareの権限設定を確認）'
          : 'チャンネル接続に失敗しました';
        logAction('network', message);
        return;
      }
      logAction('network', `チャンネル接続完了: ${channelName}`);
      ensureStarted();
      if (ablyClient.connection.state === 'connected') {
        void publishJoin(roomId);
      } else {
        ablyClient.connection.once('connected', () => {
          void publishJoin(roomId);
        });
      }
    });
  } else if (ablyClient.connection.state === 'connected' && lastJoinedRoomId !== roomId) {
    void publishJoin(roomId);
  }
}

async function publishJoin(roomId) {
  if (!ablyChannel || !ablyClient) return;
  if (lastJoinedRoomId === roomId) return;
  const payload = {
    clientId: ablyClient.auth?.clientId ?? null,
    roomId,
    joinedAt: Date.now(),
  };

  try {
    logAction('network', 'join を送信中…');
    await ablyChannel.publish('join', payload);
    lastJoinedRoomId = roomId;
    logAction('network', 'join を送信しました');
  } catch (err) {
    console.warn('[ably] join publish failed', err);
    const message = err?.code === 40160
      ? 'join の送信に必要な権限が不足しています'
      : 'join の送信に失敗しました';
    logAction('network', message);
  }
}

function getClientId() {
  return ablyClient?.auth?.clientId ?? null;
}

async function publishStart(members = []) {
  if (!ablyChannel || !ablyClient || !state.roomId) return;
  const payload = {
    roomId: state.roomId,
    hostId: getClientId(),
    members: members.length ? members : [{ clientId: getClientId() }],
    startedAt: Date.now(),
  };

  try {
    logAction('network', 'start を送信中…');
    await ablyChannel.publish('start', payload);
    logAction('network', 'start を送信しました');
  } catch (err) {
    console.warn('[ably] start publish failed', err);
    const message = err?.code === 40160
      ? 'start の送信に必要な権限が不足しています'
      : 'start の送信に失敗しました';
    logAction('network', message);
  }
}

async function publishMove(move = {}) {
  if (!ablyChannel || !ablyClient || !state.roomId) return;
  const payload = {
    clientId: getClientId(),
    round: state.turn,
    action: 'summon',
    cardId: 'card-mock',
    ...move,
  };

  try {
    logAction('network', `move を送信中… (${payload.action})`);
    await ablyChannel.publish('move', payload);
    logAction('network', 'move を送信しました');
  } catch (err) {
    console.warn('[ably] move publish failed', err);
    const message = err?.code === 40160
      ? 'move の送信に必要な権限が不足しています'
      : 'move の送信に失敗しました';
    logAction('network', message);
  }
}

async function publishState(snapshot = {}) {
  if (!ablyChannel || !ablyClient || !state.roomId) return;
  const baseSnapshot = {
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

  try {
    logAction('network', 'state を送信中…');
    await ablyChannel.publish('state', { ...baseSnapshot, ...snapshot });
    logAction('network', 'state を送信しました');
  } catch (err) {
    console.warn('[ably] state publish failed', err);
    const message = err?.code === 40160
      ? 'state の送信に必要な権限が不足しています'
      : 'state の送信に失敗しました';
    logAction('network', message);
  }
}

function detachRealtime() {
  lastJoinedRoomId = null;
  if (ablyChannel) {
    unsubscribeChannelMessages(ablyChannel);
    ablyChannel.detach();
    ablyChannel = null;
  }
  state.started = false;
  state.hostId = null;
  state.isHost = false;
  state.members = [];
  state.hostGame = null;
  updateStartUI();
}

// dev-only advanceTurn removed

function adjustScores({ charm = 0, oji = 0 } = {}) {
  state.scores.charm += charm;
  state.scores.oji += oji;
  state.scores.total = state.scores.charm + state.scores.oji;
  updateScores(state.scores);
}

function clearContainer(target) {
  if (!target) return;
  target.innerHTML = '';
}

function renderHand(target, cards) {
  if (!target) return;
  clearContainer(target);
  cards.forEach((card) => {
    const cardEl = document.createElement('div');
    cardEl.className = `card card-${card.type}`;
    cardEl.textContent = card.name;
    target.appendChild(cardEl);
  });
}

function renderField(target, field) {
  if (!target) return;
  clearContainer(target);
  field.humans.forEach((human) => {
    const humanEl = document.createElement('div');
    humanEl.className = 'field-human';

    const cardEl = document.createElement('div');
    cardEl.className = 'field-human-card';
    cardEl.textContent = human.name;
    humanEl.appendChild(cardEl);

    const decorationsWrap = document.createElement('div');
    decorationsWrap.className = 'field-human-decorations';
    const decorations = human.decorations ?? [];
    for (let i = 0; i < MAX_DECORATIONS_PER_HUMAN; i += 1) {
      const decoration = decorations[i];
      const slot = document.createElement('div');
      slot.className = 'decoration-slot';
      if (decoration) {
        slot.classList.add('has-decoration');
        slot.textContent = decoration.name;
        slot.title = decoration.name;
      } else {
        slot.textContent = '＋';
        slot.title = '空きスロット';
      }
      decorationsWrap.appendChild(slot);
    }

    humanEl.appendChild(decorationsWrap);
    target.appendChild(humanEl);
  });
}

function renderGame() {
  renderHand(handSelf, state.self.hand);
  renderHand(handOpponent, state.opponent.hand);
  renderField(fieldSelf, state.self.field);
  renderField(fieldOpponent, state.opponent.field);
}

function prepareRoom() {
  resetScores();
  resetPlayers();
  resetTurn();
  resetLog();
  state.started = false;
  state.hostId = null;
  renderGame();
  // 開始前はロックしておき、state受信で解放
  lockActions();
  updateScores(state.scores);
  updateStartUI();
}

function lockActions() {
  state.actionLocked = true;
  setActionButtonsDisabled(true);
}

function unlockActions() {
  state.actionLocked = false;
  setActionButtonsDisabled(false);
}

function setActionButtonsDisabled(disabled) {
  actionButtons.forEach((button) => {
    if (!button) return;
    button.disabled = disabled;
  });
}

async function copyRoomLink() {
  if (!state.roomId) return;
  const url = `${location.origin}/room/${state.roomId}`;
  try {
    await navigator.clipboard.writeText(url);
    alert('招待リンクをコピーしました');
  } catch (err) {
    console.warn('Clipboard API unavailable', err);
    window.prompt('この URL をコピーしてください', url);
  }
}

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

function navigateToRoom(roomId) {
  history.pushState({ roomId }, '', `/room/${roomId}`);
  showRoom(roomId);
}

function navigateToLobby(withNotice) {
  history.pushState({}, '', '/');
  detachRealtime();
  showLobby(withNotice);
}

async function init() {
  await loadEnvironment();

  handleInitialRoute(history.state);

  window.addEventListener('popstate', (event) => {
    handleInitialRoute(event.state);
  });

  createButton?.addEventListener('click', (event) => {
    event.preventDefault();
    const id = generateRoomId();
    // この端末が部屋を作成した＝Host として扱う（セッション内）
    state.isHost = true;
    state.hostId = null; // 接続後の clientId で確定
    updateStartUI();
    navigateToRoom(id);
  });

  copyButton?.addEventListener('click', copyRoomLink);

  // ゲーム開始（Host のみが押せる想定。UI側でも非表示）
  startButton?.addEventListener('click', async () => {
    if (!ablyClient || !ablyChannel) return;
    const hostId = getClientId();
    if (!hostId) {
      logAction('network', 'clientId 未確定のため開始できません');
      return;
    }
    startButton.disabled = true;
    state.started = true;
    updateStartUI();
    // start → 初期state を順に送信
    await publishStart();
    await publishState({ round: 1, phase: 'in-round', turnOwner: hostId, roundHalf: 0 });
  });

  document.getElementById('action-summon')?.addEventListener(
    'click',
    logButtonAction('summon', '召喚', () => {
      void publishMove({ action: 'summon' });
    }),
  );
  document.getElementById('action-decorate')?.addEventListener(
    'click',
    logButtonAction('decorate', '装飾', () => {
      void publishMove({ action: 'decorate' });
    }),
  );
  document.getElementById('action-play')?.addEventListener(
    'click',
    logButtonAction('play', 'アクション', () => {
      void publishMove({ action: 'play' });
    }),
  );
  document.getElementById('action-skip')?.addEventListener(
    'click',
    logButtonAction('skip', 'スキップ', () => {
      void publishMove({ action: 'skip' });
    }),
  );

}

function updateStartUI() {
  // 招待リンクコピーは Host のみ表示
  if (copyButton) {
    if (state.isHost) copyButton.removeAttribute('hidden');
    else copyButton.setAttribute('hidden', '');
  }
  // Start ボタンが存在しないならここで終わり
  if (!startButton) return;
  if (state.started) {
    startButton.setAttribute('hidden', '');
    return;
  }
  if (state.isHost) startButton.removeAttribute('hidden');
  else startButton.setAttribute('hidden', '');
  const connected = !!ablyClient && ablyClient.connection?.state === 'connected';
  startButton.disabled = !connected;
}

function ensureStarted() {
  if (state.started) return;
  if (!state.isHost) return;
  if (!ablyClient || ablyClient.connection?.state !== 'connected') return;
  if (!ablyChannel) return;
  // start → 初期state
  void publishStart();
  void publishState({ round: 1, phase: 'in-round', turnOwner: getClientId(), roundHalf: 0 });
  state.started = true;
}

init();
