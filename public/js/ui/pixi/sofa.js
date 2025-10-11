// ソファ（横から見た側面）をPixi.Graphicsで描画するモジュール
// 公開API: mountSofa({ PIXI, app, layers, spec? })

let sofaNode = null;
let mounted = false;

export async function mountSofa({ PIXI, app, layers, spec = {} }) {
  if (!PIXI || !app || !layers) return null;
  if (mounted && sofaNode) return sofaNode;

  const defaults = {
    // 配置: キャンバス高さに対する“座面上端の基準線”の割合
    baselineYRate: 0.58,
    // 微調整: 基準線のピクセルオフセット（+で下へ, -で上へ）
    baselineOffset: 0,
    // 縦方向のみのスケール（1=等倍、0.8で縦を20%圧縮）
    heightScale: 1,
    // リファレンス寸法（scale=1で描くサイズ）
    ref: { w: 900, backH: 130, seatH: 100, armW: 90, armH: 150, radius: 28 },
    // 色（ラウンジ系の落ち着いた赤）
    colors: {
      back: 0x7f2a33,
      backShade: 0x6c232a,
      seat: 0x8b2f38,
      seatShade: 0x73262e,
      arm: 0x7a2730,
      stitch: 0xb94b56,
      button: 0x571e25,
      base: 0x5d1e25,
    },
    tuft: { rows: 2, cols: 6, r: 6, alpha: 0.9 },
  };
  const cfg = merge(defaults, spec);

  // 既存ノードがあれば破棄
  if (sofaNode) {
    try { (layers.bg || layers.root)?.removeChild(sofaNode); } catch {}
    try { sofaNode.destroy({ children: true }); } catch {}
    sofaNode = null;
  }

  sofaNode = new PIXI.Container();
  sofaNode.interactive = false;
  sofaNode.interactiveChildren = false;

  const R = cfg.ref;

  // 背もたれ
  const back = new PIXI.Graphics();
  back.beginFill(cfg.colors.back)
      .drawRoundedRect(-R.w / 2, -R.backH, R.w, R.backH, R.radius)
      .endFill();
  // 背もたれの陰影帯
  const backShade = new PIXI.Graphics();
  backShade.beginFill(cfg.colors.backShade, 0.65)
          .drawRoundedRect(-R.w / 2, -R.backH * 0.35, R.w, R.backH * 0.2, R.radius)
          .endFill();
  // タフティング（くるみボタン）
  const tuft = new PIXI.Graphics();
  tuft.beginFill(cfg.colors.button, cfg.tuft.alpha);
  for (let i = 0; i < cfg.tuft.cols; i++) {
    const tx = -R.w * 0.42 + (i * (R.w * 0.84)) / (cfg.tuft.cols - 1);
    for (let j = 0; j < cfg.tuft.rows; j++) {
      const ty = -R.backH * (0.7 - j * 0.28);
      tuft.drawCircle(tx, ty, cfg.tuft.r);
    }
  }
  tuft.endFill();

  // 座面
  const seat = new PIXI.Graphics();
  seat.beginFill(cfg.colors.seat)
      .drawRoundedRect(-R.w / 2, 0, R.w, R.seatH, R.radius * 0.7)
      .endFill();
  const seatShade = new PIXI.Graphics();
  seatShade.beginFill(cfg.colors.seatShade, 0.6)
           .drawRoundedRect(-R.w / 2, R.seatH * 0.45, R.w, R.seatH * 0.25, R.radius * 0.6)
           .endFill();

  // ひじ掛け
  const armL = new PIXI.Graphics();
  armL.beginFill(cfg.colors.arm)
      .drawRoundedRect(-R.w / 2 - R.armW * 0.1, -R.armH * 0.25, R.armW, R.armH, R.radius)
      .endFill();
  const armR = new PIXI.Graphics();
  armR.beginFill(cfg.colors.arm)
      .drawRoundedRect(R.w / 2 - R.armW * 0.9, -R.armH * 0.25, R.armW, R.armH, R.radius)
      .endFill();

  // ベース（座面の下に薄い帯）
  const base = new PIXI.Graphics();
  base.beginFill(cfg.colors.base)
      .drawRoundedRect(-R.w / 2, R.seatH + 8, R.w, 14, 8)
      .endFill();

  // 描画順: 背もたれ → 陰影 → ボタン → ひじ掛け → 座面 → 座面陰影 → ベース
  sofaNode.addChild(back, backShade, tuft, armL, armR, seat, seatShade, base);

  // 背景レイヤーに追加
  (layers.bg || layers.root || app.stage).addChild(sofaNode);

  // レイアウト + リスナー
  positionSofa({ app, node: sofaNode, cfg });
  const onLayout = () => positionSofa({ app, node: sofaNode, cfg });
  window.addEventListener('resize', onLayout);
  window.addEventListener('scroll', onLayout, { passive: true });

  mounted = true;
  return sofaNode;
}

export function positionSofa({ app, node, cfg }) {
  if (!app || !node) return;
  const w = app.renderer.width;
  const h = app.renderer.height;

  // 横幅基準でスケール（左右に5%の余白を確保）。縦は heightScale を掛ける
  const maxW = Math.min(w * 0.95, 1200);
  const scaleX = clamp(0.5, 1.2, maxW / cfg.ref.w);
  const scaleY = scaleX * (cfg.heightScale ?? 1);
  node.scale.set(scaleX, scaleY);

  node.x = Math.floor(w / 2);
  node.y = Math.floor(h * cfg.baselineYRate + (cfg.baselineOffset || 0));
}

function clamp(min, max, v) { return Math.max(min, Math.min(max, v)); }
function merge(a, b) { const o = { ...a }; for (const k in b) { const v = b[k]; o[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] || {}, v) : v; } return o; }
