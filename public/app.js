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
const actionButtons = [
  document.getElementById('action-summon'),
  document.getElementById('action-decorate'),
  document.getElementById('action-play'),
  document.getElementById('action-skip'),
];

const ROOM_ID_PATTERN = /^[a-z0-9-]{8}$/;

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
  applyMockData();
  unlockActions();
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
    const nameEl = document.createElement('div');
    nameEl.className = 'field-human-name';
    nameEl.textContent = human.name;
    humanEl.appendChild(nameEl);

    const decorationsEl = document.createElement('ul');
    decorationsEl.className = 'field-decorations';
    human.decorations?.forEach((decoration) => {
      const li = document.createElement('li');
      li.textContent = decoration.name;
      decorationsEl.appendChild(li);
    });

    humanEl.appendChild(decorationsEl);
    target.appendChild(humanEl);
  });
}

function applyMockData() {
  state.self = structuredClone(MOCK_SELF);
  state.opponent = structuredClone(MOCK_OPPONENT);

  renderHand(handSelf, state.self.hand);
  renderHand(handOpponent, state.opponent.hand);
  renderField(fieldSelf, state.self.field);
  renderField(fieldOpponent, state.opponent.field);
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

function navigateToRoom(roomId) {
  history.pushState({ roomId }, '', `/room/${roomId}`);
  showRoom(roomId);
}

function navigateToLobby(withNotice) {
  history.pushState({}, '', '/');
  showLobby(withNotice);
}

function init() {
  handleInitialRoute(history.state);

  window.addEventListener('popstate', (event) => {
    handleInitialRoute(event.state);
  });

  createButton?.addEventListener('click', (event) => {
    event.preventDefault();
    const id = generateRoomId();
    navigateToRoom(id);
  });

  copyButton?.addEventListener('click', copyRoomLink);

  document.getElementById('action-summon')?.addEventListener(
    'click',
    ensureSingleAction(() => {
      adjustScores({ charm: 1 });
      console.log('summon: charm +1');
    }),
  );
  document.getElementById('action-decorate')?.addEventListener(
    'click',
    ensureSingleAction(() => {
      adjustScores({ oji: 1 });
      console.log('decorate: oji +1');
    }),
  );
  document.getElementById('action-play')?.addEventListener(
    'click',
    ensureSingleAction(() => {
      adjustScores({ charm: 1, oji: 1 });
      console.log('action: charm +1, oji +1');
    }),
  );
  document.getElementById('action-skip')?.addEventListener(
    'click',
    ensureSingleAction(() => {
      console.log('skip: no change');
    }),
  );

  // モック向け: console から window.mockNextTurn() でボタンを再有効化
  window.mockNextTurn = () => {
    unlockActions();
    console.log('[mock] 次のターンへ（ロック解除）');
  };

  // モック向け: ロビーに戻るヘルパー
  window.mockToLobby = () => {
    navigateToLobby();
    console.log('[mock] ロビーへ戻りました');
  };
}

init();
