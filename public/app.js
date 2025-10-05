import { DEBUG, CARD_TYPES, TOTAL_TURNS, ABLY_CHANNEL_PREFIX, MAX_DECORATIONS_PER_HUMAN } from './js/constants.js';
import { randInt, shuffle } from './js/utils/random.js';
import { buildPlayers } from './js/utils/players.js';

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

let ablyClient = null;
let ablyChannel = null;
let lastJoinedRoomId = null;
let hasConnectionWatcher = false;
const subscribedMessageChannels = new Set();

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

function updateDeckCounts(selfCount = 0, oppCount = 0) {
  if (deckSelfCount) deckSelfCount.textContent = String(selfCount);
  if (deckOpponentCount) deckOpponentCount.textContent = String(oppCount);
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

// channel-level verbose watchersは削除（最小ログ運用）

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

  // スコア更新（summon / play は固定、decorate はカード由来で可変）
  const scores = game.scoresById[actorId] ?? { charm: 0, oji: 0, total: 0 };
  if (data.action === 'summon') {
    scores.charm += 1;
  } else if (data.action === 'play') {
    scores.charm += 1; scores.oji += 1;
  }

  // 次の手番・ラウンド（2人想定）
  const members = getMembers();
  const opponent = members.find((id) => id && id !== actorId) || actorId;
  let round = game.round || 1;
  let phase = 'in-round';
  const half = typeof game.half === 'number' ? game.half : 0; // 0:前半, 1:後半

  // 盤面の最小更新（召喚/装飾）
  if (!game.fieldById) game.fieldById = {};
  const field = game.fieldById[actorId] ?? { humans: [] };
  let lastAction = { type: data.action, actorId, cardName: undefined };
  if (data.action === 'summon') {
    // 手札から対象カードIDのhumanを取り出して場へ（ID優先、なければ最初のhuman）
    const hand = Array.isArray(game.handsById?.[actorId]) ? game.handsById[actorId] : [];
    console.debug('[host-move] summon before', { actorId, hand: hand.map((c)=>c.id), cardId: data.cardId });
    let idx = -1;
    if (data.cardId) {
      idx = hand.findIndex((c) => c?.id === data.cardId);
    }
    if (idx < 0) {
      idx = hand.findIndex((c) => c?.type === 'human');
    }
    if (idx >= 0) {
      const humanCard = hand.splice(idx, 1)[0];
      if (humanCard?.type === 'human') {
        field.humans.push({ id: humanCard.id, name: humanCard.name, decorations: [] });
        logAction('event', `summon: ${humanCard.name}`);
        console.debug('[host-move] summon after', { actorId, hand: hand.map((c)=>c.id), fieldCount: field.humans.length });
        lastAction.cardName = humanCard.name;
      } else {
        // human以外を誤って指定した場合は手札へ戻す
        hand.splice(idx, 0, humanCard);
        logAction('event', 'summon: human以外を選択のため無視');
      }
    } else {
      logAction('event', 'summon: 手札に一致カードなし');
    }
  } else if (data.action === 'decorate') {
    // 付与先（空き枠のある最初の人間）を決定
    if (field.humans.length > 0) {
      const target = field.humans.find((h) => (h?.decorations?.length ?? 0) < MAX_DECORATIONS_PER_HUMAN);
      if (target) {
        const decorations = target.decorations ?? [];
        // 手札から対象装飾を取り出す（ID優先、無ければ最初の装飾）
        const hand = Array.isArray(game.handsById?.[actorId]) ? game.handsById[actorId] : [];
        let idx = -1;
        if (data.cardId) idx = hand.findIndex((c) => c?.id === data.cardId);
        if (idx < 0) idx = hand.findIndex((c) => c?.type === 'decoration');
        if (idx >= 0) {
          const deco = hand.splice(idx, 1)[0];
          decorations.push({ id: deco.id, name: deco.name });
          target.decorations = decorations;
          // カード個別の魅力/好感度補正（デフォルト: charm +1）
          const dCharm = Number.isFinite(deco?.charm) ? Number(deco.charm) : 1;
          const dOji = 0; // 装飾では好感度（oji）は上げない
          scores.charm += dCharm;
          scores.oji += dOji;
          lastAction.cardName = deco.name;
          lastAction.charm = dCharm;
          lastAction.oji = dOji;
          logAction('event', `decorate: ${deco.name}`);
        } else {
          logAction('event', 'decorate: 手札に装飾が見つからないため無視');
        }
      } else {
        logAction('event', 'decorate: 空き枠のある人がいないため無視');
      }
    } else {
      logAction('event', 'decorate: 場に人間がいないため無視');
    }
  } else if (data.action === 'play') {
    // ムーブ（所作）: actionカードのeffectを適用
    // サーバ側ガード：場に人間がいなければ無視
    const myField = game.fieldById?.[actorId] ?? { humans: [] };
    if (!Array.isArray(myField.humans) || myField.humans.length === 0) {
      logAction('event', 'play: 場に人間がいないため無視');
      // 手番は消費する（1アクション扱い）か？→ 現状は消費とするためこのまま後続進行。
      // 消費したくない場合は return; で早期終了に変更可能。
    }
    const hand = Array.isArray(game.handsById?.[actorId]) ? game.handsById[actorId] : [];
    let idx = -1;
    if (data.cardId) idx = hand.findIndex((c) => c?.id === data.cardId);
    if (idx < 0) idx = hand.findIndex((c) => c?.type === 'action');
    if (idx >= 0) {
      const act = hand.splice(idx, 1)[0];
      lastAction.cardName = act.name;
      // effectの合計を計算しつつ、対象に適用
      let dCharmSum = 0;
      let dOjiSum = 0;
      const effects = Array.isArray(act?.effect) ? act.effect : [];
      for (const e of effects) {
        if (!e || e.op !== 'add') continue;
        const delta = Number(e.value) || 0;
        if (!delta) continue;
        const targetId = (e.target === 'opponent') ? opponent : actorId;
        const tScores = game.scoresById[targetId] ?? { charm: 0, oji: 0, total: 0 };
        if (e.stat === 'charm') {
          tScores.charm = Math.max(0, tScores.charm + delta);
          if (targetId === actorId) dCharmSum += delta; // 自分に与えた分を表示用に集計
        } else if (e.stat === 'oji') {
          tScores.oji = Math.max(0, tScores.oji + delta);
          if (targetId === actorId) dOjiSum += delta;
        }
        tScores.total = tScores.charm + tScores.oji;
        game.scoresById[targetId] = tScores;
      }
      if (dCharmSum) lastAction.charm = dCharmSum;
      if (dOjiSum) lastAction.oji = dOjiSum;
      logAction('event', `play: ${act.name}`);
    } else {
      logAction('event', 'play: 手札にアクションが見つからないため無視');
    }
  }
  game.fieldById[actorId] = field;

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

  // 新しい手番の開始時に1ドロー（最終ラウンドのended時はドローしない）
  if (phase !== 'ended') {
    drawCard(game.turnOwner, game);
  }

  // players を構築して配信
  scores.total = scores.charm + scores.oji;
  game.scoresById[actorId] = scores;
  const players = buildPlayers(game, members);
  void publishState({ round, turnOwner: game.turnOwner, players, phase, roundHalf: game.half, lastAction });
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
  state.isMyTurn = !!myTurn;

    // 山札枚数（あれば表示）
    const selfDeck = Number.isFinite(me?.deckCount) ? me.deckCount : 0;
    const oppDeck = Number.isFinite(opp?.deckCount) ? opp.deckCount : 0;
    updateDeckCounts(selfDeck, oppDeck);

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
    unsubscribeChannelMessages(ablyChannel);
    ablyChannel.detach();
    ablyChannel = null;
    lastJoinedRoomId = null;
  }

  if (!ablyChannel) {
    ablyChannel = ablyClient.channels.get(channelName);
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

// adjustScores は move のホスト処理に置き換わったため削除

function clearContainer(target) {
  if (!target) return;
  target.innerHTML = '';
}

function renderHand(target, cards, mask = false) {
  if (!target) return;
  clearContainer(target);
  cards.forEach((card) => {
    const cardEl = document.createElement('div');
    cardEl.className = `card card-${card.type}${mask ? ' masked' : ''}`;
    cardEl.textContent = mask ? '？？？' : card.name;
    if (!mask) {
      cardEl.dataset.cardId = card.id;
      cardEl.dataset.cardType = card.type || '';
      cardEl.dataset.cardName = card.name || '';
    }
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
  renderHand(handSelf, state.self.hand, false);
  renderHand(handOpponent, state.opponent.hand, true);
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
  updateHandInteractivity();
}

function unlockActions() {
  state.actionLocked = false;
  setActionButtonsDisabled(false);
  updateHandInteractivity();
}

function setActionButtonsDisabled(disabled) {
  actionButtons.forEach((button) => {
    if (!button) return;
    button.disabled = disabled;
  });
}

// Enable/disable self hand interactivity based on turn/lock
function updateHandInteractivity() {
  if (!handSelf) return;
  if (state.isMyTurn && !state.actionLocked) handSelf.classList.remove('disabled');
  else handSelf.classList.add('disabled');
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

// --- minimal card helpers (Host側で使用) ---
function pickCard(type) {
  const empty = { id: `${type}-none`, name: 'カード' };
  const col = state.cardsByType?.[type];
  if (!Array.isArray(col) || col.length === 0) return empty;
  if (!state.hostGame) return col[0];
  if (!state.hostGame._seq) state.hostGame._seq = { humans: 0, decorations: 0, actions: 0 };
  const idx = state.hostGame._seq[type] % col.length;
  state.hostGame._seq[type] = state.hostGame._seq[type] + 1;
  return col[idx];
}

function drawCard(playerId, game) {
  if (!game || !playerId) return null;
  const deck = game.decksById?.[playerId];
  if (!Array.isArray(deck) || deck.length === 0) return null;
  const card = deck.shift();
  if (!Array.isArray(game.handsById?.[playerId])) game.handsById[playerId] = [];
  game.handsById[playerId].push(card);
  return card;
}

// randInt, shuffle -> js/utils/random.js
// buildPlayers -> js/utils/players.js

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
  await loadCards();

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

  // 手札クリック（自分の手札のみ）
  handSelf?.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains('card')) return;
    if (!state.isMyTurn || state.actionLocked) return;
    const cardId = target.dataset.cardId;
    const cardType = target.dataset.cardType;
    const cardName = target.dataset.cardName || '';
    if (!cardId) return;
    // 最小実装: human はクリックで召喚（確認付き）
    if (cardType === 'human') {
      const ok = window.confirm(`このカードを召喚しますか？\n${cardName}`);
      if (!ok) return;
      const action = logButtonAction('summon', `召喚：${cardName}`, () => {
        void publishMove({ action: 'summon', cardId });
      });
      action();
    } else if (cardType === 'decoration') {
      const hasSlot = Array.isArray(state.self?.field?.humans)
        && state.self.field.humans.some((h) => Array.isArray(h?.decorations) ? h.decorations.length < MAX_DECORATIONS_PER_HUMAN : true);
      if (!hasSlot) {
        alert('装飾を付けられる人がいません（先に召喚するか、空き枠を確保してください）');
        return;
      }
      const ok = window.confirm(`この装飾を装備しますか？（空き枠のある人に付与）\n${cardName}`);
      if (!ok) return;
      const action = logButtonAction('decorate', `装飾：${cardName}`, () => {
        void publishMove({ action: 'decorate', cardId });
      });
      action();
    } else if (cardType === 'action') {
      // クライアント側ガード：場に人間がいなければ使えない
      const hasSelfHuman = Array.isArray(state.self?.field?.humans) && state.self.field.humans.length > 0;
      if (!hasSelfHuman) {
        alert('ムーブを使う前に、人間を召喚してください');
        return;
      }
      const ok = window.confirm(`このムーブを使いますか？\n${cardName}`);
      if (!ok) return;
      const action = logButtonAction('play', `ムーブ：${cardName}`, () => {
        void publishMove({ action: 'play', cardId });
      });
      action();
    }
  });

  // 港区女子っぽいスキップ（今回は様子見）
  document.getElementById('action-skip')?.addEventListener(
    'click',
    logButtonAction('skip', 'このターンは様子見', () => {
      void publishMove({ action: 'skip' });
    }),
  );

  // Startボタンは廃止（自動開始）
  // 下部の装飾ボタンは廃止（手札クリックで装飾）
  // 下部のアクション/スキップボタンは Mock のため削除（手札クリック運用）

}

