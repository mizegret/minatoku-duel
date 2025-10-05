import { TOTAL_TURNS, MAX_DECORATIONS_PER_HUMAN, HAND_SIZE, ACTIONS, SCORE_RULES } from '../constants.js';
import { buildPlayers } from '../utils/players.js';
import { buildDeck, drawCard, popFirstByIdOrType } from '../utils/deck.js';
import { buildCardIndex, scoreField } from '../utils/score.js';

// Step3: Host-side game authority logic
// - ensureStarted: initialize decks/hands/fields/scores and broadcast start+state
// - handleMoveMessage: process a single move with guards, advance half/round, broadcast state

export function ensureStarted(ctx) {
  const { state, publishStart, publishState, getMembers, getClientId, logAction } = ctx;
  if (state.started) return;
  if (!state.isHost) return;
  if (!getMembers || getMembers().length < 2) return; // two players only (MVP)

  const members = getMembers();
  const hostId = getClientId();
  const game = (state.hostGame = {
    seed: (typeof crypto !== 'undefined' && crypto.getRandomValues)
      ? (() => { const b=new Uint32Array(1); crypto.getRandomValues(b); return b[0].toString(16).padStart(8,'0'); })()
      : Math.floor(Math.random()*1e9).toString(16),
    round: 1,
    turnOwner: hostId,
    roundStarter: hostId,
    half: 0,
    scoresById: {},
    fieldById: {},
    decksById: {},
    handsById: {},
    _actionDeltasById: {}, // accumulate play() deltas; combined with field for final scores
    _cardsById: buildCardIndex(state.cardsByType),
  });

  // distribute decks/hands (MVP fixed composition)
  members.forEach((id) => {
    const deck = buildDeck(state.cardsByType, game);
    const hand = deck.splice(0, HAND_SIZE);
    game.decksById[id] = deck;
    game.handsById[id] = hand;
    game.fieldById[id] = { humans: [] };
    game.scoresById[id] = { charm: 0, oji: 0, total: 0 };
  });

  // first draw for the first player
  drawCard(hostId, game);

  // start + initial state
  publishStart();
  const players = buildPlayers(game, members);
  publishState({ round: 1, phase: 'in-round', turnOwner: hostId, roundHalf: 0, players });
  state.started = true;
  logAction?.('event', 'ゲームを開始しました');
}

