// Shared DOM helpers (Phase 1: behavior-invariant)

export function buildLogHTML(log = []) {
  if (!Array.isArray(log) || log.length === 0) {
    return '<div class="log-entry">まだ行動がありません</div>';
  }
  return log
    .map(({ type, message, at }) => {
      const time = new Date(at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      return `<div class="log-entry action-${type}"><span>${message}</span><time>${time}</time></div>`;
    })
    .join('');
}

export function updateScoresDOM({ charm, oji, total }) {
  const c = document.getElementById('score-charm');
  const o = document.getElementById('score-oji');
  const t = document.getElementById('score-total');
  if (c) c.textContent = String(charm ?? 0);
  if (o) o.textContent = String(oji ?? 0);
  const fallback = (charm ?? 0) + (oji ?? 0);
  if (t) t.textContent = String(total ?? fallback);
}

export function updateDeckCountsDOM(selfCount = 0, oppCount = 0) {
  const a = document.getElementById('deck-self-count');
  const b = document.getElementById('deck-opponent-count');
  if (a) a.textContent = String(selfCount);
  if (b) b.textContent = String(oppCount);
}
