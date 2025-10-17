// Minimal store (Phase 1: behavior-invariant wrapper)
// - Holds a single state object reference (mutated shallowly for PATCH)
// - Dispatch returns changedKeys; subscribers get notified with (changedKeys, state)

export function createStore(initialState = {}, reducer = null) {
  let state = initialState;
  const subs = new Set();

  function getState() { return state; }

  function computeChangedKeys(patch) {
    const changed = [];
    for (const [k, v] of Object.entries(patch || {})) {
      if (state[k] !== v) changed.push(k);
    }
    return changed;
  }

  function applyPatch(patch) {
    const changed = computeChangedKeys(patch);
    if (changed.length) {
      for (const k of changed) state[k] = patch[k];
    }
    return changed;
  }

  function dispatch(action) {
    let patch = null;
    if (typeof reducer === 'function') {
      try { patch = reducer(state, action) || null; } catch { patch = null; }
    }
    if (!patch && action && action.type === 'PATCH') {
      patch = action.patch || null;
    }
    const changedKeys = patch && typeof patch === 'object' ? applyPatch(patch) : [];
    if (changedKeys.length) {
      // Notify subscribers synchronously; outer layers can queue if needed
      subs.forEach((fn) => { try { fn(changedKeys, state); } catch {} });
    }
    return { changedKeys };
  }

  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

  return { getState, dispatch, subscribe };
}

