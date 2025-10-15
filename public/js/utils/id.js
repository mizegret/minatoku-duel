// ID helpers (Phase 1: behavior-invariant)

export function generateRoomId() {
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return raw.toLowerCase();
}