function updateStartUI() {
  // 招待リンクコピーは Host のみ表示
  if (copyButton) {
    if (state.isHost) copyButton.removeAttribute('hidden');
    else copyButton.setAttribute('hidden', '');
  }
}

function ensureStarted() {
  if (state.started) return;
  if (!state.isHost) return;
  if (!ablyClient || ablyClient.connection?.state !== 'connected') return;
  if (!ablyChannel) return;
  if (getMembers().length < 2) return; // 2人揃ってから開始
  // デッキ配布（MVP固定: human5 / deco10 / action5）
  const members = getMembers();
  const hostId = getClientId();
  const game = (state.hostGame = {
    round: 1,
    turnOwner: hostId,
    roundStarter: hostId,
    half: 0,
    scoresById: {},
    fieldById: {},
    decksById: {},
    handsById: {},
  });

  function buildDeck() {
    const deck = [];
    // 指定枚数ぶんタイプ別に詰める（この時点では順序固定）
    for (let i = 0; i < 5; i += 1) {
      const c = pickCard('humans');
      deck.push({ ...c, type: 'human' });
    }
    for (let i = 0; i < 10; i += 1) {
      const c = pickCard('decorations');
      deck.push({ ...c, type: 'decoration' });
    }
    for (let i = 0; i < 5; i += 1) {
      const c = pickCard('actions');
      deck.push({ ...c, type: 'action' });
    }
    // デッキ内順序をシャッフル（各プレイヤー独立）
    return shuffle(deck);
  }

  // 各プレイヤーへ配布（簡易：シャッフルなし、上から5枚を手札）
  members.forEach((id) => {
    const deck = buildDeck();
    const hand = deck.splice(0, 5);
    game.decksById[id] = deck;
    game.handsById[id] = hand;
    game.fieldById[id] = { humans: [] };
    game.scoresById[id] = { charm: 0, oji: 0, total: 0 };
  });

  // 先攻の開始時ドロー
  drawCard(hostId, game);

  // start → 初期state（playersに手札・空の場・初期スコアを含める）
  void publishStart();
  const players = buildPlayers(game, members);
  void publishState({ round: 1, phase: 'in-round', turnOwner: hostId, roundHalf: 0, players });
  state.started = true;
}

init();
// ---- Constants / Flags ----------------------------------------------------
// DEBUG, CARD_TYPES -> js/constants.js
