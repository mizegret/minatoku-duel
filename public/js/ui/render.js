import { TOTAL_TURNS, MAX_DECORATIONS_PER_HUMAN } from '../constants.js';

// Cache DOM refs (modules are deferred, DOM is parsed)
const refs = {
  scoreCharm: document.getElementById('score-charm'),
  scoreOji: document.getElementById('score-oji'),
  scoreTotal: document.getElementById('score-total'),
  turnLabel: document.getElementById('turn-indicator'),
  deckSelfCount: document.getElementById('deck-self-count'),
  deckOpponentCount: document.getElementById('deck-opponent-count'),
  handSelf: document.getElementById('hand-self'),
  handOpponent: document.getElementById('hand-opponent'),
  fieldSelf: document.getElementById('field-self'),
  fieldOpponent: document.getElementById('field-opponent'),
  actionLog: document.getElementById('action-log'),
  copyButton: document.getElementById('copy-room-link'),
  skipButton: document.getElementById('action-skip'),
};

function clear(el) {
  if (!el) return;
  el.innerHTML = '';
}

function renderHand(target, cards, mask = false) {
  if (!target) return;
  clear(target);
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
  clear(target);
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

export function renderGame(state) {
  renderHand(refs.handSelf, state.self.hand, false);
  renderHand(refs.handOpponent, state.opponent.hand, true);
  renderField(refs.fieldSelf, state.self.field);
  renderField(refs.fieldOpponent, state.opponent.field);
}

export function updateScores({ charm, oji, total }) {
  if (refs.scoreCharm) refs.scoreCharm.textContent = String(charm ?? 0);
  if (refs.scoreOji) refs.scoreOji.textContent = String(oji ?? 0);
  const fallbackTotal = (charm ?? 0) + (oji ?? 0);
  if (refs.scoreTotal) refs.scoreTotal.textContent = String(total ?? fallbackTotal);
}

export function updateTurnIndicator(turn, totalTurns = TOTAL_TURNS) {
  if (!refs.turnLabel) return;
  refs.turnLabel.textContent = `ターン ${turn} / ${totalTurns}`;
}

export function updateDeckCounts(selfCount = 0, oppCount = 0) {
  if (refs.deckSelfCount) refs.deckSelfCount.textContent = String(selfCount);
  if (refs.deckOpponentCount) refs.deckOpponentCount.textContent = String(oppCount);
}

export function renderLog(log = []) {
  if (!refs.actionLog) return;
  if (!Array.isArray(log) || log.length === 0) {
    refs.actionLog.innerHTML = '<div class="log-entry">まだ行動がありません</div>';
    return;
  }
  refs.actionLog.innerHTML = log
    .map(({ type, message, at }) => {
      const time = new Date(at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      return `<div class="log-entry action-${type}"><span>${message}</span><time>${time}</time></div>`;
    })
    .join('');
}

export function setActionButtonsDisabled(disabled) {
  if (refs.skipButton) refs.skipButton.disabled = !!disabled;
}

export function updateHandInteractivity(isMyTurn, actionLocked) {
  if (!refs.handSelf) return;
  if (isMyTurn && !actionLocked) refs.handSelf.classList.remove('disabled');
  else refs.handSelf.classList.add('disabled');
}

export function updateStartUI(isHost) {
  if (!refs.copyButton) return;
  if (isHost) refs.copyButton.removeAttribute('hidden');
  else refs.copyButton.setAttribute('hidden', '');
}

