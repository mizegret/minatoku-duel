// Apply host-authoritative state snapshots to UI and local state
// Phase 1: behavior-invariant extraction from app.js

import { TOTAL_TURNS } from '../constants.js';
import { state, dispatch } from '../state.js';
import { formatLastAction, formatDeltaParts } from '../utils/turn.js';
import { getEndgameTexts } from '../utils/outcome.js';
import { lockActions, unlockActions, logAction, shouldLog } from '../ui/actions.js';
import { buildTurnKey, buildStartKey, buildActionKey, buildEndKey } from '../utils/log.js';
import { selectDisplayRound, selectDeckCountsFrom, selectMeOppFrom } from '../state/selectors.js';

export function applyStateSnapshot(snapshot, { UI, getClientId, setNotice }) {
  try {
    dispatch({ type: 'STATE_APPLIED', snapshot, getClientId });
    const myId = getClientId?.();
    const displayRound = selectDisplayRound({ snapshot, state, myId });
    UI.updateTurnIndicator(displayRound, TOTAL_TURNS);
    const { selfDeck, oppDeck } = selectDeckCountsFrom(state, snapshot, myId);
    UI.updateDeckCounts(selfDeck, oppDeck);
    UI.updateScores(state.scores);
    UI.renderGame(state);

    // 通知とアクション制御
    if (phase === 'ended' || phase === 'game-over' || round > TOTAL_TURNS) {
      lockActions(UI);
      const { me, opp } = selectMeOppFrom(state, snapshot, myId);
      const { notice, log } = getEndgameTexts({ result: snapshot?.result, me, opp, myId });
      setNotice(notice);
      if (log) logAction('state', log);
    } else if (myTurn) {
      unlockActions(UI);
      setNotice('あなたのターン!!');
      const turnKey = buildTurnKey(round, turnOwner || '');
      if (shouldLog('turnMsg', turnKey)) logAction('event', `あなたのターン（ラウンド ${displayRound}）`);
      const ts = snapshot?.turnStart;
      if (ts && (Number.isFinite(ts.charm) || Number.isFinite(ts.oji))) {
        const startKey = buildStartKey(round, turnOwner || '', { charm: ts.charm || 0, oji: ts.oji || 0 });
        if (shouldLog('turnStart', startKey)) {
          const parts = formatDeltaParts({ charm: ts.charm, oji: ts.oji });
          if (parts.length) logAction('event', `あなた：スキル発動（開始時） ${parts.join(' / ')}`);
        }
      }
    } else {
      lockActions(UI);
      if (turnOwner) {
        setNotice('相手のターンです…');
        const oppTurnKey = buildTurnKey(round, turnOwner || '');
        if (shouldLog('turnMsg', oppTurnKey)) logAction('event', '相手のターンです…');
        const ts = snapshot?.turnStart;
        if (ts && (Number.isFinite(ts.charm) || Number.isFinite(ts.oji))) {
          const startKey = buildStartKey(round, turnOwner || '', { charm: ts.charm || 0, oji: ts.oji || 0 });
          if (shouldLog('turnStart', startKey)) {
            const parts = formatDeltaParts({ charm: ts.charm, oji: ts.oji });
            if (parts.length) logAction('event', `相手：スキル発動（開始時） ${parts.join(' / ')}`);
          }
        }
      }
    }

    // 行動ログ（権威のみ、重複防止）
    const la = snapshot?.lastAction;
    if (la && la.type) {
      const actorIsMe = !!(la.actorId && la.actorId === myId);
      const actorLabel = actorIsMe ? 'あなた' : '相手';
      const msg = formatLastAction(la, actorLabel);
      const aKey = buildActionKey(round, Number.isFinite(snapshot?.roundHalf) ? snapshot.roundHalf : 0, la);
      if (msg && shouldLog('action', aKey)) logAction('move', msg);
    }

    // ターン終了時スキル（直近行動の後ろに出す、重複防止）
    const te = snapshot?.turnEnd;
    if (te && (Number.isFinite(te.charm) || Number.isFinite(te.oji))) {
      const mine = !!(te.actorId && te.actorId === myId);
      const eKey = buildEndKey(round, te);
      if (shouldLog('turnEnd', eKey)) {
        const parts = formatDeltaParts({ charm: te.charm, oji: te.oji });
        if (parts.length) logAction('event', `${mine ? 'あなた' : '相手'}：スキル発動（終了時） ${parts.join(' / ')}`);
      }
    }
  } catch (e) {
    console.warn('[state] failed to apply snapshot', e);
    logAction('state', 'スナップショット適用に失敗しました');
  }
}