export function handleMoveMessage(message, ctx) {
  const { state, publishState, getMembers, getClientId, logAction } = ctx;
  const data = message?.data ?? {};
  logAction?.('event', `move 受信: ${data.clientId ?? 'unknown'} → ${data.action ?? 'unknown'}`);

  // Host only processes
  if (!state.isHost || !state.started) return;
  const actorId = data.clientId;
  if (!actorId) return;

  if (!state.hostGame) {
    state.hostGame = { round: state.turn || 1, turnOwner: actorId, scoresById: {}, half: 0 };
  }
  const game = state.hostGame;

  // turn guard
  if (game.turnOwner && actorId !== game.turnOwner) {
    logAction?.('event', '手番ではない move を無視');
    return;
  }

  // Scores are finalized at the end of the handler from (field + action deltas).

  // members / opponent
  const members = getMembers();
  const opponent = members.find((id) => id && id !== actorId) || actorId;
  let round = game.round || 1;
  let phase = 'in-round';
  const half = typeof game.half === 'number' ? game.half : 0; // 0: first, 1: second

  // field bucket
  if (!game.fieldById) game.fieldById = {};
  const field = game.fieldById[actorId] ?? { humans: [] };
  let lastAction = { type: data.action, actorId, cardName: undefined };

  if (data.action === ACTIONS.summon) {
    // remove chosen human from hand and put it on field
    const hand = Array.isArray(game.handsById?.[actorId]) ? game.handsById[actorId] : [];
    const { card: humanCard, index } = popFirstByIdOrType(hand, { cardId: data.cardId, type: 'human' });
    if (humanCard) {
      if (humanCard?.type === 'human') {
        // M2: save-only — keep baseCharm on field entity (no scoring change)
        const humanOnField = { id: humanCard.id, name: humanCard.name, decorations: [] };
        if (Number.isFinite(humanCard?.baseCharm) && Number(humanCard.baseCharm) > 0) {
          humanOnField.baseCharm = Number(humanCard.baseCharm);
        }
        field.humans.push(humanOnField);
        logAction?.('event', `summon: ${humanCard.name}`);
        lastAction.cardName = humanCard.name;
        // Skills (minimal): apply self add effects with trigger 'onSummon'
        try {
          const ensureDelta = (id) => (game._actionDeltasById[id] ||= { charm: 0, oji: 0 });
          let sCharm = 0; let sOji = 0;
          const skills = Array.isArray(humanCard.skills) ? humanCard.skills : [];
          for (const sk of skills) {
            const triggers = Array.isArray(sk?.triggers) ? sk.triggers : [];
            if (!triggers.includes('onSummon')) continue;
            const effects = Array.isArray(sk?.effects) ? sk.effects : [];
            for (const e of effects) {
              if (!e || e.op !== 'add') continue;
              const delta = Number(e.value) || 0;
              if (!delta) continue;
              const targetSelf = !e.target || e.target === 'self';
              if (!targetSelf) continue; // minimal: self only
              const d = ensureDelta(actorId);
              if (e.stat === 'charm') { d.charm = Math.max(0, d.charm + delta); sCharm += delta; }
              if (e.stat === 'oji') { d.oji = Math.max(0, d.oji + delta); sOji += delta; }
            }
          }
          if (sCharm) lastAction.charm = (lastAction.charm || 0) + sCharm;
          if (sOji) lastAction.oji = (lastAction.oji || 0) + sOji;
        } catch {}
        // scoring is handled by aggregator (field + rules + skill deltas); no mid-tick mutation
      } else {
        // restore when id matched non-human
        if (index >= 0) hand.splice(index, 0, humanCard);
        logAction?.('event', 'summon: human以外を選択のため無視');
      }
    } else {
      logAction?.('event', 'summon: 手札に一致カードなし');
    }
  } else if (data.action === ACTIONS.decorate) {
    if (field.humans.length > 0) {
      const target = field.humans.find((h) => (h?.decorations?.length ?? 0) < MAX_DECORATIONS_PER_HUMAN);
      if (target) {
        const decorations = target.decorations ?? [];
        const hand = Array.isArray(game.handsById?.[actorId]) ? game.handsById[actorId] : [];
        const { card: deco } = popFirstByIdOrType(hand, { cardId: data.cardId, type: 'decoration' });
        if (deco) {
          decorations.push({ id: deco.id, name: deco.name });
          target.decorations = decorations;
          // v2 cards: charmBonus is the source; fallback to rule default
          const dCharm = Number.isFinite(deco?.charmBonus)
            ? Number(deco.charmBonus)
            : Number(SCORE_RULES?.decorate?.defaultCharm ?? 1);
          const dOji = Number(SCORE_RULES?.decorate?.defaultOji ?? 0);
          lastAction.cardName = deco.name;
          lastAction.charm = dCharm;
          lastAction.oji = dOji;

          // Skills (minimal): apply target human's onDecorate self-add effects
          try {
            const ensureDelta = (id) => (game._actionDeltasById[id] ||= { charm: 0, oji: 0 });
            let sCharm = 0; let sOji = 0;
            const byId = game._cardsById || buildCardIndex(state.cardsByType);
            const humanDef = target?.id ? byId.get(target.id) : null;
            const skills = Array.isArray(humanDef?.skills) ? humanDef.skills : [];
            for (const sk of skills) {
              const triggers = Array.isArray(sk?.triggers) ? sk.triggers : [];
              if (!triggers.includes('onDecorate')) continue;
              const effects = Array.isArray(sk?.effects) ? sk.effects : [];
              for (const e of effects) {
                if (!e || e.op !== 'add') continue;
                const delta = Number(e.value) || 0;
                if (!delta) continue;
                const targetSelf = !e.target || e.target === 'self';
                if (!targetSelf) continue; // minimal
                const d = ensureDelta(actorId);
                if (e.stat === 'charm') { d.charm = Math.max(0, d.charm + delta); sCharm += delta; }
                if (e.stat === 'oji') { d.oji = Math.max(0, d.oji + delta); sOji += delta; }
              }
            }
            if (sCharm) lastAction.charm = (lastAction.charm || 0) + sCharm;
            if (sOji) lastAction.oji = (lastAction.oji || 0) + sOji;
          } catch {}
          logAction?.('event', `decorate: ${deco.name}`);
        } else {
          logAction?.('event', 'decorate: 手札に装飾が見つからないため無視');
        }
      } else {
        logAction?.('event', 'decorate: 空き枠のある人がいないため無視');
      }
    } else {
      logAction?.('event', 'decorate: 場に人間がいないため無視');
    }
  } else if (data.action === ACTIONS.play) {
    // action: guard when no human in field (still consume action per current behavior)
    const myField = game.fieldById?.[actorId] ?? { humans: [] };
    if (!Array.isArray(myField.humans) || myField.humans.length === 0) {
      logAction?.('event', 'play: 場に人間がいないため無視');
      // continue to half/turn advance per existing code
    }
    const hand = Array.isArray(game.handsById?.[actorId]) ? game.handsById[actorId] : [];
    const { card: act } = popFirstByIdOrType(hand, { cardId: data.cardId, type: 'action' });
    if (act) {
      lastAction.cardName = act.name;
      // base deltas are tracked; final scoring is aggregated later
      // M3: accumulate for verification (clamp to >=0 progressively like runtime)
      const ensureDelta = (id) => (game._actionDeltasById[id] ||= { charm: 0, oji: 0 });
      const dSelf = ensureDelta(actorId);
      const baseC = Number(SCORE_RULES?.play?.baseCharm ?? 1);
      const baseO = Number(SCORE_RULES?.play?.baseOji ?? 1);
      dSelf.charm = Math.max(0, dSelf.charm + baseC);
      dSelf.oji = Math.max(0, dSelf.oji + baseO);
      // apply card effects (may update actor or opponent)
      let dCharmSum = 0;
      let dOjiSum = 0;
      const effects = Array.isArray(act?.effect) ? act.effect : [];
      for (const e of effects) {
        if (!e || e.op !== 'add') continue;
        const delta = Number(e.value) || 0;
        if (!delta) continue;
        const targetId = (e.target === 'opponent') ? opponent : actorId;
        if (e.stat === 'charm') {
          if (targetId === actorId) dCharmSum += delta;
          // M3 aggregate
          const d = ensureDelta(targetId);
          d.charm = Math.max(0, d.charm + delta);
        } else if (e.stat === 'oji') {
          if (targetId === actorId) dOjiSum += delta;
          const d = ensureDelta(targetId);
          d.oji = Math.max(0, d.oji + delta);
        }
      }
      if (dCharmSum) lastAction.charm = dCharmSum;
      if (dOjiSum) lastAction.oji = dOjiSum;
      logAction?.('event', `play: ${act.name}`);
    } else {
      logAction?.('event', 'play: 手札にアクションが見つからないため無視');
    }
  } else if (data.action === ACTIONS.skip) {
    lastAction.type = ACTIONS.skip;
  }

  game.fieldById[actorId] = field;

  // Turn end skills for the acting player (minimal: self add only)
  let turnEndInfo = null;
  try {
    const fieldAct = game.fieldById?.[actorId] ?? { humans: [] };
    const byId = game._cardsById || buildCardIndex(state.cardsByType);
    const ensureDelta = (id) => (game._actionDeltasById[id] ||= { charm: 0, oji: 0 });
    let eCharm = 0; let eOji = 0;
    for (const h of Array.isArray(fieldAct.humans) ? fieldAct.humans : []) {
      const humanDef = h?.id ? byId.get(h.id) : null;
      const skills = Array.isArray(humanDef?.skills) ? humanDef.skills : [];
      for (const sk of skills) {
        const triggers = Array.isArray(sk?.triggers) ? sk.triggers : [];
        if (!triggers.includes('onTurnEnd')) continue;
        const effects = Array.isArray(sk?.effects) ? sk.effects : [];
        for (const e of effects) {
          if (!e || e.op !== 'add') continue;
          const delta = Number(e.value) || 0;
          if (!delta) continue;
          const targetSelf = !e.target || e.target === 'self';
          if (!targetSelf) continue;
          const d = ensureDelta(actorId);
          if (e.stat === 'charm') { d.charm = Math.max(0, d.charm + delta); eCharm += delta; }
          if (e.stat === 'oji') { d.oji = Math.max(0, d.oji + delta); eOji += delta; }
        }
      }
    }
    if (eCharm || eOji) turnEndInfo = { actorId, charm: eCharm || 0, oji: eOji || 0 };
  } catch {}

  // advance half/round and switch turn owner (2 players)
  const members2 = members; // keep reference stable for readability
  const opponent2 = opponent;
  if (half === 0) {
    game.half = 1;
    game.turnOwner = opponent2;
    game.roundStarter = actorId;
  } else {
    if (round >= TOTAL_TURNS) {
      phase = 'ended';
      round = TOTAL_TURNS;
    } else {
      round += 1;
    }
    game.half = 0;
    game.turnOwner = opponent2;
    game.roundStarter = opponent2;
  }

  game.round = round;
  let turnStartInfo = null;

  // Turn start skills for the next turn owner (minimal: self add only)
  if (phase !== 'ended') {
    try {
      const pid = game.turnOwner;
      const fieldP = game.fieldById?.[pid] ?? { humans: [] };
      const byId = game._cardsById || buildCardIndex(state.cardsByType);
      const ensureDelta = (id) => (game._actionDeltasById[id] ||= { charm: 0, oji: 0 });
      let tCharm = 0; let tOji = 0;
      for (const h of Array.isArray(fieldP.humans) ? fieldP.humans : []) {
        const humanDef = h?.id ? byId.get(h.id) : null;
        const skills = Array.isArray(humanDef?.skills) ? humanDef.skills : [];
        for (const sk of skills) {
          const triggers = Array.isArray(sk?.triggers) ? sk.triggers : [];
          if (!triggers.includes('onTurnStart')) continue;
          const effects = Array.isArray(sk?.effects) ? sk.effects : [];
          for (const e of effects) {
            if (!e || e.op !== 'add') continue;
            const delta = Number(e.value) || 0;
            if (!delta) continue;
            const targetSelf = !e.target || e.target === 'self';
            if (!targetSelf) continue;
            const d = ensureDelta(pid);
            if (e.stat === 'charm') { d.charm = Math.max(0, d.charm + delta); tCharm += delta; }
            if (e.stat === 'oji') { d.oji = Math.max(0, d.oji + delta); tOji += delta; }
          }
        }
      }
      if (tCharm || tOji) {
        turnStartInfo = { actorId: pid, charm: tCharm || 0, oji: tOji || 0 };
      }
    } catch {}

    // draw one for next turn owner
    drawCard(game.turnOwner, game);
  }

  // SWITCH: recompute scores from field + accumulated action deltas (source of truth)
  try {
    const byId = game._cardsById || buildCardIndex(state.cardsByType);
    for (const pid of members2) {
      const fieldP = game.fieldById?.[pid] ?? { humans: [] };
      const f = scoreField(fieldP, byId);
      const d = game._actionDeltasById?.[pid] ?? { charm: 0, oji: 0 };
      const fin = { charm: (f.charm || 0) + (d.charm || 0), oji: (f.oji || 0) + (d.oji || 0) };
      fin.total = fin.charm + fin.oji;
      game.scoresById[pid] = fin;
    }
  } catch {}

  const players = buildPlayers(game, members2);
  publishState({ round, turnOwner: game.turnOwner, players, phase, roundHalf: game.half, lastAction, turnStart: turnStartInfo, turnEnd: turnEndInfo });
}
