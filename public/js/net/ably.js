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

// (deprecated) connect/detach/publishJoin have been removed in favor of createConnection()

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

// B2: Factory-style handle that scopes channel state per connection.
export function createConnection({
  apiKey,
  clientIdPrefix = 'web-',
  channelPrefix = 'room:',
  roomId,
  logAction,
  onConnectionStateChange,
  onConnected,
  onAttach,
  onJoin,
  onStart,
  onMove,
  onState,
} = {}) {
  const c = init({ apiKey, clientIdPrefix, logAction, onConnectionStateChange });
  if (!c) return null;
  const handle = { _channel: null, _subscribed: false, _lastJoined: null };
  const channelName = `${channelPrefix}${roomId}`;
  handle._channel = c.channels.get(channelName);

  if (!handle._subscribed) {
    if (onJoin) handle._channel.subscribe(EVENTS.join, onJoin);
    if (onStart) handle._channel.subscribe(EVENTS.start, onStart);
    if (onMove) handle._channel.subscribe(EVENTS.move, onMove);
    if (onState) handle._channel.subscribe(EVENTS.state, onState);
    handle._subscribed = true;
  }

  logAction?.('network', `チャンネル接続要求: ${channelName}`);
  handle._channel.attach((err) => {
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
    if (c.connection.state === 'connected') {
      handle.publishJoin({ roomId });
    } else {
      c.connection.once('connected', () => handle.publishJoin({ roomId }));
    }
  });

  c.connection.once('connected', () => {
    logAction?.('network', 'Ably接続完了');
    onConnected?.();
    if (roomId) handle.publishJoin({ roomId });
  });

  handle.publishJoin = async ({ roomId }) => {
    if (!handle._channel || !client) return;
    if (handle._lastJoined === roomId) return;
    const payload = { clientId: client.auth?.clientId ?? null, roomId, joinedAt: Date.now() };
    try {
      logAction?.('network', 'join を送信中…');
      await handle._channel.publish(EVENTS.join, payload);
      handle._lastJoined = roomId;
      logAction?.('network', 'join を送信しました');
    } catch (err) {
      const message = err?.code === 40160
        ? 'join の送信に必要な権限が不足しています'
        : 'join の送信に失敗しました';
      logAction?.('network', message);
    }
  };

  handle.publishStart = async (payload = {}) => {
    if (!handle._channel || !client) return;
    const base = {
      roomId: payload.roomId,
      hostId: client.auth?.clientId ?? null,
      members: payload.members?.length ? payload.members : [{ clientId: client.auth?.clientId ?? null }],
      startedAt: Date.now(),
    };
    try {
      logAction?.('network', 'start を送信中…');
      await handle._channel.publish(EVENTS.start, { ...base, ...payload });
      logAction?.('network', 'start を送信しました');
    } catch (err) {
      const message = err?.code === 40160
        ? 'start の送信に必要な権限が不足しています'
        : 'start の送信に失敗しました';
      logAction?.('network', message);
    }
  };

  handle.publishMove = async (payload = {}) => {
    if (!handle._channel || !client) return;
    const base = { clientId: client.auth?.clientId ?? null, round: payload.round ?? undefined };
    try {
      logAction?.('network', `move を送信中… (${payload.action})`);
      await handle._channel.publish(EVENTS.move, { ...base, ...payload });
      logAction?.('network', 'move を送信しました');
    } catch (err) {
      const message = err?.code === 40160
        ? 'move の送信に必要な権限が不足しています'
        : 'move の送信に失敗しました';
      logAction?.('network', message);
    }
  };

  handle.publishState = async (snapshot = {}) => {
    if (!handle._channel || !client) return;
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
      await handle._channel.publish(EVENTS.state, { ...baseSnapshot, ...snapshot });
      logAction?.('network', 'state を送信しました');
    } catch (err) {
      const message = err?.code === 40160
        ? 'state の送信に必要な権限が不足しています'
        : 'state の送信に失敗しました';
      logAction?.('network', message);
    }
  };

  handle.detach = () => {
    handle._lastJoined = null;
    if (handle._channel) {
      try { handle._channel.unsubscribe(); } catch {}
      try { handle._channel.detach(); } catch {}
      handle._channel = null; handle._subscribed = false;
    }
  };

  handle.getClientId = () => client?.auth?.clientId ?? null;
  handle.isConnected = () => client?.connection?.state === 'connected';

  return handle;
}
