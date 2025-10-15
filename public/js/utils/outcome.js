// Endgame text composition (Phase 1: behavior-invariant)
// Builds notice/log strings identical to current wording/order.

export function getEndgameTexts({ result, me, opp, myId }) {
  const pMy = Number.isFinite(me?.scores?.total) ? me.scores.total : 0;
  const pOpp = Number.isFinite(opp?.scores?.total) ? opp.scores.total : 0;

  if (!result || typeof result !== 'object') {
    return { notice: 'ゲーム終了', log: null };
  }

  if (result.type === 'draw') {
    const notice = `ゲーム終了：引き分け（${pMy} - ${pOpp}）`;
    const log = `結果：引き分け（${pMy} - ${pOpp}）`;
    return { notice, log };
  }

  if (result.type === 'win') {
    const mine = !!(result.winnerId && myId && result.winnerId === myId);
    const notice = `ゲーム終了：${mine ? 'あなたの勝ち' : 'あなたの負け'}（${pMy} - ${pOpp}）`;
    const log = `結果：${mine ? '勝ち' : '負け'}（${pMy} - ${pOpp}）`;
    return { notice, log };
  }

  return { notice: 'ゲーム終了', log: null };
}

