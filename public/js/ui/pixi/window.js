// 大きな窓と夜景（ソファのさらに背面）
// 公開API: mountWindow({ PIXI, app, layers, spec? })

let windowNode = null;
let mounted = false;
let TowerLib = null;

export async function mountWindow({ PIXI, app, layers, spec = {} }) {
  if (!PIXI || !app || !layers) return null;
  if (mounted && windowNode) return windowNode;

  const defaults = {
    // キャンバス内の余白（窓枠の外側余白）
    inset: 14,
    // 窓枠の太さと角丸
    frame: { thickness: 12, radius: 8, color: 0x0e2a36, mullion: 0x134252, mullionAlpha: 0.7 },
    // ガラス内側の余白
    glassPadding: 6,
    // 窓サイズの最大幅比（キャンバス幅に対する％）
    maxWidthRate: 0.88,
    // 空の色（上→下）
    skyTop: 0x0a1622,
    skyBottom: 0x0e2430,
    // ビル群の色（遠景/近景）
    far: 0x0f2532,
    near: 0x153447,
    // 桟（縦横の本数）
    mullions: { cols: 2, rows: 1, thickness: 6 },
    // 位置
    centerYRate: 0.38,
    // 地平線（ガラス下端からの余白率）。ビルの“足元”をここに揃える
    groundOffsetRate: 0.18,
    // 東京タワー（簡易シルエット）の表示設定
    tokyoTower: {
      enabled: true,
      xRate: 0.72,        // ガラス幅に対するX位置の割合（0.0 左端, 1.0 右端）
      heightRate: 0.78,   // ガラス高さに対する最大高さ
      baseWidthRate: 0.11,// 台座の横幅（ガラス幅比）
      body: 0xff5d2e,     // 本体色（夜のオレンジ）
      edge: 0xffd4b0,     // 縁ハイライト色
      edgeAlpha: 0.35,
      deck: 0x1a2a36,     // 展望台の暗色
      deckAlpha: 0.9,
      glow: 0xfff2cc,
      glowAlpha: 0.08,
      // 点滅（航空障害灯）
      blink: { enabled: true, speedHz: 1.2, min: 0.05, max: 0.22 },
      // デッキの明かり（控えめなチラつき）
      lights: { enabled: true, base: 0.10, amp: 0.10, speedHz: 0.8 },
    },
  };
  const cfg = merge(defaults, spec);

  if (windowNode) {
    try { (layers.sky || layers.root)?.removeChild(windowNode); } catch {}
    try { windowNode.destroy({ children: true }); } catch {}
    windowNode = null;
  }

  windowNode = new PIXI.Container();
  windowNode.interactive = false;
  windowNode.interactiveChildren = false;

  (layers.sky || layers.root || app.stage).addChild(windowNode);

  // 初期レイアウト
  positionWindow({ PIXI, app, node: windowNode, cfg });
  const onLayout = () => positionWindow({ PIXI, app, node: windowNode, cfg });
  window.addEventListener('resize', onLayout);
  window.addEventListener('scroll', onLayout, { passive: true });

  // 東京タワーモジュールを読み込み、アニメーション設定
  try {
    TowerLib = await import('./tokyo-tower.js');
    TowerLib.setupTowerAnimation({ app, windowNode, cfg });
    // 再レイアウトで東京タワーも描画されるように一度呼び直す
    positionWindow({ PIXI, app, node: windowNode, cfg });
  } catch {}

  mounted = true;
  return windowNode;
}

