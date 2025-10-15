// Skills utilities (Phase 1: behavior-invariant)
// - applyAddSelfEffects: apply skills with a given trigger, self-target 'add' only

export function applyAddSelfEffects(skills, trigger, ensureDelta, actorId) {
  let sumCharm = 0;
  let sumOji = 0;
  const list = Array.isArray(skills) ? skills : [];
  for (const sk of list) {
    const triggers = Array.isArray(sk?.triggers) ? sk.triggers : [];
    if (!triggers.includes(trigger)) continue;
    const effects = Array.isArray(sk?.effects) ? sk.effects : [];
    for (const e of effects) {
      if (!e || e.op !== 'add') continue;
      const delta = Number(e.value) || 0;
      if (!delta) continue;
      const targetSelf = !e.target || e.target === 'self';
      if (!targetSelf) continue; // current runtime: self only
      const d = ensureDelta(actorId);
      if (e.stat === 'charm') { d.charm = Math.max(0, d.charm + delta); sumCharm += delta; }
      if (e.stat === 'oji') { d.oji = Math.max(0, d.oji + delta); sumOji += delta; }
    }
  }
  return { sumCharm, sumOji };
}

