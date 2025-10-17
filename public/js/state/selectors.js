// Minimal selectors (Phase 1: behavior-invariant)
// Pure helpers to derive frequently used values from snapshot-like data.

import { computeDisplayRound } from '../utils/turn.js';

export function selectPlayersArray(state, snapshot) {
  if (state && Array.isArray(state.playerOrder) && state.playersById && typeof state.playersById === 'object') {
    return state.playerOrder.map((id) => state.playersById[id]).filter(Boolean);
  }
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  return players;
}

export function selectMeOpp(players = [], myId) {
  const me = players.find((p) => p?.clientId === myId) ?? players[0] ?? null;
  const opp = players.find((p) => p?.clientId && p.clientId !== myId) ?? players[1] ?? null;
  return { me, opp };
}

export function selectDeckCounts(players = [], myId) {
  const { me, opp } = selectMeOpp(players, myId);
  return {
    selfDeck: Number.isFinite(me?.deckCount) ? me.deckCount : 0,
    oppDeck: Number.isFinite(opp?.deckCount) ? opp.deckCount : 0,
  };
}

export function selectScoresForMe(players = [], myId) {
  const { me } = selectMeOpp(players, myId);
  const s = me?.scores ?? { charm: 0, oji: 0, total: undefined };
  return {
    charm: Number.isFinite(s.charm) ? s.charm : 0,
    oji: Number.isFinite(s.oji) ? s.oji : 0,
    total: Number.isFinite(s.total) ? s.total : undefined,
  };
}

export function selectDisplayRound({ snapshot, state, myId }) {
  const phase = snapshot?.phase ?? 'in-round';
  const round = Number.isFinite(snapshot?.round) ? snapshot.round : state.turn;
  const turnOwner = snapshot?.turnOwner ?? null;
  const myTurn = !!(turnOwner && myId && turnOwner === myId);
  const roundHalf = Number.isFinite(snapshot?.roundHalf) ? snapshot.roundHalf : 0;
  return computeDisplayRound({ phase, round, myTurn, roundHalf });
}

export function selectMeOppFrom(state, snapshot, myId) {
  const arr = selectPlayersArray(state, snapshot);
  return selectMeOpp(arr, myId);
}

export function selectDeckCountsFrom(state, snapshot, myId) {
  const arr = selectPlayersArray(state, snapshot);
  return selectDeckCounts(arr, myId);
}
