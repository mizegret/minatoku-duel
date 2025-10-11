// 東京タワーをPixiで描く小モジュール
// 公開API:
// - createTower({ PIXI, glassW, glassH, topMargin, groundY, cfg }): PIXI.Container
// - setupTowerAnimation({ app, windowNode, cfg }): tickerを設定（点滅/照明のゆらぎ）

export function createTower({ PIXI, glassW, glassH, topMargin, groundY, cfg }) {
  const g = new PIXI.Container();
  g.name = 'tokyoTower';

  const x = -glassW / 2 + Math.floor(glassW * (cfg.xRate ?? 0.7));
  const maxH = Math.floor(glassH * (cfg.heightRate ?? 0.78));
  const baseW = Math.floor(glassW * (cfg.baseWidthRate ?? 0.1));
  const topW = Math.max(6, Math.floor(baseW * 0.2));
  let topY = groundY - maxH;
  const minTop = -glassH / 2 + Math.max(6, topMargin);
  if (topY < minTop) topY = minTop;

  // 下半身は2段の台形で“くびれ”を作る
  const yMid = topY + Math.floor((groundY - topY) * 0.55);
  const midW = Math.floor(baseW * 0.58);

  const body1 = new PIXI.Graphics();
  body1.beginFill(cfg.body ?? 0xff5d2e, 1)
       .drawPolygon([
         x - baseW / 2, groundY,
         x + baseW / 2, groundY,
         x + midW / 2, yMid,
         x - midW / 2, yMid,
       ])
       .endFill();

  const body2 = new PIXI.Graphics();
  body2.beginFill(cfg.body ?? 0xff5d2e, 1)
       .drawPolygon([
         x - midW / 2, yMid,
         x + midW / 2, yMid,
         x + topW / 2, topY,
         x - topW / 2, topY,
       ])
       .endFill();

  // スパイア
  const spireH = Math.floor(maxH * 0.14);
  const spireW = Math.max(3, Math.floor(topW * 0.25));
  const spireTop = Math.max(minTop, topY - spireH);
  const spire = new PIXI.Graphics();
  spire.beginFill(cfg.body ?? 0xff5d2e, 1)
       .drawRoundedRect(x - spireW / 2, spireTop, spireW, (topY - spireTop), 2)
       .endFill();

  // 白帯（東京タワーらしさ）
  const stripes = cfg.stripes ?? { color: 0xfffaf2, alpha: 0.85, bands: [0.18, 0.34, 0.58] };
  const white = new PIXI.Graphics();
  white.beginFill(stripes.color, stripes.alpha);
  for (const fr of stripes.bands) {
    const y = topY + Math.floor((groundY - topY) * fr);
    const w = lerp(topW, baseW, fr);
    const h = Math.max(4, Math.floor(glassH * 0.012));
    white.drawRoundedRect(x - w / 2, y - h / 2, w, h, 2);
  }
  white.endFill();

  // 展望台（2段）
  const deckColor = cfg.deck ?? 0x1a2a36;
  const deckAlpha = cfg.deckAlpha ?? 0.9;
  const deck1Y = topY + Math.floor((groundY - topY) * 0.42);
  const deck2Y = topY + Math.floor((groundY - topY) * 0.18);
  const deck1W = Math.floor(baseW * 0.62);
  const deck2W = Math.floor(baseW * 0.36);
  const deckH = Math.max(6, Math.floor(glassH * 0.012));
  const deck1 = new PIXI.Graphics();
  deck1.beginFill(deckColor, deckAlpha)
       .drawRoundedRect(x - deck1W / 2, deck1Y - deckH / 2, deck1W, deckH, 4)
       .endFill();
  const deck2 = new PIXI.Graphics();
  deck2.beginFill(deckColor, deckAlpha)
       .drawRoundedRect(x - deck2W / 2, deck2Y - deckH / 2, deck2W, deckH, 4)
       .endFill();

  // デッキ照明（点列）
  const lights = new PIXI.Container();
  lights.name = 'towerLights';
  if (cfg.lights?.enabled !== false) {
    const addLine = (y, width, count) => {
      const r = Math.max(1.5, Math.floor(deckH * 0.28));
      for (let i = 0; i < count; i++) {
        const t = (i + 1) / (count + 1);
        const dot = new PIXI.Graphics();
        dot.beginFill(cfg.glow ?? 0xfff2cc, (cfg.lights?.base ?? 0.1))
           .drawCircle(x - width / 2 + Math.floor(width * t), y, r)
           .endFill();
        lights.addChild(dot);
      }
    };
    addLine(deck1Y, deck1W * 0.86, Math.max(6, Math.floor(deck1W / 50)));
    addLine(deck2Y, deck2W * 0.8, Math.max(4, Math.floor(deck2W / 40)));
  }

  // 縁ハイライト
  const edge = new PIXI.Graphics();
  edge.lineStyle(2, cfg.edge ?? 0xffd4b0, cfg.edgeAlpha ?? 0.35)
      .moveTo(x - baseW / 2 + 2, groundY)
      .lineTo(x - topW / 2 + 1, topY);

  // 頂部のグロー（点滅対象）
  const glow = new PIXI.Graphics();
  glow.name = 'towerGlow';
  glow.beginFill(cfg.glow ?? 0xfff2cc, cfg.glowAlpha ?? 0.08)
      .drawCircle(x, spireTop - 4, Math.max(4, Math.floor(glassH * 0.012)))
      .endFill();

  g.addChild(body1, body2, spire, white, deck1, deck2, lights, edge, glow);
  return g;
}

export function setupTowerAnimation({ app, windowNode, cfg }) {
  const blinkCfg = cfg?.tokyoTower?.blink || { enabled: true, speedHz: 1.2, min: 0.05, max: 0.22 };
  const lightsCfg = cfg?.tokyoTower?.lights || { enabled: true, base: 0.1, amp: 0.1, speedHz: 0.8 };
  if (!blinkCfg.enabled && !lightsCfg.enabled) return;

  let t = 0;
  const tick = (delta) => {
    t += delta / 60;
    const city = windowNode.children?.find?.(c => c.name === 'city');
    const tower = city?.children?.find?.(c => c.name === 'tokyoTower');
    if (!tower) return;
    if (blinkCfg.enabled) {
      const glow = tower.children?.find?.(c => c.name === 'towerGlow');
      if (glow) {
        const f = Math.max(0.1, blinkCfg.speedHz || 1.2);
        const min = Math.max(0, blinkCfg.min ?? 0.05);
        const max = Math.max(min, blinkCfg.max ?? 0.22);
        const s = (Math.sin(2 * Math.PI * f * t) + 1) / 2;
        glow.alpha = min + (max - min) * s;
      }
    }
    if (lightsCfg.enabled) {
      const lights = tower.children?.find?.(c => c.name === 'towerLights');
      if (lights) {
        const f2 = Math.max(0.1, lightsCfg.speedHz || 0.8);
        const base = Math.max(0, lightsCfg.base ?? 0.1);
        const amp = Math.max(0, lightsCfg.amp ?? 0.1);
        for (let i = 0; i < lights.children.length; i++) {
          const dot = lights.children[i];
          const phase = i * 0.7;
          const s2 = (Math.sin(2 * Math.PI * f2 * t + phase) + 1) / 2;
          dot.alpha = base + amp * s2;
        }
      }
    }
  };
  app.ticker.add(tick);
}

function lerp(a, b, t) { return a + (b - a) * t; }

