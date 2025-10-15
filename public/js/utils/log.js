// Log key builders (Phase 1: behavior-invariant)

export function buildTurnKey(round, turnOwner) {
  const r = Number.isFinite(round) ? round : 0;
  return `turn:${r}:${turnOwner || ''}`;
}

export function buildStartKey(round, turnOwner, { charm = 0, oji = 0 } = {}) {
  const r = Number.isFinite(round) ? round : 0;
  return `start:${r}:${turnOwner || ''}:${charm || 0}:${oji || 0}`;
}

export function buildActionKey(round, roundHalf, la = {}) {
  const r = Number.isFinite(round) ? round : 0;
  const h = Number.isFinite(roundHalf) ? roundHalf : 0;
  return `act:${r}:${h}:${la.type}:${la.actorId || ''}:${la.cardName || ''}:${la.charm || 0}:${la.oji || 0}`;
}

export function buildEndKey(round, te = {}) {
  const r = Number.isFinite(round) ? round : 0;
  return `end:${r}:${te.actorId || ''}:${te.charm || 0}:${te.oji || 0}`;
}

