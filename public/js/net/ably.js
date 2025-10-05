// Ably networking wrapper (Step5)
// - init: create Realtime client with logs and connection watcher
// - connect: attach to channel, subscribe handlers, auto-join
// - publish: join/start/move/state with consistent log wording

import { EVENTS } from '../constants.js';

let client = null;
let channel = null;
let lastJoinedRoomId = null;
let subscribed = false;
let hasConnWatcher = false;

export function hasRealtimeSupport() {
  return typeof Ably !== 'undefined' && typeof Ably.Realtime === 'function';
}

export function getClientId() {
  return client?.auth?.clientId ?? null;
}

export function isConnected() {
  return client?.connection?.state === 'connected';
}

export function init({ apiKey, clientIdPrefix = 'web-', logAction, onConnectionStateChange } = {}) {
  if (client) return client;
  if (!hasRealtimeSupport()) {
    logAction?.('network', 'Ablyライブラリが読み込まれていません');
    return null;
  }
  try {
    client = new Ably.Realtime({
      key: apiKey,
      clientId: `${clientIdPrefix}${crypto.randomUUID().slice(0, 8)}`,
      transports: ['web_socket', 'xhr_streaming', 'xhr_polling'],
    });
  } catch (e) {
    logAction?.('network', 'Ably初期化に失敗しました');
    return null;
  }

  if (!hasConnWatcher) {
    hasConnWatcher = true;
    client.connection.on('statechange', (change) => {
      const reason = change.reason
        ? ` (reason: ${change.reason.code ?? ''} ${change.reason.message ?? ''})`
        : '';
      logAction?.('network', `接続状態: ${change.previous} → ${change.current}${reason}`);
      onConnectionStateChange?.(change);
    });
    client.connection.on('failed', (err) => {
      console.warn('[ably] connection failed', err);
      logAction?.('network', 'Ably接続に失敗しました');
    });
  }

  return client;
}

export function connect({
  roomId,
  channelPrefix = 'room:',
  logAction,
  onConnected,
  onAttach,
  onJoin,
  onStart,
  onMove,
  onState,
} = {}) {
  if (!client) return null;
  const channelName = `${channelPrefix}${roomId}`;

  // channel rotate if room changed
  if (channel && channel.name !== channelName) {
    try { channel.unsubscribe(); } catch {}
    try { channel.detach(); } catch {}
    channel = null; subscribed = false; lastJoinedRoomId = null;
  }
  if (!channel) channel = client.channels.get(channelName);

  if (!subscribed) {
    if (onJoin) channel.subscribe(EVENTS.join, onJoin);
    if (onStart) channel.subscribe(EVENTS.start, onStart);
    if (onMove) channel.subscribe(EVENTS.move, onMove);
    if (onState) channel.subscribe(EVENTS.state, onState);
    subscribed = true;
  }

  logAction?.('network', `チャンネル接続要求: ${channelName}`);
  channel.attach((err) => {
    if (err) {
      console.warn('[ably] channel attach failed', err);
      const message = err.code === 40160
        ? 'チャンネルの権限がありません（Cloudflareの権限設定を確認）'
        : 'チャンネル接続に失敗しました';
      logAction?.('network', message);
      return;
    }
    logAction?.('network', `チャンネル接続完了: ${channelName}`);
    onAttach?.(roomId);
    if (client.connection.state === 'connected') {
      publishJoin({ roomId, logAction });
    } else {
      client.connection.once('connected', () => publishJoin({ roomId, logAction }));
    }
  });

  // Extra safety: also log when attached via statechange and avoid silent stalls
  try {
    channel.once('attached', () => {
      logAction?.('network', `チャンネル状態: attached (${channelName})`);
    });
  } catch {}

  client.connection.once('connected', () => {
    logAction?.('network', 'Ably接続完了');
    onConnected?.();
    // Fallback: publish join even if attach callback hasn't fired yet (Ably will implicitly attach)
    if (roomId) publishJoin({ roomId, logAction });
  });

  return {
    publishJoin: ({ roomId: r }) => publishJoin({ roomId: r, logAction }),
    publishStart: (payload) => publishStart(payload, { logAction }),
    publishMove: (payload) => publishMove(payload, { logAction }),
    publishState: (payload) => publishState(payload, { logAction }),
    detach,
    getClientId,
    isConnected,
  };
}

export function detach() {
  lastJoinedRoomId = null;
  if (channel) {
    try { channel.unsubscribe(); } catch {}
    try { channel.detach(); } catch {}
    channel = null; subscribed = false;
  }
}

export async function publishJoin({ roomId, logAction }) {
  if (!channel || !client) return;
  if (lastJoinedRoomId === roomId) return;
  const payload = {
    clientId: client.auth?.clientId ?? null,
    roomId,
    joinedAt: Date.now(),
  };
  try {
    logAction?.('network', 'join を送信中…');
    await channel.publish(EVENTS.join, payload);
    lastJoinedRoomId = roomId;
    logAction?.('network', 'join を送信しました');
  } catch (err) {
    const message = err?.code === 40160
      ? 'join の送信に必要な権限が不足しています'
      : 'join の送信に失敗しました';
    logAction?.('network', message);
  }
}

export async function publishStart(payload = {}, { logAction } = {}) {
  if (!channel || !client) return;
  const base = {
    roomId: payload.roomId,
    hostId: client.auth?.clientId ?? null,
    members: payload.members?.length ? payload.members : [{ clientId: client.auth?.clientId ?? null }],
    startedAt: Date.now(),
  };
  try {
    logAction?.('network', 'start を送信中…');
    await channel.publish(EVENTS.start, { ...base, ...payload });
    logAction?.('network', 'start を送信しました');
  } catch (err) {
    const message = err?.code === 40160
      ? 'start の送信に必要な権限が不足しています'
      : 'start の送信に失敗しました';
    logAction?.('network', message);
  }
}

export async function publishMove(payload = {}, { logAction } = {}) {
  if (!channel || !client) return;
  const base = { clientId: client.auth?.clientId ?? null, round: payload.round ?? undefined };
  try {
    logAction?.('network', `move を送信中… (${payload.action})`);
    await channel.publish(EVENTS.move, { ...base, ...payload });
    logAction?.('network', 'move を送信しました');
  } catch (err) {
    const message = err?.code === 40160
      ? 'move の送信に必要な権限が不足しています'
      : 'move の送信に失敗しました';
    logAction?.('network', message);
  }
}

export async function publishState(snapshot = {}, { logAction } = {}) {
  if (!channel || !client) return;
  const baseSnapshot = {
    phase: snapshot.phase ?? 'in-round',
    round: snapshot.round,
    turnOwner: snapshot.turnOwner ?? client.auth?.clientId ?? null,
    players: snapshot.players ?? [],
    log: snapshot.log ?? [],
    updatedAt: Date.now(),
  };
  try {
    logAction?.('network', 'state を送信中…');
    await channel.publish(EVENTS.state, { ...baseSnapshot, ...snapshot });
    logAction?.('network', 'state を送信しました');
  } catch (err) {
    const message = err?.code === 40160
      ? 'state の送信に必要な権限が不足しています'
      : 'state の送信に失敗しました';
    logAction?.('network', message);
  }
}
