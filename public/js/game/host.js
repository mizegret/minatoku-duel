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
    _actionDeltasById: {}, // M3: accumulate play() deltas for verification only
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

  // base score bucket
  const scores = game.scoresById[actorId] ?? { charm: 0, oji: 0, total: 0 };

  // A5: score helper
  function applyScoreDelta(s, { charm = 0, oji = 0 } = {}) {
    s.charm = (s.charm || 0) + charm;
    s.oji = (s.oji || 0) + oji;
    s.total = s.charm + s.oji;
    return s;
  }

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
        if (Number.isFinite(humanCard?.baseCharm)) humanOnField.baseCharm = Number(humanCard.baseCharm);
        field.humans.push(humanOnField);
        logAction?.('event', `summon: ${humanCard.name}`);
        lastAction.cardName = humanCard.name;
        // M4: use SCORE_RULES (same result as before)
        applyScoreDelta(scores, { charm: Number(SCORE_RULES?.summon?.charm) || 1 });
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
          // M4: per-card adjustment via SCORE_RULES (matches previous behavior)
          const dCharm = (SCORE_RULES?.decorate?.useCardCharm && Number.isFinite(deco?.charm))
            ? Number(deco.charm)
            : Number(SCORE_RULES?.decorate?.defaultCharm ?? 1);
          const dOji = Number(SCORE_RULES?.decorate?.defaultOji ?? 0);
          applyScoreDelta(scores, { charm: dCharm, oji: dOji });
          lastAction.cardName = deco.name;
          lastAction.charm = dCharm;
          lastAction.oji = dOji;
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
      // M4: base from SCORE_RULES (same as +1/+1)
      applyScoreDelta(scores, {
        charm: Number(SCORE_RULES?.play?.baseCharm ?? 1),
        oji: Number(SCORE_RULES?.play?.baseOji ?? 1),
      });
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
        const tScores = game.scoresById[targetId] ?? { charm: 0, oji: 0, total: 0 };
        if (e.stat === 'charm') {
          tScores.charm = Math.max(0, tScores.charm + delta);
          if (targetId === actorId) dCharmSum += delta;
          // M3 aggregate
          const d = ensureDelta(targetId);
          d.charm = Math.max(0, d.charm + delta);
        } else if (e.stat === 'oji') {
          tScores.oji = Math.max(0, tScores.oji + delta);
          if (targetId === actorId) dOjiSum += delta;
          const d = ensureDelta(targetId);
          d.oji = Math.max(0, d.oji + delta);
        }
        tScores.total = tScores.charm + tScores.oji;
        game.scoresById[targetId] = tScores;
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

  // draw one for next turn owner unless ended
  if (phase !== 'ended') {
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
  publishState({ round, turnOwner: game.turnOwner, players, phase, roundHalf: game.half, lastAction });
}
