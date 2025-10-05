import { TOTAL_TURNS, MAX_DECORATIONS_PER_HUMAN, HAND_SIZE, ACTIONS } from '../constants.js';
import { buildPlayers } from '../utils/players.js';
import { buildDeck, drawCard } from '../utils/deck.js';

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
    round: 1,
    turnOwner: hostId,
    roundStarter: hostId,
    half: 0,
    scoresById: {},
    fieldById: {},
    decksById: {},
    handsById: {},
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
    let idx = -1;
    if (data.cardId) idx = hand.findIndex((c) => c?.id === data.cardId);
    if (idx < 0) idx = hand.findIndex((c) => c?.type === 'human');
    if (idx >= 0) {
      const humanCard = hand.splice(idx, 1)[0];
      if (humanCard?.type === 'human') {
        field.humans.push({ id: humanCard.id, name: humanCard.name, decorations: [] });
        logAction?.('event', `summon: ${humanCard.name}`);
        lastAction.cardName = humanCard.name;
        // fixed MVP scoring (existing behavior)
        scores.charm += 1;
      } else {
        hand.splice(idx, 0, humanCard);
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
        let idx = -1;
        if (data.cardId) idx = hand.findIndex((c) => c?.id === data.cardId);
        if (idx < 0) idx = hand.findIndex((c) => c?.type === 'decoration');
        if (idx >= 0) {
          const deco = hand.splice(idx, 1)[0];
          decorations.push({ id: deco.id, name: deco.name });
          target.decorations = decorations;
          // per-card adjustment (default charm +1, oji +0)
          const dCharm = Number.isFinite(deco?.charm) ? Number(deco.charm) : 1;
          const dOji = 0;
          scores.charm += dCharm;
          scores.oji += dOji;
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
    let idx = -1;
    if (data.cardId) idx = hand.findIndex((c) => c?.id === data.cardId);
    if (idx < 0) idx = hand.findIndex((c) => c?.type === 'action');
    if (idx >= 0) {
      const act = hand.splice(idx, 1)[0];
      lastAction.cardName = act.name;
      // Note: existing behavior adds +1 to both charm and oji here
      scores.charm += 1;
      scores.oji += 1;
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
        } else if (e.stat === 'oji') {
          tScores.oji = Math.max(0, tScores.oji + delta);
          if (targetId === actorId) dOjiSum += delta;
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

  // finalize actor score (existing behavior: overwrite after effects)
  scores.total = scores.charm + scores.oji;
  game.scoresById[actorId] = scores;

  const players = buildPlayers(game, members2);
  publishState({ round, turnOwner: game.turnOwner, players, phase, roundHalf: game.half, lastAction });
}
