// Minimal reducer for STATE_APPLIED (Phase 1: behavior-invariant)
// Produces a state patch and derived values consumed by UI updates.

import { computeDisplayRound } from '../utils/turn.js';
import { selectMeOpp } from './selectors.js';
import { normalizePlayers } from '../utils/players.js';

export function reduceStateApplied({ state, snapshot, getClientId }) {
  const phase = snapshot?.phase ?? 'in-round';
  const round = Number.isFinite(snapshot?.round) ? snapshot.round : state.turn;
  const roundHalf = Number.isFinite(snapshot?.roundHalf) ? snapshot.roundHalf : 0;
  const turnOwner = snapshot?.turnOwner ?? null;
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];

  const myId = typeof getClientId === 'function' ? getClientId() : null;
  const { me, opp } = selectMeOpp(players, myId);

  const myTurn = !!(turnOwner && myId && turnOwner === myId);
  const displayRound = computeDisplayRound({ phase, round, myTurn, roundHalf });

  const scoresSrc = me?.scores ?? { charm: 0, oji: 0, total: undefined };
  const scores = {
    charm: Number.isFinite(scoresSrc.charm) ? scoresSrc.charm : 0,
    oji: Number.isFinite(scoresSrc.oji) ? scoresSrc.oji : 0,
    total: Number.isFinite(scoresSrc.total) ? scoresSrc.total : undefined,
  };

  const patch = {};
  patch.turn = displayRound;
  patch.isMyTurn = !!myTurn;
  patch.scores = scores;
  if (me) {
    patch.self = {
      hand: Array.isArray(me.hand) ? me.hand : [],
      field: me.field && Array.isArray(me.field?.humans) ? { humans: me.field.humans } : { humans: [] },
    };
  }
  if (opp) {
    patch.opponent = {
      hand: Array.isArray(opp.hand) ? opp.hand : [],
      field: opp.field && Array.isArray(opp.field?.humans) ? { humans: opp.field.humans } : { humans: [] },
    };
  }

  const deckCounts = {
    selfDeck: Number.isFinite(me?.deckCount) ? me.deckCount : 0,
    oppDeck: Number.isFinite(opp?.deckCount) ? opp.deckCount : 0,
  };

  // Add normalized players (backward-compatible; consumers may ignore)
  const norm = normalizePlayers(players);
  patch.playersById = norm.byId;
  patch.playerOrder = norm.order;

  return {
    patch,
    derived: { phase, round, roundHalf, turnOwner, displayRound, myId, me, opp, deckCounts },
  };
}

// Host helpers (Phase 1: pure helpers, no side effects)
import { buildCardIndex, scoreField } from '../utils/score.js';

export function hostAdvanceTurn({ game, actorId, members, totalTurns }) {
  const opponent = members.find((id) => id && id !== actorId) || actorId;
  const half = typeof game.half === 'number' ? game.half : 0;
  let round = game.round || 1;
  let phase = 'in-round';
  if (half === 0) {
    return { round, phase, half: 1, turnOwner: opponent, roundStarter: actorId };
  }
  if (round >= totalTurns) {
    phase = 'ended';
  } else {
    round += 1;
  }
  return { round, phase, half: 0, turnOwner: opponent, roundStarter: opponent };
}

export function hostRecomputeScores({ game, cardsByType, members }) {
  const byId = game._cardsById || buildCardIndex(cardsByType);
  const result = {};
  for (const pid of members) {
    const fieldP = game.fieldById?.[pid] ?? { humans: [] };
    const f = scoreField(fieldP, byId);
    const d = game._actionDeltasById?.[pid] ?? { charm: 0, oji: 0 };
    const fin = { charm: (f.charm || 0) + (d.charm || 0), oji: (f.oji || 0) + (d.oji || 0) };
    fin.total = fin.charm + fin.oji;
    result[pid] = fin;
  }
  return result;
}
