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

