// Pixi adapter UI (P1): draw board with Pixi, DOM shows headers/scores/logs.
// Default renderer when no query param is provided.

let pixiApp = null;
let pixiRoot = null;
let layers = null; // { fieldSelf, fieldOpp }
let anchorUpdater = null; // fn to keep canvas aligned to .board
let pixiLoadPromise = null; // single-flight loader for UMD script
let pixiInitPromise = null; // single-flight initializer for Application
let PIXI_NS = null; // holds ESM or UMD namespace
let layoutPrepared = false;

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

  // Layers (field only)
    layers = {
      fieldSelf: new PIXI.Container(),
      fieldOpp: new PIXI.Container(),
    };
    pixiApp.stage.addChild(layers.fieldOpp, layers.fieldSelf);

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
  // Update left-hand via DOM (hybrid mode)
  try { renderHandDOM(state?.self?.hand || []); } catch {}
  try { drawScene(state); } catch {}
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

// --- drawing & interactions ---

function makeRect(PIXI, { x, y, w, h, color = 0x4aa3b5, label, onClick }) {
  const g = new PIXI.Graphics();
  g.lineStyle(2, color, 0.9);
  g.drawRoundedRect(x, y, w, h, 10);
  if (onClick) {
    g.eventMode = 'static';
    g.cursor = 'pointer';
    g.on('pointertap', onClick);
  }
  if (label && (PIXI.Text)) {
    const t = new PIXI.Text(String(label), { fill: 0xbfe8ef, fontSize: 13, fontFamily: 'sans-serif', align: 'center', wordWrap: true, wordWrapWidth: w - 12 });
    t.anchor.set(0.5, 0.5);
    t.x = x + w / 2;
    t.y = y + h / 2;
    g.addChild(t);
  }
  return g;
}

function colorForType(type) {
  if (type === 'human') return 0xd9534f; // red-ish
  if (type === 'decoration') return 0x5bc0de; // cyan-ish
  if (type === 'action') return 0x5cb85c; // green-ish
  return 0x777777;
}

function drawScene(state) {
  if (!pixiApp || !layers) return;
  const PIXI = PIXI_NS || window.PIXI;
  const W = pixiApp.renderer.width;
  const H = pixiApp.renderer.height;
  const pad = 16;
  const gap = 12;

  // clear (canvas draws fields only)
  layers.fieldSelf.removeChildren();
  layers.fieldOpp.removeChildren();

  // Center canvas: two field panes
  let Rfs, Rfo;
  Rfs = { x: pad, y: pad, w: Math.floor((W - pad * 3) / 2), h: H - pad * 2 };
  Rfo = { x: Rfs.x + Rfs.w + pad, y: pad, w: W - pad * 2 - Rfs.w - pad, h: H - pad * 2 };

  layers.fieldSelf.position.set(Rfs.x, Rfs.y);
  layers.fieldOpp.position.set(Rfo.x, Rfo.y);

  // Optional debug: board outline (disabled by default)
  // const frame = new PIXI.Graphics();
  // frame.lineStyle(2, 0xff00aa, 0.4);
  // frame.drawRoundedRect(1, 1, Math.max(2, W - 2), Math.max(2, H - 2), 10);
  // layers.fieldSelf.addChild(frame);

  // No hand or log rendering in canvas (handled by DOM)

  // Self field (center-left)
  const humans = Array.isArray(state?.self?.field?.humans) ? state.self.field.humans : [];
  const fcols = Math.max(1, humans.length);
  const fw = Math.max(100, Math.floor((Rfs.w - gap * (fcols - 1)) / fcols));
  const fh = Math.min(120, Math.max(60, Rfs.h - 10));
  humans.forEach((h, i) => {
    const x = i * (fw + gap);
    const y = Math.max(0, Math.floor((Rfs.h - fh) / 2));
    const rect = makeRect(PIXI, { x, y, w: fw, h: fh, color: colorForType('human'), label: h?.name || 'human' });
    layers.fieldSelf.addChild(rect);
  });

  // Opp field (center-right)
  const oppHumans = Array.isArray(state?.opponent?.field?.humans) ? state.opponent.field.humans : [];
  const oc = Math.max(1, oppHumans.length);
  const ofw = Math.max(100, Math.floor((Rfo.w - gap * (oc - 1)) / oc));
  const ofh = Math.min(120, Math.max(60, Rfo.h - 10));
  oppHumans.forEach((h, i) => {
    const x = i * (ofw + gap);
    const y = Math.max(0, Math.floor((Rfo.h - ofh) / 2));
    const rect = makeRect(PIXI, { x, y, w: ofw, h: ofh, color: 0x8888aa, label: h?.name || 'opponent' });
    layers.fieldOpp.addChild(rect);
  });

  // no waiting overlay
}

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
