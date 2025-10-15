// Tiny client-side router (Phase 1: behavior-invariant)
// Moves handleInitialRoute/popstate/navigateToRoom from app.js with no logic changes.

const ROOM_ID_PATTERN = /^[a-z0-9-]{8}$/; // keep strict 8-char rule as-is

let callbacks = { onLobby: null, onRoom: null, onInvalid: null };

function applyRoute(stateOverride) {
  const onLobby = callbacks.onLobby || (() => {});
  const onRoom = callbacks.onRoom || (() => {});
  const onInvalid = callbacks.onInvalid || (() => {});

  const roomIdFromState = stateOverride?.roomId;
  if (roomIdFromState && ROOM_ID_PATTERN.test(roomIdFromState)) {
    onRoom(roomIdFromState);
    return;
  }

  const roomMatch = location.pathname.match(/^\/room\/([a-z0-9-]{1,32})\/?$/);
  if (!roomMatch) {
    onLobby();
    return;
  }
  const requestedId = roomMatch[1];
  if (!ROOM_ID_PATTERN.test(requestedId)) {
    onInvalid('無効な Room ID です。もう一度作成し直してください。');
    return;
  }
  onRoom(requestedId);
}

export function initRouter({ onLobby, onRoom, onInvalid } = {}) {
  callbacks = { onLobby: onLobby || null, onRoom: onRoom || null, onInvalid: onInvalid || null };
  applyRoute(history.state);
  window.addEventListener('popstate', (event) => {
    applyRoute(event.state);
  });
}

export function navigateToRoom(roomId) {
  history.pushState({ roomId }, '', `/room/${roomId}`);
  callbacks.onRoom && callbacks.onRoom(roomId);
}

