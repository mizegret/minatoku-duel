// Pixi renderer (hybrid): center canvas only（何も描かない）

let pixiApp = null;
let pixiRoot = null;
let layers = null; // minimal layer placeholders
let anchorUpdater = null; // fn to keep canvas aligned to .board
let pixiLoadPromise = null; // single-flight loader for UMD script
let pixiInitPromise = null; // single-flight initializer for Application
let PIXI_NS = null; // holds ESM or UMD namespace
let layoutPrepared = false;
// Table is managed by table.js

async function loadPixi() {
  if (PIXI_NS) return PIXI_NS;
  if (window.PIXI) { PIXI_NS = window.PIXI; return PIXI_NS; }
  if (pixiLoadPromise) return pixiLoadPromise;

  // Try ESM first (no globals). Fallback to UMD if blocked.
  pixiLoadPromise = (async () => {
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/pixi.js@7/dist/pixi.mjs');
      PIXI_NS = mod;
      return PIXI_NS;
    } catch (e) {
      // UMD fallback
      await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-pixi="v7"]');
        if (existing) {
          existing.addEventListener('load', resolve);
          existing.addEventListener('error', reject);
        } else {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/pixi.js@7/dist/pixi.min.js';
          s.async = true;
          s.crossOrigin = 'anonymous';
          s.dataset.pixi = 'v7';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        }
      });
      PIXI_NS = window.PIXI || null;
      return PIXI_NS;
    }
  })();
  return pixiLoadPromise;
}

async function ensurePixi() {
  if (pixiApp) return pixiApp;
  if (pixiInitPromise) return pixiInitPromise;
  pixiInitPromise = (async () => {
    const PIXI = await loadPixi();
    
    // Anchor canvas to #canvas-center (center panel)
    function ensureRoot() {
      const host = document.getElementById('canvas-center') || (document.querySelector('main') || document.body);
      const existing = document.getElementById('pixi-root');
      pixiRoot = existing || document.createElement('div');
      pixiRoot.id = 'pixi-root';
      Object.assign(pixiRoot.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
      });
      if (!existing) host.appendChild(pixiRoot);
      const updateAnchor = () => {
        const r = host.getBoundingClientRect();
        const w = Math.max(1, Math.floor(r.width));
        const h = Math.max(1, Math.floor(r.height));
        if (pixiApp) pixiApp.renderer.resize(w, h);
      };
      updateAnchor();
      window.addEventListener('resize', updateAnchor);
      window.addEventListener('scroll', updateAnchor, { passive: true });
      anchorUpdater = updateAnchor;
    }
    ensureRoot();

    pixiApp = new PIXI.Application({
      width: Math.max(1, pixiRoot.clientWidth || 800),
      height: Math.max(1, pixiRoot.clientHeight || 600),
      antialias: true,
      backgroundAlpha: 0,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    pixiRoot.appendChild(pixiApp.view);

  // Minimal stage setup（空のコンテナのみ）
    layers = { root: new PIXI.Container(), bg: new PIXI.Container(), table: new PIXI.Container() };
    pixiApp.stage.addChild(layers.root);
    // z-order: bg (sofa etc) behind table
    layers.root.addChild(layers.bg);
    layers.root.addChild(layers.table);

    // Mount background sofa first, then the table
    try {
      const sofa = await import('./sofa.js');
      await sofa.mountSofa({
        PIXI,
        app: pixiApp,
        layers,
        spec: {
          // Slightly lower seam line and compress vertical height
          baselineYRate: 0.66,
          baselineOffset: 8, // px: ほんの少しだけ下げる
          heightScale: 0.82,
        },
      });
    } catch {}
    try {
      const table = await import('./table.js');
      await table.mountFullTable({ PIXI, app: pixiApp, layers });
    } catch {}

    // Force initial anchor sizing right after creation
    try { anchorUpdater && anchorUpdater(); } catch {}

    return pixiApp;
  })();
  return pixiInitPromise;
}

// --- Public UI API (Pixi is the board; DOM shows HUD) ---

export function renderGame(state) {
  void ensurePixi();
  prepareLayoutOnce();
  // Update left-hand via DOM（ハイブリッド）
  try { renderHandDOM(state?.self?.hand || []); } catch {}
  // Canvas は描画なし（今は空）
}

export function updateScores({ charm, oji, total }) {
  const c = document.getElementById('score-charm');
  const o = document.getElementById('score-oji');
  const t = document.getElementById('score-total');
  if (c) c.textContent = String(charm ?? 0);
  if (o) o.textContent = String(oji ?? 0);
  const fallback = (charm ?? 0) + (oji ?? 0);
  if (t) t.textContent = String(total ?? fallback);
}
export function updateTurnIndicator(turn, total) {
  const el = document.getElementById('turn-indicator');
  if (el) el.textContent = `ターン ${turn} / ${total}`;
}
export function updateDeckCounts(selfCount = 0, oppCount = 0) {
  const a = document.getElementById('deck-self-count');
  const b = document.getElementById('deck-opponent-count');
  if (a) a.textContent = String(selfCount);
  if (b) b.textContent = String(oppCount);
}
export function renderLog(log = []) {
  const el = document.getElementById('log-vertical') || document.getElementById('action-log');
  if (!el) return;
  if (!Array.isArray(log) || log.length === 0) {
    el.innerHTML = '<div class="log-entry">まだ行動がありません</div>';
    return;
  }
  el.innerHTML = log
    .map(({ type, message, at }) => {
      const time = new Date(at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      return `<div class="log-entry action-${type}"><span>${message}</span><time>${time}</time></div>`;
    })
    .join('');
}
export function setActionButtonsDisabled(disabled) {
  const btn = document.getElementById('action-skip');
  if (btn) btn.disabled = !!disabled;
}
export function updateHandInteractivity(isMyTurn, actionLocked) {
  const hand = document.getElementById('hand-self');
  if (!hand) return;
  if (isMyTurn && !actionLocked) hand.classList.remove('disabled');
  else hand.classList.add('disabled');
}

export function updateStartUI(_isHost) {
  void ensurePixi();
  prepareLayoutOnce();
}

export function init(context) {
  ctx = context || null;
}

// --- drawScene: 現状は何も描かない（将来席やアニメを追加）
function drawScene(_state) { /* no-op */ }

function prepareLayoutOnce() {
  if (layoutPrepared) return;
  layoutPrepared = true;
  try {
    document.body.classList.add('pixi-hybrid');
    // Hide DOM fields (center is Pixi)
    const fs = document.getElementById('field-self');
    const fo = document.getElementById('field-opponent');
    if (fs) fs.style.display = 'none';
    if (fo) fo.style.display = 'none';
    // Hide bottom log; we use right vertical log instead
    const bottomLog = document.getElementById('action-log');
    if (bottomLog) bottomLog.style.display = 'none';
    // CSS Gridで高さを100vhに収めるため、JSによる高さ固定は不要
  } catch {}
}

function renderHandDOM(cards) {
  const target = document.getElementById('hand-self');
  if (!target) return;
  target.innerHTML = '';
  const frag = document.createDocumentFragment();
  cards.forEach((card) => {
    const cardEl = document.createElement('div');
    cardEl.className = `card card-${card.type || 'unknown'}`;
    cardEl.textContent = card.name || '';
    cardEl.dataset.cardId = card.id || '';
    cardEl.dataset.cardType = card.type || '';
    cardEl.dataset.cardName = card.name || '';
    frag.appendChild(cardEl);
  });
  target.appendChild(frag);
}

// Table drawing moved to table.js
