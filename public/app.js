const lobbySection = document.getElementById('screen-lobby');
const roomSection = document.getElementById('screen-room');
const createButton = document.getElementById('create-room');
const copyButton = document.getElementById('copy-room-link');
const roomIdLabel = document.getElementById('room-id');
const scoreCharm = document.getElementById('score-charm');
const scoreOji = document.getElementById('score-oji');
const scoreTotal = document.getElementById('score-total');
const noticeArea = document.getElementById('notice');

const ROOM_ID_PATTERN = /^[a-z0-9-]{8}$/;

const state = {
  roomId: null,
  scores: {
    charm: 0,
    oji: 0,
    total: 0,
  },
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
  resetScores();
  updateScores(state.scores);
  lobbySection?.setAttribute('hidden', '');
  roomSection?.removeAttribute('hidden');
}

function resetScores() {
  state.scores = { charm: 0, oji: 0, total: 0 };
}

function updateScores({ charm, oji, total }) {
  if (scoreCharm) scoreCharm.textContent = String(charm ?? 0);
  if (scoreOji) scoreOji.textContent = String(oji ?? 0);
  const fallbackTotal = (charm ?? 0) + (oji ?? 0);
  if (scoreTotal) scoreTotal.textContent = String(total ?? fallbackTotal);
}

function adjustScores({ charm = 0, oji = 0 } = {}) {
  state.scores.charm += charm;
  state.scores.oji += oji;
  state.scores.total = state.scores.charm + state.scores.oji;
  updateScores(state.scores);
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

function handleInitialRoute() {
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

function init() {
  handleInitialRoute();

  createButton?.addEventListener('click', () => {
    const id = generateRoomId();
    location.href = `/room/${id}`;
  });

  copyButton?.addEventListener('click', copyRoomLink);

  document.getElementById('action-summon')?.addEventListener('click', () => {
    adjustScores({ charm: 1 });
    console.log('summon: charm +1');
  });
  document.getElementById('action-decorate')?.addEventListener('click', () => {
    adjustScores({ oji: 1 });
    console.log('decorate: oji +1');
  });
  document.getElementById('action-play')?.addEventListener('click', () => {
    adjustScores({ charm: 1, oji: 1 });
    console.log('action: charm +1, oji +1');
  });
  document.getElementById('action-skip')?.addEventListener('click', () => {
    console.log('skip: no change');
  });
}

init();