function positionWindow({ PIXI, app, node, cfg }) {
  const w = app.renderer.width;
  const h = app.renderer.height;

  // サイズ計算
  const maxW = Math.min(w * cfg.maxWidthRate, 1400);
  const glassW = Math.floor(maxW - cfg.inset * 2 - cfg.frame.thickness * 2);
  const glassH = Math.floor(Math.min(h * 0.54, glassW * 0.42)); // 横長の比率
  const totalW = glassW + cfg.frame.thickness * 2;
  const totalH = glassH + cfg.frame.thickness * 2;

  node.removeChildren();

  // ガラス面（グラデーション）
  const glass = makeSkySprite({ PIXI, w: glassW, h: glassH, top: cfg.skyTop, bottom: cfg.skyBottom });
  glass.x = -glassW / 2;
  glass.y = -glassH / 2;

  // クリップ用マスク（ガラス内で切り抜く）
  const mask = new PIXI.Graphics();
  const innerR = Math.max(6, cfg.frame.radius * 0.7);
  mask.beginFill(0xffffff, 1).drawRoundedRect(-glassW/2, -glassH/2, glassW, glassH, innerR).endFill();

  // 都市ビュー（マスクを適用）
  const city = new PIXI.Container();
  city.name = 'city';
  city.mask = mask;

  // ビル群（単純な矩形群）: 画面上端からはみ出さないようにトリミング
  const topMargin = Math.max(10, Math.round(glassH * 0.04));
  // ガラスの下端から少し上に“地平線”を設定（ここにビルの底辺を揃える）
  const groundY = glassH / 2 - Math.max(8, Math.round(glassH * cfg.groundOffsetRate));

  const far = new PIXI.Graphics();
  far.beginFill(cfg.far, 1);
  const blocks = [
    [0.06, 0.22], [0.14, 0.26], [0.22, 0.18], [0.32, 0.30], [0.44, 0.22], [0.56, 0.28], [0.68, 0.18], [0.8, 0.26]
  ];
  for (const [x, hRate] of blocks) {
    const bw = Math.floor(glassW * 0.06);
    const bh = Math.floor(glassH * hRate);
    const xPos = -glassW/2 + Math.floor(glassW * x);
    const yTop = Math.max(-glassH/2 + topMargin, groundY - bh);
    far.drawRect(xPos, yTop, bw, bh);
  }
  far.endFill();

  const near = new PIXI.Graphics();
  near.beginFill(cfg.near, 1);
  const blocks2 = [
    [0.1, 0.18], [0.2, 0.24], [0.36, 0.16], [0.5, 0.26], [0.66, 0.2], [0.82, 0.22]
  ];
  for (const [x, hRate] of blocks2) {
    const bw = Math.floor(glassW * 0.08);
    const bh = Math.floor(glassH * hRate);
    const xPos = -glassW/2 + Math.floor(glassW * x);
    const yTop = Math.max(-glassH/2 + topMargin, groundY - bh + 8);
    near.drawRect(xPos, yTop, bw, bh);
  }
  near.endFill();

  // 東京タワー（必要なら描画）
  let tower = null;
  if (cfg.tokyoTower?.enabled && TowerLib?.createTower) {
    try {
      tower = TowerLib.createTower({ PIXI, glassW, glassH, topMargin, groundY, cfg: cfg.tokyoTower });
    } catch {}
  }

  // ハイライト（ガラスの反射風）
  const highlight = new PIXI.Graphics();
  highlight.beginFill(0xffffff, 0.05)
           .drawRoundedRect(-glassW/2 + 8, -glassH/2 + 8, glassW * 0.28, glassH * 0.18, 10)
           .endFill();

  // 窓枠（穴あきの角丸）
  const frame = new PIXI.Graphics();
  frame.beginFill(cfg.frame.color, 1);
  frame.drawRoundedRect(-totalW/2, -totalH/2, totalW, totalH, cfg.frame.radius);
  frame.beginHole();
  frame.drawRoundedRect(-glassW/2, -glassH/2, glassW, glassH, Math.max(6, cfg.frame.radius * 0.7));
  frame.endHole();
  frame.endFill();

  // 桟（縦横に分割線）
  const bars = new PIXI.Graphics();
  bars.beginFill(cfg.frame.mullion, cfg.frame.mullionAlpha);
  const mt = cfg.mullions.thickness;
  // 縦
  for (let i = 1; i < cfg.mullions.cols; i++) {
    const x = -glassW/2 + Math.round((glassW * i) / cfg.mullions.cols) - mt/2;
    bars.drawRect(x, -glassH/2 + cfg.glassPadding, mt, glassH - cfg.glassPadding * 2);
  }
  // 横
  for (let j = 1; j < cfg.mullions.rows; j++) {
    const y = -glassH/2 + Math.round((glassH * j) / cfg.mullions.rows) - mt/2;
    bars.drawRect(-glassW/2 + cfg.glassPadding, y, glassW - cfg.glassPadding * 2, mt);
  }
  bars.endFill();

  // city に要素を追加（マスク内に収める）
  if (tower) city.addChild(far, near, tower, mask);
  else city.addChild(far, near, mask);

  // 追加順序: ガラス → ハイライト → 都市ビュー（マスク済み） → 枠 → 桟
  node.addChild(glass, highlight, city, frame, bars);

  // 位置
  node.x = Math.floor(w / 2);
  node.y = Math.floor(h * cfg.centerYRate);
}

function makeSkySprite({ PIXI, w, h, top, bottom }) {
  // 簡易グラデーション用にCanvasを使ってテクスチャ化
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, w);
  canvas.height = Math.max(2, h);
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, hex(top));
  g.addColorStop(1, hex(bottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = PIXI.Texture.from(canvas);
  const sp = new PIXI.Sprite(tex);
  return sp;
}

function hex(n) {
  const s = (n >>> 0).toString(16).padStart(6, '0');
  return `#${s}`;
}

function merge(a, b) { const o = { ...a }; for (const k in b) { const v = b[k]; o[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] || {}, v) : v; } return o; }

// 東京タワー（簡易シルエット）を作成して返す
