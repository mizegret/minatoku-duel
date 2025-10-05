import { MAX_DECORATIONS_PER_HUMAN } from '../constants.js';

export function bindInputs(ctx) {
  const {
    onCreateRoom,
    getRoomId,
    state,
    logButtonAction,
    publishMove,
  } = ctx;

  const createButton = document.getElementById('create-room');
  const copyButton = document.getElementById('copy-room-link');
  const handSelf = document.getElementById('hand-self');
  const skipButton = document.getElementById('action-skip');

  createButton?.addEventListener('click', (event) => {
    event.preventDefault();
    onCreateRoom?.();
  });

  copyButton?.addEventListener('click', async () => {
    const roomId = getRoomId?.();
    if (!roomId) return;
    const url = `${location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('招待リンクをコピーしました');
    } catch (err) {
      console.warn('Clipboard API unavailable', err);
      window.prompt('この URL をコピーしてください', url);
    }
  });

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

  // スキップ
  skipButton?.addEventListener(
    'click',
    logButtonAction('skip', 'このターンは様子見', () => {
      void publishMove({ action: 'skip' });
    }),
  );
}

